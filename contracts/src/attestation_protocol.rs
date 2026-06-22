//! Attestation protocol (#122).
//!
//! Lets registered third-party verifiers (attesters) vouch for the validity of
//! credentials on-chain, forming a cross-institutional trust network. Modeled as
//! a free-function module (like [`crate::credential_registry`]) and surfaced
//! through `AetherMintContract` wrappers in `lib.rs`, so it shares the single
//! contract instance rather than declaring a conflicting `#[contract]`.
//!
//! Flow:
//! - An attester registers itself with [`register_attester`].
//! - It vouches for a credential with [`attest_credential`]; multiple distinct
//!   attesters can attest to the same credential.
//! - It can withdraw with [`revoke_attestation`].
//! - The contract admin can [`deactivate_attester`] (and [`reactivate_attester`]).

use soroban_sdk::{contracterror, contracttype, panic_with_error, Address, BytesN, Env, String, Vec};

use crate::credential_registry;
use crate::utils::validation::{
    validate_non_zero_address, validate_optional_string_length, validate_string_length,
    MAX_METADATA_LENGTH, MAX_SHORT_TEXT_LENGTH,
};

/// Typed attestation-protocol errors.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum AttestationError {
    /// Attester address is already registered.
    AttesterAlreadyRegistered = 1,
    /// No attester record exists for the address.
    AttesterNotRegistered = 2,
    /// Attester exists but has been deactivated.
    AttesterInactive = 3,
    /// This attester has already attested to this credential.
    AlreadyAttested = 4,
    /// No attestation by this attester exists for this credential.
    AttestationNotFound = 5,
    /// Caller is not authorized for this operation.
    Unauthorized = 6,
    /// The referenced credential does not exist.
    CredentialNotFound = 7,
    /// Contract admin has not been initialized.
    AdminNotSet = 8,
}

/// A registered third-party verifier.
#[contracttype]
#[derive(Clone)]
pub struct Attester {
    pub address: Address,
    pub institution_name: String,
    pub verification_key: BytesN<32>,
    pub registered_at: u64,
    pub is_active: bool,
    pub attestation_count: u32,
}

/// A single attestation that an attester has made about a credential.
///
/// Carries the four fields required by the issue: the attesting `attester`, the
/// `timestamp` it was made, the off-chain `signature` over the credential, and
/// free-form `metadata`.
#[contracttype]
#[derive(Clone)]
pub struct CredentialAttestation {
    pub attester: Address,
    pub credential_id: u64,
    pub timestamp: u64,
    pub signature: BytesN<64>,
    pub metadata: String,
}

/// Storage keys for the attestation protocol.
#[contracttype]
pub enum AttestationKey {
    /// attester address -> [`Attester`]
    Attester(Address),
    /// credential id -> list of [`CredentialAttestation`]
    Attestations(u64),
}

/// Require that `caller` is the (authorized) contract admin set by `initialize`.
fn require_admin(env: &Env, caller: &Address) {
    caller.require_auth();
    let admin: Address = env
        .storage()
        .instance()
        .get(&crate::DataKey::Admin)
        .unwrap_or_else(|| panic_with_error!(env, AttestationError::AdminNotSet));
    if caller != &admin {
        panic_with_error!(env, AttestationError::Unauthorized);
    }
}

/// Register `attester_address` as a verifier. Self-service: the address being
/// registered must authorize the call.
pub fn register_attester(
    env: &Env,
    attester_address: Address,
    institution_name: String,
    verification_key: BytesN<32>,
) {
    attester_address.require_auth();
    validate_non_zero_address(env, &attester_address);
    validate_string_length(env, &institution_name, MAX_SHORT_TEXT_LENGTH);

    let key = AttestationKey::Attester(attester_address.clone());
    if env.storage().persistent().has(&key) {
        panic_with_error!(env, AttestationError::AttesterAlreadyRegistered);
    }

    let attester = Attester {
        address: attester_address.clone(),
        institution_name,
        verification_key,
        registered_at: env.ledger().timestamp(),
        is_active: true,
        attestation_count: 0,
    };
    env.storage().persistent().set(&key, &attester);
}

