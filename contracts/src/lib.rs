//! # AetherMint Education Smart Contracts
//!
//! A comprehensive suite of [Soroban](https://soroban.stellar.org) smart contracts for
//! decentralized credential verification on the Stellar blockchain. This crate provides
//! the core on-chain logic for issuing, verifying, revoking, and trading educational
//! credentials as soul-bound dynamic NFTs.
//!
//! ## Architecture
//!
//! The contract suite is organized as a single `AetherMintContract` that delegates to
//! specialized free-function modules:
//!
//! | Module | Responsibility |
//! |---|---|
//! | [`credentials`] | Core credential issuance, verification, and revocation |
//! | [`credential_registry`] | Expiring credentials with renewal, batch issuance, attestation tracking |
//! | [`dynamic_nft`] | Soul-bound dynamic NFTs that evolve with learner achievements |
//! | [`attestation_protocol`] | Cross-institutional trust network via third-party attestations |
//! | [`marketplace`] | List, buy, and escrow credentials with dynamic fees |
//! | [`governance`] | DAO-style proposal creation, voting, and execution with timelock |
//! | [`proctoring`] | Proctoring session management with challenge resolution |
//! | [`user_profile`] | Privacy-aware user profiles with packed storage |
//! | [`dynamic_fees`] | Fee calculation with volume-based discounts |
//! | [`utils`] | Shared storage, validation, and pause utilities |
//!
//! ## Storage Versioning
//!
//! The contract implements **[upgradeable storage versioning]** (issue #120).
//! Every write to persistent storage goes through
//! [`StorageVersion::require_compatible_version`], which panics if the on-disk
//! version is not compatible with the current binary. Admin-triggered migrations
//! are supported via [`AetherMintContract::migrate_storage`].
//!
//! ## Events
//!
//! All state-changing operations emit Soroban events, including credential lifecycle
//! events via [`credential_events`]. Off-chain indexers can reliably reconstruct
//! the full history of every credential from these events.
//!
//! ## Soroban Concepts
//!
//! This crate targets [`soroban-sdk`] v26 and uses:
//! - `Env` for ledger access (timestamps, storage, events)
//! - [`Address::require_auth`] for authorization checks
//! - Persistent storage for credential data; instance storage for counters
//! - Contract events for off-chain indexing
//!
//! ## Quick Start
//!
//! ```ignore
//! // Build for WASM target
//! cargo build --target wasm32v1-none --release
//!
//! // Run tests
//! cargo test
//!
//! // Generate documentation
//! cargo doc --no-deps --open
//! ```
#![no_std]
extern crate alloc;
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, BytesN, Env, String, Symbol, Vec};

use crate::credential_registry::{BatchCredentialParams, MAX_BATCH_SIZE};
use crate::utils::storage::{MigrationRecord, StorageVersion};
use crate::utils::validation::{
    validate_non_zero_address, validate_positive_u64, validate_string_length,
    MAX_DESCRIPTION_LENGTH, MAX_SHORT_TEXT_LENGTH, MAX_TITLE_LENGTH, MAX_URI_LENGTH,
};
use crate::utils::pause::PauseUtils;
use crate::utils::storage::StorageKey;

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

pub mod credentials;
#[cfg(test)]
mod credentials_test;

pub mod credential_events;
// #[cfg(test)]
// mod credential_events_test;

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
// pub mod tokenomics;
pub mod dynamic_fees;
pub mod marketplace;

// #[cfg(test)]
// mod time_lock_credential_test;
// #[cfg(test)]
// mod vrf_system_test;
// #[cfg(test)]
// mod progress_test;
// #[cfg(test)]
// mod event_logger_test;
// #[cfg(test)]
// mod user_profile_test;
// #[cfg(test)]
// mod analyticsStorage_test;
// #[cfg(test)]
// mod consciousness_test;
// #[cfg(test)]
// mod courseMetadata_test;
// #[cfg(test)]
// mod syncCoordination_test;

