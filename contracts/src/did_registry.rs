//! Self-sovereign identity (DID) registry — issue #397.
//!
//! Lets learners control a decentralized identifier (DID) bound to their
//! Stellar wallet. The registry stores a DID document per learner containing
//! the verification keys used to sign their verifiable credentials.
//!
//! ## Key rotation without breaking credentials
//!
//! Rotating a key retires the previously active key(s) but keeps them in the
//! DID document, so credentials that were signed under an older key remain
//! verifiable (`verify_key` accepts retired keys). Only an *explicit*
//! revocation (`revoke_verification_method`) — or deactivating the whole DID
//! (`deactivate_did`) — stops a key from verifying.
//!
//! ## Issued credentials reference the holder's DID
//!
//! Each DID document records the credential references issued to its holder
//! (`attach_credential` / `get_credentials`), so the DID acts as the anchor
//! that issued credentials point back to.

use crate::utils::storage::StorageVersion;
use crate::utils::validation::{validate_non_zero_address, validate_string_length, MAX_URI_LENGTH};
use soroban_sdk::{contracttype, symbol_short, Address, Env, String, Symbol, Vec};

/// Maximum length (in bytes) of a DID identifier.
pub const MAX_DID_LENGTH: u32 = 128;
/// Maximum length (in bytes) of a public key or key identifier string.
pub const MAX_KEY_LENGTH: u32 = MAX_URI_LENGTH;
/// Maximum number of verification methods bound to a single DID.
pub const MAX_VERIFICATION_METHODS: u32 = 32;
/// Maximum number of credential references recorded against a single DID.
pub const MAX_CREDENTIAL_REFS: u32 = 512;

/// Topic prefix used for all DID lifecycle events.
const TOPIC_PREFIX: Symbol = symbol_short!("did_op");

/// DID lifecycle event types, mirrored as short on-chain topics.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DidOperation {
    Created,
    KeyAdded,
    KeyRotated,
    KeyRevoked,
    Deactivated,
    CredentialAttached,
}

impl DidOperation {
    /// Short, on-chain symbol used as the second topic for `publish`.
    /// Limited to 9 characters because of the `symbol_short!` macro.
    pub fn topic(&self) -> Symbol {
        match self {
            DidOperation::Created => symbol_short!("created"),
            DidOperation::KeyAdded => symbol_short!("key_add"),
            DidOperation::KeyRotated => symbol_short!("key_rot"),
            DidOperation::KeyRevoked => symbol_short!("key_rev"),
            DidOperation::Deactivated => symbol_short!("deactvd"),
            DidOperation::CredentialAttached => symbol_short!("cred_at"),
        }
    }
}

/// Storage keys for the DID registry.
#[contracttype]
pub enum DidRegistryKey {
    /// DID document keyed by its DID identifier string.
    DidDocument(String),
    /// Reverse index: wallet address -> DID identifier.
    DidByWallet(Address),
    /// Monotonically increasing counter used to derive DID identifiers.
    DidCount,
}

/// A single verification method bound to a DID.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VerificationMethod {
    pub id: String,
    pub key_type: String,
    pub public_key: String,
    /// Ledger timestamp when this key was added.
    pub added_at: u64,
    /// Set when the key is rotated out. Retired keys remain valid for
    /// verifying signatures produced while they were the active key, so key
    /// rotation does not invalidate previously issued credentials.
    pub retired_at: Option<u64>,
    /// Explicitly revoked keys can no longer verify anything.
    pub revoked: bool,
}

/// A resolvable DID document.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DidDocument {
    pub id: String,
    /// Wallet address that controls this DID (the learner's wallet).
    pub controller: Address,
    /// Verification methods currently — or previously — bound to this DID.
    pub verification_methods: Vec<VerificationMethod>,
    /// Credential references issued to the holder of this DID.
    pub credential_refs: Vec<String>,
    pub created_at: u64,
    pub updated_at: u64,
    pub deactivated: bool,
}

/// Build a deterministic key id for a DID: `{did}#key-{n}`.
fn key_id(env: &Env, did: &String, index: u64) -> String {
    crate::str_cat(
        env,
        &crate::str_cat(env, did, &String::from_str(env, "#key-")),
        &crate::u64_to_string(env, index, ""),
    )
}

/// Publish a DID lifecycle event with topics `(did_op, <action>)` and payload
/// `(did, actor, timestamp)` so off-chain indexers can filter on them.
fn publish_did_event(env: &Env, op: DidOperation, did: &String, actor: Address) {
    let timestamp = env.ledger().timestamp();
    env.events()
        .publish((TOPIC_PREFIX, op.topic()), (did.clone(), actor, timestamp));
}

fn load_document(env: &Env, did: &String) -> DidDocument {
    env.storage()
        .persistent()
        .get(&DidRegistryKey::DidDocument(did.clone()))
        .unwrap_or_else(|| panic!("DID not found"))
}

fn store_document(env: &Env, doc: &DidDocument) {
    env.storage()
        .persistent()
        .set(&DidRegistryKey::DidDocument(doc.id.clone()), doc);
}

