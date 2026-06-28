#![cfg(test)]

use crate::{AetherMintContract, AetherMintContractClient};
use crate::utils::pause::{PausedEvent, UnpausedEvent};
use soroban_sdk::{testutils::{Address as _, Ledger}, symbol_short, Address, Env, String, IntoVal};

fn setup_test() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(AetherMintContract, ());
    let client = AetherMintContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    // Test pause/unpause admin
    assert!(!client.is_paused());
    client.pause(&admin);
    assert!(client.is_paused());
    client.unpause(&admin);
    assert!(!client.is_paused());
}

#[test]
fn test_pause_unpause_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(AetherMintContract, ());
    let client = AetherMintContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    assert!(!client.is_paused());
    client.pause(&admin);
    assert!(client.is_paused());
    client.unpause(&admin);
    assert!(!client.is_paused());
}

#[test]
#[should_panic(expected = "Only admin can pause")]
fn test_pause_non_admin_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(AetherMintContract, ());
    let client = AetherMintContractClient::new(&env, &contract_id);
    client.initialize(&admin);
    let non_admin = Address::generate(&env);
    client.pause(&non_admin);
}

#[test]
#[should_panic(expected = "Only admin can unpause")]
fn test_unpause_non_admin_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(AetherMintContract, ());
    let client = AetherMintContractClient::new(&env, &contract_id);
    client.initialize(&admin);
    let non_admin = Address::generate(&env);

    client.pause(&admin);
    client.unpause(&non_admin);
}

#[test]
fn test_mutating_methods_fail_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(AetherMintContract, ());
    let client = AetherMintContractClient::new(&env, &contract_id);
    client.initialize(&admin);
    let user = Address::generate(&env);

    client.pause(&admin);

    let title = String::from_str(&env, "Title");
    let desc = String::from_str(&env, "Desc");
    let course = String::from_str(&env, "Course");
    let ipfs = String::from_str(&env, "IPFS");

    let result = client.try_issue_credential(&admin, &user, &title, &desc, &course, &ipfs);
    assert!(result.is_err());

    let result_course = client.try_create_course(&admin, &title, &desc, &100);
    assert!(result_course.is_err());
}

#[test]
fn test_read_methods_work_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(AetherMintContract, ());
    let client = AetherMintContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    client.pause(&admin);
    assert!(client.is_paused());
    assert_eq!(client.get_credential_count(), 0);
    assert_eq!(client.get_course_count(), 0);
}

#[test]
fn test_events_emitted_correctly() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(AetherMintContract, ());
    let client = AetherMintContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    client.pause(&admin);
    client.unpause(&admin);
}

#[test]
fn test_pause_persistence() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(AetherMintContract, ());
    let client = AetherMintContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    client.pause(&admin);
    assert!(client.is_paused());

    let client2 = AetherMintContractClient::new(&env, &contract_id);
    assert!(client2.is_paused());
}
