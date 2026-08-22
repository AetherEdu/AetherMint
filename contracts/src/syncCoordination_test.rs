#![cfg(test)]

use crate::syncCoordination::{
    ConflictResolution, Device, DeviceType, SyncConflict, SyncCoordinationContract,
    SyncCoordinationKey, SyncEntry, SyncSession, SyncStatus,
};
use soroban_sdk::{testutils::Address as _, vec, Address, Env, String, Vec};

#[test]
fn test_initialize() {
    let env = Env::default();
    let admin = Address::generate(&env);

    // Test successful initialization
    SyncCoordinationContract::initialize(env.clone(), admin.clone());

    // Verify admin is set
    let stored_admin: Address = env
        .storage()
        .instance()
        .get(&SyncCoordinationKey::Admin)
        .unwrap();
    assert_eq!(stored_admin, admin);

    // Verify counters are initialized
    assert_eq!(SyncCoordinationContract::get_device_count(env.clone()), 0);
    assert_eq!(SyncCoordinationContract::get_entry_count(env.clone()), 0);
    assert_eq!(SyncCoordinationContract::get_conflict_count(env.clone()), 0);
    assert_eq!(SyncCoordinationContract::get_session_count(env.clone()), 0);

    // Test double initialization fails
    let result = std::panic::catch_unwind(|| {
        SyncCoordinationContract::initialize(env, admin);
    });
    assert!(result.is_err());
}

#[test]
fn test_register_device() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    // Initialize contract
    SyncCoordinationContract::initialize(env.clone(), admin);

    // Register a mobile device
    let device_id = SyncCoordinationContract::register_device(
        env.clone(),
        user.clone(),
        DeviceType::Mobile,
        String::from_str(&env, "iPhone 14"),
        vec![
            &env,
            String::from_str(&env, "read"),
            String::from_str(&env, "write"),
        ],
    );

    // Verify device was created
    let device = SyncCoordinationContract::get_device(env.clone(), device_id.clone());
    assert_eq!(device.id, device_id);
    assert_eq!(device.user_address, user);
    assert!(matches!(device.device_type, DeviceType::Mobile));
    assert_eq!(device.name, String::from_str(&env, "iPhone 14"));
    assert_eq!(device.is_active, true);
    assert_eq!(device.sync_version, 1);

    // Verify device is in user's device list
    let user_devices = SyncCoordinationContract::get_user_devices(env, user);
    assert!(user_devices.contains(&device_id));

    // Verify device count increased
    assert_eq!(SyncCoordinationContract::get_device_count(env), 1);
}

#[test]
fn test_start_sync_session() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    // Initialize contract
    SyncCoordinationContract::initialize(env.clone(), admin);

    // Register a device first
    let device_id = SyncCoordinationContract::register_device(
        env.clone(),
        user.clone(),
        DeviceType::Desktop,
        String::from_str(&env, "Work Laptop"),
        vec![&env],
    );

    // Start sync session
    let session_id =
        SyncCoordinationContract::start_sync_session(env.clone(), user.clone(), device_id.clone());

    // Verify session was created
    let session = SyncCoordinationContract::get_sync_session(env.clone(), session_id.clone());
    assert_eq!(session.id, session_id);
    assert_eq!(session.user_address, user);
    assert_eq!(session.device_id, device_id);
    assert!(matches!(session.status, SyncStatus::InProgress));
    assert_eq!(session.entries_synced, 0);
    assert_eq!(session.conflicts_resolved, 0);

    // Verify device last_seen was updated
    let device = SyncCoordinationContract::get_device(env, device_id);
    assert!(device.last_seen > 0);

    // Verify session count increased
    assert_eq!(SyncCoordinationContract::get_session_count(env), 1);
}

