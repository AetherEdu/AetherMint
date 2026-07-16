use soroban_sdk::{contracterror, contracttype, panic_with_error, Address, Env, String, Vec};

// `DataKey::Admin` is the unit variant that `AetherMintContract::initialize`
// writes under for the contract admin. Pulled from `lib.rs` so the version
// util reads the SAME on-disk XDR key the init path wrote — a bare
// `Symbol::new(env, "admin")` would serialise to a different namespace and
// would always look uninitialised.
use crate::DataKey;

/// Bit-packed storage utilities for gas optimization
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PackedUserFlags {
    /// Bits 0-1: PrivacyLevel (0=Public, 1=Private, 2=FriendsOnly)
    /// Bit 2: Verified status
    /// Bit 3: Active status
    /// Bits 4-7: Reserved for future use
    pub flags: u32,
}

impl PackedUserFlags {
    pub fn new(privacy_level: u8, verified: bool, active: bool) -> Self {
        let mut flags: u32 = (privacy_level & 0x03) as u32;
        if verified {
            flags |= 0x04;
        }
        if active {
            flags |= 0x08;
        }
        Self { flags }
    }

    pub fn privacy_level(&self) -> u8 {
        (self.flags & 0x03) as u8
    }
    pub fn is_verified(&self) -> bool {
        (self.flags & 0x04) != 0
    }
    pub fn is_active(&self) -> bool {
        (self.flags & 0x08) != 0
    }
}

/// Packed timestamps and small integers
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PackedTimestamps {
    /// Combines creation and update timestamps (64 bits each)
    pub packed: u128,
}

impl PackedTimestamps {
    pub fn new(created_at: u64, updated_at: u64) -> Self {
        let packed = (created_at as u128) << 64 | (updated_at as u128);
        Self { packed }
    }

    pub fn created_at(&self) -> u64 {
        (self.packed >> 64) as u64
    }
    pub fn updated_at(&self) -> u64 {
        (self.packed & 0xFFFFFFFFFFFFFFFF) as u64
    }
}

/// Packed rating data (rating and review count in single u64)
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PackedRating {
    /// High 32 bits: rating (0-10000 basis points)
    /// Low 32 bits: review count
    pub packed: u64,
}

impl PackedRating {
    pub fn new(rating_bps: u32, review_count: u32) -> Self {
        let packed = ((rating_bps as u64) << 32) | (review_count as u64);
        Self { packed }
    }

    pub fn rating_bps(&self) -> u32 {
        (self.packed >> 32) as u32
    }
    pub fn review_count(&self) -> u32 {
        (self.packed & 0xFFFFFFFF) as u32
    }
}

/// Efficient storage keys using namespaces
#[contracttype]
#[derive(Clone)]
pub enum StorageKey {
    /// User data namespace
    User(Address),
    UserFlags(Address),
    UserTimestamps(Address),
    UserAchievements(Address),
    UserCredentials(Address),
    UsernameMap(String),

    /// Course data namespace  
    Course(String),
    CourseFlags(String),
    CourseRating(String),
    CourseTimestamps(String),
    CourseCount,

    /// Credential namespace
    Credential(u64),
    CredentialCount,

    /// Achievement namespace
    Achievement(u64),
    AchievementCount,

    /// Analytics namespace
    Analytics(u64), // timestamp-based
    AnalyticsCount,

    /// Global admin
    Admin,

    /// Pause state
    Paused,
}

/// Storage utilities for efficient data management
pub struct StorageUtils;

impl StorageUtils {
    /// Store user data with minimal storage slots
    pub fn store_user_compact(
        env: &Env,
        user: Address,
        username: String,
        email: Option<String>,
        bio: Option<String>,
        avatar_url: Option<String>,
        privacy_level: u8,
        verified: bool,
        active: bool,
    ) {
        // Store core user data
        let core_data = (username, email, bio, avatar_url);
        env.storage()
            .instance()
            .set(&StorageKey::User(user.clone()), &core_data);

        // Store flags in single byte
        let flags = PackedUserFlags::new(privacy_level, verified, active);
        env.storage()
            .instance()
            .set(&StorageKey::UserFlags(user.clone()), &flags);

        // Store timestamps in single U256
        let now = env.ledger().timestamp();
        let timestamps = PackedTimestamps::new(now, now);
        env.storage()
            .instance()
            .set(&StorageKey::UserTimestamps(user), &timestamps);
    }

