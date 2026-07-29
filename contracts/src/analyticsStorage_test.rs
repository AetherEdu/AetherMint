#![cfg(test)]
extern crate std;

use crate::analyticsStorage::{AnalyticsContract, AnalyticsContractClient, LearningOutcome};
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Ledger},
    Address, Env, Vec,
};

#[test]
fn test_analytics_initialization() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AnalyticsContract);
    let client = AnalyticsContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    // Verify admin is set
    assert_eq!(client.get_admin(), admin);

    // Verify history is empty
    let history = client.get_history();
    assert_eq!(history.len(), 0);

    // Verify last update is 0
    assert_eq!(client.get_last_update(), 0);
}

#[test]
fn test_record_and_retrieve_metrics() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AnalyticsContract);
    let client = AnalyticsContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    // Record metrics
    let total_users = 100;
    let active_users = 75;
    let total_courses = 5;
    let total_completions = 20;
    let avg_progress = 7500; // 75.00%
    let avg_quiz_score = 8200; // 82.00%
    let total_time = 5000; // minutes

    env.ledger().set_timestamp(1000);
    client.record_metrics(
        &total_users,
        &active_users,
        &total_courses,
        &total_completions,
        &avg_progress,
        &avg_quiz_score,
        &total_time,
    );

    // Verify latest
    let latest = client.get_latest().unwrap();
    assert_eq!(latest.total_users, total_users);
    assert_eq!(latest.active_users, active_users);
    assert_eq!(latest.avg_progress_bps, avg_progress);
    assert_eq!(latest.avg_quiz_score_bps, avg_quiz_score);
    assert_eq!(latest.total_time_spent, total_time);
    assert_eq!(latest.timestamp, 1000);

    // Verify last update timestamp
    assert_eq!(client.get_last_update(), 1000);
}

#[test]
fn test_historical_data_tracking() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AnalyticsContract);
    let client = AnalyticsContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    // Record multiple data points
    env.ledger().set_timestamp(1000);
    client.record_metrics(&100, &75, &5, &20, &7500, &8200, &5000);

    env.ledger().set_timestamp(2000);
    client.record_metrics(&110, &80, &6, &25, &7600, &8300, &5500);

    env.ledger().set_timestamp(3000);
    client.record_metrics(&125, &90, &7, &32, &7800, &8400, &6200);

    // Verify history
    let history = client.get_history();
    assert_eq!(history.len(), 3);
    assert_eq!(history.get(0).unwrap().timestamp, 1000);
    assert_eq!(history.get(1).unwrap().timestamp, 2000);
    assert_eq!(history.get(2).unwrap().timestamp, 3000);

    // Verify progression
    assert_eq!(history.get(0).unwrap().total_users, 100);
    assert_eq!(history.get(1).unwrap().total_users, 110);
    assert_eq!(history.get(2).unwrap().total_users, 125);
}

#[test]
fn test_time_range_queries() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AnalyticsContract);
    let client = AnalyticsContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    // Record data at different times
    env.ledger().set_timestamp(1000);
    client.record_metrics(&100, &75, &5, &20, &7500, &8200, &5000);

    env.ledger().set_timestamp(2000);
    client.record_metrics(&110, &80, &6, &25, &7600, &8300, &5500);

    env.ledger().set_timestamp(3000);
    client.record_metrics(&125, &90, &7, &32, &7800, &8400, &6200);

    env.ledger().set_timestamp(4000);
    client.record_metrics(&140, &100, &8, &40, &8000, &8500, &7000);

    // Query specific range
    let range = client.get_history_range(&1500, &3500);
    assert_eq!(range.len(), 2);
    assert_eq!(range.get(0).unwrap().timestamp, 2000);
    assert_eq!(range.get(1).unwrap().timestamp, 3000);
}

