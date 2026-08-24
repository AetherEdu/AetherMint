// This module emits events via the legacy `env.events().publish` API
// (deprecated in soroban-sdk 26). Scoped here rather than crate-wide until it
// is migrated to the `#[contractevent]` macro.
#![allow(deprecated)]

use crate::credential_events::{publish_credential_event, CredentialLifecycleEvent};
use crate::utils::storage::{EntityType, StorageUtils, StorageVersion};
use crate::utils::validation::{
    validate_duration, validate_non_zero_address, validate_string_length, MAX_DESCRIPTION_LENGTH,
    MAX_SHORT_TEXT_LENGTH, MAX_TITLE_LENGTH, MAX_URI_LENGTH,
};
use soroban_sdk::{contracttype, Address, Env, String, Symbol, Vec};

/// Credential status enumeration
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CredentialStatus {
    Active = 0,
    Expired = 1,
    Revoked = 2,
    Pending = 3,
}

impl CredentialStatus {
    pub fn to_u8(&self) -> u8 {
        match self {
            CredentialStatus::Active => 0,
            CredentialStatus::Expired => 1,
            CredentialStatus::Revoked => 2,
            CredentialStatus::Pending => 3,
        }
    }

    pub fn from_u8(value: u8) -> Self {
        match value {
            0 => CredentialStatus::Active,
            1 => CredentialStatus::Expired,
            2 => CredentialStatus::Revoked,
            3 => CredentialStatus::Pending,
            _ => CredentialStatus::Pending,
        }
    }
}

/// Enhanced credential with expiration support
#[contracttype]
#[derive(Clone)]
pub struct CredentialRegistry {
    pub id: u64,
    pub issuer: Address,
    pub recipient: Address,
    pub title: String,
    pub description: String,
    pub course_id: String,
    pub issued_at: u64,
    pub expires_at: u64,
    pub status: CredentialStatus,
    pub proctored: bool,
    pub ipfs_hash: String,
    pub renewal_count: u32,
    pub last_renewed_at: Option<u64>,
}

/// Credential registry storage keys
#[contracttype]
pub enum CredentialRegistryKey {
    Credential(u64),
    UserCredentials(Address),
    CredentialCount,
    ExpiredCredentials,
    RenewalHistory(u64),   // credential_id -> Vec<RenewalRecord>
    AttestationCount(u64), // credential_id -> number of active attestations
}

/// Renewal record for tracking credential renewals
#[contracttype]
#[derive(Clone)]
pub struct RenewalRecord {
    pub renewed_at: u64,
    pub old_expires_at: u64,
    pub new_expires_at: u64,
    pub renewed_by: Address,
}

/// Events for credential operations
#[contracttype]
#[derive(Clone)]
pub enum CredentialEvent {
    Issued(u64),        // credential_id
    Expired(u64),       // credential_id
    Renewed(u64),       // credential_id
    Revoked(u64),       // credential_id
    StatusChanged(u64), // credential_id
}

/// Issue a new credential with expiration support
#[allow(clippy::too_many_arguments)] // Contract-facing signature; kept as-is.
pub fn issue_credential_with_expiration(
    env: &Env,
    issuer: Address,
    recipient: Address,
    title: String,
    description: String,
    course_id: String,
    ipfs_hash: String,
    validity_duration: u64, // Duration in seconds from issuance
) -> u64 {
    // Reject writes against an unrecognized storage layout (issue #120).
    StorageVersion::require_compatible_version(env);

    issuer.require_auth();

    // Validate inputs before any state access (issue #117).
    validate_non_zero_address(env, &recipient);
    validate_string_length(env, &title, MAX_TITLE_LENGTH);
    validate_string_length(env, &description, MAX_DESCRIPTION_LENGTH);
    validate_string_length(env, &course_id, MAX_SHORT_TEXT_LENGTH);
    validate_string_length(env, &ipfs_hash, MAX_URI_LENGTH);
    validate_duration(env, validity_duration);

    // RBAC: require Issuer role (Admin also satisfies via role inheritance)
    crate::access_control::require_role(env, &issuer, crate::access_control::Role::Issuer);

    let credential_id = StorageUtils::get_next_id(env, EntityType::Credential);
    let current_time = env.ledger().timestamp();

    let credential = CredentialRegistry {
        id: credential_id,
        issuer: issuer.clone(),
        recipient: recipient.clone(),
        title,
        description,
        course_id,
        issued_at: current_time,
        expires_at: current_time + validity_duration,
        status: CredentialStatus::Active,
        proctored: false,
        ipfs_hash,
        renewal_count: 0,
        last_renewed_at: None,
    };

    // Store credential
    env.storage().persistent().set(
        &CredentialRegistryKey::Credential(credential_id),
        &credential,
    );

    // Add to user's credential list
    let mut user_creds = env
        .storage()
        .persistent()
        .get(&CredentialRegistryKey::UserCredentials(recipient.clone()))
        .unwrap_or_else(|| Vec::new(env));
    user_creds.push_back(credential_id);
    env.storage().persistent().set(
        &CredentialRegistryKey::UserCredentials(recipient),
        &user_creds,
    );

    // Update credential count
    env.storage()
        .instance()
        .set(&CredentialRegistryKey::CredentialCount, &credential_id);

    // Emit credential lifecycle event with consistent
    // (credential_id, actor, timestamp) payload and queryable record.
    publish_credential_event(env, CredentialLifecycleEvent::Issued, credential_id, issuer);

    credential_id
}

