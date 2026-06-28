//! # Credential Core Module
//!
//! Core credential lifecycle management: issuance, verification, and revocation.
//! Uses packed storage with bit-packing for revocation status to minimize on-chain
//! storage footprint.
//!
//! ## Key Design Decisions
//!
//! - **Packed timestamps**: The `timestamp` field uses bit 0 as a revocation flag
//!   and bits 1..=63 for the ledger timestamp. See [`Credential::is_revoked`]
//!   and [`Credential::issued_at`].
//! - **Description hashing**: Descriptions are hashed to `u64` to avoid storing
//!   large strings on-chain. The full description is stored in instance storage
//!   separately.
//! - **Event-driven**: Every state change publishes a [`CredentialLifecycleEvent`]
//!   for off-chain indexing via [`credential_events`].

use crate::credential_events::{
    publish_credential_event, CredentialLifecycleEvent,
};
use crate::utils::storage::{EntityType, StorageUtils};
use soroban_sdk::{contracttype, Address, Env, String, Symbol, Vec};

/// Optimized credential keys with better organization
#[contracttype]
pub enum CredentialKey {
    Credential(u64),
    UserCredentials(Address),
    CredentialCount,
    CredentialMetadata(u64),    // Separate metadata storage
    CredentialRevocations(u64), // Separate revocation tracking
}

/// Optimized credential with packed verification status.
///
/// `timestamp` uses bit 0 as a revocation flag and bits 1..=63 for the
/// ledger timestamp at issuance. Use [`Credential::is_revoked`] to
/// extract the flag and [`Credential::issued_at`] to extract the timestamp.
#[contracttype]
pub struct Credential {
    pub id: u64,
    pub issuer: Address,
    pub recipient: Address,
    pub title: String,
    pub description_hash: u64, // Hash of description string (u64 to avoid format! in no_std)
    pub course_id: String,
    pub timestamp: u64, // Packed completion_date and revocation status
    pub ipfs_hash: String,
}

impl Credential {
    /// Returns `true` if the credential has been revoked.
    /// Revocation is tracked in bit 0 of the `timestamp` field.
    pub fn is_revoked(&self) -> bool {
        (self.timestamp & 1) != 0
    }

    /// Returns the ledger timestamp at issuance (bit 0 stripped).
    pub fn issued_at(&self) -> u64 {
        self.timestamp >> 1
    }
}

/// Issue a new credential with packed storage.
///
/// The credential's `timestamp` is bit-packed: bits 1..=63 hold the ledger
/// timestamp and bit 0 is reserved for the revocation flag (initially 0).
///
/// # Parameters
/// * `env` - Soroban environment.
/// * `issuer` - Must match the stored admin address (`"admin"` key).
/// * `recipient` - The credential recipient.
/// * `title` - Credential title.
/// * `description` - Full description (hashed for storage efficiency).
/// * `course_id` - Associated course identifier.
/// * `ipfs_hash` - IPFS content hash for off-chain metadata.
///
/// # Returns
/// The newly assigned credential ID.
pub fn issue_credential(
    env: &Env,
    issuer: Address,
    recipient: Address,
    title: String,
    description: String,
    course_id: String,
    ipfs_hash: String,
) -> u64 {
    issuer.require_auth();

    let admin: Address = env.storage().instance()
        .get(&Symbol::new(env, "admin"))
        .unwrap_or_else(|| panic!("Admin not set"));
    if issuer != admin {
        panic!("Unauthorized issuer");
    }

    // Use shared storage utility for ID generation
    let credential_id = StorageUtils::get_next_id(env, EntityType::Credential);

    // Pack timestamp and revocation status
    let timestamp = env.ledger().timestamp();
    let packed_timestamp = timestamp << 1; // Reserve bit 0 for revocation status

    // Generate hash for description to save storage space
    let description_hash = generate_string_hash(&description);

    let credential = Credential {
        id: credential_id,
        issuer: issuer.clone(),
        recipient: recipient.clone(),
        title,
        description_hash,
        course_id,
        timestamp: packed_timestamp,
        ipfs_hash,
    };

    // Store credential in persistent storage
    env.storage()
        .persistent()
        .set(&CredentialKey::Credential(credential_id), &credential);

    // Store description separately if needed for verification
    env.storage().instance().set(
        &CredentialKey::CredentialMetadata(credential_id),
        &description,
    );

    // Integrate with user profile
    crate::user_profile::add_credential(env, recipient.clone(), credential_id);

    // Update credential count
    env.storage()
        .instance()
        .set(&CredentialKey::CredentialCount, &credential_id);

    // Emit lifecycle event (publishes on-chain event + records for queryability)
    publish_credential_event(
        env,
        CredentialLifecycleEvent::Issued,
        credential_id,
        issuer,
    );

    credential_id
}