#[test]
fn test_learning_outcomes() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AnalyticsContract);
    let client = AnalyticsContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    // Create learning outcomes
    let mut outcomes = Vec::new(&env);
    outcomes.push_back(LearningOutcome {
        course_id: symbol_short!("COURSE1"),
        completion_rate_bps: 6500, // 65%
        avg_score_bps: 8200,       // 82%
        total_enrolled: 150,
    });
    outcomes.push_back(LearningOutcome {
        course_id: symbol_short!("COURSE2"),
        completion_rate_bps: 7200, // 72%
        avg_score_bps: 8500,       // 85%
        total_enrolled: 120,
    });

    env.ledger().set_timestamp(1000);
    client.record_outcomes(&outcomes);

    // Retrieve outcomes
    let retrieved = client.get_outcomes(&1000).unwrap();
    assert_eq!(retrieved.len(), 2);
    assert_eq!(
        retrieved.get(0).unwrap().course_id,
        symbol_short!("COURSE1")
    );
    assert_eq!(retrieved.get(0).unwrap().completion_rate_bps, 6500);
    assert_eq!(retrieved.get(1).unwrap().avg_score_bps, 8500);
}

#[test]
fn test_growth_metrics() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AnalyticsContract);
    let client = AnalyticsContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    // Period 1: Week 1
    env.ledger().set_timestamp(1000);
    client.record_metrics(&100, &75, &5, &20, &7500, &8200, &5000);

    // Period 2: Week 2
    env.ledger().set_timestamp(8000);
    client.record_metrics(&125, &90, &7, &32, &7800, &8400, &6200);

    // Calculate growth
    let growth = client.get_growth_metrics(&0, &2000, &7000, &9000).unwrap();

    // user_growth, completion_growth, progress_change
    assert_eq!(growth.0, 25); // 25 new users
    assert_eq!(growth.1, 12); // 12 new completions
    assert_eq!(growth.2, 300); // 3% progress increase (300 bps)
}

#[test]
fn test_public_transparency() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AnalyticsContract);
    let client = AnalyticsContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    // Anyone can query admin address
    let retrieved_admin = client.get_admin();
    assert_eq!(retrieved_admin, admin);

    // Record some data
    env.ledger().set_timestamp(1000);
    client.record_metrics(&100, &75, &5, &20, &7500, &8200, &5000);

    // Anyone can query history (no auth required)
    let history = client.get_history();
    assert_eq!(history.len(), 1);

    // Anyone can query latest
    let latest = client.get_latest().unwrap();
    assert_eq!(latest.total_users, 100);
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_cannot_reinitialize() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AnalyticsContract);
    let client = AnalyticsContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);
    client.initialize(&admin); // Should panic
}

#[test]
fn test_record_metrics_with_zero_values() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AnalyticsContract);
    let client = AnalyticsContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    // Record metrics with zero values
    client.record_metrics(&0, &0, &0, &0, &0, &0, &0);

    let latest = client.get_latest().unwrap();
    assert_eq!(latest.total_users, 0);
    assert_eq!(latest.active_users, 0);
    assert_eq!(latest.total_courses, 0);
    assert_eq!(latest.total_completions, 0);
}

#[test]
fn test_record_metrics_with_max_values() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AnalyticsContract);
    let client = AnalyticsContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    // Record metrics with maximum values
    client.record_metrics(&u64::MAX, &u64::MAX, &u64::MAX, &u64::MAX, &u32::MAX, &u32::MAX, &u64::MAX);

    let latest = client.get_latest().unwrap();
    assert_eq!(latest.total_users, u64::MAX);
    assert_eq!(latest.active_users, u64::MAX);
    assert_eq!(latest.avg_progress_bps, u32::MAX);
}

#[test]
fn test_get_history_range_empty() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AnalyticsContract);
    let client = AnalyticsContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    let range = client.get_history_range(&1000, &2000);
    assert_eq!(range.len(), 0);
}

#[test]
fn test_get_history_range_no_match() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AnalyticsContract);
    let client = AnalyticsContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    env.ledger().set_timestamp(1000);
    client.record_metrics(&100, &75, &5, &20, &7500, &8200, &5000);

    // Query range that doesn't match
    let range = client.get_history_range(&5000, &10000);
    assert_eq!(range.len(), 0);
}