/// Record an attestation by `attester` for `credential_id`.
///
/// Requires the attester to be registered and active, the credential to exist,
/// and the attester not to have already attested to this credential.
pub fn attest_credential(
    env: &Env,
    attester: Address,
    credential_id: u64,
    signature: BytesN<64>,
    metadata: String,
) {
    attester.require_auth();
    validate_optional_string_length(env, &metadata, MAX_METADATA_LENGTH);

    let mut profile = get_attester(env, attester.clone());
    if !profile.is_active {
        panic_with_error!(env, AttestationError::AttesterInactive);
    }

    if !credential_registry::credential_exists(env, credential_id) {
        panic_with_error!(env, AttestationError::CredentialNotFound);
    }

    if is_attested_by(env, credential_id, attester.clone()) {
        panic_with_error!(env, AttestationError::AlreadyAttested);
    }

    let attestation = CredentialAttestation {
        attester: attester.clone(),
        credential_id,
        timestamp: env.ledger().timestamp(),
        signature,
        metadata,
    };

    let list_key = AttestationKey::Attestations(credential_id);
    let mut attestations: Vec<CredentialAttestation> = env
        .storage()
        .persistent()
        .get(&list_key)
        .unwrap_or_else(|| Vec::new(env));
    attestations.push_back(attestation);
    env.storage().persistent().set(&list_key, &attestations);

    profile.attestation_count += 1;
    env.storage()
        .persistent()
        .set(&AttestationKey::Attester(attester), &profile);

    // Keep per-credential attestation tracking in sync (issue #122 integration).
    credential_registry::increment_attestation_count(env, credential_id);
}

/// Withdraw `attester`'s attestation for `credential_id`.
pub fn revoke_attestation(env: &Env, attester: Address, credential_id: u64) {
    attester.require_auth();

    let list_key = AttestationKey::Attestations(credential_id);
    let attestations: Vec<CredentialAttestation> = env
        .storage()
        .persistent()
        .get(&list_key)
        .unwrap_or_else(|| Vec::new(env));

    let mut remaining = Vec::new(env);
    let mut removed = false;
    for attestation in attestations.iter() {
        if attestation.attester == attester {
            removed = true;
        } else {
            remaining.push_back(attestation);
        }
    }
    if !removed {
        panic_with_error!(env, AttestationError::AttestationNotFound);
    }
    env.storage().persistent().set(&list_key, &remaining);

    if let Some(mut profile) = env
        .storage()
        .persistent()
        .get::<_, Attester>(&AttestationKey::Attester(attester.clone()))
    {
        if profile.attestation_count > 0 {
            profile.attestation_count -= 1;
        }
        env.storage()
            .persistent()
            .set(&AttestationKey::Attester(attester), &profile);
    }

    credential_registry::decrement_attestation_count(env, credential_id);
}

/// All attestations recorded for a credential.
pub fn get_attestations(env: &Env, credential_id: u64) -> Vec<CredentialAttestation> {
    env.storage()
        .persistent()
        .get(&AttestationKey::Attestations(credential_id))
        .unwrap_or_else(|| Vec::new(env))
}

/// Whether `attester` has an active attestation for `credential_id`.
pub fn is_attested_by(env: &Env, credential_id: u64, attester: Address) -> bool {
    let attestations = get_attestations(env, credential_id);
    for attestation in attestations.iter() {
        if attestation.attester == attester {
            return true;
        }
    }
    false
}

/// Fetch an attester profile, panicking if it is not registered.
pub fn get_attester(env: &Env, attester_address: Address) -> Attester {
    env.storage()
        .persistent()
        .get(&AttestationKey::Attester(attester_address))
        .unwrap_or_else(|| panic_with_error!(env, AttestationError::AttesterNotRegistered))
}

/// Whether an attester record exists for `attester_address`.
pub fn is_registered_attester(env: &Env, attester_address: Address) -> bool {
    env.storage()
        .persistent()
        .has(&AttestationKey::Attester(attester_address))
}

/// Admin-only: deactivate an attester so it can no longer create attestations.
pub fn deactivate_attester(env: &Env, admin: Address, attester_address: Address) {
    require_admin(env, &admin);
    set_attester_active(env, attester_address, false);
}

/// Admin-only: re-activate a previously deactivated attester.
pub fn reactivate_attester(env: &Env, admin: Address, attester_address: Address) {
    require_admin(env, &admin);
    set_attester_active(env, attester_address, true);
}

fn set_attester_active(env: &Env, attester_address: Address, active: bool) {
    let key = AttestationKey::Attester(attester_address);
    let mut profile: Attester = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| panic_with_error!(env, AttestationError::AttesterNotRegistered));
    profile.is_active = active;
    env.storage().persistent().set(&key, &profile);
}
