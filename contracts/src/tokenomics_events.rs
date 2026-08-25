// This module emits events via the legacy `env.events().publish` API
// (deprecated in soroban-sdk 26). Scoped here rather than crate-wide until it
// is migrated to the `#[contractevent]` macro.
#![allow(deprecated)]

//! Tokenomics lifecycle event publishing and indexing.
//!
//! Provides a consistent surface for emitting and querying tokenomics events
//! (Minted, Staked, Unstaked, Voted, ProposalCreated).
//!
//! Each call to [`publish_tokenomics_event`] does two things:
//! 1. Publishes a blockchain-level event via `env.events().publish()` with
//!    topics `(token_op, <action_symbol>)` and payload `(entity_id, actor, timestamp)`.
//! 2. Records the event in contract storage, indexed by `actor` for queryability.
use soroban_sdk::{contracttype, symbol_short, Address, Env, Symbol, Vec};

/// Topic prefix used for all tokenomics lifecycle events.
const TOPIC_PREFIX: Symbol = symbol_short!("token_op");

/// Tokenomics event types.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TokenomicsEvent {
    /// Reward tokens minted to a recipient (entity_id = amount).
    Minted,
    /// Tokens staked by an actor (entity_id = amount).
    Staked,
    /// Staked tokens withdrawn (entity_id = total_return including reward).
    Unstaked,
    /// Vote cast on a governance proposal (entity_id = proposal_id).
    Voted,
    /// New governance proposal created (entity_id = proposal_id).
    ProposalCreated,
}

impl TokenomicsEvent {
    /// Short, on-chain symbol used as the second topic.
    /// Limited to 9 characters because of the `symbol_short!` macro.
    pub fn topic(&self) -> Symbol {
        match self {
            TokenomicsEvent::Minted => symbol_short!("minted"),
            TokenomicsEvent::Staked => symbol_short!("staked"),
            TokenomicsEvent::Unstaked => symbol_short!("unstaked"),
            TokenomicsEvent::Voted => symbol_short!("voted"),
            TokenomicsEvent::ProposalCreated => symbol_short!("prop_new"),
        }
    }
}

/// Storage keys for tokenomics lifecycle events.
#[contracttype]
pub enum TokenomicsEventKey {
    /// A single event record by its monotonically increasing id.
    Event(u64),
    /// Reverse-lookup index: all event ids performed by a given actor.
    EventsByActor(Address),
    /// Monotonically increasing count of recorded events.
    EventCount,
}

/// Stored record of a tokenomics lifecycle event.
///
/// `entity_id` semantics depend on `event_type`:
/// - `Minted`         → amount minted
/// - `Staked`         → amount staked
/// - `Unstaked`       → total return (stake + reward)
/// - `Voted`          → proposal_id
/// - `ProposalCreated`→ proposal_id
#[contracttype]
#[derive(Clone, Debug)]
pub struct TokenomicsEventRecord {
    pub id: u64,
    pub event_type: TokenomicsEvent,
    /// Context-dependent id: amount for token operations, proposal_id for governance.
    pub entity_id: u64,
    pub actor: Address,
    pub timestamp: u64,
}

/// Publish a tokenomics lifecycle event AND record it for queryability.
///
/// The published on-chain event has topics `(token_op, <action_symbol>)` and
/// payload `(entity_id, actor, timestamp)`. Off-chain indexers can filter on
/// those topics to monitor token and governance activity.
///
/// Returns the id of the newly stored record.
pub fn publish_tokenomics_event(
    env: &Env,
    event_type: TokenomicsEvent,
    entity_id: u64,
    actor: Address,
) -> u64 {
    let timestamp = env.ledger().timestamp();
    env.events().publish(
        (TOPIC_PREFIX, event_type.topic()),
        (entity_id, actor.clone(), timestamp),
    );

    record_tokenomics_event(env, event_type, entity_id, actor, timestamp)
}

/// Record a tokenomics event in storage without emitting an on-chain event.
/// Useful for backfilling or testing storage in isolation.
pub fn record_tokenomics_event(
    env: &Env,
    event_type: TokenomicsEvent,
    entity_id: u64,
    actor: Address,
    timestamp: u64,
) -> u64 {
    let count: u64 = env
        .storage()
        .instance()
        .get(&TokenomicsEventKey::EventCount)
        .unwrap_or(0);
    let event_id = count + 1;

    let record = TokenomicsEventRecord {
        id: event_id,
        event_type: event_type.clone(),
        entity_id,
        actor: actor.clone(),
        timestamp,
    };

    env.storage()
        .instance()
        .set(&TokenomicsEventKey::Event(event_id), &record);
    env.storage()
        .instance()
        .set(&TokenomicsEventKey::EventCount, &event_id);

    // Index by actor address.
    let mut by_actor: Vec<u64> = env
        .storage()
        .instance()
        .get(&TokenomicsEventKey::EventsByActor(actor.clone()))
        .unwrap_or_else(|| Vec::new(env));
    by_actor.push_back(event_id);
    env.storage()
        .instance()
        .set(&TokenomicsEventKey::EventsByActor(actor), &by_actor);

    event_id
}

/// Fetch a single tokenomics event record by id.
pub fn get_tokenomics_event(env: &Env, event_id: u64) -> Option<TokenomicsEventRecord> {
    env.storage()
        .instance()
        .get(&TokenomicsEventKey::Event(event_id))
}

/// Fetch all tokenomics event records emitted by a given actor, in insertion order.
pub fn get_tokenomics_actor_events(env: &Env, actor: Address) -> Vec<TokenomicsEventRecord> {
    let ids: Vec<u64> = env
        .storage()
        .instance()
        .get(&TokenomicsEventKey::EventsByActor(actor))
        .unwrap_or_else(|| Vec::new(env));

    let mut out = Vec::new(env);
    for id in ids.iter() {
        if let Some(rec) = env
            .storage()
            .instance()
            .get::<_, TokenomicsEventRecord>(&TokenomicsEventKey::Event(id))
        {
            out.push_back(rec);
        }
    }
    out
}

/// Total number of recorded tokenomics lifecycle events.
pub fn get_tokenomics_event_count(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&TokenomicsEventKey::EventCount)
        .unwrap_or(0)
}
