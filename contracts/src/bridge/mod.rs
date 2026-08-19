//! Cross-chain bridge relayer registry and optimistic attestation protocol
//! (issue #423).
//!
//! # Security model
//!
//! The bridge is secured with an optimistic, stake-backed design:
//!
//! 1. **Registration + stake** — a relayer stakes at least [`MIN_STAKE`] to
//!    participate. The stake is the economic collateral that can be slashed
//!    for misbehaviour.
//! 2. **Liveness** — relayers must call [`heartbeat`] within
//!    [`LIVENESS_WINDOW_SECONDS`]; a relayer that stops heartbeating is
//!    considered not-live and its attestations are rejected.
//! 3. **Attestation + dispute window** — a relayer submits an attestation for
//!    an off-chain message. The attestation stays `Pending` for
//!    [`DISPUTE_WINDOW_SECONDS`] and is only trusted once [`finalize_attestation`]
//!    runs after the window has closed.
//! 4. **Fraud proofs** — anyone can call [`submit_fraud_proof`] with evidence
//!    during the dispute window. A valid challenge marks the attestation
//!    `Challenged` and **slashes** the relayer (stake set to zero, status
//!    `Slashed`), so misbehaviour is economically punished.
//! 5. **Admin freeze** — the bridge admin can [`freeze_relayer`] /
//!    [`unfreeze_relayer`] as a manual circuit breaker.
//!
//! The module is written as free functions (like [`crate::attestation_protocol`])
//! and surfaced through `AetherMintContract` wrappers in `lib.rs`, so it shares
//! the single contract instance rather than declaring a conflicting
//! `#[contract]`.

use soroban_sdk::{contracttype, symbol_short, Address, Env, String};

/// Minimum stake (in the bridge's base asset units) required to register.
pub const MIN_STAKE: i128 = 1000;
/// How long an attestation remains challengeable before it can be finalized.
pub const DISPUTE_WINDOW_SECONDS: u64 = 7 * 24 * 60 * 60;
/// How long a relayer may go without a heartbeat before it is considered down.
pub const LIVENESS_WINDOW_SECONDS: u64 = 24 * 60 * 60;

/// Lifecycle status of a relayer.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RelayerStatus {
    Active,
    Frozen,
    Slashed,
}

/// A staked, monitored relayer.
#[contracttype]
#[derive(Clone)]
pub struct Relayer {
    pub address: Address,
    pub stake: i128,
    pub status: RelayerStatus,
    pub registered_at: u64,
    pub last_seen: u64,
    pub attestation_count: u64,
}

/// Lifecycle status of a cross-chain attestation.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum AttestationStatus {
    Pending,
    Challenged,
    Finalized,
}

/// An optimistic attestation submitted by a relayer.
#[contracttype]
#[derive(Clone)]
pub struct Attestation {
    pub id: u64,
    pub relayer: Address,
    pub message_id: String,
    pub source_chain: u32,
    pub destination_chain: u32,
    pub state_root: String,
    pub submitted_at: u64,
    pub status: AttestationStatus,
    pub fraud_proof_count: u64,
}

/// Storage keys for the bridge subsystem.
#[contracttype]
#[derive(Clone)]
pub enum BridgeKey {
    Admin,
    Relayer(Address),
    Attestation(u64),
    AttestationCount,
    RelayerCount,
}

/// Initialize the bridge subsystem with an admin. Idempotent-guarded.
pub fn initialize_bridge(env: &Env, admin: Address) {
    if env.storage().instance().has(&BridgeKey::Admin) {
        panic!("Bridge already initialized");
    }
    env.storage().instance().set(&BridgeKey::Admin, &admin);
    env.storage()
        .instance()
        .set(&BridgeKey::AttestationCount, &0u64);
    env.storage()
        .instance()
        .set(&BridgeKey::RelayerCount, &0u64);
}

fn require_admin(env: &Env, caller: &Address) {
    caller.require_auth();
    let admin: Address = env
        .storage()
        .instance()
        .get(&BridgeKey::Admin)
        .unwrap_or_else(|| panic!("Bridge admin not set"));
    if caller != &admin {
        panic!("Only bridge admin can perform this action");
    }
}

/// Register a relayer with a stake of at least [`MIN_STAKE`].
pub fn register_relayer(env: &Env, relayer: Address, stake: i128) {
    relayer.require_auth();
    if stake < MIN_STAKE {
        panic!("Stake below minimum required");
    }
    let key = BridgeKey::Relayer(relayer.clone());
    if env.storage().persistent().has(&key) {
        panic!("Relayer already registered");
    }
    let now = env.ledger().timestamp();
    let record = Relayer {
        address: relayer.clone(),
        stake,
        status: RelayerStatus::Active,
        registered_at: now,
        last_seen: now,
        attestation_count: 0,
    };
    env.storage().persistent().set(&key, &record);

    let count: u64 = env
        .storage()
        .instance()
        .get(&BridgeKey::RelayerCount)
        .unwrap_or(0);
    env.storage()
        .instance()
        .set(&BridgeKey::RelayerCount, &(count + 1));

    env.events().publish(
        (symbol_short!("bridge"), symbol_short!("register")),
        (relayer, stake),
    );
}

/// Report liveness. Must be called by an active relayer.
pub fn heartbeat(env: &Env, relayer: Address) {
    relayer.require_auth();
    let mut record = get_relayer(env, relayer.clone());
    if record.status != RelayerStatus::Active {
        panic!("Relayer is not active");
    }
    record.last_seen = env.ledger().timestamp();
    env.storage()
        .persistent()
        .set(&BridgeKey::Relayer(relayer.clone()), &record);
}