#[test]
fn test_get_outcomes_nonexistent_timestamp() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AnalyticsContract);
    let client = AnalyticsContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    let outcomes = client.get_outcomes(&9999);
    assert!(outcomes.is_none());
}

#[test]
fn test_record_empty_outcomes() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AnalyticsContract);
    let client = AnalyticsContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    let outcomes = Vec::new(&env);

    env.ledger().set_timestamp(1000);
    client.record_outcomes(&outcomes);

    let retrieved = client.get_outcomes(&1000).unwrap();
    assert_eq!(retrieved.len(), 0);
}

#[test]
fn test_growth_metrics_no_data() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AnalyticsContract);
    let client = AnalyticsContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    let growth = client.get_growth_metrics(&0, &2000, &7000, &9000);
    assert!(growth.is_none());
}

#[test]
fn test_get_latest_before_any_record() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AnalyticsContract);
    let client = AnalyticsContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    let latest = client.get_latest();
    assert!(latest.is_none());
}

#[test]
fn test_multiple_outcome_records() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AnalyticsContract);
    let client = AnalyticsContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    // Record outcomes at different timestamps
    env.ledger().set_timestamp(1000);
    let mut outcomes1 = Vec::new(&env);
    outcomes1.push_back(LearningOutcome {
        course_id: symbol_short!("COURSE1"),
        completion_rate_bps: 6500,
        avg_score_bps: 8200,
        total_enrolled: 150,
    });
    client.record_outcomes(&outcomes1);

    env.ledger().set_timestamp(2000);
    let mut outcomes2 = Vec::new(&env);
    outcomes2.push_back(LearningOutcome {
        course_id: symbol_short!("COURSE2"),
        completion_rate_bps: 7200,
        avg_score_bps: 8500,
        total_enrolled: 120,
    });
    client.record_outcomes(&outcomes2);

    // Verify both are stored separately
    let retrieved1 = client.get_outcomes(&1000).unwrap();
    let retrieved2 = client.get_outcomes(&2000).unwrap();

    assert_eq!(retrieved1.len(), 1);
    assert_eq!(retrieved2.len(), 1);
    assert_eq!(retrieved1.get(0).unwrap().course_id, symbol_short!("COURSE1"));
    assert_eq!(retrieved2.get(0).unwrap().course_id, symbol_short!("COURSE2"));
}

#[test]
fn test_history_ordering() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AnalyticsContract);
    let client = AnalyticsContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    // Record in reverse order to test ordering
    env.ledger().set_timestamp(3000);
    client.record_metrics(&125, &90, &7, &32, &7800, &8400, &6200);

    env.ledger().set_timestamp(1000);
    client.record_metrics(&100, &75, &5, &20, &7500, &8200, &5000);

    env.ledger().set_timestamp(2000);
    client.record_metrics(&110, &80, &6, &25, &7600, &8300, &5500);

    let history = client.get_history();
    assert_eq!(history.len(), 3);
    // Should be in chronological order
    assert_eq!(history.get(0).unwrap().timestamp, 1000);
    assert_eq!(history.get(1).unwrap().timestamp, 2000);
    assert_eq!(history.get(2).unwrap().timestamp, 3000);
}

#[test]
fn test_unauthorized_metrics_recording() {
    let env = Env::default();
    let contract_id = env.register_contract(None, AnalyticsContract);
    let client = AnalyticsContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let unauthorized = Address::generate(&env);

    client.initialize(&admin);

    // Try to record metrics without admin auth
    env.mock_all_auths_except(&[&unauthorized], &[]);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.record_metrics(&100, &75, &5, &20, &7500, &8200, &5000);
    }));
    assert!(result.is_err());
}

#[test]
fn test_unauthorized_outcomes_recording() {
    let env = Env::default();
    let contract_id = env.register_contract(None, AnalyticsContract);
    let client = AnalyticsContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let unauthorized = Address::generate(&env);

    client.initialize(&admin);

    let outcomes = Vec::new(&env);

    // Try to record outcomes without admin auth
    env.mock_all_auths_except(&[&unauthorized], &[]);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.record_outcomes(&outcomes);
    }));
    assert!(result.is_err());
}