#[test]
fn test_submit_sync_entry() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    // Initialize contract
    SyncCoordinationContract::initialize(env.clone(), admin);

    // Register device and start session
    let device_id = SyncCoordinationContract::register_device(
        env.clone(),
        user.clone(),
        DeviceType::Web,
        String::from_str(&env, "Browser"),
        vec![&env],
    );

    let session_id =
        SyncCoordinationContract::start_sync_session(env.clone(), user.clone(), device_id.clone());

    // Submit sync entry
    let entry_id = SyncCoordinationContract::submit_sync_entry(
        env.clone(),
        session_id.clone(),
        device_id.clone(),
        String::from_str(&env, "course_progress"),
        String::from_str(&env, "hash123"),
        String::from_str(&env, "progress_data"),
    );

    // Verify entry was created
    let entry = SyncCoordinationContract::get_sync_entry(env.clone(), entry_id.clone());
    assert_eq!(entry.id, entry_id);
    assert_eq!(entry.user_address, user);
    assert_eq!(entry.device_id, device_id);
    assert_eq!(entry.data_type, String::from_str(&env, "course_progress"));
    assert_eq!(entry.data_hash, String::from_str(&env, "hash123"));
    assert!(matches!(entry.sync_status, SyncStatus::Completed));

    // Verify session was updated
    let session = SyncCoordinationContract::get_sync_session(env, session_id);
    assert_eq!(session.entries_synced, 1);

    // Verify entry count increased
    assert_eq!(SyncCoordinationContract::get_entry_count(env), 1);
}

#[test]
fn test_resolve_conflict_last_write_wins() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    // Initialize contract
    SyncCoordinationContract::initialize(env.clone(), admin);

    // Create a conflict (simplified - in real scenario would be detected during sync)
    let conflict_id = String::from_str(&env, "conflict_1");

    // Test last-write-wins resolution
    let result = SyncCoordinationContract::resolve_conflict(
        env.clone(),
        conflict_id.clone(),
        ConflictResolution::LastWriteWins,
        String::from_str(&env, "entry_1"),
        admin.clone(),
    );

    assert!(result);

    // Verify conflict was resolved
    let conflict = SyncCoordinationContract::get_sync_conflict(env, conflict_id);
    assert_eq!(conflict.resolution, Some(ConflictResolution::LastWriteWins));
    assert_eq!(conflict.resolved_by, Some(admin));
    assert_eq!(
        conflict.winning_entry_id,
        Some(String::from_str(&env, "entry_1"))
    );
}

#[test]
fn test_resolve_conflict_first_write_wins() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    // Initialize contract
    SyncCoordinationContract::initialize(env.clone(), admin);

    let conflict_id = String::from_str(&env, "conflict_2");

    // Test first-write-wins resolution
    let result = SyncCoordinationContract::resolve_conflict(
        env.clone(),
        conflict_id.clone(),
        ConflictResolution::FirstWriteWins,
        String::from_str(&env, "entry_1"),
        admin.clone(),
    );

    assert!(result);

    let conflict = SyncCoordinationContract::get_sync_conflict(env, conflict_id);
    assert_eq!(
        conflict.resolution,
        Some(ConflictResolution::FirstWriteWins)
    );
}

#[test]
fn test_resolve_conflict_timestamp_wins() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    // Initialize contract
    SyncCoordinationContract::initialize(env.clone(), admin);

    let conflict_id = String::from_str(&env, "conflict_3");

    // Test timestamp-wins resolution
    let result = SyncCoordinationContract::resolve_conflict(
        env.clone(),
        conflict_id.clone(),
        ConflictResolution::TimestampWins,
        String::from_str(&env, "entry_1"),
        admin.clone(),
    );

    assert!(result);

    let conflict = SyncCoordinationContract::get_sync_conflict(env, conflict_id);
    assert_eq!(conflict.resolution, Some(ConflictResolution::TimestampWins));
}

#[test]
fn test_resolve_conflict_manual_review() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    // Initialize contract
    SyncCoordinationContract::initialize(env.clone(), admin);

    let conflict_id = String::from_str(&env, "conflict_4");

    // Test manual review resolution
    let result = SyncCoordinationContract::resolve_conflict(
        env.clone(),
        conflict_id.clone(),
        ConflictResolution::ManualReview,
        String::from_str(&env, "entry_1"),
        admin.clone(),
    );

    assert!(result);

    let conflict = SyncCoordinationContract::get_sync_conflict(env, conflict_id);
    assert_eq!(conflict.resolution, Some(ConflictResolution::ManualReview));

    // Verify entry is marked as pending
    let entry = SyncCoordinationContract::get_sync_entry(env, String::from_str(&env, "entry_1"));
    assert!(matches!(entry.sync_status, SyncStatus::Pending));
}

