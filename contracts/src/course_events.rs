//! Course lifecycle event publishing and indexing.
//!
//! Provides a consistent surface for emitting and querying course lifecycle
//! events (Created, Enrolled, Completed, Updated).
//!
//! Each call to [`publish_course_event`] does two things:
//! 1. Publishes a blockchain-level event via `env.events().publish()` with
//!    topics `(course_op, <action_symbol>)` and payload `(course_id, actor, timestamp)`.
//! 2. Records the event in contract storage, indexed both by `course_id` and
//!    by `actor` so events can be queried efficiently by off-chain indexers.
use soroban_sdk::{contracttype, symbol_short, Address, Env, Symbol, Vec};

/// Topic prefix used for all course lifecycle events.
const TOPIC_PREFIX: Symbol = symbol_short!("course_op");

/// Course lifecycle event types.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CourseLifecycleEvent {
    Created,
    Enrolled,
    Completed,
    Updated,
}

impl CourseLifecycleEvent {
    /// Short, on-chain symbol used as the second topic for `publish`.
    /// Limited to 9 characters because of the `symbol_short!` macro.
    pub fn topic(&self) -> Symbol {
        match self {
            CourseLifecycleEvent::Created => symbol_short!("created"),
            CourseLifecycleEvent::Enrolled => symbol_short!("enrolled"),
            CourseLifecycleEvent::Completed => symbol_short!("completed"),
            CourseLifecycleEvent::Updated => symbol_short!("updated"),
        }
    }
}

/// Storage keys for course lifecycle events.
#[contracttype]
pub enum CourseEventKey {
    /// A single event record by its monotonically increasing id.
    Event(u64),
    /// Reverse-lookup index: all event ids for a given course id.
    EventsByCourse(u64),
    /// Reverse-lookup index: all event ids performed by a given actor.
    EventsByActor(Address),
    /// Monotonically increasing count of recorded events.
    EventCount,
}

/// Stored record of a course lifecycle event.
#[contracttype]
#[derive(Clone, Debug)]
pub struct CourseEventRecord {
    pub id: u64,
    pub event_type: CourseLifecycleEvent,
    pub course_id: u64,
    pub actor: Address,
    pub timestamp: u64,
}

/// Publish a course lifecycle event AND record it for queryability.
///
/// The published on-chain event has topics `(course_op, <action_symbol>)` and
/// payload `(course_id, actor, timestamp)`. Off-chain indexers (Horizon,
/// RPC, etc.) can filter on those topics to surface course lifecycle changes.
///
/// Returns the id of the newly stored record.
pub fn publish_course_event(
    env: &Env,
    event_type: CourseLifecycleEvent,
    course_id: u64,
    actor: Address,
) -> u64 {
    let timestamp = env.ledger().timestamp();
    env.events().publish(
        (TOPIC_PREFIX, event_type.topic()),
        (course_id, actor.clone(), timestamp),
    );

    record_course_event(env, event_type, course_id, actor, timestamp)
}

/// Record a course lifecycle event in contract storage without emitting an
/// on-chain event. Useful for backfilling or testing storage in isolation.
pub fn record_course_event(
    env: &Env,
    event_type: CourseLifecycleEvent,
    course_id: u64,
    actor: Address,
    timestamp: u64,
) -> u64 {
    let count: u64 = env
        .storage()
        .instance()
        .get(&CourseEventKey::EventCount)
        .unwrap_or(0);
    let event_id = count + 1;

    let record = CourseEventRecord {
        id: event_id,
        event_type: event_type.clone(),
        course_id,
        actor: actor.clone(),
        timestamp,
    };

    env.storage()
        .instance()
        .set(&CourseEventKey::Event(event_id), &record);
    env.storage()
        .instance()
        .set(&CourseEventKey::EventCount, &event_id);

    // Index by course id.
    let mut by_course: Vec<u64> = env
        .storage()
        .instance()
        .get(&CourseEventKey::EventsByCourse(course_id))
        .unwrap_or_else(|| Vec::new(env));
    by_course.push_back(event_id);
    env.storage()
        .instance()
        .set(&CourseEventKey::EventsByCourse(course_id), &by_course);

    // Index by actor address.
    let mut by_actor: Vec<u64> = env
        .storage()
        .instance()
        .get(&CourseEventKey::EventsByActor(actor.clone()))
        .unwrap_or_else(|| Vec::new(env));
    by_actor.push_back(event_id);
    env.storage()
        .instance()
        .set(&CourseEventKey::EventsByActor(actor), &by_actor);

    event_id
}

/// Fetch a single course event record by id.
pub fn get_course_event(env: &Env, event_id: u64) -> Option<CourseEventRecord> {
    env.storage()
        .instance()
        .get(&CourseEventKey::Event(event_id))
}

/// Fetch all event records associated with a given course id, in insertion order.
pub fn get_course_events(env: &Env, course_id: u64) -> Vec<CourseEventRecord> {
    let ids: Vec<u64> = env
        .storage()
        .instance()
        .get(&CourseEventKey::EventsByCourse(course_id))
        .unwrap_or_else(|| Vec::new(env));

    let mut out = Vec::new(env);
    for id in ids.iter() {
        if let Some(rec) = env
            .storage()
            .instance()
            .get::<_, CourseEventRecord>(&CourseEventKey::Event(id))
        {
            out.push_back(rec);
        }
    }
    out
}

/// Fetch all course event records emitted by a given actor, in insertion order.
pub fn get_course_actor_events(env: &Env, actor: Address) -> Vec<CourseEventRecord> {
    let ids: Vec<u64> = env
        .storage()
        .instance()
        .get(&CourseEventKey::EventsByActor(actor))
        .unwrap_or_else(|| Vec::new(env));

    let mut out = Vec::new(env);
    for id in ids.iter() {
        if let Some(rec) = env
            .storage()
            .instance()
            .get::<_, CourseEventRecord>(&CourseEventKey::Event(id))
        {
            out.push_back(rec);
        }
    }
    out
}

/// Total number of recorded course lifecycle events.
pub fn get_course_event_count(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&CourseEventKey::EventCount)
        .unwrap_or(0)
}
