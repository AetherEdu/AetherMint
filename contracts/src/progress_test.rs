#![cfg(test)]

use crate::progress::{CourseProgressContract, CourseProgressContractClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, String,
};

#[test]
fn test_progress_tracking() {
    let env = Env::default();
    let contract_id = env.register_contract(None, CourseProgressContract);
    let client = CourseProgressContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    let course_id = String::from_str(&env, "course-101");

    // Mock authentication
    env.mock_all_auths();

    // Record initial progress
    client.record_progress(&user, &course_id, &2, &10);

    // Verify progress stored
    let progress = client.get_progress(&user, &course_id).unwrap();
    assert_eq!(progress.lessons_completed, 2);
    assert_eq!(progress.total_lessons, 10);
    assert_eq!(progress.is_completed, false);

    // Update progress to completion
    client.record_progress(&user, &course_id, &10, &10);

    // Verify completion
    let completed_progress = client.get_progress(&user, &course_id).unwrap();
    assert_eq!(completed_progress.lessons_completed, 10);
    assert_eq!(completed_progress.is_completed, true);
    assert!(completed_progress.last_updated > 0);
}

#[test]
fn test_unauthorized_progress_update() {
    let env = Env::default();
    let contract_id = env.register_contract(None, CourseProgressContract);
    let client = CourseProgressContractClient::new(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let course_id = String::from_str(&env, "course-101");

    // User1 records progress
    env.mock_all_auths();
    client.record_progress(&user1, &course_id, &2, &10);

    // User2 tries to update user1's progress (should fail due to auth)
    env.mock_all_auths_except(&[&user2], &[]);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.record_progress(&user1, &course_id, &5, &10);
    }));
    assert!(result.is_err());
}

#[test]
fn test_empty_course_id() {
    let env = Env::default();
    let contract_id = env.register_contract(None, CourseProgressContract);
    let client = CourseProgressContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    let course_id = String::from_str(&env, "");

    env.mock_all_auths();
    client.record_progress(&user, &course_id, &2, &10);

    let progress = client.get_progress(&user, &course_id).unwrap();
    assert_eq!(progress.course_id.len(), 0);
}

#[test]
fn test_zero_lessons() {
    let env = Env::default();
    let contract_id = env.register_contract(None, CourseProgressContract);
    let client = CourseProgressContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    let course_id = String::from_str(&env, "course-101");

    env.mock_all_auths();
    client.record_progress(&user, &course_id, &0, &0);

    let progress = client.get_progress(&user, &course_id).unwrap();
    assert_eq!(progress.lessons_completed, 0);
    assert_eq!(progress.total_lessons, 0);
    assert!(progress.is_completed); // 0 >= 0 is true
}

#[test]
fn test_lessons_exceed_total() {
    let env = Env::default();
    let contract_id = env.register_contract(None, CourseProgressContract);
    let client = CourseProgressContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    let course_id = String::from_str(&env, "course-101");

    env.mock_all_auths();
    client.record_progress(&user, &course_id, &15, &10);

    let progress = client.get_progress(&user, &course_id).unwrap();
    assert_eq!(progress.lessons_completed, 15);
    assert_eq!(progress.total_lessons, 10);
    assert!(progress.is_completed); // 15 >= 10 is true
}

#[test]
fn test_multiple_courses_same_user() {
    let env = Env::default();
    let contract_id = env.register_contract(None, CourseProgressContract);
    let client = CourseProgressContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    let course1 = String::from_str(&env, "course-101");
    let course2 = String::from_str(&env, "course-102");
    let course3 = String::from_str(&env, "course-103");

    env.mock_all_auths();
    client.record_progress(&user, &course1, &5, &10);
    client.record_progress(&user, &course2, &3, &20);
    client.record_progress(&user, &course3, &10, &10);

    let progress1 = client.get_progress(&user, &course1).unwrap();
    let progress2 = client.get_progress(&user, &course2).unwrap();
    let progress3 = client.get_progress(&user, &course3).unwrap();

    assert_eq!(progress1.lessons_completed, 5);
    assert_eq!(progress2.lessons_completed, 3);
    assert_eq!(progress3.lessons_completed, 10);
    assert!(!progress1.is_completed);
    assert!(!progress2.is_completed);
    assert!(progress3.is_completed);
}

