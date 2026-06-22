use crate::utils::storage::{PackedTimestamps, PackedUserFlags};
use soroban_sdk::{
    contract, contracttype, symbol_short, Address, Env, String, Vec,
};

/// Optimized user profile with packed storage
#[contracttype]
#[derive(Clone)]
pub struct UserProfile {
    pub owner: Address,
    pub username: String,
    pub email_hash: u64,  // Hash of email string
    pub bio_hash: u64,    // Hash of bio string
    pub avatar_hash: u64, // Hash of avatar URL
    pub timestamps: PackedTimestamps,
    pub achievement_count: u32,
    pub credential_count: u32,
    pub reputation: u64,
    pub flags: PackedUserFlags,
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
        *self as u8
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

/// Optimized storage keys with better organization
#[contracttype]
#[derive(Clone)]
pub enum ProfileKey {
    User(Address),
    UserEmail(Address),        // Separate email storage
    UserBio(Address),          // Separate bio storage
    UserAvatar(Address),       // Separate avatar storage
    UserAchievements(Address), // Achievement ID list
    UserCredentials(Address),  // Credential ID list
    Achievement(u64),
    Username(String),
    AchievementByUser(Address, u64),
    AchievementCount,
    CredentialCount,
}

/// Optimized achievement with packed verification status
#[contracttype]
#[derive(Clone)]
pub struct Achievement {
    pub id: u64,
    pub user: Address,
    pub title: String,
    pub description: String,
    pub timestamp: u64,     // Packed earned_at and verification status
    pub badge_hash: u64, // Hash of badge URL
}

// Contract attribute disabled - this is a module used by main contract in lib.rs
// #[contract]
pub struct UserProfileContract;

/// Add a credential to user's profile with optimized storage
pub fn add_credential(env: &Env, user: Address, credential_id: u64) {
    let mut profile = env
        .storage()
        .instance()
        .get::<_, UserProfile>(&ProfileKey::User(user.clone()))
        .unwrap_or_else(|| {
            // Create minimal profile if missing (fallback)
            let now = env.ledger().timestamp();
            UserProfile {
                owner: user.clone(),
                username: String::from_str(env, "unknown"),
                email_hash: generate_string_hash(&String::from_str(env, "")),
                bio_hash: generate_string_hash(&String::from_str(env, "")),
                avatar_hash: generate_string_hash(&String::from_str(env, "")),
                timestamps: PackedTimestamps::new(now, now),
                achievement_count: 0,
                credential_count: 0,
                reputation: 0,
                flags: PackedUserFlags::new(PrivacyLevel::Public.to_u8(), false, true),
            }
        });

    // Update credential count
    profile.credential_count += 1;
    profile.timestamps =
        PackedTimestamps::new(profile.timestamps.created_at(), env.ledger().timestamp());
    env.storage()
        .instance()
        .set(&ProfileKey::User(user.clone()), &profile);

    // Also maintain separate user credentials list for fast lookup
    let mut user_creds: Vec<u64> = env
        .storage()
        .instance()
        .get(&ProfileKey::UserCredentials(user.clone()))
        .unwrap_or_else(|| Vec::new(env));
    if !user_creds.contains(&credential_id) {
        user_creds.push_back(credential_id);
        env.storage()
            .instance()
            .set(&ProfileKey::UserCredentials(user), &user_creds);
    }
}

/// Get all credential IDs for a user (fast path)
pub fn get_user_credential_ids(env: &Env, user: Address) -> Vec<u64> {
    env.storage()
        .instance()
        .get(&ProfileKey::UserCredentials(user))
        .unwrap_or_else(|| Vec::new(env))
}

/// Generate hash for string data
fn generate_string_hash(string: &String) -> u64 {
    let mut hash: u64 = 0;
    let mut buf = [0u8; 256];
    let len = string.len() as usize;
    let buf_len = if len < 256 { len } else { 256usize };
    string.copy_into_slice(&mut buf[..buf_len]);
    for i in 0..buf_len {
        hash = hash.wrapping_mul(31).wrapping_add(buf[i] as u64);
    }
    hash
}

impl UserProfileContract {
    /// Initialize the contract
    pub fn initialize(_env: Env) {
        // Contract initialization logic can be added here if needed
    }

