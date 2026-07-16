#![cfg(test)]

// Note on `#[should_panic]`:
//   * For `panic!()` calls we keep `expected = "…"` so the test is precise.
//   * For `panic_with_error!(env, MyError::Variant)` tests the display string
//     is the error *code* (e.g. `#2`) — not the variant name — so we use bare
//     `#[should_panic]` to verify the call panics without coupling to a
//     specific panic-message format that may shift between Soroban versions.

use crate::utils::storage::{
    MigrationRecord, StorageVersion, StorageVersionKey, STORAGE_VERSION, SUPPORTED_STORAGE_VERSIONS,
};
use soroban_sdk::{testutils::Address as _, Address, Env, Vec};

fn setup_env_with_admin() -> (Env, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    // The contract records its admin under `DataKey::Admin` —
    // `StorageVersion::migrate` reads it back from the same keyspace.
    env.storage().instance().set(&crate::DataKey::Admin, &admin);
    (env, admin)
}

// ---------------------------------------------------------------------------
// Initial version storage
// ---------------------------------------------------------------------------

#[test]
fn initialize_writes_current_storage_version() {
    let env = Env::default();
    // Fresh contract: nothing on disk yet.
    assert!(!env
        .storage()
        .instance()
        .has(&StorageVersionKey::StorageVersion));

    StorageVersion::initialize(&env);

    let stored = env
        .storage()
        .instance()
        .get::<_, u32>(&StorageVersionKey::StorageVersion)
        .unwrap();
    assert_eq!(stored, STORAGE_VERSION);
    assert!(
        SUPPORTED_STORAGE_VERSIONS.contains(&stored),
        "the stored version must be in SUPPORTED_STORAGE_VERSIONS so reads on freshly initialized contracts pass",
    );
}

#[test]
fn initialize_is_idempotent() {
    let env = Env::default();
    StorageVersion::initialize(&env);
    StorageVersion::initialize(&env);
    assert_eq!(
        env.storage()
            .instance()
            .get::<_, u32>(&StorageVersionKey::StorageVersion)
            .unwrap(),
        STORAGE_VERSION,
    );
}

#[test]
fn require_compatible_version_lazy_inits_for_legacy_contracts() {
    let env = Env::default();
    // No version key on disk — the contract predates versioning.
    assert!(!env
        .storage()
        .instance()
        .has(&StorageVersionKey::StorageVersion));

    let v = StorageVersion::require_compatible_version(&env);

    assert_eq!(v, STORAGE_VERSION);
    assert!(env
        .storage()
        .instance()
        .has(&StorageVersionKey::StorageVersion));
}

#[test]
fn require_compatible_version_accepts_known_versions() {
    let env = setup_env_with_admin().0;
    // v1 is in SUPPORTED_STORAGE_VERSIONS, so it must pass even before any
    // migration to v2 has run.
    StorageVersion::set_storage_version_for_testing(&env, 1);
    let v = StorageVersion::require_compatible_version(&env);
    assert_eq!(v, 1);

    StorageVersion::set_storage_version_for_testing(&env, STORAGE_VERSION);
    assert_eq!(
        StorageVersion::require_compatible_version(&env),
        STORAGE_VERSION
    );
}

#[test]
#[should_panic]
fn require_compatible_version_rejects_unknown_version() {
    let env = setup_env_with_admin().0;
    // Pretend the contract was written by a *future* binary whose layout we
    // do not understand. We must refuse to touch storage until we upgrade.
    StorageVersion::set_storage_version_for_testing(&env, 999);
    StorageVersion::require_compatible_version(&env);
}

#[test]
#[should_panic]
fn get_storage_version_panics_when_uninitialized() {
    let env = Env::default();
    assert!(!env
        .storage()
        .instance()
        .has(&StorageVersionKey::StorageVersion));
    // Strict getter refuses on un-initialized contracts.
    StorageVersion::get_storage_version(&env);
}

// ---------------------------------------------------------------------------
// Migration between versions
// ---------------------------------------------------------------------------

