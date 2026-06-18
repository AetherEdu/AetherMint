#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec};

/// Helper: convert u64 to Soroban String without format! macro
pub fn u64_to_string(env: &Env, num: u64, prefix: &str) -> String {
    let prefix_bytes = prefix.as_bytes();
    let mut buf = [0u8; 64];
    let mut pos = 0;
    for &b in prefix_bytes {
        buf[pos] = b;
        pos += 1;
    }
    if num == 0 {
        buf[pos] = b'0';
        pos += 1;
    } else {
        let start = pos;
        let mut n = num;
        while n > 0 {
            buf[pos] = b'0' + (n % 10) as u8;
            n /= 10;
            pos += 1;
        }
        let mut i = start;
        let mut j = pos - 1;
        while i < j {
            let tmp = buf[i];
            buf[i] = buf[j];
            buf[j] = tmp;
            i += 1;
            j -= 1;
        }
    }
    let s = core::str::from_utf8(&buf[..pos]).unwrap_or("0");
    String::from_str(env, s)
}

/// Helper: concatenate two Soroban Strings
pub fn str_cat(env: &Env, a: &String, b: &String) -> String {
    let a_bytes = string_to_bytes(env, a);
    let b_bytes = string_to_bytes(env, b);
    let mut combined = Bytes::new(env);
    combined.append(&a_bytes);
    combined.append(&b_bytes);
    // Copy Bytes content to convert to String
    let mut buf = [0u8; 1024];
    let total = combined.len();
    if total == 0 {
        return String::from_str(env, "");
    }
    let mut i: u32 = 0;
    while i < total && (i as usize) < 1024 {
        buf[i as usize] = combined.get(i).unwrap_or(0);
        i += 1;
    }
    let s = core::str::from_utf8(&buf[..(total as usize).min(1024)]).unwrap_or("");
    String::from_str(env, s)
}

/// Helper: convert Soroban String to Bytes (since From<String> is not implemented for Bytes in v20)
pub fn string_to_bytes(env: &Env, s: &String) -> Bytes {
    let len = s.len() as usize;
    if len == 0 {
        return Bytes::new(env);
    }
    let mut buf = [0u8; 512];
    let buf_len = if len < 512 { len } else { 512usize };
    s.copy_into_slice(&mut buf[..buf_len]);
    Bytes::from_slice(env, &buf[..buf_len])
}

pub mod access_control;
pub mod credentials;
#[cfg(test)]
mod credentials_test;

pub mod credential_registry;
pub mod dynamic_nft;
#[cfg(test)]
mod dynamic_nft_test;

pub mod time_lock_credential;
#[cfg(test)]
mod time_lock_credential_test;

pub mod vrf_system;
#[cfg(test)]
mod vrf_system_test;

pub mod progress;
pub mod event_logger;
pub mod user_profile;
#[allow(non_snake_case)]
pub mod analyticsStorage;
pub mod consciousness;
#[cfg(test)]
mod progress_test;
#[cfg(test)]
mod event_logger_test;
#[cfg(test)]
mod user_profile_test;
#[cfg(test)]
mod analyticsStorage_test;
#[cfg(test)]
mod consciousness_test;
#[allow(non_snake_case)]
pub mod courseMetadata;
#[allow(non_snake_case)]
pub mod syncCoordination;
#[cfg(test)]
mod courseMetadata_test;
#[cfg(test)]
mod syncCoordination_test;
pub mod utils;
pub mod proctoring;
pub mod tokenomics;
pub mod marketplace;


/// Optimized user profile with packed storage
#[contracttype]
#[derive(Clone)]
pub struct UserProfile {
    pub owner: Address,
    pub username: String,
    pub email: Option<String>,
    pub bio: Option<String>,
    pub avatar_url: Option<String>,
    pub timestamps: u128, // Packed created_at and updated_at
    pub achievement_count: u32,
    pub credential_count: u32,
    pub reputation: u64,
    pub flags: u32, // Packed privacy level, verification status, etc.
}

/// Privacy levels packed into flags
#[contracttype]
#[derive(Clone, Copy)]
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
    Course(u64),
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
    pub id: u64,
    pub instructor: Address,
    pub title: String,
    pub description: String,
    pub price: u64,
    pub flags: u32, // Packed active status and other boolean flags
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
pub struct AetherMintContract;

