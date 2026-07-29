#![cfg_attr(not(test), no_std)]
#![allow(deprecated)]
#![allow(clippy::too_many_arguments)]
#![allow(clippy::manual_checked_ops)]
#![allow(clippy::needless_range_loop)]
extern crate alloc;
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, BytesN, Env, String, Vec};

use crate::credential_registry::{BatchCredentialParams, MAX_BATCH_SIZE};
use crate::utils::pause::PauseUtils;
use crate::utils::validation::{
    validate_non_zero_address, validate_positive_u64, validate_string_length,
    MAX_DESCRIPTION_LENGTH, MAX_SHORT_TEXT_LENGTH, MAX_TITLE_LENGTH, MAX_URI_LENGTH,
};

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
            buf.swap(i, j);
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

pub mod credentials;
#[cfg(test)]
mod credentials_test;

pub mod credential_events;
#[cfg(test)]
mod credential_events_test;

pub mod course_events;
#[cfg(test)]
mod course_events_test;

pub mod tokenomics_events;
#[cfg(test)]
mod tokenomics_events_test;

pub mod credential_registry;
#[cfg(test)]
mod credential_registry_test;
pub mod dynamic_nft;
#[cfg(test)]
mod dynamic_nft_test;

pub mod attestation_protocol;
#[cfg(test)]
mod attestation_protocol_test;

// Modules commented out to avoid duplicate contract symbol conflicts
// These should be in separate crates or behind feature flags
// pub mod time_lock_credential;
// pub mod vrf_system;
// pub mod progress;
// pub mod event_logger;
pub mod user_profile;
// pub mod analyticsStorage;
// pub mod consciousness;
// pub mod courseMetadata;
// pub mod syncCoordination;
pub mod proctoring;
pub mod tokenomics;
#[cfg(test)]
mod analyticsStorage_test;
#[cfg(test)]
mod consciousness_test;
#[cfg(test)]
mod courseMetadata_test;
#[cfg(test)]
mod event_logger_test;
#[cfg(test)]
mod progress_test;
#[cfg(test)]
mod syncCoordination_test;
#[cfg(test)]
mod time_lock_credential_test;
#[cfg(test)]
mod user_profile_test;
#[cfg(test)]
mod vrf_system_test;

#[cfg(test)]
mod pause_test;

pub mod utils;

pub mod dna_services;
pub mod dna_storage;
#[cfg(test)]
mod dna_storage_checkpoint_test;
#[cfg(test)]
mod dna_storage_test;