fn require_controller(doc: &DidDocument, controller: &Address) {
    if doc.controller != *controller {
        panic!("Only the DID controller can perform this operation");
    }
}

/// Create a DID bound to the learner's wallet with an initial verification
/// key. Returns the new DID identifier (`did:aethermint:{n}`).
pub fn create_did(env: &Env, controller: Address, public_key: String, key_type: String) -> String {
    StorageVersion::require_compatible_version(env);
    controller.require_auth();

    validate_non_zero_address(env, &controller);
    validate_string_length(env, &public_key, MAX_KEY_LENGTH);
    validate_string_length(env, &key_type, MAX_KEY_LENGTH);

    if env
        .storage()
        .persistent()
        .has(&DidRegistryKey::DidByWallet(controller.clone()))
    {
        panic!("Wallet already has a DID");
    }

    let did_count: u64 = env
        .storage()
        .persistent()
        .get(&DidRegistryKey::DidCount)
        .unwrap_or(0);
    let did = crate::u64_to_string(env, did_count, "did:aethermint:");
    let now = env.ledger().timestamp();

    let method = VerificationMethod {
        id: key_id(env, &did, 1),
        key_type: key_type.clone(),
        public_key: public_key.clone(),
        added_at: now,
        retired_at: None,
        revoked: false,
    };

    let mut methods: Vec<VerificationMethod> = Vec::new(env);
    methods.push_back(method);
    let credential_refs: Vec<String> = Vec::new(env);

    let doc = DidDocument {
        id: did.clone(),
        controller: controller.clone(),
        verification_methods: methods,
        credential_refs,
        created_at: now,
        updated_at: now,
        deactivated: false,
    };

    store_document(env, &doc);
    env.storage()
        .persistent()
        .set(&DidRegistryKey::DidByWallet(controller.clone()), &did);
    env.storage()
        .persistent()
        .set(&DidRegistryKey::DidCount, &(did_count + 1));

    publish_did_event(env, DidOperation::Created, &did, controller);

    did
}

/// Resolve a DID to its full DID document, including verification keys.
pub fn resolve_did(env: &Env, did: String) -> DidDocument {
    validate_string_length(env, &did, MAX_DID_LENGTH);
    load_document(env, &did)
}

/// Look up the DID bound to a wallet address.
pub fn get_did_by_wallet(env: &Env, wallet: Address) -> Option<DidDocument> {
    validate_non_zero_address(env, &wallet);
    let did: String = env
        .storage()
        .persistent()
        .get(&DidRegistryKey::DidByWallet(wallet))?;
    Some(load_document(env, &did))
}

/// Whether a DID exists in the registry.
pub fn did_exists(env: &Env, did: String) -> bool {
    env.storage()
        .persistent()
        .has(&DidRegistryKey::DidDocument(did))
}

/// Total number of DIDs ever created.
pub fn get_total_dids(env: &Env) -> u64 {
    env.storage()
        .persistent()
        .get(&DidRegistryKey::DidCount)
        .unwrap_or(0)
}

/// Add an additional verification method to a DID. Returns the new key id.
pub fn add_verification_method(
    env: &Env,
    controller: Address,
    did: String,
    public_key: String,
    key_type: String,
) -> String {
    StorageVersion::require_compatible_version(env);
    controller.require_auth();

    validate_string_length(env, &did, MAX_DID_LENGTH);
    validate_string_length(env, &public_key, MAX_KEY_LENGTH);
    validate_string_length(env, &key_type, MAX_KEY_LENGTH);

    let mut doc = load_document(env, &did);
    require_controller(&doc, &controller);
    if doc.deactivated {
        panic!("DID is deactivated");
    }
    if doc.verification_methods.len() >= MAX_VERIFICATION_METHODS {
        panic!("Maximum number of verification methods reached");
    }

    let index = doc.verification_methods.len() as u64 + 1;
    let id = key_id(env, &did, index);
    let method = VerificationMethod {
        id: id.clone(),
        key_type,
        public_key,
        added_at: env.ledger().timestamp(),
        retired_at: None,
        revoked: false,
    };

    doc.verification_methods.push_back(method);
    doc.updated_at = env.ledger().timestamp();
    store_document(env, &doc);

    publish_did_event(env, DidOperation::KeyAdded, &did, controller);

    id
}