/// Verify a credential, checking revocation status and recording the
/// verification event.
///
/// Anyone may call this — the `verifier` is recorded for audit purposes,
/// not for access control.
///
/// # Parameters
/// * `env` - Soroban environment.
/// * `credential_id` - The credential to verify.
/// * `verifier` - Address performing the verification (recorded in events).
///
/// # Returns
/// `true` if the credential exists and is not revoked.
pub fn verify_credential(env: &Env, credential_id: u64, verifier: Address) -> bool {
    verifier.require_auth();

    let credential: Credential = env
        .storage()
        .persistent()
        .get(&CredentialKey::Credential(credential_id))
        .unwrap_or_else(|| panic!("Credential not found"));

    // Emit lifecycle event so verifications are recorded/indexable.
    publish_credential_event(
        env,
        CredentialLifecycleEvent::Verified,
        credential_id,
        verifier,
    );

    // Check revocation bit (bit 0)
    if credential.is_revoked() {
        return false; // Credential is revoked
    }

    // Here you can add more verification logic (e.g. check issuer signature, expiration)
    true
}

/// Revoke a credential by setting the revocation bit (bit 0) in the packed
/// timestamp. Only the stored admin may revoke.
///
/// # Parameters
/// * `env` - Soroban environment.
/// * `credential_id` - The credential to revoke.
/// * `revoker` - Must match the stored admin address.
pub fn revoke_credential(env: &Env, credential_id: u64, revoker: Address) {
    revoker.require_auth();

    let admin: Address = env.storage().instance()
        .get(&Symbol::new(env, "admin"))
        .unwrap_or_else(|| panic!("Admin not set"));
    if revoker != admin {
        panic!("Only admin can revoke");
    }

    let mut credential: Credential = env
        .storage()
        .persistent()
        .get(&CredentialKey::Credential(credential_id))
        .unwrap_or_else(|| panic!("Credential not found"));

    // Set revocation bit (bit 0)
    credential.timestamp |= 1u64;
    env.storage()
        .persistent()
        .set(&CredentialKey::Credential(credential_id), &credential);

    // Store revocation record
    let revocation_time = env.ledger().timestamp();
    env.storage().instance().set(
        &CredentialKey::CredentialRevocations(credential_id),
        &revocation_time,
    );

    // Emit lifecycle event so revocations are recorded/indexable.
    publish_credential_event(
        env,
        CredentialLifecycleEvent::Revoked,
        credential_id,
        revoker,
    );
}

/// Get all credential IDs for a user.
///
/// # Returns
/// A vector of credential IDs, or an empty vector if the user has none.
pub fn get_user_credentials(env: &Env, user: Address) -> Vec<u64> {
    env.storage()
        .persistent()
        .get(&CredentialKey::UserCredentials(user))
        .unwrap_or_else(|| Vec::new(env))
}

/// Get the full [`Credential`] struct by ID.
///
/// # Panics
/// Panics if no credential exists with the given ID.
pub fn get_credential(env: &Env, credential_id: u64) -> Credential {
    env.storage()
        .persistent()
        .get(&CredentialKey::Credential(credential_id))
        .unwrap_or_else(|| panic!("Credential not found"))
}

/// Get the original description string for a credential (stored separately).
pub fn get_credential_description(env: &Env, credential_id: u64) -> Option<String> {
    env.storage()
        .instance()
        .get(&CredentialKey::CredentialMetadata(credential_id))
}

/// Get the revocation timestamp for a credential, if revoked.
pub fn get_credential_revocation_time(env: &Env, credential_id: u64) -> Option<u64> {
    env.storage()
        .instance()
        .get(&CredentialKey::CredentialRevocations(credential_id))
}

/// Get the total number of credentials issued.
pub fn get_credential_count(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&CredentialKey::CredentialCount)
        .unwrap_or(0)
}

/// Generate hash for string data (returns u64 instead of hex string to avoid format!)
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
