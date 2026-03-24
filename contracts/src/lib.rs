#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Vec, U256};

pub mod credentials;
#[cfg(test)]
mod credentials_test;

pub mod credential_registry;

pub mod progress;
pub mod event_logger;
pub mod user_profile;
pub mod analyticsStorage;
#[cfg(test)]
mod progress_test;
#[cfg(test)]
mod event_logger_test;
#[cfg(test)]
mod user_profile_test;
#[cfg(test)]
mod analyticsStorage_test;
pub mod eventLogger;
pub mod courseMetadata;
pub mod syncCoordination;
#[cfg(test)]
mod progress_test;
#[cfg(test)]
mod courseMetadata_test;
#[cfg(test)]
mod syncCoordination_test;
pub mod utils;


/// Optimized user profile with packed storage
#[contracttype]
#[derive(Clone)]
pub struct UserProfile {
    pub owner: Address,
    pub username: String,
    pub email: Option<String>,
    pub bio: Option<String>,
    pub avatar_url: Option<String>,
    pub timestamps: U256, // Packed created_at and updated_at
    pub achievement_count: u32,
    pub credential_count: u32,
    pub reputation: u64,
    pub flags: u8, // Packed privacy level, verification status, etc.
}

/// Privacy levels packed into flags
#[contracttype]
#[derive(Clone)]
pub enum PrivacyLevel {
    Public = 0,
    Private = 1,
    FriendsOnly = 2,
}

impl PrivacyLevel {
    pub fn to_u8(&self) -> u8 {
        match self {
            PrivacyLevel::Public => 0,
            PrivacyLevel::Private => 1,
            PrivacyLevel::FriendsOnly => 2,
        }
    }
    
    pub fn from_u8(value: u8) -> Self {
        match value & 0x03 {
            0 => PrivacyLevel::Public,
            1 => PrivacyLevel::Private,
            2 => PrivacyLevel::FriendsOnly,
            _ => PrivacyLevel::Public,
        }
    }
}

/// Optimized storage keys using namespaces
#[contracttype]
#[derive(Clone)]
pub enum ProfileKey {
    User(Address),
    UserFlags(Address),
    UserTimestamps(Address),
    UserAchievements(Address),
    UserCredentials(Address),
    Achievement(u64),
    Username(String),
    AchievementByUser(Address, u64),
    Credential(u64),
    Course(String),
}

/// Optimized achievement with packed storage
#[contracttype]
#[derive(Clone)]
pub struct Achievement {
    pub id: u64,
    pub user: Address,
    pub title: String,
    pub description: String,
    pub timestamp: u64, // Combined earned_at + verification status in high bits
    pub badge_url: Option<String>,
}

/// Optimized data keys with better organization
#[contracttype]
pub enum DataKey {
    Admin,
    Credential(u64),
    CredentialCount,
    CourseCount,
    AchievementCount,
    UserAchievements(Address),
    UserCredentials(Address),
}

/// Optimized credential with packed verification status
#[contracttype]
pub struct Credential {
    pub id: u64,
    pub issuer: Address,
    pub recipient: Address,
    pub title: String,
    pub description: String,
    pub course_id: String,
    pub timestamp: u64, // Packed completion_date and revocation status
    pub ipfs_hash: String,
}

/// Optimized course with packed status
#[contracttype]
pub struct Course {
    pub id: String,
    pub instructor: Address,
    pub title: String,
    pub description: String,
    pub price: u64,
    pub flags: u8, // Packed active status and other boolean flags
}

/// Simplified profile for backward compatibility
#[contracttype]
pub struct Profile {
    pub owner: Address,
    pub credential_count: u32,
    pub achievement_count: u32,
    pub reputation: u64,
}

#[contract]
pub struct StarkEdContract;

