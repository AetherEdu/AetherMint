#![cfg(test)]

use crate::utils::pause::{PausedEvent, UnpausedEvent};
use crate::{AetherMintContract, AetherMintContractClient};
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Events, Ledger},
    Address, BytesN, Env, IntoVal, String,
};

fn setup_test() -> (Env, Address, AetherMintContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(AetherMintContract, ());
    let client = AetherMintContractClient::new(&env, &contract_id);
    client.initialize(&admin);
    (env, admin, client)
}

/// Setup that also returns the contract_id for persistence tests
fn setup_test_with_id() -> (Env, Address, AetherMintContractClient<'static>, soroban_sdk::Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(AetherMintContract, ());
    let client = AetherMintContractClient::new(&env, &contract_id);
    client.initialize(&admin);
    (env, admin, client, contract_id)
}

#[test]
fn test_pause_unpause_admin() {
    let (_env, admin, client) = setup_test();

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
    let (env, admin, client) = setup_test();
    let non_admin = Address::generate(&env);

    client.pause(&non_admin);
}

#[test]
#[should_panic(expected = "Only admin can unpause")]
fn test_unpause_non_admin_fails() {
    let (env, admin, client) = setup_test();
    let non_admin = Address::generate(&env);

    client.pause(&admin);
    client.unpause(&non_admin);
}

#[test]
fn test_mutating_methods_fail_when_paused() {
    let (env, admin, client) = setup_test();
    let user = Address::generate(&env);

    client.pause(&admin);

    // Test issue_credential (mutating) - should fail
    let title = String::from_str(&env, "Title");
    let desc = String::from_str(&env, "Description");
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
    let (_env, admin, client) = setup_test();

    client.pause(&admin);

    // Read methods should still work
    assert!(client.is_paused());
    assert_eq!(client.get_credential_count(), 0);
    assert_eq!(client.get_course_count(), 0);
}

#[test]
fn test_pause_persistence() {
    let (env, admin, _client, contract_id) = setup_test_with_id();

    // Use a client for the original contract
    let client = AetherMintContractClient::new(&env, &contract_id);
    client.pause(&admin);
    assert!(client.is_paused());

    // Create a second client for the SAME contract to verify persistence
    let client2 = AetherMintContractClient::new(&env, &contract_id);
    assert!(client2.is_paused());
}

#[test]
fn test_pause_blocks_all_mutating_operations() {
    let (env, admin, client) = setup_test();
    let user = Address::generate(&env);
    let title = String::from_str(&env, "Title");
    let desc = String::from_str(&env, "Desc");
    let course = String::from_str(&env, "Course");
    let ipfs = String::from_str(&env, "IPFS");

    client.pause(&admin);
    assert!(client.is_paused());

    // All mutating operations should fail
    assert!(client.try_issue_credential(&admin, &user, &title, &desc, &course, &ipfs).is_err());
    assert!(client.try_create_course(&admin, &title, &desc, &100).is_err());
    assert!(client
        .try_issue_credential_with_expiration(&admin, &user, &title, &desc, &course, &ipfs, &3600)
        .is_err());

    // Read methods should still work
    assert_eq!(client.get_credential_count(), 0);
    assert_eq!(client.get_course_count(), 0);
}

#[test]
fn test_unpause_restores_mutating_operations() {
    let (env, admin, client) = setup_test();
    let user = Address::generate(&env);

    client.pause(&admin);
    assert!(client.is_paused());

    let title = String::from_str(&env, "Title");
    let desc = String::from_str(&env, "Desc");
    let course = String::from_str(&env, "Course");
    let ipfs = String::from_str(&env, "IPFS");

    // Should fail while paused
    assert!(
        client
            .try_issue_credential(&admin, &user, &title, &desc, &course, &ipfs)
            .is_err()
    );

    // Unpause
    client.unpause(&admin);
    assert!(!client.is_paused());

    // Should work after unpause
    let cred_id = client.issue_credential(&admin, &user, &title, &desc, &course, &ipfs);
    assert_eq!(cred_id, 1);
}

#[test]
fn test_credential_registry_paused() {
    let (env, admin, client) = setup_test();
    let user = Address::generate(&env);
    let title = String::from_str(&env, "Title");
    let desc = String::from_str(&env, "Desc");
    let course = String::from_str(&env, "Course");
    let ipfs = String::from_str(&env, "IPFS");

    client.pause(&admin);

    // Credential operations should fail
    assert!(client
        .try_issue_credential_with_expiration(&admin, &user, &title, &desc, &course, &ipfs, &3600)
        .is_err());

    // Issue a credential first (need to unpause temporarily)
    client.unpause(&admin);
    let cred_id = client.issue_credential_with_expiration(
        &admin, &user, &title, &desc, &course, &ipfs, &3600,
    );
    client.pause(&admin);
    assert!(client.is_paused());

    // Renew and revoke should fail while paused
    let renew_result = client.try_renew_credential(&cred_id, &admin, &1800);
    assert!(renew_result.is_err());

    let revoke_result = client.try_revoke_credential_registry(&cred_id, &admin);
    assert!(revoke_result.is_err());
}

#[test]
fn test_nft_operations_paused() {
    let (env, admin, client) = setup_test();
    let creator = Address::generate(&env);
    let recipient = Address::generate(&env);
    let base_uri = String::from_str(&env, "uri");
    let metadata = String::from_str(&env, "meta");

    client.pause(&admin);

    let mint_result = client.try_mint_dynamic_nft(&creator, &recipient, &base_uri, &metadata);
    assert!(mint_result.is_err());

    let fuse_result = client.try_fuse_nfts(&1u64, &2u64, &recipient);
    assert!(fuse_result.is_err());

    let transfer_result = client.try_transfer_nft(&creator, &recipient, &1u64);
    assert!(transfer_result.is_err());
}

#[test]
fn test_attestation_operations_paused() {
    let (env, admin, client) = setup_test();
    let attester = Address::generate(&env);
    let name = String::from_str(&env, "University");
    let key = soroban_sdk::BytesN::from_array(&env, &[1u8; 32]);

    client.pause(&admin);

    let register_result = client.try_register_attester(&attester, &name, &key);
    assert!(register_result.is_err());

    let sig = soroban_sdk::BytesN::from_array(&env, &[2u8; 64]);
    let meta = String::from_str(&env, "verify");
    let attest_result = client.try_attest_credential(&attester, &1u64, &sig, &meta);
    assert!(attest_result.is_err());

    let revoke_result = client.try_revoke_attestation(&attester, &1u64);
    assert!(revoke_result.is_err());

    let deact_result = client.try_deactivate_attester(&admin, &attester);
    assert!(deact_result.is_err());

    let react_result = client.try_reactivate_attester(&admin, &attester);
    assert!(react_result.is_err());
}