/// Rotate the DID's verification keys: every currently active key is retired
/// (kept in the document so credentials signed under it remain verifiable) and
/// a fresh key becomes the active one. Returns the new key id.
pub fn rotate_key(
    env: &Env,
    controller: Address,
    did: String,
    new_public_key: String,
    key_type: String,
) -> String {
    StorageVersion::require_compatible_version(env);
    controller.require_auth();

    validate_string_length(env, &did, MAX_DID_LENGTH);
    validate_string_length(env, &new_public_key, MAX_KEY_LENGTH);
    validate_string_length(env, &key_type, MAX_KEY_LENGTH);

    let mut doc = load_document(env, &did);
    require_controller(&doc, &controller);
    if doc.deactivated {
        panic!("DID is deactivated");
    }

    let now = env.ledger().timestamp();
    let mut methods: Vec<VerificationMethod> = Vec::new(env);
    for method in doc.verification_methods.iter() {
        if !method.revoked && method.retired_at.is_none() {
            methods.push_back(VerificationMethod {
                id: method.id.clone(),
                key_type: method.key_type.clone(),
                public_key: method.public_key.clone(),
                added_at: method.added_at,
                retired_at: Some(now),
                revoked: false,
            });
        } else {
            methods.push_back(method);
        }
    }

    let index = doc.verification_methods.len() as u64 + 1;
    let id = key_id(env, &did, index);
    let method = VerificationMethod {
        id: id.clone(),
        key_type,
        public_key: new_public_key,
        added_at: now,
        retired_at: None,
        revoked: false,
    };
    methods.push_back(method);

    doc.verification_methods = methods;
    doc.updated_at = now;
    store_document(env, &doc);

    publish_did_event(env, DidOperation::KeyRotated, &did, controller);

    id
}

/// Explicitly revoke a verification method. Unlike rotation, a revoked key
/// can no longer be used to verify signatures. Returns the revoked key id.
pub fn revoke_verification_method(
    env: &Env,
    controller: Address,
    did: String,
    key_id: String,
) -> String {
    StorageVersion::require_compatible_version(env);
    controller.require_auth();

    validate_string_length(env, &did, MAX_DID_LENGTH);
    validate_string_length(env, &key_id, MAX_KEY_LENGTH);

    let mut doc = load_document(env, &did);
    require_controller(&doc, &controller);

    let mut found = false;
    let mut methods: Vec<VerificationMethod> = Vec::new(env);
    for method in doc.verification_methods.iter() {
        if method.id == key_id {
            if method.revoked {
                panic!("Verification method already revoked");
            }
            found = true;
            methods.push_back(VerificationMethod {
                id: method.id.clone(),
                key_type: method.key_type.clone(),
                public_key: method.public_key.clone(),
                added_at: method.added_at,
                retired_at: method.retired_at,
                revoked: true,
            });
        } else {
            methods.push_back(method);
        }
    }
    if !found {
        panic!("Verification method not found");
    }

    doc.verification_methods = methods;
    doc.updated_at = env.ledger().timestamp();
    store_document(env, &doc);

    publish_did_event(env, DidOperation::KeyRevoked, &did, controller);

    key_id
}

/// Deactivate a DID. All verification keys stop verifying; the document stays
/// resolvable so verifiers can see why a check fails.
pub fn deactivate_did(env: &Env, controller: Address, did: String) {
    StorageVersion::require_compatible_version(env);
    controller.require_auth();

    validate_string_length(env, &did, MAX_DID_LENGTH);

    let mut doc = load_document(env, &did);
    require_controller(&doc, &controller);
    if doc.deactivated {
        panic!("DID is already deactivated");
    }

    doc.deactivated = true;
    doc.updated_at = env.ledger().timestamp();
    store_document(env, &doc);

    publish_did_event(env, DidOperation::Deactivated, &did, controller);
}

/// Whether `key_id` can currently verify signatures for `did`.
///
/// * Deactivated DIDs never verify.
/// * Revoked keys never verify.
/// * Retired (rotated-out) keys still verify, so credentials issued under a
///   previous key remain valid after rotation.
pub fn verify_key(env: &Env, did: String, key_id: String) -> bool {
    let Some(doc) = env
        .storage()
        .persistent()
        .get::<_, DidDocument>(&DidRegistryKey::DidDocument(did))
    else {
        return false;
    };
    if doc.deactivated {
        return false;
    }
    for method in doc.verification_methods.iter() {
        if method.id == key_id {
            return !method.revoked;
        }
    }
    false
}

/// Record a credential reference against the holder's DID, anchoring the
/// credential back to the DID that was used to sign it.
pub fn attach_credential(env: &Env, controller: Address, did: String, credential_ref: String) {
    StorageVersion::require_compatible_version(env);
    controller.require_auth();

    validate_string_length(env, &did, MAX_DID_LENGTH);
    validate_string_length(env, &credential_ref, MAX_KEY_LENGTH);

    let mut doc = load_document(env, &did);
    require_controller(&doc, &controller);
    if doc.deactivated {
        panic!("DID is deactivated");
    }

    for existing in doc.credential_refs.iter() {
        if existing == credential_ref {
            panic!("Credential already attached to this DID");
        }
    }
    if doc.credential_refs.len() >= MAX_CREDENTIAL_REFS {
        panic!("Maximum number of credential references reached");
    }

    doc.credential_refs.push_back(credential_ref.clone());
    doc.updated_at = env.ledger().timestamp();
    store_document(env, &doc);

    publish_did_event(env, DidOperation::CredentialAttached, &did, controller);
}

/// Credential references recorded against a DID.
pub fn get_credentials(env: &Env, did: String) -> Vec<String> {
    validate_string_length(env, &did, MAX_DID_LENGTH);
    load_document(env, &did).credential_refs
}