/// Renew an existing credential
pub fn renew_credential(
    env: &Env,
    credential_id: u64,
    renewer: Address,
    extension_duration: u64,
) -> bool {
    StorageVersion::require_compatible_version(env);
    renewer.require_auth();

    // Validate the extension window before any state access (issue #117).
    validate_duration(env, extension_duration);

    let mut credential: CredentialRegistry = env
        .storage()
        .persistent()
        .get(&CredentialRegistryKey::Credential(credential_id))
        .unwrap_or_else(|| panic!("Credential not found"));

    // Check if renewer is authorized (admin or credential recipient)
    let admin: Address = env
        .storage()
        .instance()
        .get(&Symbol::new(env, "admin"))
        .unwrap_or_else(|| panic!("Admin not found"));

    if renewer != admin && renewer != credential.recipient {
        panic!("Unauthorized to renew credential");
    }

    // Check if credential is eligible for renewal
    match credential.status {
        CredentialStatus::Revoked => {
            panic!("Cannot renew revoked credential");
        }
        CredentialStatus::Expired => {
            // Allow renewal of expired credentials
        }
        _ => {} // Active and Pending can be renewed
    }

    let current_time = env.ledger().timestamp();
    let old_expires_at = credential.expires_at;

    // Create renewal record
    let renewal_record = RenewalRecord {
        renewed_at: current_time,
        old_expires_at,
        new_expires_at: current_time + extension_duration,
        renewed_by: renewer.clone(),
    };

    // Store renewal history
    let mut renewal_history = env
        .storage()
        .instance()
        .get(&CredentialRegistryKey::RenewalHistory(credential_id))
        .unwrap_or_else(|| Vec::new(env));
    renewal_history.push_back(renewal_record.clone());
    env.storage().instance().set(
        &CredentialRegistryKey::RenewalHistory(credential_id),
        &renewal_history,
    );

    // Update credential
    credential.expires_at = current_time + extension_duration;
    credential.status = CredentialStatus::Active;
    credential.renewal_count += 1;
    credential.last_renewed_at = Some(current_time);

    env.storage().persistent().set(
        &CredentialRegistryKey::Credential(credential_id),
        &credential,
    );

    // Emit credential lifecycle event with consistent
    // (credential_id, actor, timestamp) payload and queryable record.
    publish_credential_event(
        env,
        CredentialLifecycleEvent::Renewed,
        credential_id,
        renewer,
    );

    true
}

/// Check and update credential expiration status
pub fn check_credential_expiration(env: &Env, credential_id: u64) -> CredentialStatus {
    StorageVersion::require_compatible_version(env);
    let mut credential: CredentialRegistry = env
        .storage()
        .persistent()
        .get(&CredentialRegistryKey::Credential(credential_id))
        .unwrap_or_else(|| panic!("Credential not found"));

    let current_time = env.ledger().timestamp();

    // Skip if already revoked
    if credential.status == CredentialStatus::Revoked {
        return credential.status;
    }

    // Check if credential has expired
    if current_time >= credential.expires_at && credential.status == CredentialStatus::Active {
        credential.status = CredentialStatus::Expired;

        // Update stored credential
        env.storage().persistent().set(
            &CredentialRegistryKey::Credential(credential_id),
            &credential,
        );

        // Add to expired credentials list
        let mut expired_creds = env
            .storage()
            .instance()
            .get(&CredentialRegistryKey::ExpiredCredentials)
            .unwrap_or_else(|| Vec::new(env));
        expired_creds.push_back(credential_id);
        env.storage()
            .instance()
            .set(&CredentialRegistryKey::ExpiredCredentials, &expired_creds);

        // Emit credential lifecycle event with consistent
        // (credential_id, actor, timestamp) payload and queryable record.
        // `current_time` was sampled above; we surface the contract as the
        // actor since cron-style expiration is system-driven.
        publish_credential_event(
            env,
            CredentialLifecycleEvent::Expired,
            credential_id,
            env.current_contract_address(),
        );
    }

    credential.status
}