    /// Store course data with packed structures
    pub fn store_course_compact(
        env: &Env,
        course_id: String,
        instructor: Address,
        title: String,
        description: String,
        category: String,
        level: String,
        duration: u64,
        price: u64,
        max_students: u64,
        certificate_enabled: bool,
    ) {
        // Pack course flags
        let mut flags: u32 = 0u32;
        if certificate_enabled {
            flags |= 0x01;
        }
        // Bits 1-7 reserved for future use

        // Store core course data
        let core_data = (
            instructor,
            title,
            description,
            category,
            level,
            duration,
            price,
            max_students,
        );
        env.storage()
            .instance()
            .set(&StorageKey::Course(course_id.clone()), &core_data);
        env.storage()
            .instance()
            .set(&StorageKey::CourseFlags(course_id.clone()), &flags);

        // Initialize rating and timestamps
        let rating = PackedRating::new(0, 0);
        let now = env.ledger().timestamp();
        let timestamps = PackedTimestamps::new(now, now);

        env.storage()
            .instance()
            .set(&StorageKey::CourseRating(course_id.clone()), &rating);
        env.storage()
            .instance()
            .set(&StorageKey::CourseTimestamps(course_id), &timestamps);
    }

    /// Efficiently add ID to user's list (achievements/credentials)
    pub fn add_to_user_list(env: &Env, user: Address, id: u64, list_type: ListType) {
        let key = match list_type {
            ListType::Achievements => StorageKey::UserAchievements(user),
            ListType::Credentials => StorageKey::UserCredentials(user),
        };

        let mut list: Vec<u64> = env
            .storage()
            .instance()
            .get(&key)
            .unwrap_or_else(|| Vec::new(env));

        if !list.contains(&id) {
            list.push_back(id);
            env.storage().instance().set(&key, &list);
        }
    }

    /// Get next ID for any entity type
    pub fn get_next_id(env: &Env, entity_type: EntityType) -> u64 {
        let key = match entity_type {
            EntityType::Course => StorageKey::CourseCount,
            EntityType::Credential => StorageKey::CredentialCount,
            EntityType::Achievement => StorageKey::AchievementCount,
        };

        let current_id: u64 = env.storage().instance().get(&key).unwrap_or(0);

        let next_id = current_id + 1;
        env.storage().instance().set(&key, &next_id);

        next_id
    }

    /// Batch store analytics data to reduce storage operations
    pub fn store_analytics_batch(
        env: &Env,
        timestamp: u64,
        total_users: u64,
        active_users: u64,
        total_courses: u64,
        total_completions: u64,
        avg_progress_bps: u32,
        avg_quiz_score_bps: u32,
        total_time_spent: u64,
    ) {
        // Pack all metrics into single storage entry
        let packed_data = (
            total_users,
            active_users,
            total_courses,
            total_completions,
            avg_progress_bps,
            avg_quiz_score_bps,
            total_time_spent,
        );

        env.storage()
            .instance()
            .set(&StorageKey::Analytics(timestamp), &packed_data);
    }
}

#[derive(Clone)]
pub enum ListType {
    Achievements,
    Credentials,
}

#[derive(Clone)]
pub enum EntityType {
    Course,
    Credential,
    Achievement,
}

/// Gas measurement utilities
pub struct GasProfiler;

impl GasProfiler {
    /// Measure gas cost of storage operations
    pub fn measure_storage_cost<F, R>(env: &Env, operation: F) -> u64
    where
        F: FnOnce(&Env) -> R,
    {
        let start_gas = env.ledger().timestamp(); // Simplified - in real implementation use actual gas metering
        operation(env);
        let end_gas = env.ledger().timestamp();
        end_gas - start_gas
    }
}

// =============================================================================
// Upgradeable Storage Versioning (issue #120)
//
// Tracks a single monotonically-increasing `STORAGE_VERSION` `u32` in instance
// storage so that future schema changes can be safely applied through an
// admin-triggered `migrate()` instead of a destructive redeploy. The version
// represents the storage *layout* used by this binary — not the application
// semver, which is tracked separately by the host crate.
//
// Migration strategy:
//   * `STORAGE_VERSION` is the version this binary *writes* on first init.
//   * `SUPPORTED_STORAGE_VERSIONS` lists every version this binary can safely
//     read. If the on-disk version falls outside the supported range the
//     contract refuses to mutate state.
//   * `migrate(new_version)` dispatches to a concrete
//     `migrate_<from>_to_<to>` function which performs the per-version
//     data transformation, then bumps the stored version and appends to the
//     audit log.
// =============================================================================

/// Current storage schema version this binary writes on init.
///
/// Bump this whenever a backward-incompatible change to any stored struct
/// (added/removed/renamed fields, repacking, rekeying, etc.) is introduced.
pub const STORAGE_VERSION: u32 = 2;