#[test]
fn migrate_bumps_version_and_records_history() {
    let (env, admin) = setup_env_with_admin();

    // Start at v1 (the prior supported version).
    StorageVersion::set_storage_version_for_testing(&env, 1);
    // Seed the credential count using the REAL enum key the migration
    // transform reads — the transform lives in credential_registry.rs so its
    // seed keys must match the production keyspace.
    env.storage().instance().set(
        &crate::credential_registry::CredentialRegistryKey::CredentialCount,
        &3u64,
    );

    StorageVersion::migrate(&env, admin.clone(), 2);

    assert_eq!(
        StorageVersion::get_storage_version(&env),
        2,
        "migrate must bump the stored version",
    );
    let history = StorageVersion::migration_history(&env);
    assert_eq!(history.len(), 1);
    let record: MigrationRecord = history.get(0).unwrap();
    assert_eq!(record.from_version, 1);
    assert_eq!(record.to_version, 2);
    assert_eq!(record.migrated_by, admin);
    assert!(record.migrated_at > 0);

    // Marker written by the migration function.
    let touched: u32 = env
        .storage()
        .instance()
        .get(&StorageVersionKey::MigrationMarker(2))
        .unwrap();
    assert_eq!(touched, 3, "v1->v2 should have touched 3 credentials");

    // The transform side-effects on the registry's own keyspace.
    for id in 1..=3u64 {
        let key = crate::credential_registry::CredentialRegistryKey::AttestationCount(id);
        assert!(
            env.storage().persistent().has(&key),
            "AttestationCount({}) must exist after migration",
            id,
        );
    }
}

#[test]
fn migrate_v1_to_v2_is_idempotent() {
    // Re-running the migration should not double-write or panic.
    let (env, admin) = setup_env_with_admin();
    StorageVersion::set_storage_version_for_testing(&env, 1);
    env.storage().instance().set(
        &crate::credential_registry::CredentialRegistryKey::CredentialCount,
        &1u64,
    );

    StorageVersion::migrate(&env, admin.clone(), 2);
    assert_eq!(StorageVersion::migration_history(&env).len(), 1);

    // Reset state and re-run to verify the migration is replayable.
    StorageVersion::set_storage_version_for_testing(&env, 1);
    StorageVersion::migrate(&env, admin, 2);
    assert_eq!(StorageVersion::get_storage_version(&env), 2);
    assert_eq!(StorageVersion::migration_history(&env).len(), 1);
}

// ---------------------------------------------------------------------------
// Legacy un-versioned contract path: v1→v2 without a pre-existing version key
// ---------------------------------------------------------------------------

#[test]
fn migrate_on_uninitialized_legacy_contract_runs_v1_to_v2_transform() {
    // Contract has the admin key but NO version stamp — i.e. it predates the
    // versioning subsystem. `migrate(2)` MUST still run the v1→v2 data
    // transform rather than tripping `AlreadyAtVersion` because `current` was
    // computed via a lazy `initialize` (the bug the thinker-with-files-gemini
    // review caught).
    let (env, admin) = setup_env_with_admin();
    assert!(!env
        .storage()
        .instance()
        .has(&StorageVersionKey::StorageVersion));

    env.storage().instance().set(
        &crate::credential_registry::CredentialRegistryKey::CredentialCount,
        &3u64,
    );

    StorageVersion::migrate(&env, admin.clone(), 2);

    assert_eq!(StorageVersion::get_storage_version(&env), 2);
    assert_eq!(StorageVersion::migration_history(&env).len(), 1);
    for id in 1..=3u64 {
        let key = crate::credential_registry::CredentialRegistryKey::AttestationCount(id);
        assert!(
            env.storage().persistent().has(&key),
            "AttestationCount({}) must exist after migration of legacy contract",
            id,
        );
    }
}

// ---------------------------------------------------------------------------
// Version-mismatch rejection
// ---------------------------------------------------------------------------

