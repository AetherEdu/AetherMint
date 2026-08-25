//! DID Registry — Issue #397.
//!
//! Self-sovereign identity for learners. A learner binds a decentralized
//! identifier (DID) to their Stellar wallet, publishes a resolvable DID
//! document holding the current verification key, and can rotate that key
//! without invalidating previously issued credentials.
//!
//! Modeled as a free-function module (like [`crate::credential_registry`]) and
//! surfaced through `AetherMintContract` wrappers in `lib.rs`, so it shares the
//! single contract instance rather than declaring a conflicting `#[contract]`.
//!
//! DID format: `did:aethermint:<stellar-address>` — deterministic and bound
//! to the controlling wallet, so the DID stays stable across key rotations
//! while the verification key recorded in the document changes.
//!
//! Flow:
//! - A wallet registers itself with [`register_did`], supplying the ed25519
//!   verification key that will sign on its behalf.
//! - Anyone can [`resolve_did`] to obtain the DID document and its current
//!   verification key.
//! - The controller can [`rotate_did_key`] (proving possession of the new key)
//!   or [`deactivate_did`].
//! - Third parties verify claims with [`verify_signature`], which resolves the
//!   document and checks the signature against the *current* verification key.
//! - [`get_credentials_for_did`] links a holder's DID to credentials issued to
//!   their wallet, so issued credentials reference the holder's DID.

use soroban_sdk::{
    contracterror, contracttype, panic_with_error, Address, Bytes, BytesN, Env, String, Vec,
};

use crate::credential_registry;
use crate::utils::pause::PauseUtils;
use crate::utils::storage::StorageVersion;
use crate::utils::validation::{
    validate_non_zero_address, validate_string_length, MAX_SHORT_TEXT_LENGTH,
};

/// DID method prefix for AetherMint DIDs.
pub const DID_METHOD: &str = "did:aethermint:";

/// Maximum length (in bytes) of a signed message / rotation challenge.
pub const MAX_CHALLENGE_LENGTH: u32 = 512;

/// Typed DID-registry errors.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum DidError {
    /// The controller wallet already has a DID registered.
    DidAlreadyRegistered = 1,
    /// No DID document exists for the requested identifier.
    DidNotFound = 2,
    /// The DID exists but has been deactivated.
    DidInactive = 3,
    /// The string is not a well-formed `did:aethermint:*` identifier.
    InvalidDid = 4,
    /// The supplied verification key is not usable (all zeros).
    InvalidVerificationKey = 5,
    /// The new verification key must differ from the current one.
    NewKeyEqualsOld = 6,
    /// The signed message exceeds `MAX_CHALLENGE_LENGTH`.
    MessageTooLong = 7,
    /// The caller is not the DID controller.
    Unauthorized = 8,
}

/// A resolvable DID document.
#[contracttype]
#[derive(Clone)]
pub struct DidDocument {
    /// The decentralized identifier, e.g. `did:aethermint:GABCDE...`.
    pub did: String,
    /// The Stellar wallet that controls this DID. Stable across rotations.
    pub controller: Address,
    /// Current ed25519 verification key (32 bytes).
    pub verification_key: BytesN<32>,
    /// Monotonic key version; bumped on every rotation.
    pub key_version: u32,
    /// Whether the DID is active and may be used for verification.
    pub active: bool,
    /// Ledger timestamp of registration.
    pub created_at: u64,
    /// Ledger timestamp of the last mutation (rotation / deactivation).
    pub updated_at: u64,
}

/// One entry in a DID's rotation history.
#[contracttype]
#[derive(Clone)]
pub struct KeyRotationRecord {
    pub old_key: BytesN<32>,
    pub new_key: BytesN<32>,
    pub rotated_at: u64,
    pub rotated_by: Address,
}

/// Storage keys for the DID registry.
#[contracttype]
pub enum DidRegistryKey {
    /// did -> [`DidDocument`]
    Did(String),
    /// controller wallet -> did (reverse lookup; one DID per wallet)
    DidByController(Address),
    /// did -> rotation history ([`KeyRotationRecord`] list)
    KeyHistory(String),
}

