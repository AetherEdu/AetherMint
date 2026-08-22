use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, String, Vec};

#[contracttype]
#[derive(Clone)]
pub enum EventType {
    CourseCompletion,
    CredentialIssuance,
    UserAchievement,
    ProfileUpdate,
    CourseEnrollment,
}

#[contracttype]
#[derive(Clone)]
pub struct EventLog {
    pub id: u64,
    pub event_type: EventType,
    pub user: Address,
    pub timestamp: u64,
    pub course_id: Option<String>,
    pub credential_id: Option<u64>,
    pub achievement_type: Option<String>,
    pub metadata: String, // JSON string for additional data
}

#[contracttype]
pub enum EventKey {
    Event(u64),
    UserEvents(Address),
    EventTypeEvents(EventType),
    EventCount,
}

// Contract attribute disabled - this is a module used by main contract in lib.rs
// #[contract]
pub struct EventLoggerContract;

#[contractimpl]
impl EventLoggerContract {
    /// Initialize the contract
    pub fn initialize(env: Env) {
        if env.storage().instance().has(&EventKey::EventCount) {
            panic!("Contract already initialized");
        }

        env.storage().instance().set(&EventKey::EventCount, &0u64);
    }

    /// Log a course completion event
    pub fn log_course_completion(
        env: Env,
        user: Address,
        course_id: String,
        metadata: String,
    ) -> u64 {
        user.require_auth();

        let event_id = Self::create_event(
            env.clone(),
            EventType::CourseCompletion,
            user.clone(),
            Some(course_id),
            None,
            None,
            metadata,
        );

        // Create notification for course completion
        env.events().publish(
            (symbol_short!("course"), symbol_short!("completed")),
            (user, event_id),
        );

        event_id
    }

    /// Log a credential issuance event
    pub fn log_credential_issuance(
        env: Env,
        user: Address,
        credential_id: u64,
        course_id: String,
        metadata: String,
    ) -> u64 {
        // In production, require admin auth
        // user.require_auth();

        let event_id = Self::create_event(
            env.clone(),
            EventType::CredentialIssuance,
            user.clone(),
            Some(course_id),
            Some(credential_id),
            None,
            metadata,
        );

        // Create notification for credential issuance
        env.events().publish(
            (symbol_short!("cred"), symbol_short!("issued")),
            (user, credential_id, event_id),
        );

        event_id
    }

    /// Log a user achievement event
    pub fn log_user_achievement(
        env: Env,
        user: Address,
        achievement_type: String,
        metadata: String,
    ) -> u64 {
        user.require_auth();

        let event_id = Self::create_event(
            env.clone(),
            EventType::UserAchievement,
            user.clone(),
            None,
            None,
            Some(achievement_type),
            metadata,
        );

        // Create notification for achievement
        env.events().publish(
            (symbol_short!("ach"), symbol_short!("earn")),
            (user, event_id),
        );

        event_id
    }

    /// Log a profile update event
    pub fn log_profile_update(env: Env, user: Address, metadata: String) -> u64 {
        user.require_auth();

        let event_id = Self::create_event(
            env.clone(),
            EventType::ProfileUpdate,
            user.clone(),
            None,
            None,
            None,
            metadata,
        );

        event_id
    }

    /// Log a course enrollment event
    pub fn log_course_enrollment(
        env: Env,
        user: Address,
        course_id: String,
        metadata: String,
    ) -> u64 {
        user.require_auth();

        let event_id = Self::create_event(
            env.clone(),
            EventType::CourseEnrollment,
            user.clone(),
            Some(course_id),
            None,
            None,
            metadata,
        );

        event_id
    }

    /// Get event by ID
    pub fn get_event(env: Env, event_id: u64) -> Option<EventLog> {
        env.storage().instance().get(&EventKey::Event(event_id))
    }

    /// Get all events for a user
    pub fn get_user_events(env: Env, user: Address) -> Vec<EventLog> {
        let event_ids: Vec<u64> = env
            .storage()
            .instance()
            .get(&EventKey::UserEvents(user))
            .unwrap_or_else(|| Vec::new(&env));

        let mut events = Vec::new(&env);
        for event_id in event_ids.iter() {
            if let Some(event) = Self::get_event(env.clone(), event_id) {
                events.push_back(event);
            }
        }

        events
    }

    /// Get all events of a specific type
    pub fn get_events_by_type(env: Env, event_type: EventType) -> Vec<EventLog> {
        let event_ids: Vec<u64> = env
            .storage()
            .instance()
            .get(&EventKey::EventTypeEvents(event_type.clone()))
            .unwrap_or_else(|| Vec::new(&env));

        let mut events = Vec::new(&env);
        for event_id in event_ids.iter() {
            if let Some(event) = Self::get_event(env.clone(), event_id) {
                events.push_back(event);
            }
        }

        events
    }

    /// Get recent events with pagination
    pub fn get_recent_events(env: Env, limit: u32, offset: u32) -> Vec<EventLog> {
        let total_events: u64 = env
            .storage()
            .instance()
            .get(&EventKey::EventCount)
            .unwrap_or(0);

        let mut events = Vec::new(&env);
        let start = if total_events > offset as u64 {
            total_events - offset as u64
        } else {
            0
        };

        let end = if start > limit as u64 {
            start - limit as u64
        } else {
            0
        };

        for i in (end..start).rev() {
            if let Some(event) = Self::get_event(env.clone(), i + 1) {
                events.push_back(event);
            }
        }

        events
    }

    /// Get total event count
    pub fn get_event_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&EventKey::EventCount)
            .unwrap_or(0)
    }

    /// Internal helper to create and store events
    fn create_event(
        env: Env,
        event_type: EventType,
        user: Address,
        course_id: Option<String>,
        credential_id: Option<u64>,
        achievement_type: Option<String>,
        metadata: String,
    ) -> u64 {
        let count: u64 = env
            .storage()
            .instance()
            .get(&EventKey::EventCount)
            .unwrap_or(0);
        let event_id = count + 1;

        let event = EventLog {
            id: event_id,
            event_type: event_type.clone(),
            user: user.clone(),
            timestamp: env.ledger().timestamp(),
            course_id,
            credential_id,
            achievement_type,
            metadata,
        };

        // Store the event
        env.storage()
            .instance()
            .set(&EventKey::Event(event_id), &event);
        env.storage()
            .instance()
            .set(&EventKey::EventCount, &event_id);

        // Update user's event list
        let mut user_events: Vec<u64> = env
            .storage()
            .instance()
            .get(&EventKey::UserEvents(user.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        user_events.push_back(event_id);
        env.storage()
            .instance()
            .set(&EventKey::UserEvents(user), &user_events);

        // Update event type list
        let mut type_events: Vec<u64> = env
            .storage()
            .instance()
            .get(&EventKey::EventTypeEvents(event_type.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        type_events.push_back(event_id);
        env.storage()
            .instance()
            .set(&EventKey::EventTypeEvents(event_type), &type_events);

        event_id
    }
}