#[contractimpl]
impl StarkEdContract {
    /// Initialize the contract with optimized storage
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }
        
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::CredentialCount, &0u64);
        env.storage().instance().set(&DataKey::CourseCount, &0u64);
        env.storage().instance().set(&DataKey::AchievementCount, &0u64);
    }

    /// Issue a new credential with optimized storage
    pub fn issue_credential(
        env: Env,
        issuer: Address,
        recipient: Address,
        title: String,
        description: String,
        course_id: String,
        ipfs_hash: String,
    ) -> u64 {
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));

        if issuer != admin {
            panic!("Only admin can issue credentials");
        }

        let count: u64 = env.storage().instance()
            .get(&DataKey::CredentialCount)
            .unwrap_or(0);
        let credential_id = count + 1;

        // Pack timestamp and revocation status
        let timestamp = env.ledger().timestamp();
        let packed_timestamp = timestamp << 1; // Reserve bit 0 for revocation status

        let credential = Credential {
            id: credential_id,
            issuer: issuer.clone(),
            recipient: recipient.clone(),
            title,
            description,
            course_id,
            timestamp: packed_timestamp,
            ipfs_hash,
        };

        env.storage().instance().set(&DataKey::Credential(credential_id), &credential);
        env.storage().instance().set(&DataKey::CredentialCount, &credential_id);

        // Update user credential count
        Self::increment_user_credential_count(&env, recipient);

        credential_id
    }

    /// Verify a credential using packed timestamp
    pub fn verify_credential(env: Env, credential_id: u64) -> bool {
        let _admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        let mut credential: Credential = env.storage().instance()
            .get(&DataKey::Credential(credential_id))
            .unwrap_or_else(|| panic!("Credential not found"));

        // Clear revocation bit (bit 0)
        credential.timestamp &= !1u64;
        env.storage().instance().set(&DataKey::Credential(credential_id), &credential);

        true
    }

    /// Get credential details
    pub fn get_credential(env: Env, credential_id: u64) -> Credential {
        env.storage().instance()
            .get(&DataKey::Credential(credential_id))
            .unwrap_or_else(|| panic!("Credential not found"))
    }

    /// Create a new course with optimized storage
    pub fn create_course(
        env: Env,
        instructor: Address,
        title: String,
        description: String,
        price: u64,
    ) -> String {
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));

        if instructor != admin {
            panic!("Only admin can create courses");
        }

        let course_count: u64 = env.storage().instance()
            .get(&DataKey::CourseCount)
            .unwrap_or(0);
        
        let course_id = format!("course_{}", course_count + 1);
        
        // Pack flags - bit 0 = active status
        let flags = 1u8; // Active = true

        let course = Course {
            id: course_id.clone(),
            instructor: instructor.clone(),
            title,
            description,
            price,
            flags,
        };

        env.storage().instance().set(&DataKey::Course(course_id.clone()), &course);
        env.storage().instance().set(&DataKey::CourseCount, &(course_count + 1));

        course_id
    }

    /// Get user profile with optimized storage
    pub fn get_profile(env: Env, user: Address) -> Profile {
        // Try to get from optimized storage first
        if let Some(user_profile) = env.storage().instance().get::<_, UserProfile>(&ProfileKey::User(user.clone())) {
            Profile {
                owner: user,
                credential_count: user_profile.credential_count,
                achievement_count: user_profile.achievement_count,
                reputation: user_profile.reputation,
            }
        } else {
            // Fallback to default
            Profile {
                owner: user.clone(),
                credential_count: 0,
                achievement_count: 0,
                reputation: 0,
            }
        }
    }

    /// Get total credential count
    pub fn get_credential_count(env: Env) -> u64 {
        env.storage().instance()
            .get(&DataKey::CredentialCount)
            .unwrap_or(0)
    }

    /// Helper function to increment user credential count
    fn increment_user_credential_count(env: &Env, user: Address) {
        if let Some(mut profile) = env.storage().instance().get::<_, UserProfile>(&ProfileKey::User(user.clone())) {
            profile.credential_count += 1;
            env.storage().instance().set(&ProfileKey::User(user), &profile);
        }
    }

    /// Helper function to increment user achievement count  
    fn increment_user_achievement_count(env: &Env, user: Address) {
        if let Some(mut profile) = env.storage().instance().get::<_, UserProfile>(&ProfileKey::User(user.clone())) {
            profile.achievement_count += 1;
            env.storage().instance().set(&ProfileKey::User(user), &profile);
        }
    }

    /// Get total course count
    pub fn get_course_count(env: Env) -> u64 {
        env.storage().instance()
            .get(&DataKey::CourseCount)
            .unwrap_or(0)
    }

    /// Get total achievement count
    pub fn get_achievement_count(env: Env) -> u64 {
        env.storage().instance()
            .get(&DataKey::AchievementCount)
            .unwrap_or(0)
    }

    // ===== CredentialRegistry Integration =====

    /// Issue a new credential with expiration support
    pub fn issue_credential_with_expiration(
        env: Env,
        issuer: Address,
        recipient: Address,
        title: String,
        description: String,
        course_id: String,
        ipfs_hash: String,
        validity_duration: u64,
    ) -> u64 {
        credential_registry::issue_credential_with_expiration(
            &env, issuer, recipient, title, description, course_id, ipfs_hash, validity_duration
        )
    }

    /// Renew an existing credential
    pub fn renew_credential(
        env: Env,
        credential_id: u64,
        renewer: Address,
        extension_duration: u64,
    ) -> bool {
        credential_registry::renew_credential(&env, credential_id, renewer, extension_duration)
    }

    /// Check and update credential expiration status
    pub fn check_credential_expiration(env: Env, credential_id: u64) -> u8 {
        let status = credential_registry::check_credential_expiration(&env, credential_id);
        status.to_u8()
    }

    /// Get credential with current expiration status
    pub fn get_credential_with_status(env: Env, credential_id: u64) -> credential_registry::CredentialRegistry {
        credential_registry::get_credential(&env, credential_id)
    }

    /// Get user credentials with current status
    pub fn get_user_credentials_with_status(env: Env, user: Address) -> Vec<u64> {
        credential_registry::get_user_credentials(&env, user)
    }

    /// Get expired credentials list
    pub fn get_expired_credentials(env: Env) -> Vec<u64> {
        credential_registry::get_expired_credentials(&env)
    }

    /// Get renewal history for a credential
    pub fn get_credential_renewal_history(env: Env, credential_id: u64) -> Vec<credential_registry::RenewalRecord> {
        credential_registry::get_renewal_history(&env, credential_id)
    }

    /// Revoke a credential (using registry)
    pub fn revoke_credential_registry(env: Env, credential_id: u64, revoker: Address) -> bool {
        credential_registry::revoke_credential(&env, credential_id, revoker)
    }

    /// Check if a credential is currently valid
    pub fn is_credential_valid(env: Env, credential_id: u64) -> bool {
        credential_registry::is_credential_valid(&env, credential_id)
    }

    /// Get credentials expiring within a time window
    pub fn get_credentials_expiring_soon(env: Env, within_seconds: u64) -> Vec<u64> {
        credential_registry::get_credentials_expiring_soon(&env, within_seconds)
    }

    /// Batch update expiration status for multiple credentials
    pub fn batch_update_expiration_status(env: Env, credential_ids: Vec<u64>) -> Vec<u64> {
        credential_registry::batch_update_expiration_status(&env, credential_ids)
    }
}