/// Batch update expiration status for multiple credentials
pub fn batch_update_expiration_status(env: &Env, credential_ids: Vec<u64>) -> Vec<u64> {
    let mut expired_credentials = Vec::new(env);

    for credential_id in credential_ids.iter() {
        let id_val: u64 = credential_id;
        let status = check_credential_expiration(env, id_val);
        if status == CredentialStatus::Expired {
            expired_credentials.push_back(id_val);
        }
    }

    expired_credentials
}

/// Get credential with current status
pub fn get_credential(env: &Env, credential_id: u64) -> CredentialRegistry {
    // Version guard first: refuse reads on unknown layouts (issue #120).
    StorageVersion::require_compatible_version(env);
    // Check expiration status before returning
    check_credential_expiration(env, credential_id);

    env.storage()
        .persistent()
        .get(&CredentialRegistryKey::Credential(credential_id))
        .unwrap_or_else(|| panic!("Credential not found"))
}

/// Get user credentials with current status
pub fn get_user_credentials(env: &Env, user: Address) -> Vec<u64> {
    env.storage()
        .persistent()
        .get(&CredentialRegistryKey::UserCredentials(user))
        .unwrap_or_else(|| Vec::new(env))
}

/// Get expired credentials list
pub fn get_expired_credentials(env: &Env) -> Vec<u64> {
    env.storage()
        .instance()
        .get(&CredentialRegistryKey::ExpiredCredentials)
        .unwrap_or_else(|| Vec::new(env))
}

/// Get renewal history for a credential
pub fn get_renewal_history(env: &Env, credential_id: u64) -> Vec<RenewalRecord> {
    env.storage()
        .instance()
        .get(&CredentialRegistryKey::RenewalHistory(credential_id))
        .unwrap_or_else(|| Vec::new(env))
}

/// Revoke a credential
pub fn revoke_credential(env: &Env, credential_id: u64, revoker: Address) -> bool {
    StorageVersion::require_compatible_version(env);
    revoker.require_auth();

    // RBAC: only Admin can revoke credentials
    crate::access_control::require_role(env, &revoker, crate::access_control::Role::Admin);

    let mut credential: CredentialRegistry = env
        .storage()
        .persistent()
        .get(&CredentialRegistryKey::Credential(credential_id))
        .unwrap_or_else(|| panic!("Credential not found"));

    credential.status = CredentialStatus::Revoked;
    env.storage().persistent().set(
        &CredentialRegistryKey::Credential(credential_id),
        &credential,
    );

    // Emit credential lifecycle event with consistent
    // (credential_id, actor, timestamp) payload and queryable record.
    publish_credential_event(
        env,
        CredentialLifecycleEvent::Revoked,
        credential_id,
        revoker,
    );

    true
}

/// Get credential count
pub fn get_credential_count(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&CredentialRegistryKey::CredentialCount)
        .unwrap_or(0)
}

/// Check if a credential is currently valid
pub fn is_credential_valid(env: &Env, credential_id: u64) -> bool {
    let credential = get_credential(env, credential_id);
    matches!(credential.status, CredentialStatus::Active)
}

/// Whether a credential with `credential_id` exists in the registry.
pub fn credential_exists(env: &Env, credential_id: u64) -> bool {
    env.storage()
        .persistent()
        .has(&CredentialRegistryKey::Credential(credential_id))
}

// ===== Attestation tracking (issue #122 integration) =====

/// Number of active attestations recorded against a credential.
pub fn get_attestation_count(env: &Env, credential_id: u64) -> u32 {
    env.storage()
        .persistent()
        .get(&CredentialRegistryKey::AttestationCount(credential_id))
        .unwrap_or(0)
}