// Typed-error tests below use bare `#[should_panic]` — see the file-header
// note for why we don't pin to a specific panic-message string here.

#[test]
#[should_panic]
fn migrate_rejects_target_equal_to_current() {
    let (env, admin) = setup_env_with_admin();
    StorageVersion::set_storage_version_for_testing(&env, STORAGE_VERSION);
    StorageVersion::migrate(&env, admin, STORAGE_VERSION);
}

#[test]
#[should_panic]
fn migrate_rejects_downgrade() {
    let (env, admin) = setup_env_with_admin();
    StorageVersion::set_storage_version_for_testing(&env, 2);
    StorageVersion::migrate(&env, admin, 1);
}

#[test]
#[should_panic]
fn migrate_rejects_unregistered_target() {
    let (env, admin) = setup_env_with_admin();
    // Current = 2, requested = 4: no `migrate_2_to_4` registered yet.
    StorageVersion::set_storage_version_for_testing(&env, 2);
    StorageVersion::migrate(&env, admin, 4);
}

#[test]
#[should_panic]
fn migrate_rejects_non_admin_caller() {
    let (env, _stored_admin) = setup_env_with_admin();
    let impostor = Address::generate(&env);
    StorageVersion::set_storage_version_for_testing(&env, 1);
    StorageVersion::migrate(&env, impostor, 2);
}

// ---------------------------------------------------------------------------
// Sanity checks on the public constants
// ---------------------------------------------------------------------------

#[test]
fn supported_versions_include_current() {
    assert!(
        SUPPORTED_STORAGE_VERSIONS.contains(&STORAGE_VERSION),
        "CURRENT must be in SUPPORTED so reads on freshly initialized contracts pass",
    );
}

#[test]
fn migration_history_is_empty_by_default() {
    let env = setup_env_with_admin().0;
    let history: Vec<MigrationRecord> = StorageVersion::migration_history(&env);
    assert_eq!(history.len(), 0);
}

// ---------------------------------------------------------------------------
// End-to-end: version-aware writes through the credential_registry module
// ---------------------------------------------------------------------------

#[test]
fn credential_registry_writes_pass_through_lazy_version_init() {
    let env = setup_env_with_admin().0;
    // No explicit version key — the registry should still accept writes
    // (lazy init takes care of stamping the layout).
    let stored_admin: Address = env
        .storage()
        .instance()
        .get(&crate::DataKey::Admin)
        .unwrap();
    let recipient = Address::generate(&env);

    let _id = crate::credential_registry::issue_credential_with_expiration(
        &env,
        stored_admin,
        recipient,
        soroban_sdk::String::from_str(&env, "Title"),
        soroban_sdk::String::from_str(&env, "Description"),
        soroban_sdk::String::from_str(&env, "course-1"),
        soroban_sdk::String::from_str(&env, "ipfs://hash"),
        60 * 60 * 24,
    );

    assert_eq!(
        StorageVersion::get_storage_version(&env),
        STORAGE_VERSION,
        "first write through the registry should have lazy-initialized the version",
    );
}

#[test]
#[should_panic]
fn credential_registry_writes_reject_unsupported_version() {
    // `no_std` test crate doesn't have `std::panic::catch_unwind`, so we rely on
    // `#[should_panic]` to verify the registry rejects writes when the on-disk
    // version is not in `SUPPORTED_STORAGE_VERSIONS`.
    let env = setup_env_with_admin().0;
    StorageVersion::set_storage_version_for_testing(&env, 999);

    let stored_admin: Address = env
        .storage()
        .instance()
        .get(&crate::DataKey::Admin)
        .unwrap();
    let recipient = Address::generate(&env);

    let _ = crate::credential_registry::issue_credential_with_expiration(
        &env,
        stored_admin,
        recipient,
        soroban_sdk::String::from_str(&env, "T"),
        soroban_sdk::String::from_str(&env, "D"),
        soroban_sdk::String::from_str(&env, "c"),
        soroban_sdk::String::from_str(&env, "h"),
        60,
    );
}