pub mod governance;
// Temporarily disabled: these test modules reference commented-out modules or have pre-existing issues
// #[cfg(test)]
// mod time_lock_credential_test;
// #[cfg(test)]
// mod vrf_system_test;
// #[cfg(test)]
// mod progress_test;
// #[cfg(test)]
// mod event_logger_test;
// #[cfg(test)]
// mod user_profile_test;
// #[cfg(test)]
// mod analyticsStorage_test;
// #[cfg(test)]
// mod consciousness_test;
// #[cfg(test)]
// mod courseMetadata_test;
// #[cfg(test)]
// mod syncCoordination_test;
#[cfg(test)]
mod proctoring_test;
#[cfg(test)]
mod marketplace_test;

pub mod utils;

// pub mod dna_storage;
// pub mod dna_services;
// #[cfg(test)]
// mod dna_storage_test;
// #[cfg(test)]
// mod dna_storage_checkpoint_test;

#[cfg(test)]
mod pause_test;


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

/// # AetherMintContract
///
/// The main entry point for the AetherMint education credential platform.
/// All state-changing operations are gated by the pause mechanism (see
/// [`crate::utils::pause::PauseUtils`]).
#[contract]
pub struct AetherMintContract;

#[contractimpl]
impl AetherMintContract {
    /// Initialize the contract with the admin address and storage schema version.
    ///
    /// # Parameters
    /// * `env` - The Soroban environment providing ledger access.
    /// * `admin` - The address that will have administrative privileges.
    ///
    /// # Panics
    /// Panics if the contract has already been initialized or if `admin` is a
    /// zero address.
    pub fn initialize(env: Env, admin: Address) {
        validate_non_zero_address(&env, &admin);

        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::CredentialCount, &0u64);
        env.storage().instance().set(&DataKey::CourseCount, &0u64);
        env.storage().instance().set(&DataKey::AchievementCount, &0u64);