/// Increment a credential's attestation count. Called by the attestation
/// protocol when a new attestation is recorded.
pub fn increment_attestation_count(env: &Env, credential_id: u64) -> u32 {
    let count = get_attestation_count(env, credential_id) + 1;
    env.storage().persistent().set(
        &CredentialRegistryKey::AttestationCount(credential_id),
        &count,
    );
    count
}

/// Decrement a credential's attestation count (saturating at 0). Called by the
/// attestation protocol when an attestation is revoked.
pub fn decrement_attestation_count(env: &Env, credential_id: u64) -> u32 {
    let current = get_attestation_count(env, credential_id);
    let count = current.saturating_sub(1);
    env.storage().persistent().set(
        &CredentialRegistryKey::AttestationCount(credential_id),
        &count,
    );
    count
}

/// Get credentials expiring within a time window
pub fn get_credentials_expiring_soon(env: &Env, within_seconds: u64) -> Vec<u64> {
    let current_time = env.ledger().timestamp();
    let threshold = current_time + within_seconds;
    let mut expiring_soon = Vec::new(env);

    // This is a simplified implementation - in production, you'd want
    // an indexed storage structure for better performance
    let credential_count = get_credential_count(env);
    for i in 1..=credential_count {
        if let Some(credential) = env
            .storage()
            .persistent()
            .get::<_, CredentialRegistry>(&CredentialRegistryKey::Credential(i))
        {
            if credential.expires_at <= threshold && credential.status == CredentialStatus::Active {
                expiring_soon.push_back(i);
            }
        }
    }

    expiring_soon
}

// ===== Batch issuance (issue #118) =====

/// Parameters for a single credential in a batch issuance request.
#[contracttype]
#[derive(Clone)]
pub struct BatchCredentialParams {
    pub recipient: Address,
    pub title: String,
    pub description: String,
    pub course_id: String,
    pub ipfs_hash: String,
    pub validity_duration: u64,
}

/// Maximum number of credentials that can be issued in a single batch.
/// Prevents unbounded gas consumption.
pub const MAX_BATCH_SIZE: u32 = 50;

/// Issue multiple credentials in a single transaction with one authorization
/// check for the issuer. Returns a vector of the newly created credential IDs
/// in the same order as the input params.
///
/// Semantics: all-or-nothing. If any param fails validation the entire call
/// panics and no credentials are stored (Soroban's atomic transaction model
/// guarantees the rollback).
///
/// Edge cases handled:
/// - Empty batch → panic (no-op batch is almost certainly a caller bug)
/// - Single credential → works identically to issue_credential_with_expiration
/// - Batch larger than MAX_BATCH_SIZE → panic
pub fn issue_credentials_batch(
    env: &Env,
    issuer: Address,
    params: Vec<BatchCredentialParams>,
) -> Vec<u64> {
    // Reject writes against an unrecognized storage layout (issue #120).
    StorageVersion::require_compatible_version(env);
    // Single auth check covers the entire batch.
    issuer.require_auth();

    let batch_len = params.len();

    // Reject empty batch.
    if batch_len == 0 {
        panic!("Batch must contain at least one credential");
    }

    // Enforce maximum batch size.
    if batch_len > MAX_BATCH_SIZE {
        panic!("Batch size exceeds maximum allowed limit");
    }

    // RBAC: require Issuer role
    crate::access_control::require_role(env, &issuer, crate::access_control::Role::Issuer);

    // Validate all params up-front before touching storage (all-or-nothing).
    for i in 0..batch_len {
        let p = params.get(i).unwrap();
        validate_non_zero_address(env, &p.recipient);
        validate_string_length(env, &p.title, MAX_TITLE_LENGTH);
        validate_string_length(env, &p.description, MAX_DESCRIPTION_LENGTH);
        validate_string_length(env, &p.course_id, MAX_SHORT_TEXT_LENGTH);
        validate_string_length(env, &p.ipfs_hash, MAX_URI_LENGTH);
        validate_duration(env, p.validity_duration);
    }

    let current_time = env.ledger().timestamp();
    let mut credential_ids: Vec<u64> = Vec::new(env);

    for i in 0..batch_len {
        let p = params.get(i).unwrap();
        let credential_id = StorageUtils::get_next_id(env, EntityType::Credential);

        let credential = CredentialRegistry {
            id: credential_id,
            issuer: issuer.clone(),
            recipient: p.recipient.clone(),
            title: p.title.clone(),
            description: p.description.clone(),
            course_id: p.course_id.clone(),
            issued_at: current_time,
            expires_at: current_time + p.validity_duration,
            status: CredentialStatus::Active,
            proctored: false,
            ipfs_hash: p.ipfs_hash.clone(),
            renewal_count: 0,
            last_renewed_at: None,
        };

        // Store credential.
        env.storage().persistent().set(
            &CredentialRegistryKey::Credential(credential_id),
            &credential,
        );

        // Append to recipient's credential list.
        let mut user_creds: Vec<u64> = env
            .storage()
            .persistent()
            .get(&CredentialRegistryKey::UserCredentials(p.recipient.clone()))
            .unwrap_or_else(|| Vec::new(env));
        user_creds.push_back(credential_id);
        env.storage().persistent().set(
            &CredentialRegistryKey::UserCredentials(p.recipient.clone()),
            &user_creds,
        );

        // Update the global credential count after each credential so
        // StorageUtils::get_next_id stays consistent.
        env.storage()
            .instance()
            .set(&CredentialRegistryKey::CredentialCount, &credential_id);

        // Emit lifecycle event for each credential individually so
        // off-chain indexers see every issuance.
        publish_credential_event(
            env,
            CredentialLifecycleEvent::Issued,
            credential_id,
            issuer.clone(),
        );

        credential_ids.push_back(credential_id);
    }

    credential_ids
}