/// All storage versions this binary can safely read.
///
/// Update together with `STORAGE_VERSION` and a matching migration function.
/// Versions not in this list cause [`require_compatible_version`] to panic
/// with [`StorageVersionError::UnsupportedVersion`].
pub const SUPPORTED_STORAGE_VERSIONS: &[u32] = &[1, 2];

/// Storage keys reserved for the versioning subsystem.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum StorageVersionKey {
    /// Holds the active `STORAGE_VERSION` as a `u32`.
    StorageVersion,
    /// Append-only audit log of completed migrations.
    MigrationLog,
    /// Marker written by each successful migration on its target version,
    /// useful as a sanity-check that a particular version is reachable.
    MigrationMarker(u32),
}

/// Typed errors emitted by the storage versioning subsystem.
///
/// Codes are stable across upgrades so off-chain consumers can pattern-match
/// on the error number to take action (re-run migration, abort, alert).
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum StorageVersionError {
    /// Storage was queried via a path that requires an initialized version
    /// but none was found on disk.
    NotInitialized = 1,
    /// The on-disk version is newer than this binary supports. The contract
    /// must be upgraded before this version is touched.
    UnsupportedVersion = 2,
    /// A downgrade was requested. Downgrades are intentionally disallowed —
    /// they risk silently corrupting newer schemas.
    DowngradeNotAllowed = 3,
    /// The requested migration target is the version we are already at.
    AlreadyAtVersion = 4,
    /// No migration function exists for the requested `(from -> to)` path.
    NoMigrationPath = 5,
    /// The caller did not authorize as the contract admin.
    UnauthorizedMigration = 6,
}

/// One record per completed migration, kept in [`StorageVersionKey::MigrationLog`].
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MigrationRecord {
    pub from_version: u32,
    pub to_version: u32,
    pub migrated_at: u64,
    pub migrated_by: Address,
}

/// Storage versioning entry points.
///
/// * [`StorageVersion::initialize`] writes `STORAGE_VERSION` once on first init.
/// * [`StorageVersion::require_compatible_version`] guards every read/write so
///   incompatible layouts fail loudly instead of producing corrupt data.
/// * [`StorageVersion::migrate`] is admin-only and walks the version graph.
pub struct StorageVersion;

impl StorageVersion {
    /// The key the contract uses to record its admin address.
    ///
    /// `AetherMintContract::initialize` writes the admin under
    /// `DataKey::Admin`, so we read it back from the same keyspace — not
    /// from a bare `Symbol::new(env, "admin")` which serialises to a
    /// different on-disk key and would always look uninitialised.
    fn admin_key() -> DataKey {
        DataKey::Admin
    }

    /// Write `STORAGE_VERSION` to instance storage. Idempotent: if a
    /// version is already present we leave it alone so that tests which
    /// hand-roll an admin key prior to calling this don't get clobbered.
    pub fn initialize(env: &Env) {
        if !env
            .storage()
            .instance()
            .has(&StorageVersionKey::StorageVersion)
        {
            env.storage()
                .instance()
                .set(&StorageVersionKey::StorageVersion, &STORAGE_VERSION);
        }
    }

    /// Return the currently-stored storage version.
    ///
    /// Panics with [`StorageVersionError::NotInitialized`] if the version key
    /// has never been written. Most callers should prefer
    /// [`require_compatible_version`] which lazy-initializes for backward
    /// compatibility with pre-existing test fixtures.
    pub fn get_storage_version(env: &Env) -> u32 {
        env.storage()
            .instance()
            .get(&StorageVersionKey::StorageVersion)
            .unwrap_or_else(|| panic_with_error!(env, StorageVersionError::NotInitialized))
    }

    /// Permissionless compatibility guard.
    ///
    /// Behaviour:
    /// * If the version key is *absent* (legacy / pre-versioned contract),
    ///   treat that as "no opinion" — initialize to [`STORAGE_VERSION`] and
    ///   return. This keeps every existing test fixture working unchanged.
    /// * If the version on disk is in [`SUPPORTED_STORAGE_VERSIONS`], pass.
    /// * Otherwise panic with [`StorageVersionError::UnsupportedVersion`].
    ///
    /// Call this at the top of every function that reads or writes durable
    /// storage so a future schema break can quarantine the contract without
    /// touching individual call-sites.
    pub fn require_compatible_version(env: &Env) -> u32 {
        let key = StorageVersionKey::StorageVersion;
        if !env.storage().instance().has(&key) {
            // Legacy / un-versioned instance: opt in to versioning silently.
            Self::initialize(env);
            return STORAGE_VERSION;
        }
        let current = env
            .storage()
            .instance()
            .get::<_, u32>(&key)
            .unwrap_or_else(|| panic_with_error!(env, StorageVersionError::NotInitialized));
        if !SUPPORTED_STORAGE_VERSIONS.contains(&current) {
            panic_with_error!(env, StorageVersionError::UnsupportedVersion);
        }
        current
    }

