use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, String, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DeviceType {
    Mobile,
    Desktop,
    Tablet,
    Web,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SyncStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    Conflict,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ConflictResolution {
    LastWriteWins,
    ManualReview,
    MergeData,
    FirstWriteWins,
    TimestampWins,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Device {
    pub id: String,
    pub user_address: Address,
    pub device_type: DeviceType,
    pub name: String,
    pub last_sync: u64,
    pub is_active: bool,
    pub capabilities: Vec<String>, // e.g., ["read", "write", "delete"]
    pub created_at: u64,
    pub last_seen: u64,
    pub sync_version: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct SyncEntry {
    pub id: String,
    pub user_address: Address,
    pub device_id: String,
    pub data_type: String, // e.g., "course_progress", "settings", "bookmarks"
    pub data_hash: String, // Hash of the data being synced
    pub timestamp: u64,
    pub sync_status: SyncStatus,
    pub conflict_resolution: Option<ConflictResolution>,
    pub parent_entry_id: Option<String>, // For conflict resolution
    pub merged_with: Vec<String>,        // Entry IDs this was merged with
    pub payload: String,                 // Actual data (simplified - in production use IPFS)
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct SyncConflict {
    pub id: String,
    pub user_address: Address,
    pub entry_id_1: String,
    pub entry_id_2: String,
    pub conflict_type: String, // "timestamp", "data", "version"
    pub detected_at: u64,
    pub resolution: Option<ConflictResolution>,
    pub resolved_at: Option<u64>,
    pub resolved_by: Option<Address>, // Admin or automated
    pub winning_entry_id: Option<String>,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct SyncSession {
    pub id: String,
    pub user_address: Address,
    pub device_id: String,
    pub started_at: u64,
    pub completed_at: Option<u64>,
    pub status: SyncStatus,
    pub entries_synced: u64,
    pub conflicts_resolved: u64,
    pub error_message: Option<String>,
}

#[contracttype]
pub enum SyncCoordinationKey {
    Device(String),
    SyncEntry(String),
    SyncConflict(String),
    SyncSession(String),
    UserDevices(Address),
    DeviceCount,
    EntryCount,
    ConflictCount,
    SessionCount,
    Admin,
}

// Contract attribute disabled - this is a module used by main contract in lib.rs
// #[contract]
pub struct SyncCoordinationContract;

#[contractimpl]
impl SyncCoordinationContract {
    /// Initialize the sync coordination contract
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&SyncCoordinationKey::Admin) {
            panic!("Contract already initialized");
        }

        env.storage()
            .instance()
            .set(&SyncCoordinationKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&SyncCoordinationKey::DeviceCount, &0u64);
        env.storage()
            .instance()
            .set(&SyncCoordinationKey::EntryCount, &0u64);
        env.storage()
            .instance()
            .set(&SyncCoordinationKey::ConflictCount, &0u64);
        env.storage()
            .instance()
            .set(&SyncCoordinationKey::SessionCount, &0u64);
    }

    /// Register a new device for a user
    pub fn register_device(
        env: Env,
        user_address: Address,
        device_type: DeviceType,
        name: String,
        capabilities: Vec<String>,
    ) -> String {
        let device_count: u64 = env
            .storage()
            .instance()
            .get(&SyncCoordinationKey::DeviceCount)
            .unwrap_or(0);

        let device_id = crate::u64_to_string(&env, device_count + 1, "device_");
        let timestamp = env.ledger().timestamp();

        let device = Device {
            id: device_id.clone(),
            user_address: user_address.clone(),
            device_type,
            name,
            last_sync: 0,
            is_active: true,
            capabilities,
            created_at: timestamp,
            last_seen: timestamp,
            sync_version: 1,
        };

        env.storage()
            .instance()
            .set(&SyncCoordinationKey::Device(device_id.clone()), &device);
        env.storage()
            .instance()
            .set(&SyncCoordinationKey::DeviceCount, &(device_count + 1));

        // Add to user's device list
        let mut user_devices = Self::get_user_devices(env.clone(), user_address.clone());
        user_devices.push_back(device_id.clone());
        env.storage().instance().set(
            &SyncCoordinationKey::UserDevices(user_address),
            &user_devices,
        );

        device_id
    }

    /// Start a sync session
    pub fn start_sync_session(env: Env, user_address: Address, device_id: String) -> String {
        // Verify device exists and belongs to user
        let device = Self::get_device(env.clone(), device_id.clone());
        if device.user_address != user_address {
            panic!("Device does not belong to user");
        }

        if !device.is_active {
            panic!("Device is not active");
        }

        let session_count: u64 = env
            .storage()
            .instance()
            .get(&SyncCoordinationKey::SessionCount)
            .unwrap_or(0);

        let session_id = crate::u64_to_string(&env, session_count + 1, "session_");
        let timestamp = env.ledger().timestamp();

        let session = SyncSession {
            id: session_id.clone(),
            user_address: user_address.clone(),
            device_id: device_id.clone(),
            started_at: timestamp,
            completed_at: None,
            status: SyncStatus::InProgress,
            entries_synced: 0,
            conflicts_resolved: 0,
            error_message: None,
        };

        env.storage().instance().set(
            &SyncCoordinationKey::SyncSession(session_id.clone()),
            &session,
        );
        env.storage()
            .instance()
            .set(&SyncCoordinationKey::SessionCount, &(session_count + 1));

        // Update device last seen
        let mut updated_device = device;
        updated_device.last_seen = timestamp;
        env.storage()
            .instance()
            .set(&SyncCoordinationKey::Device(device_id), &updated_device);

        session_id
    }

    /// Submit a sync entry
    pub fn submit_sync_entry(
        env: Env,
        session_id: String,
        device_id: String,
        data_type: String,
        data_hash: String,
        payload: String,
    ) -> String {
        // Verify session exists and is active
        let session = Self::get_sync_session(env.clone(), session_id.clone());
        if session.status != SyncStatus::InProgress {
            panic!("Session is not active");
        }

        // Check for conflicts with existing entries
        let conflict_id = Self::check_for_conflicts(
            env.clone(),
            session.user_address.clone(),
            data_type.clone(),
            data_hash.clone(),
            env.ledger().timestamp(),
        );

        let entry_count: u64 = env
            .storage()
            .instance()
            .get(&SyncCoordinationKey::EntryCount)
            .unwrap_or(0);

        let entry_id = crate::u64_to_string(&env, entry_count + 1, "entry_");
        let timestamp = env.ledger().timestamp();

        let sync_entry = SyncEntry {
            id: entry_id.clone(),
            user_address: session.user_address.clone(),
            device_id: device_id.clone(),
            data_type: data_type.clone(),
            data_hash: data_hash.clone(),
            timestamp,
            sync_status: if conflict_id.is_some() {
                SyncStatus::Conflict
            } else {
                SyncStatus::Completed
            },
            conflict_resolution: None, // Will be set during conflict resolution
            parent_entry_id: None,
            merged_with: Vec::new(&env),
            payload,
        };

        env.storage().instance().set(
            &SyncCoordinationKey::SyncEntry(entry_id.clone()),
            &sync_entry,
        );
        env.storage()
            .instance()
            .set(&SyncCoordinationKey::EntryCount, &(entry_count + 1));

        // Update session
        let mut updated_session = session;
        updated_session.entries_synced += 1;
        if conflict_id.is_some() {
            updated_session.conflicts_resolved += 1;
        }
        env.storage().instance().set(
            &SyncCoordinationKey::SyncSession(session_id),
            &updated_session,
        );

        entry_id
    }

    /// Resolve a sync conflict using specified strategy
    pub fn resolve_conflict(
        env: Env,
        conflict_id: String,
        resolution: ConflictResolution,
        winning_entry_id: String,
        resolver: Address,
    ) -> bool {
        let mut conflict = Self::get_sync_conflict(env.clone(), conflict_id.clone());

        // Verify resolver is authorized (admin or conflict owner)
        let admin: Address = env
            .storage()
            .instance()
            .get(&SyncCoordinationKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));

        if resolver != admin && resolver != conflict.user_address {
            panic!("Not authorized to resolve this conflict");
        }

        // Apply resolution strategy
        match resolution {
            ConflictResolution::LastWriteWins => {
                Self::apply_last_write_wins(env.clone(), &conflict, winning_entry_id.clone());
            }
            ConflictResolution::FirstWriteWins => {
                Self::apply_first_write_wins(env.clone(), &conflict, winning_entry_id.clone());
            }
            ConflictResolution::TimestampWins => {
                Self::apply_timestamp_wins(env.clone(), &conflict, winning_entry_id.clone());
            }
            ConflictResolution::ManualReview => {
                Self::apply_manual_review(env.clone(), &conflict, winning_entry_id.clone());
            }
            ConflictResolution::MergeData => {
                Self::apply_merge_data(env.clone(), &conflict, winning_entry_id.clone());
            }
        }

        // Update conflict record
        conflict.resolution = Some(resolution.clone());
        conflict.resolved_at = Some(env.ledger().timestamp());
        conflict.resolved_by = Some(resolver.clone());
        conflict.winning_entry_id = Some(winning_entry_id);

        env.storage()
            .instance()
            .set(&SyncCoordinationKey::SyncConflict(conflict_id), &conflict);

        true
    }

    /// Complete a sync session
    pub fn complete_sync_session(
        env: Env,
        session_id: String,
        success: bool,
        error_message: Option<String>,
    ) -> bool {
        let mut session = Self::get_sync_session(env.clone(), session_id.clone());

        if session.status != SyncStatus::InProgress {
            panic!("Session is not in progress");
        }

        session.completed_at = Some(env.ledger().timestamp());
        session.status = if success {
            SyncStatus::Completed
        } else {
            SyncStatus::Failed
        };
        session.error_message = error_message;

        env.storage()
            .instance()
            .set(&SyncCoordinationKey::SyncSession(session_id), &session);

        // Update device last sync
        let mut device = Self::get_device(env.clone(), session.device_id.clone());
        device.last_sync = env.ledger().timestamp();
        device.sync_version += 1;
        env.storage()
            .instance()
            .set(&SyncCoordinationKey::Device(session.device_id), &device);

        true
    }

    /// Get device information
    pub fn get_device(env: Env, device_id: String) -> Device {
        env.storage()
            .instance()
            .get(&SyncCoordinationKey::Device(device_id))
            .unwrap_or_else(|| panic!("Device not found"))
    }

    /// Get sync session
    pub fn get_sync_session(env: Env, session_id: String) -> SyncSession {
        env.storage()
            .instance()
            .get(&SyncCoordinationKey::SyncSession(session_id))
            .unwrap_or_else(|| panic!("Sync session not found"))
    }

    /// Get sync entry
    pub fn get_sync_entry(env: Env, entry_id: String) -> SyncEntry {
        env.storage()
            .instance()
            .get(&SyncCoordinationKey::SyncEntry(entry_id))
            .unwrap_or_else(|| panic!("Sync entry not found"))
    }

    /// Get sync conflict
    pub fn get_sync_conflict(env: Env, conflict_id: String) -> SyncConflict {
        env.storage()
            .instance()
            .get(&SyncCoordinationKey::SyncConflict(conflict_id))
            .unwrap_or_else(|| panic!("Sync conflict not found"))
    }

    /// Get user's devices
    pub fn get_user_devices(env: Env, user_address: Address) -> Vec<String> {
        env.storage()
            .instance()
            .get(&SyncCoordinationKey::UserDevices(user_address))
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Get user's sync history
    pub fn get_user_sync_history(env: Env, _user_address: Address, _limit: u32) -> Vec<String> {
        // This is a simplified implementation
        // In production, you'd maintain an index by user and timestamp
        Vec::new(&env)
    }

    /// Get conflicts for user
    pub fn get_user_conflicts(env: Env, _user_address: Address) -> Vec<String> {
        // Simplified implementation
        // In production, maintain user conflict index
        Vec::new(&env)
    }

    /// Deactivate a device
    pub fn deactivate_device(env: Env, user_address: Address, device_id: String) -> bool {
        let mut device = Self::get_device(env.clone(), device_id.clone());

        if device.user_address != user_address {
            panic!("Device does not belong to user");
        }

        device.is_active = false;
        device.last_seen = env.ledger().timestamp();

        env.storage()
            .instance()
            .set(&SyncCoordinationKey::Device(device_id), &device);
        true
    }

    /// Update device capabilities
    pub fn update_device_capabilities(
        env: Env,
        user_address: Address,
        device_id: String,
        capabilities: Vec<String>,
    ) -> bool {
        let mut device = Self::get_device(env.clone(), device_id.clone());

        if device.user_address != user_address {
            panic!("Device does not belong to user");
        }

        device.capabilities = capabilities;
        device.last_seen = env.ledger().timestamp();

        env.storage()
            .instance()
            .set(&SyncCoordinationKey::Device(device_id), &device);
        true
    }

    /// Check for conflicts with existing entries
    fn check_for_conflicts(
        _env: Env,
        _user_address: Address,
        _data_type: String,
        _data_hash: String,
        _timestamp: u64,
    ) -> Option<String> {
        // Simplified conflict detection
        // In production, this would check against recent entries of same data type
        // For now, return no conflict
        None
    }

    /// Apply last-write-wins resolution
    fn apply_last_write_wins(env: Env, _conflict: &SyncConflict, winning_entry_id: String) {
        let winning_entry = Self::get_sync_entry(env.clone(), winning_entry_id.clone());
        let mut updated_entry = winning_entry;
        updated_entry.sync_status = SyncStatus::Completed;
        updated_entry.conflict_resolution = Some(ConflictResolution::LastWriteWins);
        env.storage().instance().set(
            &SyncCoordinationKey::SyncEntry(winning_entry_id),
            &updated_entry,
        );
    }

    /// Apply first-write-wins resolution
    fn apply_first_write_wins(env: Env, _conflict: &SyncConflict, winning_entry_id: String) {
        let winning_entry = Self::get_sync_entry(env.clone(), winning_entry_id.clone());
        let mut updated_entry = winning_entry;
        updated_entry.sync_status = SyncStatus::Completed;
        updated_entry.conflict_resolution = Some(ConflictResolution::FirstWriteWins);
        env.storage().instance().set(
            &SyncCoordinationKey::SyncEntry(winning_entry_id),
            &updated_entry,
        );
    }

    /// Apply timestamp-wins resolution
    fn apply_timestamp_wins(env: Env, _conflict: &SyncConflict, winning_entry_id: String) {
        let winning_entry = Self::get_sync_entry(env.clone(), winning_entry_id.clone());
        let mut updated_entry = winning_entry;
        updated_entry.sync_status = SyncStatus::Completed;
        updated_entry.conflict_resolution = Some(ConflictResolution::TimestampWins);
        env.storage().instance().set(
            &SyncCoordinationKey::SyncEntry(winning_entry_id),
            &updated_entry,
        );
    }

    /// Apply manual review resolution
    fn apply_manual_review(env: Env, _conflict: &SyncConflict, winning_entry_id: String) {
        let winning_entry = Self::get_sync_entry(env.clone(), winning_entry_id.clone());
        let mut updated_entry = winning_entry;
        updated_entry.sync_status = SyncStatus::Pending;
        updated_entry.conflict_resolution = Some(ConflictResolution::ManualReview);
        env.storage().instance().set(
            &SyncCoordinationKey::SyncEntry(winning_entry_id),
            &updated_entry,
        );
    }

    /// Apply merge data resolution
    fn apply_merge_data(env: Env, conflict: &SyncConflict, winning_entry_id: String) {
        let winning_entry = Self::get_sync_entry(env.clone(), winning_entry_id.clone());
        let other_entry = Self::get_sync_entry(env.clone(), conflict.entry_id_2.clone());

        let merged_payload = crate::str_cat(&env, &winning_entry.payload, &other_entry.payload);

        let mut updated_entry = winning_entry;
        updated_entry.payload = merged_payload;
        updated_entry.sync_status = SyncStatus::Completed;
        updated_entry.conflict_resolution = Some(ConflictResolution::MergeData);
        updated_entry
            .merged_with
            .push_back(conflict.entry_id_2.clone());

        env.storage().instance().set(
            &SyncCoordinationKey::SyncEntry(winning_entry_id),
            &updated_entry,
        );
    }

    /// Get total device count
    pub fn get_device_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&SyncCoordinationKey::DeviceCount)
            .unwrap_or(0)
    }

    /// Get total entry count
    pub fn get_entry_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&SyncCoordinationKey::EntryCount)
            .unwrap_or(0)
    }

    /// Get total conflict count
    pub fn get_conflict_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&SyncCoordinationKey::ConflictCount)
            .unwrap_or(0)
    }

    /// Get total session count
    pub fn get_session_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&SyncCoordinationKey::SessionCount)
            .unwrap_or(0)
    }

    /// Clean up old sync data (maintenance function)
    pub fn cleanup_old_data(_env: Env, _older_than: u64) -> u64 {
        // This would require iterating through all entries and removing old ones
        // Simplified implementation for demo
        0
    }
}