#[test]
fn test_complete_sync_session() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    // Initialize contract
    SyncCoordinationContract::initialize(env.clone(), admin);

    // Register device and start session
    let device_id = SyncCoordinationContract::register_device(
        env.clone(),
        user.clone(),
        DeviceType::Tablet,
        String::from_str(&env, "iPad"),
        vec![&env],
    );

    let session_id =
        SyncCoordinationContract::start_sync_session(env.clone(), user.clone(), device_id.clone());

    // Complete session successfully
    let result = SyncCoordinationContract::complete_sync_session(
        env.clone(),
        session_id.clone(),
        true, // success
        None, // no error
    );

    assert!(result);

    // Verify session was completed
    let session = SyncCoordinationContract::get_sync_session(env, session_id);
    assert!(matches!(session.status, SyncStatus::Completed));
    assert!(session.completed_at.is_some());
    assert!(session.error_message.is_none());

    // Verify device last_sync was updated
    let device = SyncCoordinationContract::get_device(env, device_id);
    assert!(device.last_sync > device.last_seen);
    assert_eq!(device.sync_version, 2);
}

#[test]
fn test_complete_sync_session_with_error() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    // Initialize contract
    SyncCoordinationContract::initialize(env.clone(), admin);

    // Register device and start session
    let device_id = SyncCoordinationContract::register_device(
        env.clone(),
        user.clone(),
        DeviceType::Mobile,
        String::from_str(&env, "Android Phone"),
        vec![&env],
    );

    let session_id =
        SyncCoordinationContract::start_sync_session(env.clone(), user.clone(), device_id.clone());

    // Complete session with error
    let error_message = String::from_str(&env, "Network timeout");
    let result = SyncCoordinationContract::complete_sync_session(
        env.clone(),
        session_id.clone(),
        false, // failed
        Some(error_message.clone()),
    );

    assert!(result);

    // Verify session was marked as failed
    let session = SyncCoordinationContract::get_sync_session(env, session_id);
    assert!(matches!(session.status, SyncStatus::Failed));
    assert_eq!(session.error_message, Some(error_message));
}

#[test]
fn test_deactivate_device() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    // Initialize contract
    SyncCoordinationContract::initialize(env.clone(), admin);

    // Register device
    let device_id = SyncCoordinationContract::register_device(
        env.clone(),
        user.clone(),
        DeviceType::Desktop,
        String::from_str(&env, "Work Computer"),
        vec![&env],
    );

    // Verify device is active
    let device = SyncCoordinationContract::get_device(env.clone(), device_id.clone());
    assert!(device.is_active);

    // Deactivate device
    let result =
        SyncCoordinationContract::deactivate_device(env.clone(), user.clone(), device_id.clone());
    assert!(result);

    // Verify device is now inactive
    let deactivated_device = SyncCoordinationContract::get_device(env, device_id);
    assert!(!deactivated_device.is_active);
}

#[test]
fn test_update_device_capabilities() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    // Initialize contract
    SyncCoordinationContract::initialize(env.clone(), admin);

    // Register device
    let device_id = SyncCoordinationContract::register_device(
        env.clone(),
        user.clone(),
        DeviceType::Web,
        String::from_str(&env, "Chrome Browser"),
        vec![&env, String::from_str(&env, "read")],
    );

    // Update capabilities
    let new_capabilities = vec![
        &env,
        String::from_str(&env, "read"),
        String::from_str(&env, "write"),
        String::from_str(&env, "delete"),
    ];
    let result = SyncCoordinationContract::update_device_capabilities(
        env.clone(),
        user.clone(),
        device_id.clone(),
        new_capabilities.clone(),
    );

    assert!(result);

    // Verify capabilities were updated
    let updated_device = SyncCoordinationContract::get_device(env, device_id);
    assert_eq!(updated_device.capabilities.len(), 3);
    assert!(updated_device
        .capabilities
        .contains(&String::from_str(&env, "delete")));
}