/// Reject a DID string that is not a well-formed `did:aethermint:*` identifier.
fn require_valid_did(env: &Env, did: &String) {
    validate_string_length(env, did, MAX_SHORT_TEXT_LENGTH);
    let prefix = String::from_str(env, DID_METHOD);
    let did_bytes = crate::string_to_bytes(env, did);
    let prefix_bytes = crate::string_to_bytes(env, &prefix);

    if did_bytes.len() <= prefix_bytes.len() {
        panic_with_error!(env, DidError::InvalidDid);
    }
    let mut i: u32 = 0;
    while i < prefix_bytes.len() {
        if did_bytes.get(i) != prefix_bytes.get(i) {
            panic_with_error!(env, DidError::InvalidDid);
        }
        i += 1;
    }
}

/// Reject an all-zero verification key (the ed25519 equivalent of a burn
/// address — no one can prove possession of it).
fn validate_verification_key(env: &Env, key: &BytesN<32>) {
    let zero = BytesN::from_array(env, &[0u8; 32]);
    if key == &zero {
        panic_with_error!(env, DidError::InvalidVerificationKey);
    }
}

/// Require `caller` to be the controller of the DID referenced by `did`.
fn require_controller(env: &Env, did: &String, caller: &Address) {
    caller.require_auth();
    let doc = resolve_did(env, did.clone());
    if &doc.controller != caller {
        panic_with_error!(env, DidError::Unauthorized);
    }
}

/// Register a new DID bound to the caller's wallet.
///
/// Returns the assigned DID, formatted as `did:aethermint:<stellar-address>`.
/// One DID per wallet: a second registration for the same controller panics.
pub fn register_did(env: &Env, controller: Address, verification_key: BytesN<32>) -> String {
    PauseUtils::require_not_paused(env);
    StorageVersion::require_compatible_version(env);
    controller.require_auth();
    validate_non_zero_address(env, &controller);
    validate_verification_key(env, &verification_key);

    if env
        .storage()
        .persistent()
        .has(&DidRegistryKey::DidByController(controller.clone()))
    {
        panic_with_error!(env, DidError::DidAlreadyRegistered);
    }

    let did = crate::str_cat(
        env,
        &String::from_str(env, DID_METHOD),
        &controller.to_string(),
    );
    let now = env.ledger().timestamp();

    let doc = DidDocument {
        did: did.clone(),
        controller: controller.clone(),
        verification_key,
        key_version: 1,
        active: true,
        created_at: now,
        updated_at: now,
    };

    env.storage()
        .persistent()
        .set(&DidRegistryKey::Did(did.clone()), &doc);
    env.storage()
        .persistent()
        .set(&DidRegistryKey::DidByController(controller), &did);
    // Initialize an empty rotation history so reads never need a default.
    env.storage().persistent().set(
        &DidRegistryKey::KeyHistory(did.clone()),
        &Vec::<KeyRotationRecord>::new(env),
    );

    did
}

/// Resolve a DID to its current document. Panics if the DID is unknown or
/// malformed.
pub fn resolve_did(env: &Env, did: String) -> DidDocument {
    StorageVersion::require_compatible_version(env);
    require_valid_did(env, &did);
    env.storage()
        .persistent()
        .get(&DidRegistryKey::Did(did))
        .unwrap_or_else(|| panic_with_error!(env, DidError::DidNotFound))
}

/// Reverse lookup: the DID bound to a wallet, if any.
pub fn get_did_for_controller(env: &Env, controller: Address) -> Option<String> {
    env.storage()
        .persistent()
        .get(&DidRegistryKey::DidByController(controller))
}

/// Whether a DID exists (without panicking on malformed identifiers).
pub fn did_exists(env: &Env, did: String) -> bool {
    env.storage().persistent().has(&DidRegistryKey::Did(did))
}