    /// Admin-triggered migration. Reads current version from disk, picks the
    /// matching `migrate_<from>_to_<to>` data-transformation, runs it, then
    /// bumps the stored version and appends to the audit log.
    ///
    /// Behaviour on bad input:
    /// * Non-admin caller → [`StorageVersionError::UnauthorizedMigration`].
    /// * `new_version == current` → [`StorageVersionError::AlreadyAtVersion`].
    /// * `new_version < current` → [`StorageVersionError::DowngradeNotAllowed`].
    /// * No migration path registered → [`StorageVersionError::NoMigrationPath`].
    pub fn migrate(env: &Env, admin: Address, new_version: u32) {
        admin.require_auth();

        // Recover the admin recorded in storage so `admin` must actually be it.
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&Self::admin_key())
            .unwrap_or_else(|| panic_with_error!(env, StorageVersionError::NotInitialized));
        if admin != stored_admin {
            panic_with_error!(env, StorageVersionError::UnauthorizedMigration);
        }

        // *Critical*: when the version key is absent on a legacy v1 contract
        // we cannot call `Self::initialize(env)` here — that would write
        // `STORAGE_VERSION` (2) to disk and immediately trip
        // `AlreadyAtVersion` below, completely bypassing the data transform.
        // Treat the legacy case as `current = 1` so the v1→v2 migration runs
        // exactly once on real v1 data and then writes `2` to disk.
        let current: u32 = if env
            .storage()
            .instance()
            .has(&StorageVersionKey::StorageVersion)
        {
            Self::get_storage_version(env)
        } else {
            1
        };

        if new_version == current {
            panic_with_error!(env, StorageVersionError::AlreadyAtVersion);
        }
        if new_version < current {
            panic_with_error!(env, StorageVersionError::DowngradeNotAllowed);
        }

        // Dispatch to the concrete transformation. The exhaustive match makes
        // it impossible to ship a new version without remembering to add the
        // migration that reaches it. Implementation lives next to the data
        // it transforms so the keys it touches are always the real ones.
        let transformed = match (current, new_version) {
            (1, 2) => {
                // Aggregate the per-module transformation counts so off-chain
                // tooling can sanity-check the migration sweep.
                let credentials = crate::credential_registry::migrate_v1_to_v2(env);
                let nfts = crate::dynamic_nft::migrate_v1_to_v2(env);
                credentials.saturating_add(nfts)
            }
            _ => {
                panic_with_error!(env, StorageVersionError::NoMigrationPath)
            }
        };
        // `transformed` is informational; surface it through the marker so
        // off-chain tooling can confirm side-effects were performed.
        env.storage().instance().set(
            &StorageVersionKey::MigrationMarker(new_version),
            &transformed,
        );

        // Bump the version.
        env.storage()
            .instance()
            .set(&StorageVersionKey::StorageVersion, &new_version);

        // Append audit record.
        let mut log: Vec<MigrationRecord> = env
            .storage()
            .instance()
            .get(&StorageVersionKey::MigrationLog)
            .unwrap_or_else(|| Vec::new(env));
        log.push_back(MigrationRecord {
            from_version: current,
            to_version: new_version,
            migrated_at: env.ledger().timestamp(),
            migrated_by: admin,
        });
        env.storage()
            .instance()
            .set(&StorageVersionKey::MigrationLog, &log);
    }

    /// Read the migration audit log. Empty if no migrations have run.
    pub fn migration_history(env: &Env) -> Vec<MigrationRecord> {
        env.storage()
            .instance()
            .get(&StorageVersionKey::MigrationLog)
            .unwrap_or_else(|| Vec::new(env))
    }

    /// Test-only escape hatch: force the stored version to an arbitrary value
    /// so we can exercise the "unsupported version" code path without having
    /// to actually deploy incompatible data.
    #[cfg(test)]
    pub fn set_storage_version_for_testing(env: &Env, version: u32) {
        env.storage()
            .instance()
            .set(&StorageVersionKey::StorageVersion, &version);
    }
}

// Per-module v1 → v2 transformations live next to the data they operate on:
//   * [`crate::credential_registry::migrate_v1_to_v2`] seeds the
//     `AttestationCount(id)` marker on every pre-existing credential.