    /// Create or update a user profile with optimized storage
    pub fn create_or_update_profile(
        env: Env,
        owner: Address,
        username: String,
        email: Option<String>,
        bio: Option<String>,
        avatar_url: Option<String>,
        privacy_level: PrivacyLevel,
    ) -> UserProfile {
        owner.require_auth();

        // Check if username is already taken by another user
        if let Some(existing_owner) = env
            .storage()
            .instance()
            .get::<_, Address>(&ProfileKey::Username(username.clone()))
        {
            if existing_owner != owner {
                panic!("Username already taken");
            }
        }

        let now = env.ledger().timestamp();
        let timestamps = PackedTimestamps::new(now, now);
        let flags = PackedUserFlags::new(privacy_level.to_u8(), false, true);

        let default_hash = generate_string_hash(&String::from_str(&env, ""));
        let mut profile = if let Some(mut existing_profile) = env
            .storage()
            .instance()
            .get::<_, UserProfile>(&ProfileKey::User(owner.clone()))
        {
            // Update existing profile
            existing_profile.username = username.clone();
            existing_profile.timestamps =
                PackedTimestamps::new(existing_profile.timestamps.created_at(), now);
            existing_profile.flags = PackedUserFlags::new(
                privacy_level.to_u8(),
                existing_profile.flags.is_verified(),
                existing_profile.flags.is_active(),
            );
            existing_profile
        } else {
            // Create new profile with placeholder hashes
            UserProfile {
                owner: owner.clone(),
                username: username.clone(),
                email_hash: default_hash,
                bio_hash: default_hash,
                avatar_hash: default_hash,
                timestamps,
                achievement_count: 0,
                credential_count: 0,
                reputation: 0,
                flags,
            }
        };

        // Handle optional data uniformly after if/else
        if let Some(e) = email {
            profile.email_hash = generate_string_hash(&e);
            env.storage()
                .instance()
                .set(&ProfileKey::UserEmail(owner.clone()), &e);
        }
        if let Some(b) = bio {
            profile.bio_hash = generate_string_hash(&b);
            env.storage()
                .instance()
                .set(&ProfileKey::UserBio(owner.clone()), &b);
        }
        if let Some(a) = avatar_url {
            profile.avatar_hash = generate_string_hash(&a);
            env.storage()
                .instance()
                .set(&ProfileKey::UserAvatar(owner.clone()), &a);
        }

        // Store the profile
        env.storage()
            .instance()
            .set(&ProfileKey::User(owner.clone()), &profile);
        // Store username mapping for uniqueness check
        env.storage()
            .instance()
            .set(&ProfileKey::Username(username), &owner);

        // Emit event for profile update
        env.events().publish(
            (symbol_short!("profile"), symbol_short!("updated")),
            (&owner,),
        );

        profile
    }

    /// Get user profile by address
    pub fn get_profile(env: Env, user: Address) -> Option<UserProfile> {
        env.storage().instance().get(&ProfileKey::User(user))
    }

    /// Get user profile by username
    pub fn get_profile_by_username(env: Env, username: String) -> Option<UserProfile> {
        if let Some(owner) = env
            .storage()
            .instance()
            .get::<_, Address>(&ProfileKey::Username(username))
        {
            env.storage().instance().get(&ProfileKey::User(owner))
        } else {
            None
        }
    }