#[contractimpl]
impl AetherMintContract {
    /// Initialize the contract with optimized storage
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::CredentialCount, &0u64);
        env.storage().instance().set(&DataKey::CourseCount, &0u64);
        env.storage().instance().set(&DataKey::AchievementCount, &0u64);

        // Bootstrap admin role for RBAC
        access_control::set_initial_admin(&env, &admin);
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
        issuer.require_auth();
        // RBAC: require Issuer role (Admin also satisfies this via grant_role)
        access_control::require_role(&env, &issuer, access_control::Role::Issuer);

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
    ) -> u64 {
        instructor.require_auth();
        // RBAC: require Instructor role
        access_control::require_role(&env, &instructor, access_control::Role::Instructor);

        let course_count: u64 = env.storage().instance()
            .get(&DataKey::CourseCount)
            .unwrap_or(0);
        
        let course_id = course_count + 1;
        
        // Pack flags - bit 0 = active status
        let flags = 1u32; // Active = true

        let course = Course {
            id: course_id,
            instructor: instructor.clone(),
            title,
            description,
            price,
            flags,
        };

        env.storage().instance().set(&DataKey::Course(course_id), &course);
        env.storage().instance().set(&DataKey::CourseCount, &course_id);

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

    // ===== RBAC Management =====

    /// Grant a role to an address. Caller must have Admin role.
    pub fn grant_role(env: Env, caller: Address, target: Address, role: u32) {
        let r = role_from_u32(role);
        access_control::grant_role(&env, caller, target, r);
    }

    /// Revoke a role from an address. Caller must have Admin role.
    pub fn revoke_role(env: Env, caller: Address, target: Address, role: u32) {
        let r = role_from_u32(role);
        access_control::revoke_role(&env, caller, target, r);
    }

    /// Check whether an address has a specific role.
    pub fn has_role(env: Env, addr: Address, role: u32) -> bool {
        let r = role_from_u32(role);
        access_control::has_role(&env, &addr, r)
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
    #[allow(dead_code)]
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
    pub fn check_credential_expiration(env: Env, credential_id: u64) -> u32 {
        let status = credential_registry::check_credential_expiration(&env, credential_id);
        status.to_u8() as u32
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

    // ===== Dynamic NFT Functions =====

    /// Mint a new dynamic NFT credential
    pub fn mint_dynamic_nft(
        env: Env,
        creator: Address,
        recipient: Address,
        base_uri: String,
        initial_metadata: String,
    ) -> u64 {
        dynamic_nft::mint_dynamic_nft(&env, creator, recipient, base_uri, initial_metadata)
    }

    /// Evolve an NFT based on achievement
    pub fn evolve_nft(
        env: Env,
        token_id: u64,
        achievement_id: u64,
        new_metadata: String,
    ) -> bool {
        dynamic_nft::evolve_nft(&env, token_id, achievement_id, new_metadata)
    }

    /// Fuse two NFTs to create a new one
    pub fn fuse_nfts(
        env: Env,
        token1_id: u64,
        token2_id: u64,
        recipient: Address,
    ) -> u64 {
        dynamic_nft::fuse_nfts(&env, token1_id, token2_id, recipient)
    }

    /// Transfer NFT to new owner
    pub fn transfer_nft(env: Env, from: Address, to: Address, token_id: u64) {
        dynamic_nft::transfer_nft(&env, from, to, token_id)
    }

    /// Get NFT details
    pub fn get_nft(env: Env, token_id: u64) -> dynamic_nft::DynamicNFT {
        dynamic_nft::get_nft(&env, token_id)
    }

    /// Get all tokens owned by an address
    pub fn get_owner_tokens(env: Env, owner: Address) -> Vec<u64> {
        dynamic_nft::get_owner_tokens(&env, owner)
    }

    /// Get NFT metadata URI
    pub fn token_uri(env: Env, token_id: u64) -> String {
        dynamic_nft::token_uri(&env, token_id)
    }

    /// Check if NFT exists
    pub fn nft_exists(env: Env, token_id: u64) -> bool {
        dynamic_nft::nft_exists(&env, token_id)
    }

    /// Get owner of NFT
    pub fn owner_of(env: Env, token_id: u64) -> Address {
        dynamic_nft::owner_of(&env, token_id)
    }

    /// Get balance of owner
    pub fn balance_of(env: Env, owner: Address) -> u64 {
        dynamic_nft::balance_of(&env, owner)
    }
}

/// Map u32 to Role enum (0=Admin,1=Issuer,2=Instructor,3=Student)
fn role_from_u32(role: u32) -> access_control::Role {
    match role {
        0 => access_control::Role::Admin,
        1 => access_control::Role::Issuer,
        2 => access_control::Role::Instructor,
        3 => access_control::Role::Student,
        _ => panic!("Unknown role"),
    }
}
