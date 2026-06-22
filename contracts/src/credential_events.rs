//! Credential lifecycle event publishing and indexing.
//!
//! Provides a single, consistent surface for emitting and querying
//! credential lifecycle events (Issued, Verified, Revoked, Renewed, Expired).
//!
//! Each call to [`publish_credential_event`] does two things:
//! 1. Publishes a blockchain-level event via `env.events().publish()` with
//!    topics `(cred_op, <action_symbol>)` and payload `(credential_id, actor, timestamp)`.
//! 2. Records the event in contract storage, indexed both by
//!    `credential_id` and by `actor` so events can be queried efficiently.
use soroban_sdk::{contracttype, symbol_short, Address, Env, Symbol, Vec};

/// Topic prefix used for all credential lifecycle events.
const TOPIC_PREFIX: Symbol = symbol_short!("cred_op");

/// Credential lifecycle event types.
///
/// Mirrors the enums already defined in `credential_registry.rs`
/// (`CredentialEvent`) and `event_logger.rs` (`EventType::CredentialIssuance`)
/// so consumers can map between the two layers.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CredentialLifecycleEvent {
    Issued,
    Verified,
    Revoked,
    Renewed,
    Expired,
}

impl CredentialLifecycleEvent {
    /// Short, on-chain symbol used as the second topic for `publish`.
    /// Limited to 9 characters because of the `symbol_short!` macro.
    pub fn topic(&self) -> Symbol {
        match self {
            CredentialLifecycleEvent::Issued => symbol_short!("issued"),
            CredentialLifecycleEvent::Verified => symbol_short!("verified"),
            CredentialLifecycleEvent::Revoked => symbol_short!("revoked"),
            CredentialLifecycleEvent::Renewed => symbol_short!("renewed"),
            CredentialLifecycleEvent::Expired => symbol_short!("expired"),
        }
    }
}

/// Storage keys for credential lifecycle events.
#[contracttype]
pub enum CredentialEventKey {
    /// A single event record by its monotonically increasing id.
    Event(u64),
    /// Reverse-lookup index: all event ids for a given credential.
    EventsByCredential(u64),
    /// Reverse-lookup index: all event ids performed by a given actor.
    EventsByActor(Address),
    /// Monotonically increasing count of recorded events.
    EventCount,
}

/// Stored record of a credential lifecycle event.
///
/// Includes the four fields required by the issuing spec:
/// `id`, `event_type`, `credential_id`, `actor`, and `timestamp`.
#[contracttype]
#[derive(Clone, Debug)]
pub struct CredentialEventRecord {
    pub id: u64,
    pub event_type: CredentialLifecycleEvent,
    pub credential_id: u64,
    pub actor: Address,
    pub timestamp: u64,
}

/// Publish a credential lifecycle event AND record it for queryability.
///
/// The published on-chain event has topics `(cred_op, <action_symbol>)` and
/// payload `(credential_id, actor, timestamp)`. Off-chain indexers (Horizon,
/// RPC, etc.) can filter on those topics to surface lifecycle changes.
///
/// Returns the id of the newly stored record.
pub fn publish_credential_event(
    env: &Env,
    event_type: CredentialLifecycleEvent,
    credential_id: u64,
    actor: Address,
) -> u64 {
    // 1. Publish on-chain, indexable event with consistent (id, actor, timestamp) payload.
    let timestamp = env.ledger().timestamp();
    env.events().publish(
        (TOPIC_PREFIX, event_type.topic()),
        (credential_id, actor.clone(), timestamp),
    );

    // 2. Store a queryable record (also indexed by credential_id and actor).
    record_event(env, event_type, credential_id, actor, timestamp)
}

/// Record a credential lifecycle event in contract storage without
/// emitting an on-chain event. Useful for republishing/backfilling.
///
/// Not currently invoked by any production caller; the dedicated helpers
/// `publish_credential_event` is the in-app entrypoint. Kept as a public
/// API so off-chain indexers can repopulate storage if a write is lost.
#[allow(dead_code)]
pub fn record_event(
    env: &Env,
    event_type: CredentialLifecycleEvent,
    credential_id: u64,
    actor: Address,
    timestamp: u64,
) -> u64 {
    let count: u64 = env
        .storage()
        .instance()
        .get(&CredentialEventKey::EventCount)
        .unwrap_or(0);
    let event_id = count + 1;

    let record = CredentialEventRecord {
        id: event_id,
        event_type: event_type.clone(),
        credential_id,
        actor: actor.clone(),
        timestamp,
    };

    env.storage()
        .instance()
        .set(&CredentialEventKey::Event(event_id), &record);
    env.storage()
        .instance()
        .set(&CredentialEventKey::EventCount, &event_id);

    // Index by credential id.
    let mut by_credential: Vec<u64> = env
        .storage()
        .instance()
        .get(&CredentialEventKey::EventsByCredential(credential_id))
        .unwrap_or_else(|| Vec::new(env));
    by_credential.push_back(event_id);
    env.storage().instance().set(
        &CredentialEventKey::EventsByCredential(credential_id),
        &by_credential,
    );

    // Index by actor address.
    let mut by_actor: Vec<u64> = env
        .storage()
        .instance()
        .get(&CredentialEventKey::EventsByActor(actor.clone()))
        .unwrap_or_else(|| Vec::new(env));
    by_actor.push_back(event_id);
    env.storage()
        .instance()
        .set(&CredentialEventKey::EventsByActor(actor), &by_actor);

    event_id
}

/// Fetch a single event record by id.
pub fn get_credential_event(env: &Env, event_id: u64) -> Option<CredentialEventRecord> {
    env.storage()
        .instance()
        .get(&CredentialEventKey::Event(event_id))
}

/// Fetch all event records associated with a given credential id,
/// in insertion order.
pub fn get_credential_events(
    env: &Env,
    credential_id: u64,
) -> Vec<CredentialEventRecord> {
    let ids: Vec<u64> = env
        .storage()
        .instance()
        .get(&CredentialEventKey::EventsByCredential(credential_id))
        .unwrap_or_else(|| Vec::new(env));

    let mut out = Vec::new(env);
    for id in ids.iter() {
        if let Some(rec) = env
            .storage()
            .instance()
            .get::<_, CredentialEventRecord>(&CredentialEventKey::Event(id))
        {
            out.push_back(rec);
        }
    }
    out
}

/// Fetch all event records emitted by a given actor address,
/// in insertion order.
pub fn get_actor_events(env: &Env, actor: Address) -> Vec<CredentialEventRecord> {
    let ids: Vec<u64> = env
        .storage()
        .instance()
        .get(&CredentialEventKey::EventsByActor(actor))
        .unwrap_or_else(|| Vec::new(env));

    let mut out = Vec::new(env);
    for id in ids.iter() {
        if let Some(rec) = env
            .storage()
            .instance()
            .get::<_, CredentialEventRecord>(&CredentialEventKey::Event(id))
        {
            out.push_back(rec);
        }
    }
    out
}

/// Total number of recorded credential lifecycle events.
pub fn get_credential_event_count(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&CredentialEventKey::EventCount)
        .unwrap_or(0)
}