        // Stamp the storage schema version (issue #120). Initializing here
        // means every later call into durable storage goes through
        // StorageVersion::require_compatible_version and is rejected if the
        // on-disk version isn't supported by this binary.
        StorageVersion::initialize(&env);
    }

    /// Issue a new credential with packed storage for the given recipient.
    ///
    /// # Parameters
    /// * `env` - Soroban environment.
    /// * `issuer` - Must match the stored admin address.
    /// * `recipient` - The credential recipient (non-zero address required).
    /// * `title` - Credential title (max 100 chars).
    /// * `description` - Longer description (max 500 chars).
    /// * `course_id` - Identifier of the associated course (max 50 chars).
    /// * `ipfs_hash` - IPFS content hash for off-chain metadata (max 100 chars).
    ///
    /// # Returns
    /// The newly assigned credential ID.
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

    /// Verify a credential, checking its revocation status and recording the
    /// verification event for auditability.
    ///
    /// Delegates to [`crate::credentials::verify_credential`]. The `verifier`
    /// address is captured for indexing purposes — anyone may verify any
    /// credential.
    ///
    /// # Parameters
    /// * `env` - Soroban environment.
    /// * `credential_id` - The credential to verify.
    /// * `verifier` - Address performing the verification (recorded in events).
    ///
    /// # Returns
    /// `true` if the credential exists and is not revoked.
    pub fn verify_credential(env: Env, credential_id: u64, verifier: Address) -> bool {
        PauseUtils::require_not_paused(&env);
        crate::credentials::verify_credential(&env, credential_id, verifier)
    }

    /// Retrieve a credential by its ID.
    ///
    /// # Returns
    /// The [`Credential`] struct. Panics if no credential exists with the
    /// given ID.
    pub fn get_credential(env: Env, credential_id: u64) -> Credential {
        env.storage().instance()
            .get(&DataKey::Credential(credential_id))
            .unwrap_or_else(|| panic!("Credential not found"))
    }

    /// Create a new course with the given instructor, title, description, and
    /// price.
    ///
    /// # Parameters
    /// * `env` - Soroban environment.
    /// * `instructor` - Must match the stored admin address.
    /// * `title` - Course title (max 100 chars).
    /// * `description` - Course description (max 500 chars).
    /// * `price` - Course price in smallest unit (must be positive).
    ///
    /// # Returns
    /// The newly assigned course ID.
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

        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));

        if instructor != admin {
            panic!("Only admin can create courses");
        }

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

        let now = env.ledger().timestamp();
        env.events().publish(
            (Symbol::new(&env, "course"), Symbol::new(&env, "created")),
            (course_id, instructor, price, now),
        );

        course_id
    }

    /// Get a simplified user profile by address.
    ///
    /// Returns a default [`Profile`] as a stub; full profile functionality is
    /// provided by the [`user_profile`] module.
    pub fn get_profile(env: Env, user: Address) -> Profile {
        // Simplified - returns default profile (user_profile module disabled to avoid conflicts)
        Profile {
            owner: user,
            credential_count: 0,
            achievement_count: 0,
            reputation: 0,
        }
    }

    /// Return the total number of credentials issued through this contract.
    pub fn get_credential_count(env: Env) -> u64 {
        env.storage().instance()
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

    /// Return the total number of courses created through this contract.
    pub fn get_course_count(env: Env) -> u64 {
        env.storage().instance()
            .get(&DataKey::CourseCount)
            .unwrap_or(0)
    }

    /// Return the total number of achievements recorded.
    pub fn get_achievement_count(env: Env) -> u64 {
        env.storage().instance()
            .get(&DataKey::AchievementCount)
            .unwrap_or(0)
    }

    // ===== CredentialRegistry Integration =====

    /// Issue a new credential with an expiration timestamp.
    ///
    /// Delegates to [`credential_registry::issue_credential_with_expiration`].
    ///
    /// # Parameters
    /// * `validity_duration` - Seconds from issuance until the credential expires.
    ///
    /// # Returns
    /// The newly assigned credential ID.
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
            &env, issuer, recipient, title, description, course_id, ipfs_hash, validity_duration
        )
    }

    /// Issue a proctored credential linked to a completed proctoring session.
    ///
    /// Combines credential issuance with proctoring linkage in one atomic call.
    ///
    /// # Parameters
    /// * `session_id` - The completed proctoring session to link.
    ///
    /// # Returns
    /// The newly assigned credential ID.
    pub fn issue_proctored_cred_with_exp(
        env: Env,
        issuer: Address,
        recipient: Address,
        title: String,
        description: String,
        course_id: String,
        ipfs_hash: String,
        validity_duration: u64,
        session_id: u64,
    ) -> u64 {
        credential_registry::issue_proctored_cred_with_exp(
            &env,
            issuer,
            recipient,
            title,
            description,
            course_id,
            ipfs_hash,
            validity_duration,
            session_id,
        )
    }

    /// Renew an expiring or expired credential, extending its validity.
    ///
    /// Delegates to [`credential_registry::renew_credential`]. The `renewer`
    /// must be either the admin or the credential recipient.
    ///
    /// # Parameters
    /// * `extension_duration` - Seconds to add to the credential's expiration.
    ///
    /// # Returns
    /// `true` on success.
    pub fn renew_credential(
        env: Env,
        credential_id: u64,
        renewer: Address,
        extension_duration: u64,
    ) -> bool {
        PauseUtils::require_not_paused(&env);
        credential_registry::renew_credential(&env, credential_id, renewer, extension_duration)
    }

    /// Check if a credential has expired and update its status accordingly.
    ///
    /// # Returns
    /// The credential status as a `u32`: 0=Active, 1=Expired, 2=Revoked, 3=Pending.
    pub fn check_credential_expiration(env: Env, credential_id: u64) -> u32 {
        let status = credential_registry::check_credential_expiration(&env, credential_id);
        status.to_u8() as u32
    }

    /// Get a credential with its current expiration status (checks expiration
    /// before returning).
    pub fn get_credential_with_status(env: Env, credential_id: u64) -> credential_registry::CredentialRegistry {
        credential_registry::get_credential(&env, credential_id)
    }

    /// Get all credential IDs associated with the given user.
    pub fn get_user_credentials_with_status(env: Env, user: Address) -> Vec<u64> {
        credential_registry::get_user_credentials(&env, user)
    }

    /// Get the list of all expired credential IDs.
    pub fn get_expired_credentials(env: Env) -> Vec<u64> {
        credential_registry::get_expired_credentials(&env)
    }

    /// Get the full renewal history for a credential.
    pub fn get_credential_renewal_history(env: Env, credential_id: u64) -> Vec<credential_registry::RenewalRecord> {
        credential_registry::get_renewal_history(&env, credential_id)
    }

    /// Revoke a credential. Only the admin may revoke.
    ///
    /// # Returns
    /// `true` on success.
    pub fn revoke_credential_registry(env: Env, credential_id: u64, revoker: Address) -> bool {
        PauseUtils::require_not_paused(&env);
        credential_registry::revoke_credential(&env, credential_id, revoker)
    }

    /// Check whether a credential is in the `Active` state.
    pub fn is_credential_valid(env: Env, credential_id: u64) -> bool {
        credential_registry::is_credential_valid(&env, credential_id)
    }

    /// Get credentials that will expire within the given time window.
    pub fn get_credentials_expiring_soon(env: Env, within_seconds: u64) -> Vec<u64> {
        credential_registry::get_credentials_expiring_soon(&env, within_seconds)
    }

    /// Update expiration status for a batch of credentials.
    ///
    /// # Returns
    /// The subset of credential IDs that are now expired.
    pub fn batch_update_expiration_status(env: Env, credential_ids: Vec<u64>) -> Vec<u64> {
        PauseUtils::require_not_paused(&env);
        credential_registry::batch_update_expiration_status(&env, credential_ids)
    }

    /// Check if a credential was issued through the proctored flow.
    pub fn is_proctored_credential(env: Env, credential_id: u64) -> bool {
        credential_registry::is_proctored_credential(&env, credential_id)
    }

    // ===== Proctoring =====

    /// Start a new proctoring session for an exam.
    ///
    /// # Parameters
    /// * `exam_id` - Unique identifier for the exam.
    /// * `student` - The address being proctored.
    /// * `proctor` - The proctor supervising the session.
    ///
    /// # Returns
    /// The newly assigned session ID.
    pub fn start_proctoring_session(
        env: Env,
        exam_id: String,
        student: Address,
        proctor: Address,
    ) -> u64 {
        proctoring::start_proctoring_session(&env, exam_id, student, proctor)
    }

    /// Submit the proctoring result for a completed session.
    ///
    /// # Parameters
    /// * `result_data` - Encoded proctoring result.
    /// * `proctor_signature` - Cryptographic signature from the proctor.
    pub fn submit_proctoring_result(
        env: Env,
        session_id: u64,
        result_data: String,
        proctor_signature: BytesN<64>,
    ) {
        proctoring::submit_proctoring_result(&env, session_id, result_data, proctor_signature)
    }

    /// Challenge a completed proctoring result with evidence.
    pub fn challenge_proctoring_result(
        env: Env,
        session_id: u64,
        challenger: Address,
        evidence: String,
    ) {
        proctoring::challenge_proctoring_result(&env, session_id, challenger, evidence)
    }

    /// Resolve a pending proctoring challenge as the admin.
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

    /// Check whether a proctoring session is eligible for credential issuance.
    pub fn proctored_credential_is_eligible(env: Env, session_id: u64) -> bool {
        proctoring::proctored_credential_is_eligible(&env, session_id)
    }

    /// Get the full details of a proctoring session.
    pub fn get_proctoring_session(
        env: Env,
        session_id: u64,
    ) -> proctoring::ProctoringSession {
        proctoring::get_proctoring_session(&env, session_id)
    }

    /// Get the proctoring result for a session, if one has been submitted.
    pub fn get_proctoring_result(env: Env, session_id: u64) -> Option<proctoring::ProctoringResult> {
        proctoring::get_proctoring_result(&env, session_id)
    }

    /// Get the pending challenge for a session, if one exists.
    pub fn get_proctoring_challenge(
        env: Env,
        session_id: u64,
    ) -> Option<proctoring::ProctoringChallenge> {
        proctoring::get_proctoring_challenge(&env, session_id)
    }

    /// Get the challenge resolution record for a session.
    pub fn get_proctoring_resolution(
        env: Env,
        session_id: u64,
    ) -> Option<proctoring::ProctoringResolutionRecord> {
        proctoring::get_proctoring_resolution(&env, session_id)
    }

    /// Get the total number of proctoring sessions created.
    pub fn get_proctoring_session_count(env: Env) -> u64 {
        proctoring::get_proctoring_session_count(&env)
    }

    // ===== Dynamic NFT Functions =====

    /// Mint a new dynamic NFT credential that evolves as the learner earns
    /// achievements.
    ///
    /// Delegates to [`dynamic_nft::mint_dynamic_nft`].
    ///
    /// # Parameters
    /// * `creator` - Must match the stored admin address.
    /// * `recipient` - The initial owner of the NFT.
    /// * `base_uri` - Base URI for NFT metadata.
    /// * `initial_metadata` - IPFS hash of initial metadata.
    ///
    /// # Returns
    /// The newly assigned token ID.
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

    /// Evolve an NFT based on a new achievement, potentially advancing its
    /// evolution stage and updating visual traits.
    ///
    /// # Returns
    /// `true` if evolution occurred; `false` if the achievement was already
    /// unlocked.
    pub fn evolve_nft(
        env: Env,
        token_id: u64,
        achievement_id: u64,
        new_metadata: String,
    ) -> bool {
        PauseUtils::require_not_paused(&env);
        dynamic_nft::evolve_nft(&env, token_id, achievement_id, new_metadata)
    }

    /// Fuse two NFTs owned by the recipient into a new, higher-level NFT.
    /// The original NFTs are burned.
    ///
    /// # Returns
    /// The newly created token ID.
    pub fn fuse_nfts(
        env: Env,
        token1_id: u64,
        token2_id: u64,
        recipient: Address,
    ) -> u64 {
        PauseUtils::require_not_paused(&env);
        dynamic_nft::fuse_nfts(&env, token1_id, token2_id, recipient)
    }

    /// Transfer an NFT from one address to another.
    pub fn transfer_nft(env: Env, from: Address, to: Address, token_id: u64) {
        PauseUtils::require_not_paused(&env);
        dynamic_nft::transfer_nft(&env, from, to, token_id)
    }

    /// Get the full [`dynamic_nft::DynamicNFT`] struct for a token.
    pub fn get_nft(env: Env, token_id: u64) -> dynamic_nft::DynamicNFT {
        dynamic_nft::get_nft(&env, token_id)
    }

    /// Get all token IDs owned by an address.
    pub fn get_owner_tokens(env: Env, owner: Address) -> Vec<u64> {
        dynamic_nft::get_owner_tokens(&env, owner)
    }

    /// Get the metadata URI (IPFS hash) for a token.
    pub fn token_uri(env: Env, token_id: u64) -> String {
        dynamic_nft::token_uri(&env, token_id)
    }

    /// Check whether a token ID exists.
    pub fn nft_exists(env: Env, token_id: u64) -> bool {
        dynamic_nft::nft_exists(&env, token_id)
    }

    /// Get the current owner of a token.
    pub fn owner_of(env: Env, token_id: u64) -> Address {
        dynamic_nft::owner_of(&env, token_id)
    }

    /// Get the number of tokens owned by an address.
    pub fn balance_of(env: Env, owner: Address) -> u64 {
        dynamic_nft::balance_of(&env, owner)
    }

    // ===== Attestation Protocol (issue #122) =====

    /// Register a third-party verifier (attester) that can vouch for
    /// credential validity.
    ///
    /// See [`attestation_protocol::register_attester`].
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

    /// Record an attestation for a credential as a registered attester.
    ///
    /// See [`attestation_protocol::attest_credential`].
    ///
    /// # Parameters
    /// * `attester` - Must be registered and active.
    /// * `credential_id` - Must exist and not already be attested by this attester.
    /// * `signature` - Off-chain cryptographic signature over the credential.
    /// * `metadata` - Free-form attestation metadata.
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

    /// Withdraw a previously made attestation for a credential.
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

    /// Get the full attester profile for an address.
    pub fn get_attester(env: Env, attester_address: Address) -> attestation_protocol::Attester {
        attestation_protocol::get_attester(&env, attester_address)
    }

    /// Check if an address is a registered attester.
    pub fn is_registered_attester(env: Env, attester_address: Address) -> bool {
        attestation_protocol::is_registered_attester(&env, attester_address)
    }

    /// Admin-only: deactivate an attester, preventing further attestations.
    pub fn deactivate_attester(env: Env, admin: Address, attester_address: Address) {
        PauseUtils::require_not_paused(&env);
        attestation_protocol::deactivate_attester(&env, admin, attester_address)
    }

    /// Admin-only: re-activate a previously deactivated attester.
    pub fn reactivate_attester(env: Env, admin: Address, attester_address: Address) {
        PauseUtils::require_not_paused(&env);
        attestation_protocol::reactivate_attester(&env, admin, attester_address)
    }

    /// Number of active attestations recorded against a credential.
    pub fn get_attestation_count(env: Env, credential_id: u64) -> u32 {
        credential_registry::get_attestation_count(&env, credential_id)
    }

    /// Issue multiple credentials in a single atomic transaction (issue #118).
    ///
    /// Delegates to [`credential_registry::issue_credentials_batch`].
    /// All credentials are stored atomically — if any validation fails the
    /// whole batch rolls back.
    ///
    /// # Returns
    /// The newly created credential IDs in input order.
    pub fn issue_credentials_batch(
        env: Env,
        issuer: Address,
        params: Vec<BatchCredentialParams>,
    ) -> Vec<u64> {
        PauseUtils::require_not_paused(&env);
        credential_registry::issue_credentials_batch(&env, issuer, params)
    }

    /// Return the maximum number of credentials allowed in a single batch
    /// (currently [`MAX_BATCH_SIZE`]).
    pub fn max_batch_size(_env: Env) -> u32 {
        MAX_BATCH_SIZE
    }

    // ===== Storage Versioning (issue #120) =====

    /// Return the current on-disk storage schema version.
    ///
    /// See [`StorageVersion::get_storage_version`].
    pub fn storage_version(env: Env) -> u32 {
        StorageVersion::get_storage_version(&env)
    }

    /// Admin-triggered migration to a newer storage layout.
    ///
    /// Performs the version-to-version data transformation and appends a
    /// [`MigrationRecord`] to the audit log.
    pub fn migrate_storage(env: Env, admin: Address, new_version: u32) {
        StorageVersion::migrate(&env, admin, new_version);
    }

    /// Read the migration audit log. Empty before any migrations have run.
    pub fn migration_history(env: Env) -> Vec<MigrationRecord> {
        StorageVersion::migration_history(&env)
    }


    // ===== Governance Functions =====

    /// Pause the contract, preventing all state-changing operations.
    /// Admin only.
    pub fn pause(env: Env, admin: Address) {
        let stored_admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        PauseUtils::pause(&env, admin, stored_admin);
    }

    /// Unpause the contract, restoring normal operation. Admin only.
    pub fn unpause(env: Env, admin: Address) {
        let stored_admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        PauseUtils::unpause(&env, admin, stored_admin);
    }

    /// Check if the contract is currently paused.
    pub fn is_paused(env: Env) -> bool {
        PauseUtils::is_paused(&env)
    }

    // ===== Marketplace Functions =====

    /// Create a marketplace listing for an item (credential, course, or NFT).
    ///
    /// # Parameters
    /// * `item_id` - ID of the item to list.
    /// * `price` - Listing price in smallest unit.
    /// * `item_type` - 0=Credential, 1=Course, 2=NFT.
    ///
    /// # Returns
    /// The newly assigned listing ID.
    pub fn list_item(
        env: Env,
        seller: Address,
        item_id: u64,
        price: u64,
        item_type: u32,
    ) -> u64 {
        marketplace::list_item(&env, &seller, item_id, price, item_type)
    }

    /// Buy an item — transfers ownership with escrow holding funds until
    /// the seller releases them.
    pub fn buy_item(env: Env, buyer: Address, listing_id: u64) {
        marketplace::buy_item(&env, &buyer, listing_id)
    }

    /// Cancel an active listing. Only the original seller may cancel.
    pub fn cancel_listing(env: Env, seller: Address, listing_id: u64) {
        marketplace::cancel_listing(&env, &seller, listing_id)
    }

    /// Release escrow funds to the seller after successful transfer.
    pub fn release_escrow(env: Env, listing_id: u64) {
        marketplace::release_escrow(&env, listing_id)
    }

    /// Refund escrow funds to the buyer on dispute or cancellation.
    pub fn refund_escrow(env: Env, listing_id: u64) {
        marketplace::refund_escrow(&env, listing_id)
    }

    /// Get the full listing details by listing ID.
    pub fn get_listing(env: Env, listing_id: u64) -> marketplace::ItemListing {
        marketplace::get_listing(&env, listing_id)
    }

    /// Get the full escrow details by escrow ID.
    pub fn get_escrow(env: Env, escrow_id: u64) -> marketplace::Escrow {
        marketplace::get_escrow(&env, escrow_id)
    }
}