/// Rotate the verification key of `did`.
///
/// Authorization:
/// - The DID controller must authorize the call (`require_auth`).
/// - The new key must prove possession by signing `challenge`
///   ([`verify_signature`] semantics against the *new* key).
///
/// Returns the new `key_version`. Old keys are preserved in the rotation
/// history so credentials signed under earlier keys remain attributable.
pub fn rotate_did_key(
    env: &Env,
    did: String,
    new_key: BytesN<32>,
    challenge: Bytes,
    new_key_signature: BytesN<64>,
) -> u32 {
    PauseUtils::require_not_paused(env);
    StorageVersion::require_compatible_version(env);
    require_valid_did(env, &did);
    validate_verification_key(env, &new_key);
    if challenge.len() > MAX_CHALLENGE_LENGTH {
        panic_with_error!(env, DidError::MessageTooLong);
    }

    let mut doc = resolve_did(env, did.clone());
    require_controller(env, &did, &doc.controller);

    if !doc.active {
        panic_with_error!(env, DidError::DidInactive);
    }
    if doc.verification_key == new_key {
        panic_with_error!(env, DidError::NewKeyEqualsOld);
    }

    // Proof of possession: the new key must sign the challenge. The host's
    // `ed25519_verify` traps when the signature does not verify, rejecting the
    // rotation.
    env.crypto()
        .ed25519_verify(&new_key, &challenge, &new_key_signature);

    // Record the rotation for auditability.
    let mut history: Vec<KeyRotationRecord> = env
        .storage()
        .persistent()
        .get(&DidRegistryKey::KeyHistory(did.clone()))
        .unwrap_or_else(|| Vec::new(env));
    history.push_back(KeyRotationRecord {
        old_key: doc.verification_key.clone(),
        new_key: new_key.clone(),
        rotated_at: env.ledger().timestamp(),
        rotated_by: doc.controller.clone(),
    });
    env.storage()
        .persistent()
        .set(&DidRegistryKey::KeyHistory(did.clone()), &history);

    doc.verification_key = new_key;
    doc.key_version += 1;
    doc.updated_at = env.ledger().timestamp();
    env.storage()
        .persistent()
        .set(&DidRegistryKey::Did(did), &doc);

    doc.key_version
}

/// Deactivate a DID. Only the controller may deactivate. Deactivation does not
/// delete the document or the rotation history, so old credentials signed by
/// the DID remain attributable, but [`verify_signature`] stops succeeding.
pub fn deactivate_did(env: &Env, did: String) -> bool {
    PauseUtils::require_not_paused(env);
    StorageVersion::require_compatible_version(env);

    let mut doc = resolve_did(env, did.clone());
    require_controller(env, &did, &doc.controller);

    if !doc.active {
        panic_with_error!(env, DidError::DidInactive);
    }

    doc.active = false;
    doc.updated_at = env.ledger().timestamp();
    env.storage()
        .persistent()
        .set(&DidRegistryKey::Did(did), &doc);

    true
}

/// Full rotation history for a DID (old key, new key, timestamp, actor).
pub fn get_key_history(env: &Env, did: String) -> Vec<KeyRotationRecord> {
    require_valid_did(env, &did);
    env.storage()
        .persistent()
        .get(&DidRegistryKey::KeyHistory(did))
        .unwrap_or_else(|| Vec::new(env))
}

/// Verify a signature over `message` against the DID's *current* verification
/// key. Resolves the DID document first, per the acceptance criteria.
///
/// Returns `false` only when the DID is deactivated. The host's
/// `ed25519_verify` rejects an invalid signature (the invocation fails), and
/// an unknown or malformed DID panics with a typed error — mirroring how
/// Soroban contract accounts reject bad signatures.
pub fn verify_signature(env: &Env, did: String, message: Bytes, signature: BytesN<64>) -> bool {
    StorageVersion::require_compatible_version(env);
    if message.len() > MAX_CHALLENGE_LENGTH {
        panic_with_error!(env, DidError::MessageTooLong);
    }

    let doc = resolve_did(env, did);
    if !doc.active {
        return false;
    }

    env.crypto()
        .ed25519_verify(&doc.verification_key, &message, &signature);
    true
}

/// Credentials issued to the holder of `did`. Because a credential references
/// its holder by wallet address and the DID is bound to that same wallet, this
/// resolves DID -> controller -> credential IDs, making the holder↔credential
/// linkage resolvable through the DID.
pub fn get_credentials_for_did(env: &Env, did: String) -> Vec<u64> {
    let doc = resolve_did(env, did);
    credential_registry::get_user_credentials(env, doc.controller)
}