use crate::profile_nft::ProfileNFT;
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
        validate_non_zero_address(&env, &admin);

        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::CredentialCount, &0u64);
        env.storage().instance().set(&DataKey::CourseCount, &0u64);
        env.storage()
            .instance()
            .set(&DataKey::AchievementCount, &0u64);
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
        PauseUtils::require_not_paused(&env);
        // Validate inputs before any state access (issue #117).
        validate_non_zero_address(&env, &recipient);
        validate_string_length(&env, &title, MAX_TITLE_LENGTH);
        validate_string_length(&env, &description, MAX_DESCRIPTION_LENGTH);
        validate_string_length(&env, &course_id, MAX_SHORT_TEXT_LENGTH);
        validate_string_length(&env, &ipfs_hash, MAX_URI_LENGTH);

        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));

        if issuer != admin {
            panic!("Only admin can issue credentials");
        }

        let count: u64 = env
            .storage()
            .instance()
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

        env.storage()
            .instance()
            .set(&DataKey::Credential(credential_id), &credential);
        env.storage()
            .instance()
            .set(&DataKey::CredentialCount, &credential_id);

        // Update user credential count
        Self::increment_user_credential_count(&env, recipient.clone());

        // Emit standardized credential lifecycle event (published on-chain + queryable record).
        crate::credential_events::publish_credential_event(
            &env,
            crate::credential_events::CredentialLifecycleEvent::Issued,
            credential_id,
            issuer,
        );

        credential_id
    }

    /// Verify a credential using packed timestamp.
    ///
    /// Accepts a `verifier` address so verifications are recorded in the
    /// credential lifecycle event log for full auditability. This wrapper
    /// delegates to [`crate::credentials::verify_credential`]; callers must
    /// have issued the credential through the same `credentials` module
    /// (which uses the `CredentialKey` / `"admin"` storage namespace) for
    /// verification to succeed.
    pub fn verify_credential(env: Env, credential_id: u64, verifier: Address) -> bool {
        PauseUtils::require_not_paused(&env);
        crate::credentials::verify_credential(&env, credential_id, verifier)
    }

    /// Get credential details
    pub fn get_credential(env: Env, credential_id: u64) -> Credential {
        env.storage()
            .instance()
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
        PauseUtils::require_not_paused(&env);
        // Validate inputs before any state access (issue #117).
        validate_string_length(&env, &title, MAX_TITLE_LENGTH);
        validate_string_length(&env, &description, MAX_DESCRIPTION_LENGTH);
        validate_positive_u64(&env, price);

        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));

        if instructor != admin {
            panic!("Only admin can create courses");
        }

        let course_count: u64 = env
            .storage()
            .instance()
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

        env.storage()
            .instance()
            .set(&DataKey::Course(course_id), &course);
        env.storage()
            .instance()
            .set(&DataKey::CourseCount, &course_id);

        course_id
    }

    /// Get user profile with optimized storage
    pub fn get_profile(_env: Env, user: Address) -> Profile {
        // Simplified - returns default profile (user_profile module disabled to avoid conflicts)
        Profile {
            owner: user,
            credential_count: 0,
            achievement_count: 0,
            reputation: 0,
        }
    }

    /// Get total credential count
    pub fn get_credential_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::CredentialCount)
            .unwrap_or(0)
    }

    /// Helper function to increment user credential count (disabled - requires user_profile module)
    fn increment_user_credential_count(_env: &Env, _user: Address) {
        // Disabled to avoid module conflicts
    }

    /// Helper function to increment user achievement count (disabled - requires user_profile module)
    #[allow(dead_code)]
    fn increment_user_achievement_count(_env: &Env, _user: Address) {
        // Disabled to avoid module conflicts
    }

    /// Get total course count
    pub fn get_course_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::CourseCount)
            .unwrap_or(0)
    }

    /// Get total achievement count
    pub fn get_achievement_count(env: Env) -> u64 {
        env.storage()
            .instance()
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
        PauseUtils::require_not_paused(&env);
        credential_registry::issue_credential_with_expiration(
            &env,
            issuer,
            recipient,
            title,
            description,
            course_id,
            ipfs_hash,
            validity_duration,
        )
    }

    /// Renew an existing credential
    pub fn renew_credential(
        env: Env,
        credential_id: u64,
        renewer: Address,
        extension_duration: u64,
    ) -> bool {
        PauseUtils::require_not_paused(&env);
        credential_registry::renew_credential(&env, credential_id, renewer, extension_duration)
    }

    /// Check and update credential expiration status
    pub fn check_credential_expiration(env: Env, credential_id: u64) -> u32 {
        let status = credential_registry::check_credential_expiration(&env, credential_id);
        status.to_u8() as u32
    }

    /// Get credential with current expiration status
    pub fn get_credential_with_status(
        env: Env,
        credential_id: u64,
    ) -> credential_registry::CredentialRegistry {
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
    pub fn get_credential_renewal_history(
        env: Env,
        credential_id: u64,
    ) -> Vec<credential_registry::RenewalRecord> {
        credential_registry::get_renewal_history(&env, credential_id)
    }

    /// Revoke a credential (using registry)
    pub fn revoke_credential_registry(env: Env, credential_id: u64, revoker: Address) -> bool {
        PauseUtils::require_not_paused(&env);
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
        PauseUtils::require_not_paused(&env);
        credential_registry::batch_update_expiration_status(&env, credential_ids)
    }

    /// Whether a credential was issued through the proctored flow.
    pub fn is_proctored_credential(env: Env, credential_id: u64) -> bool {
        credential_registry::is_proctored_credential(&env, credential_id)
    }

    // ===== Proctoring =====

    /// Start a proctoring session.
    pub fn start_proctoring_session(
        env: Env,
        exam_id: String,
        student: Address,
        proctor: Address,
    ) -> u64 {
        proctoring::start_proctoring_session(&env, exam_id, student, proctor)
    }

    /// Submit the proctoring result for a session.
    pub fn submit_proctoring_result(
        env: Env,
        session_id: u64,
        result_data: String,
        proctor_signature: BytesN<64>,
    ) {
        proctoring::submit_proctoring_result(&env, session_id, result_data, proctor_signature)
    }

    /// Challenge a completed proctoring result.
    pub fn challenge_proctoring_result(
        env: Env,
        session_id: u64,
        challenger: Address,
        evidence: String,
    ) {
        proctoring::challenge_proctoring_result(&env, session_id, challenger, evidence)
    }

    /// Resolve a proctoring challenge.
    pub fn resolve_challenge(
        env: Env,
        session_id: u64,
        resolution: proctoring::ChallengeResolution,
        admin: Address,
    ) {
        proctoring::resolve_challenge(&env, session_id, resolution, admin)
    }

    /// Link a credential issuance to a proctoring session.
    pub fn register_proctored_credential(env: Env, session_id: u64, credential_id: u64) {
        proctoring::register_proctored_credential(&env, session_id, credential_id)
    }

    /// Check whether a session is eligible for a proctored credential.
    pub fn proctored_credential_is_eligible(env: Env, session_id: u64) -> bool {
        proctoring::proctored_credential_is_eligible(&env, session_id)
    }

    /// Get a stored proctoring session.
    pub fn get_proctoring_session(env: Env, session_id: u64) -> proctoring::ProctoringSession {
        proctoring::get_proctoring_session(&env, session_id)
    }

    /// Get a stored proctoring result.
    pub fn get_proctoring_result(
        env: Env,
        session_id: u64,
    ) -> Option<proctoring::ProctoringResult> {
        proctoring::get_proctoring_result(&env, session_id)
    }

    /// Get a stored challenge for a session.
    pub fn get_proctoring_challenge(
        env: Env,
        session_id: u64,
    ) -> Option<proctoring::ProctoringChallenge> {
        proctoring::get_proctoring_challenge(&env, session_id)
    }

    /// Get a stored challenge resolution for a session.
    pub fn get_proctoring_resolution(
        env: Env,
        session_id: u64,
    ) -> Option<proctoring::ProctoringResolutionRecord> {
        proctoring::get_proctoring_resolution(&env, session_id)
    }

    /// Get the number of proctoring sessions created so far.
    pub fn get_proctoring_session_count(env: Env) -> u64 {
        proctoring::get_proctoring_session_count(&env)
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
        PauseUtils::require_not_paused(&env);
        dynamic_nft::mint_dynamic_nft(&env, creator, recipient, base_uri, initial_metadata)
    }

    /// Evolve an NFT based on achievement
    pub fn evolve_nft(env: Env, token_id: u64, achievement_id: u64, new_metadata: String) -> bool {
        PauseUtils::require_not_paused(&env);
        dynamic_nft::evolve_nft(&env, token_id, achievement_id, new_metadata)
    }

    /// Fuse two NFTs to create a new one
    pub fn fuse_nfts(env: Env, token1_id: u64, token2_id: u64, recipient: Address) -> u64 {
        PauseUtils::require_not_paused(&env);
        dynamic_nft::fuse_nfts(&env, token1_id, token2_id, recipient)
    }

    /// Transfer NFT to new owner
    pub fn transfer_nft(env: Env, from: Address, to: Address, token_id: u64) {
        PauseUtils::require_not_paused(&env);
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

    // ===== Profile NFT Functions =====

    /// Mint a profile NFT for the caller. One per address.
    pub fn mint_profile_nft(
        env: Env,
        owner: Address,
        name: String,
        bio: String,
        avatar_url: String,
        skills: Vec<String>,
        website: Option<String>,
    ) -> u64 {
        PauseUtils::require_not_paused(&env);
        profile_nft::mint_profile_nft(&env, owner, name, bio, avatar_url, skills, website)
    }

    /// Update an existing profile NFT's metadata.
    pub fn update_profile_nft(
        env: Env,
        owner: Address,
        name: String,
        bio: String,
        avatar_url: String,
        skills: Vec<String>,
        website: Option<String>,
    ) -> bool {
        PauseUtils::require_not_paused(&env);
        profile_nft::update_profile_nft(&env, owner, name, bio, avatar_url, skills, website)
    }

    /// Get a profile NFT by token ID.
    pub fn get_profile_nft(env: Env, token_id: u64) -> ProfileNFT {
        profile_nft::get_profile_nft(&env, token_id)
    }

    /// Get a profile NFT by owner address.
    pub fn get_profile_nft_by_owner(env: Env, owner: Address) -> Option<ProfileNFT> {
        profile_nft::get_profile_nft_by_owner(&env, owner)
    }

    /// Check if an address has a profile NFT.
    pub fn has_profile_nft(env: Env, owner: Address) -> bool {
        profile_nft::has_profile_nft(&env, owner)
    }

    /// Burn the caller's profile NFT.
    pub fn burn_profile_nft(env: Env, owner: Address) -> bool {
        PauseUtils::require_not_paused(&env);
        profile_nft::burn_profile_nft(&env, owner)
    }

    /// Admin-only: verify a profile NFT.
    pub fn verify_profile_nft(env: Env, admin: Address, token_id: u64) -> bool {
        PauseUtils::require_not_paused(&env);
        profile_nft::verify_profile_nft(&env, admin, token_id)
    }

    /// Admin-only: unverify a profile NFT.
    pub fn unverify_profile_nft(env: Env, admin: Address, token_id: u64) -> bool {
        PauseUtils::require_not_paused(&env);
        profile_nft::unverify_profile_nft(&env, admin, token_id)
    }

    /// Get total profile NFT supply.
    pub fn get_profile_nft_supply(env: Env) -> u64 {
        profile_nft::get_total_supply(&env)
    }

    /// Get the token ID for an owner, if one exists. Falls back to a default (0)
    /// for backwards-compatibility so the return type remains u64.
    pub fn get_profile_nft_token_id(env: Env, owner: Address) -> u64 {
        profile_nft::get_token_id_for_owner(&env, owner).unwrap_or(0)
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

    // ===== Attestation Protocol (issue #122) =====

    /// Register a third-party verifier (attester).
    pub fn register_attester(
        env: Env,
        attester_address: Address,
        institution_name: String,
        verification_key: BytesN<32>,
    ) {
        PauseUtils::require_not_paused(&env);
        attestation_protocol::register_attester(
            &env,
            attester_address,
            institution_name,
            verification_key,
        )
    }

    /// Attest to a credential's validity as a registered attester.
    pub fn attest_credential(
        env: Env,
        attester: Address,
        credential_id: u64,
        signature: BytesN<64>,
        metadata: String,
    ) {
        PauseUtils::require_not_paused(&env);
        attestation_protocol::attest_credential(&env, attester, credential_id, signature, metadata)
    }

    /// Withdraw an attestation previously made by `attester`.
    pub fn revoke_attestation(env: Env, attester: Address, credential_id: u64) {
        PauseUtils::require_not_paused(&env);
        attestation_protocol::revoke_attestation(&env, attester, credential_id)
    }

    /// Get all attestations recorded for a credential.
    pub fn get_attestations(
        env: Env,
        credential_id: u64,
    ) -> Vec<attestation_protocol::CredentialAttestation> {
        attestation_protocol::get_attestations(&env, credential_id)
    }

    /// Check whether a specific attester has attested to a credential.
    pub fn is_attested_by(env: Env, credential_id: u64, attester: Address) -> bool {
        attestation_protocol::is_attested_by(&env, credential_id, attester)
    }

    /// Get an attester's profile.
    pub fn get_attester(env: Env, attester_address: Address) -> attestation_protocol::Attester {
        attestation_protocol::get_attester(&env, attester_address)
    }

    /// Whether an address is a registered attester.
    pub fn is_registered_attester(env: Env, attester_address: Address) -> bool {
        attestation_protocol::is_registered_attester(&env, attester_address)
    }

    /// Admin-only: deactivate an attester.
    pub fn deactivate_attester(env: Env, admin: Address, attester_address: Address) {
        PauseUtils::require_not_paused(&env);
        attestation_protocol::deactivate_attester(&env, admin, attester_address)
    }

    /// Admin-only: re-activate a deactivated attester.
    pub fn reactivate_attester(env: Env, admin: Address, attester_address: Address) {
        PauseUtils::require_not_paused(&env);
        attestation_protocol::reactivate_attester(&env, admin, attester_address)
    }

    /// Number of active attestations recorded against a credential.
    pub fn get_attestation_count(env: Env, credential_id: u64) -> u32 {
        credential_registry::get_attestation_count(&env, credential_id)
    }

    /// Issue multiple credentials in a single transaction (issue #118).
    ///
    /// Performs one authorization check for the issuer and stores every
    /// credential atomically — if any validation fails the whole batch rolls
    /// back. Returns the newly created credential IDs in input order.
    pub fn issue_credentials_batch(
        env: Env,
        issuer: Address,
        params: Vec<BatchCredentialParams>,
    ) -> Vec<u64> {
        PauseUtils::require_not_paused(&env);
        credential_registry::issue_credentials_batch(&env, issuer, params)
    }

    /// Return the maximum number of credentials allowed in a single batch.
    pub fn max_batch_size(_env: Env) -> u32 {
        MAX_BATCH_SIZE
    }

    // ===== Pause / Unpause (Circuit Breaker) =====

    /// Pause the contract (Admin only)
    pub fn pause(env: Env, admin: Address) {
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        PauseUtils::pause(&env, admin, stored_admin);
    }

    /// Unpause the contract (Admin only)
    pub fn unpause(env: Env, admin: Address) {
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        PauseUtils::unpause(&env, admin, stored_admin);
    }

    /// Check if the contract is paused
    pub fn is_paused(env: Env) -> bool {
        PauseUtils::is_paused(&env)
    }
}