#[test]
fn test_get_progress_nonexistent() {
    let env = Env::default();
    let contract_id = env.register_contract(None, CourseProgressContract);
    let client = CourseProgressContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    let course_id = String::from_str(&env, "course-999");

    let progress = client.get_progress(&user, &course_id);
    assert!(progress.is_none());
}

#[test]
fn test_progress_update_overwrites() {
    let env = Env::default();
    let contract_id = env.register_contract(None, CourseProgressContract);
    let client = CourseProgressContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    let course_id = String::from_str(&env, "course-101");

    env.mock_all_auths();
    client.record_progress(&user, &course_id, &2, &10);

    let progress1 = client.get_progress(&user, &course_id).unwrap();
    assert_eq!(progress1.lessons_completed, 2);

    // Update progress
    env.mock_all_auths();
    client.record_progress(&user, &course_id, &7, &10);

    let progress2 = client.get_progress(&user, &course_id).unwrap();
    assert_eq!(progress2.lessons_completed, 7);
    assert!(progress2.last_updated > progress1.last_updated);
}

#[test]
fn test_max_values() {
    let env = Env::default();
    let contract_id = env.register_contract(None, CourseProgressContract);
    let client = CourseProgressContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    let course_id = String::from_str(&env, "course-101");

    env.mock_all_auths();
    client.record_progress(&user, &course_id, &u32::MAX, &u32::MAX);

    let progress = client.get_progress(&user, &course_id).unwrap();
    assert_eq!(progress.lessons_completed, u32::MAX);
    assert_eq!(progress.total_lessons, u32::MAX);
    assert!(progress.is_completed);
}

#[test]
fn test_timestamp_updates() {
    let env = Env::default();
    let contract_id = env.register_contract(None, CourseProgressContract);
    let client = CourseProgressContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    let course_id = String::from_str(&env, "course-101");

    env.ledger().set_timestamp(1000);
    env.mock_all_auths();
    client.record_progress(&user, &course_id, &2, &10);

    let progress1 = client.get_progress(&user, &course_id).unwrap();
    assert_eq!(progress1.last_updated, 1000);

    env.ledger().set_timestamp(5000);
    env.mock_all_auths();
    client.record_progress(&user, &course_id, &5, &10);

    let progress2 = client.get_progress(&user, &course_id).unwrap();
    assert_eq!(progress2.last_updated, 5000);
}

#[test]
fn test_different_users_same_course() {
    let env = Env::default();
    let contract_id = env.register_contract(None, CourseProgressContract);
    let client = CourseProgressContractClient::new(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let user3 = Address::generate(&env);
    let course_id = String::from_str(&env, "course-101");

    env.mock_all_auths();
    client.record_progress(&user1, &course_id, &10, &10);
    client.record_progress(&user2, &course_id, &5, &10);
    client.record_progress(&user3, &course_id, &0, &10);

    let progress1 = client.get_progress(&user1, &course_id).unwrap();
    let progress2 = client.get_progress(&user2, &course_id).unwrap();
    let progress3 = client.get_progress(&user3, &course_id).unwrap();

    assert!(progress1.is_completed);
    assert!(!progress2.is_completed);
    assert!(!progress3.is_completed);
}

#[test]
fn test_completion_threshold() {
    let env = Env::default();
    let contract_id = env.register_contract(None, CourseProgressContract);
    let client = CourseProgressContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    let course_id = String::from_str(&env, "course-101");

    env.mock_all_auths();
    client.record_progress(&user, &course_id, &9, &10);

    let progress = client.get_progress(&user, &course_id).unwrap();
    assert!(!progress.is_completed);

    env.mock_all_auths();
    client.record_progress(&user, &course_id, &10, &10);

    let progress = client.get_progress(&user, &course_id).unwrap();
    assert!(progress.is_completed);
}