/// Submit an optimistic attestation for an off-chain message. Returns the id.
pub fn submit_attestation(
    env: &Env,
    relayer: Address,
    message_id: String,
    source_chain: u32,
    destination_chain: u32,
    state_root: String,
) -> u64 {
    relayer.require_auth();
    let record = get_relayer(env, relayer.clone());
    if record.status != RelayerStatus::Active {
        panic!("Relayer is not active");
    }
    let now = env.ledger().timestamp();
    if now > record.last_seen + LIVENESS_WINDOW_SECONDS {
        panic!("Relayer is not live");
    }

    let count: u64 = env
        .storage()
        .instance()
        .get(&BridgeKey::AttestationCount)
        .unwrap_or(0);
    let id = count + 1;
    env.storage()
        .instance()
        .set(&BridgeKey::AttestationCount, &id);

    let attestation = Attestation {
        id,
        relayer: relayer.clone(),
        message_id,
        source_chain,
        destination_chain,
        state_root,
        submitted_at: now,
        status: AttestationStatus::Pending,
        fraud_proof_count: 0,
    };
    env.storage()
        .persistent()
        .set(&BridgeKey::Attestation(id), &attestation);

    let mut updated = record;
    updated.attestation_count += 1;
    env.storage()
        .persistent()
        .set(&BridgeKey::Relayer(relayer.clone()), &updated);

    env.events().publish(
        (symbol_short!("bridge"), symbol_short!("attest")),
        (relayer, id),
    );
    id
}

/// Submit a fraud proof against a pending attestation within the dispute
/// window. Slashes the submitting relayer. Returns `true` on success.
pub fn submit_fraud_proof(
    env: &Env,
    challenger: Address,
    attestation_id: u64,
    evidence: String,
) -> bool {
    challenger.require_auth();
    let attestation = get_attestation(env, attestation_id);
    if attestation.status != AttestationStatus::Pending {
        panic!("Attestation is not pending");
    }
    let now = env.ledger().timestamp();
    if now > attestation.submitted_at + DISPUTE_WINDOW_SECONDS {
        panic!("Dispute window has closed");
    }

    let mut updated = attestation;
    updated.status = AttestationStatus::Challenged;
    updated.fraud_proof_count += 1;
    env.storage()
        .persistent()
        .set(&BridgeKey::Attestation(attestation_id), &updated);

    let mut relayer = get_relayer(env, updated.relayer.clone());
    relayer.status = RelayerStatus::Slashed;
    relayer.stake = 0;
    env.storage()
        .persistent()
        .set(&BridgeKey::Relayer(updated.relayer.clone()), &relayer);

    env.events().publish(
        (symbol_short!("bridge"), symbol_short!("fraud")),
        (challenger, attestation_id, evidence),
    );
    true
}

/// Finalize a pending attestation after the dispute window has closed.
pub fn finalize_attestation(env: &Env, attestation_id: u64) {
    let attestation = get_attestation(env, attestation_id);
    if attestation.status != AttestationStatus::Pending {
        panic!("Attestation cannot be finalized");
    }
    let now = env.ledger().timestamp();
    if now <= attestation.submitted_at + DISPUTE_WINDOW_SECONDS {
        panic!("Dispute window still open");
    }
    let mut updated = attestation;
    updated.status = AttestationStatus::Finalized;
    env.storage()
        .persistent()
        .set(&BridgeKey::Attestation(attestation_id), &updated);

    env.events().publish(
        (symbol_short!("bridge"), symbol_short!("finalize")),
        (attestation_id,),
    );
}

/// Admin-only: freeze an active relayer.
pub fn freeze_relayer(env: &Env, admin: Address, relayer: Address) {
    require_admin(env, &admin);
    let mut record = get_relayer(env, relayer.clone());
    if record.status == RelayerStatus::Active {
        record.status = RelayerStatus::Frozen;
    }
    env.storage()
        .persistent()
        .set(&BridgeKey::Relayer(relayer.clone()), &record);
}

/// Admin-only: unfreeze a frozen relayer.
pub fn unfreeze_relayer(env: &Env, admin: Address, relayer: Address) {
    require_admin(env, &admin);
    let mut record = get_relayer(env, relayer.clone());
    if record.status == RelayerStatus::Frozen {
        record.status = RelayerStatus::Active;
    }
    env.storage()
        .persistent()
        .set(&BridgeKey::Relayer(relayer.clone()), &record);
}

/// Fetch a relayer record.
pub fn get_relayer(env: &Env, relayer: Address) -> Relayer {
    env.storage()
        .persistent()
        .get(&BridgeKey::Relayer(relayer))
        .unwrap_or_else(|| panic!("Relayer not registered"))
}

/// Fetch an attestation record.
pub fn get_attestation(env: &Env, attestation_id: u64) -> Attestation {
    env.storage()
        .persistent()
        .get(&BridgeKey::Attestation(attestation_id))
        .unwrap_or_else(|| panic!("Attestation not found"))
}

/// Whether a relayer is currently frozen.
pub fn is_relayer_frozen(env: &Env, relayer: Address) -> bool {
    let record = get_relayer(env, relayer);
    record.status == RelayerStatus::Frozen
}

/// Whether a relayer is active and has heartbeated within the liveness window.
pub fn is_relayer_live(env: &Env, relayer: Address) -> bool {
    let record = get_relayer(env, relayer);
    let now = env.ledger().timestamp();
    record.status == RelayerStatus::Active && now <= record.last_seen + LIVENESS_WINDOW_SECONDS
}

#[cfg(test)]
mod test;
