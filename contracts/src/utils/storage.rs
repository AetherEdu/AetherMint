use soroban_sdk::{contracttype, Address, Env, String, Vec};

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
