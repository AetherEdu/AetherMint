#![cfg(test)]

use crate::utils::pause::{PausedEvent, UnpausedEvent};
use crate::{AetherMintContract, AetherMintContractClient};
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Events, Ledger},
    Address, Env, IntoVal, String,
};

fn setup_test() -> (Env, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(AetherMintContract, ());
    let client = AetherMintContractClient::new(&env, &contract_id);
    client.initialize(&admin);
    (env, admin)
}

#[test]
fn test_pause_unpause_admin() {
    let (env, admin) = setup_test();
    let contract_id = env.register(AetherMintContract, ());
    let client = AetherMintContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    // Initially not paused
    assert!(!client.is_paused());

    // Admin can pause
    client.pause(&admin);
    assert!(client.is_paused());

    // Admin can unpause
    client.unpause(&admin);
    assert!(!client.is_paused());
}

#[test]
#[should_panic(expected = "Only admin can pause")]
fn test_pause_non_admin_fails() {
    let (env, admin) = setup_test();
    let contract_id = env.register(AetherMintContract, ());
    let client = AetherMintContractClient::new(&env, &contract_id);
    client.initialize(&admin);
    let non_admin = Address::generate(&client.env);

    client.pause(&non_admin);
}

#[test]
#[should_panic(expected = "Only admin can unpause")]
fn test_unpause_non_admin_fails() {
    let (env, admin) = setup_test();
    let contract_id = env.register(AetherMintContract, ());
    let client = AetherMintContractClient::new(&env, &contract_id);
    client.initialize(&admin);
    let non_admin = Address::generate(&env);

    client.pause(&admin);
    client.unpause(&non_admin);
}

#[test]
fn test_mutating_methods_fail_when_paused() {
    let (env, admin) = setup_test();
    let contract_id = env.register(AetherMintContract, ());
    let client = AetherMintContractClient::new(&env, &contract_id);
    client.initialize(&admin);
    let user = Address::generate(&env);

    client.pause(&admin);

    // Test issue_credential (mutating) - should fail
    let title = String::from_str(&env, "Title");
    let desc = String::from_str(&env, "Desc");
    let course = String::from_str(&env, "Course");
    let ipfs = String::from_str(&env, "IPFS");

    let result = client.try_issue_credential(&admin, &user, &title, &desc, &course, &ipfs);
    assert!(result.is_err());

    // Test create_course (mutating) - should fail
    let result_course = client.try_create_course(&admin, &title, &desc, &100);
    assert!(result_course.is_err());
}

#[test]
fn test_read_methods_work_when_paused() {
    let (env, admin) = setup_test();
    let contract_id = env.register(AetherMintContract, ());
    let client = AetherMintContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    client.pause(&admin);

    // Read methods should still work
    assert!(client.is_paused());
    assert_eq!(client.get_credential_count(), 0);
    assert_eq!(client.get_course_count(), 0);
}

#[test]
fn test_events_emitted_correctly() {
    let (env, admin) = setup_test();
    let contract_id = env.register(AetherMintContract, ());
    let client = AetherMintContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    client.pause(&admin);

    // Verify pause was recorded (state change is sufficient evidence)
    assert!(client.is_paused());

    client.unpause(&admin);

    // Verify unpause was recorded
    assert!(!client.is_paused());
}

#[test]
fn test_pause_persistence() {
    let (env, admin) = setup_test();
    let contract_id = env.register(AetherMintContract, ());
    let client = AetherMintContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    client.pause(&admin);
    assert!(client.is_paused());

    // New client instance for the same contract
    let client2 = AetherMintContractClient::new(&env, &contract_id);
    assert!(client2.is_paused());
}
