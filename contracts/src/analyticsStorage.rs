use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AnalyticsRecord {
    pub timestamp: u64,
    pub total_users: u64,
    pub active_users: u64,
    pub total_courses: u64,
    pub total_completions: u64,
    pub avg_progress_bps: u32,   // Basis points (0-10000)
    pub avg_quiz_score_bps: u32, // Basis points (0-10000)
    pub total_time_spent: u64,   // Total minutes across all users
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LearningOutcome {
    pub course_id: Symbol,
    pub completion_rate_bps: u32,
    pub avg_score_bps: u32,
    pub total_enrolled: u64,
}

#[contracttype]
pub enum AnalyticsDataKey {
    Admin,
    History,
    Outcomes(u64), // Keyed by timestamp
    LastUpdate,
}

// Contract attribute disabled - this is a module used by main contract in lib.rs
// #[contract]
pub struct AnalyticsContract;

#[contractimpl]
impl AnalyticsContract {
    /// Initialize the contract with an admin address
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&AnalyticsDataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage()
            .instance()
            .set(&AnalyticsDataKey::Admin, &admin);
        let history: Vec<AnalyticsRecord> = Vec::new(&env);
        env.storage()
            .instance()
            .set(&AnalyticsDataKey::History, &history);
        env.storage()
            .instance()
            .set(&AnalyticsDataKey::LastUpdate, &0u64);
    }

    /// Record new analytics data (Admin only)
    pub fn record_metrics(
        env: Env,
        total_users: u64,
        active_users: u64,
        total_courses: u64,
        total_completions: u64,
        avg_progress_bps: u32,
        avg_quiz_score_bps: u32,
        total_time_spent: u64,
    ) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&AnalyticsDataKey::Admin)
            .unwrap();
        admin.require_auth();

        let timestamp = env.ledger().timestamp();
        let mut history: Vec<AnalyticsRecord> = env
            .storage()
            .instance()
            .get(&AnalyticsDataKey::History)
            .unwrap_or(Vec::new(&env));

        let record = AnalyticsRecord {
            timestamp,
            total_users,
            active_users,
            total_courses,
            total_completions,
            avg_progress_bps,
            avg_quiz_score_bps,
            total_time_spent,
        };

        history.push_back(record);
        env.storage()
            .instance()
            .set(&AnalyticsDataKey::History, &history);
        env.storage()
            .instance()
            .set(&AnalyticsDataKey::LastUpdate, &timestamp);
    }

    /// Record learning outcomes for courses (Admin only)
    pub fn record_outcomes(env: Env, outcomes: Vec<LearningOutcome>) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&AnalyticsDataKey::Admin)
            .unwrap();
        admin.require_auth();

        let timestamp = env.ledger().timestamp();
        env.storage()
            .instance()
            .set(&AnalyticsDataKey::Outcomes(timestamp), &outcomes);
    }

    /// Get the full history of analytics
    pub fn get_history(env: Env) -> Vec<AnalyticsRecord> {
        env.storage()
            .instance()
            .get(&AnalyticsDataKey::History)
            .unwrap_or(Vec::new(&env))
    }

    /// Get the most recent analytics record
    pub fn get_latest(env: Env) -> Option<AnalyticsRecord> {
        let history: Vec<AnalyticsRecord> = env
            .storage()
            .instance()
            .get(&AnalyticsDataKey::History)
            .unwrap_or(Vec::new(&env));
        if history.is_empty() {
            None
        } else {
            Some(history.get(history.len() - 1).unwrap())
        }
    }

    /// Get analytics records within a time range
    pub fn get_history_range(env: Env, start_time: u64, end_time: u64) -> Vec<AnalyticsRecord> {
        let history: Vec<AnalyticsRecord> = env
            .storage()
            .instance()
            .get(&AnalyticsDataKey::History)
            .unwrap_or(Vec::new(&env));
        let mut filtered = Vec::new(&env);

        for i in 0..history.len() {
            let record = history.get(i).unwrap();
            if record.timestamp >= start_time && record.timestamp <= end_time {
                filtered.push_back(record);
            }
        }

        filtered
    }

    /// Get learning outcomes for a specific timestamp
    pub fn get_outcomes(env: Env, timestamp: u64) -> Option<Vec<LearningOutcome>> {
        env.storage()
            .instance()
            .get(&AnalyticsDataKey::Outcomes(timestamp))
    }

    /// Get timestamp of last update
    pub fn get_last_update(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&AnalyticsDataKey::LastUpdate)
            .unwrap_or(0)
    }

    /// Calculate growth metrics between two time periods
    pub fn get_growth_metrics(
        env: Env,
        period1_start: u64,
        period1_end: u64,
        period2_start: u64,
        period2_end: u64,
    ) -> Option<(i64, i64, i64)> {
        let period1_records = Self::get_history_range(env.clone(), period1_start, period1_end);
        let period2_records = Self::get_history_range(env, period2_start, period2_end);

        if period1_records.is_empty() || period2_records.is_empty() {
            return None;
        }

        let p1_last = period1_records.get(period1_records.len() - 1).unwrap();
        let p2_last = period2_records.get(period2_records.len() - 1).unwrap();

        let user_growth = (p2_last.total_users as i64) - (p1_last.total_users as i64);
        let completion_growth =
            (p2_last.total_completions as i64) - (p1_last.total_completions as i64);
        let progress_change = (p2_last.avg_progress_bps as i64) - (p1_last.avg_progress_bps as i64);

        Some((user_growth, completion_growth, progress_change))
    }

    /// Get admin address (public for transparency)
    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&AnalyticsDataKey::Admin)
            .unwrap()
    }
}