    /// Add an achievement to a user with optimized storage
    pub fn add_achievement(
        env: Env,
        user: Address,
        title: String,
        description: String,
        badge_url: Option<String>,
    ) -> u64 {
        user.require_auth();

        let achievement_id = Self::get_next_achievement_id(&env);
        let timestamp = env.ledger().timestamp();

        // Pack timestamp and verification status
        let packed_timestamp = timestamp << 1; // Reserve bit 0 for verification status
        let badge_hash =
            generate_string_hash(&badge_url.as_ref().cloned().unwrap_or_else(|| String::from_str(&env, "")));

        // Create achievement
        let achievement = Achievement {
            id: achievement_id,
            user: user.clone(),
            title,
            description,
            timestamp: packed_timestamp,
            badge_hash,
        };

        // Store the achievement
        env.storage()
            .instance()
            .set(&ProfileKey::Achievement(achievement_id), &achievement);
        env.storage().instance().set(
            &ProfileKey::AchievementByUser(user.clone(), achievement_id),
            &(),
        );

        // Store badge URL separately if provided
        if let Some(badge_url) = badge_url {
            env.storage()
                .instance()
                .set(&ProfileKey::UserAvatar(user.clone()), &badge_url); // Reuse storage key
        }

        // Update user achievement count
        if let Some(mut profile) = env
            .storage()
            .instance()
            .get::<_, UserProfile>(&ProfileKey::User(user.clone()))
        {
            profile.achievement_count += 1;
            profile.timestamps = PackedTimestamps::new(profile.timestamps.created_at(), timestamp);
            env.storage()
                .instance()
                .set(&ProfileKey::User(user.clone()), &profile);
        }

        // Also store the user's achievement list separately for easier access
        let mut user_achievements: Vec<u64> = env
            .storage()
            .instance()
            .get(&ProfileKey::UserAchievements(user.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        user_achievements.push_back(achievement_id);
        env.storage().instance().set(
            &ProfileKey::UserAchievements(user.clone()),
            &user_achievements,
        );

        // Emit event for achievement earned
        env.events().publish(
            (symbol_short!("ach"), symbol_short!("earn")),
            (user, achievement_id),
        );

        achievement_id
    }

    /// Get achievement by ID
    pub fn get_achievement(env: Env, achievement_id: u64) -> Option<Achievement> {
        env.storage()
            .instance()
            .get(&ProfileKey::Achievement(achievement_id))
    }

    /// Get all achievements for a user
    pub fn get_user_achievements(env: Env, user: Address) -> Vec<Achievement> {
        let mut achievements = Vec::new(&env);

        let user_achievements: Vec<u64> = env
            .storage()
            .instance()
            .get(&ProfileKey::UserAchievements(user))
            .unwrap_or_else(|| Vec::new(&env));

        for achievement_id in user_achievements.iter() {
            if let Some(achievement) = Self::get_achievement(env.clone(), achievement_id) {
                achievements.push_back(achievement);
            }
        }

        achievements
    }

    /// Verify an achievement using packed timestamp
    pub fn verify_achievement(env: Env, admin: Address, achievement_id: u64) -> bool {
        admin.require_auth();

        let mut achievement = env
            .storage()
            .instance()
            .get::<_, Achievement>(&ProfileKey::Achievement(achievement_id))
            .unwrap_or_else(|| panic!("Achievement not found"));

        // Set verification bit (bit 0)
        achievement.timestamp |= 1u64;
        env.storage()
            .instance()
            .set(&ProfileKey::Achievement(achievement_id), &achievement);

        // Emit event for verification
        env.events().publish(
            (symbol_short!("ach"), symbol_short!("ver")),
            (achievement_id,),
        );

        true
    }

    /// Check if profile is authentic by verifying it exists and has proper data
    pub fn verify_profile_authenticity(env: Env, user: Address) -> bool {
        if let Some(profile) = env
            .storage()
            .instance()
            .get::<_, UserProfile>(&ProfileKey::User(user))
        {
            // Perform basic checks for authenticity
            // Here we just check that the profile exists and has a username
            profile.username.len() > 0
        } else {
            false
        }
    }

    /// Get next achievement ID
    fn get_next_achievement_id(env: &Env) -> u64 {
        let current_id: u64 = env
            .storage()
            .instance()
            .get(&symbol_short!("nxt_ach"))
            .unwrap_or(0);

        let next_id = current_id + 1;
        env.storage()
            .instance()
            .set(&symbol_short!("nxt_ach"), &next_id);

        next_id
    }

    /// Update privacy level for a profile using packed flags
    pub fn update_privacy_level(env: Env, user: Address, privacy_level: PrivacyLevel) -> bool {
        user.require_auth();

        let mut profile = env
            .storage()
            .instance()
            .get::<_, UserProfile>(&ProfileKey::User(user.clone()))
            .unwrap_or_else(|| panic!("Profile not found"));

        let now = env.ledger().timestamp();
        profile.flags = PackedUserFlags::new(
            privacy_level.to_u8(),
            profile.flags.is_verified(),
            profile.flags.is_active(),
        );
        profile.timestamps = PackedTimestamps::new(profile.timestamps.created_at(), now);

        env.storage()
            .instance()
            .set(&ProfileKey::User(user), &profile);

        true
    }

    /// Get profile with privacy check using packed flags
    pub fn get_profile_with_privacy_check(
        env: Env,
        requester: Address,
        target_user: Address,
    ) -> Option<UserProfile> {
        if let Some(profile) = env
            .storage()
            .instance()
            .get::<_, UserProfile>(&ProfileKey::User(target_user.clone()))
        {
            let privacy_level = PrivacyLevel::from_u8(profile.flags.privacy_level());
            match privacy_level {
                PrivacyLevel::Public => Some(profile),
                PrivacyLevel::Private => {
                    if requester == target_user.clone() {
                        Some(profile)
                    } else {
                        None
                    }
                }
                PrivacyLevel::FriendsOnly => {
                    // In a real implementation, this would check friendship status
                    // For now, we'll allow access only to the profile owner
                    if requester == target_user.clone() {
                        Some(profile)
                    } else {
                        None
                    }
                }
            }
        } else {
            None
        }
    }

}
