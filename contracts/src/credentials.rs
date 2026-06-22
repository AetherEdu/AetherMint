use crate::credential_events::{
    publish_credential_event, CredentialLifecycleEvent,
};
use crate::utils::storage::{EntityType, StorageUtils};
use soroban_sdk::{contracttype, Address, Env, String, Vec};

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

/// Issue a new credential with optimized storage
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

    // RBAC: require Issuer role
    crate::access_control::require_role(env, &issuer, crate::access_control::Role::Issuer);

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

/// Verify a credential using packed timestamp.
///
/// The `verifier` address is recorded as the actor that performed the
/// verification so a complete audit trail is preserved. Anyone can verify
/// a credential - the verifier is captured for indexing purposes, not
/// for access control.
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

/// Revoke a credential using packed timestamp
pub fn revoke_credential(env: &Env, credential_id: u64, revoker: Address) {
    revoker.require_auth();

    // RBAC: require Admin role
    crate::access_control::require_role(env, &revoker, crate::access_control::Role::Admin);

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

/// Get user credentials with optimized storage
pub fn get_user_credentials(env: &Env, user: Address) -> Vec<u64> {
    env.storage()
        .persistent()
        .get(&CredentialKey::UserCredentials(user))
        .unwrap_or_else(|| Vec::new(env))
}

/// Get credential details with optional description
pub fn get_credential(env: &Env, credential_id: u64) -> Credential {
    env.storage()
        .persistent()
        .get(&CredentialKey::Credential(credential_id))
        .unwrap_or_else(|| panic!("Credential not found"))
}

/// Get credential description if needed
pub fn get_credential_description(env: &Env, credential_id: u64) -> Option<String> {
    env.storage()
        .instance()
        .get(&CredentialKey::CredentialMetadata(credential_id))
}

/// Get credential revocation time
pub fn get_credential_revocation_time(env: &Env, credential_id: u64) -> Option<u64> {
    env.storage()
        .instance()
        .get(&CredentialKey::CredentialRevocations(credential_id))
}

    // Get credential count with optimized storage
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