/// Mark an issued credential as proctored.
///
/// This is used after a proctoring session has been successfully linked to the
/// credential issuance flow.
pub fn mark_credential_as_proctored(env: &Env, credential_id: u64) -> bool {
    StorageVersion::require_compatible_version(env);
    let mut credential: CredentialRegistry = env
        .storage()
        .persistent()
        .get(&CredentialRegistryKey::Credential(credential_id))
        .unwrap_or_else(|| panic!("Credential not found"));

    credential.proctored = true;
    env.storage().persistent().set(
        &CredentialRegistryKey::Credential(credential_id),
        &credential,
    );

    let now = env.ledger().timestamp();
    env.events().publish(
        (Symbol::new(env, "cred_op"), Symbol::new(env, "proctored")),
        (credential_id, now),
    );

    true
}

/// Whether a credential was issued through the proctored flow.
pub fn is_proctored_credential(env: &Env, credential_id: u64) -> bool {
    env.storage()
        .persistent()
        .get::<_, CredentialRegistry>(&CredentialRegistryKey::Credential(credential_id))
        .map(|credential| credential.proctored)
        .unwrap_or(false)
}

/// Issue a credential and mark it as proctored once the session is linked.
#[allow(clippy::too_many_arguments)] // Contract-facing signature; kept as-is.
pub fn issue_proctored_cred_with_exp(
    env: &Env,
    issuer: Address,
    recipient: Address,
    title: String,
    description: String,
    course_id: String,
    ipfs_hash: String,
    validity_duration: u64,
    session_id: u64,
) -> u64 {
    let credential_id = issue_credential_with_expiration(
        env,
        issuer,
        recipient,
        title,
        description,
        course_id,
        ipfs_hash,
        validity_duration,
    );

    crate::proctoring::register_proctored_credential(env, session_id, credential_id);
    mark_credential_as_proctored(env, credential_id);

    credential_id
}

// ===== Storage migration transformation (issue #120) =====

/// v1 → v2 storage migration transformation for the credential registry.
///
/// What changed in v2: the v2 schema seeds a `AttestationCount(id) = 0` marker
/// on every credential that was issued under v1 so v2-aware readers can tell
/// pre-existing credentials apart from freshly issued ones without having to
/// re-derive that fact from event history.
///
/// Important: callers MUST NOT call `StorageVersion::require_compatible_version`
/// before this — the contract is mid-migration and the on-disk version is
/// about to be flipped.
pub fn migrate_v1_to_v2(env: &Env) -> u32 {
    let count: u64 = env
        .storage()
        .instance()
        .get(&CredentialRegistryKey::CredentialCount)
        .unwrap_or(0u64);

    let touched: u32 = if count > u32::MAX as u64 {
        u32::MAX
    } else {
        count as u32
    };

    for id in 1..=touched {
        let key = CredentialRegistryKey::AttestationCount(id as u64);
        if !env.storage().persistent().has(&key) {
            env.storage().persistent().set(&key, &0u32);
        }
    }

    touched
}