#[test]
fn test_get_user_devices() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    // Initialize contract
    SyncCoordinationContract::initialize(env.clone(), admin);

    // Register multiple devices
    let device1_id = SyncCoordinationContract::register_device(
        env.clone(),
        user.clone(),
        DeviceType::Mobile,
        String::from_str(&env, "iPhone"),
        vec![&env],
    );

    let device2_id = SyncCoordinationContract::register_device(
        env.clone(),
        user.clone(),
        DeviceType::Desktop,
        String::from_str(&env, "Laptop"),
        vec![&env],
    );

    let device3_id = SyncCoordinationContract::register_device(
        env.clone(),
        user.clone(),
        DeviceType::Tablet,
        String::from_str(&env, "iPad"),
        vec![&env],
    );

    // Get user's devices
    let user_devices = SyncCoordinationContract::get_user_devices(env, user);
    assert_eq!(user_devices.len(), 3);
    assert!(user_devices.contains(&device1_id));
    assert!(user_devices.contains(&device2_id));
    assert!(user_devices.contains(&device3_id));

    // Verify device count
    assert_eq!(SyncCoordinationContract::get_device_count(env), 3);
}

#[test]
fn test_get_user_sync_history() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    // Initialize contract
    SyncCoordinationContract::initialize(env.clone(), admin);

    // Register device and create sync sessions
    let device_id = SyncCoordinationContract::register_device(
        env.clone(),
        user.clone(),
        DeviceType::Mobile,
        String::from_str(&env, "Test Device"),
        vec![&env],
    );

    // Create multiple sync sessions
    let session1_id =
        SyncCoordinationContract::start_sync_session(env.clone(), user.clone(), device_id.clone());
    SyncCoordinationContract::complete_sync_session(env.clone(), session1_id, true, None);

    let session2_id =
        SyncCoordinationContract::start_sync_session(env.clone(), user.clone(), device_id.clone());
    SyncCoordinationContract::complete_sync_session(env.clone(), session2_id, true, None);

    // Get sync history (simplified implementation)
    let history = SyncCoordinationContract::get_user_sync_history(env, user.clone(), 10);

    // In production, this would return actual session IDs
    // For now, we just verify the function exists and returns a Vec
    assert!(history.is_empty()); // Simplified implementation returns empty
}

#[test]
fn test_get_user_conflicts() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    // Initialize contract
    SyncCoordinationContract::initialize(env.clone(), admin);

    // Get user conflicts (simplified implementation)
    let conflicts = SyncCoordinationContract::get_user_conflicts(env, user);

    // In production, this would return actual conflict IDs
    // For now, we just verify the function exists and returns a Vec
    assert!(conflicts.is_empty()); // Simplified implementation returns empty
}

#[test]
#[should_panic(expected = "Device does not belong to user")]
fn test_unauthorized_device_access() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    // Initialize contract
    SyncCoordinationContract::initialize(env.clone(), admin);

    // Register device for user1
    let device_id = SyncCoordinationContract::register_device(
        env.clone(),
        user1,
        DeviceType::Mobile,
        String::from_str(&env, "Phone"),
        vec![&env],
    );

    // Try to deactivate device with different user (should panic)
    SyncCoordinationContract::deactivate_device(env, user2, device_id);
}

#[test]
#[should_panic(expected = "Device is not active")]
fn test_sync_inactive_device() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    // Initialize contract
    SyncCoordinationContract::initialize(env.clone(), admin);

    // Register device
    let device_id = SyncCoordinationContract::register_device(
        env.clone(),
        user.clone(),
        DeviceType::Mobile,
        String::from_str(&env, "Phone"),
        vec![&env],
    );

    // Deactivate device
    SyncCoordinationContract::deactivate_device(env.clone(), user.clone(), device_id.clone());

    // Try to start sync session with inactive device (should panic)
    SyncCoordinationContract::start_sync_session(env, user, device_id);
}

#[test]
#[should_panic(expected = "Session is not active")]
fn test_complete_completed_session() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    // Initialize contract
    SyncCoordinationContract::initialize(env.clone(), admin);

    // Register device and start session
    let device_id = SyncCoordinationContract::register_device(
        env.clone(),
        user.clone(),
        DeviceType::Mobile,
        String::from_str(&env, "Phone"),
        vec![&env],
    );

    let session_id =
        SyncCoordinationContract::start_sync_session(env.clone(), user.clone(), device_id.clone());

    // Complete session
    SyncCoordinationContract::complete_sync_session(env.clone(), session_id.clone(), true, None);

    // Try to complete same session again (should panic)
    SyncCoordinationContract::complete_sync_session(env, session_id, true, None);
}
