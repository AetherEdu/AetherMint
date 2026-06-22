#![cfg(test)]

use crate::{AetherMintContract, AetherMintContractClient, DataKey};
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, String, Symbol};

/// Register the contract and initialize both admin keys the modules read:
/// - `Symbol("admin")` for credential_registry / dynamic_nft
/// - `DataKey::Admin` for the attestation protocol's admin checks
///
/// Returns `(env, contract_id, admin)`. Tests build a client per call so each
/// invocation gets its own auth frame (works cleanly with `mock_all_auths`).
fn setup() -> (Env, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AetherMintContract, ());
    let admin = Address::generate(&env);
    let env_ref = env.clone();
    let admin_ref = admin.clone();
    env.as_contract(&contract_id, move || {
        env_ref
            .storage()
            .instance()
            .set(&Symbol::new(&env_ref, "admin"), &admin_ref);
        env_ref
            .storage()
            .instance()
            .set(&DataKey::Admin, &admin_ref);
    });
    (env, contract_id, admin)
}

fn create_credential(client: &AetherMintContractClient, admin: &Address, recipient: &Address) -> u64 {
    let env = client.env.clone();
    client.issue_credential_with_expiration(
        admin,
        recipient,
        &String::from_str(&env, "Rust on Stellar"),
        &String::from_str(&env, "Completed Soroban basics"),
        &String::from_str(&env, "course-001"),
        &String::from_str(&env, "ipfs://Qm..."),
        &1_000u64,
    )
}

fn key(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[1u8; 32])
}

fn sig(env: &Env) -> BytesN<64> {
    BytesN::from_array(env, &[7u8; 64])
}

#[test]
fn test_register_attester() {
    let (env, cid, _admin) = setup();
    let client = AetherMintContractClient::new(&env, &cid);
    let attester = Address::generate(&env);

    assert!(!client.is_registered_attester(&attester));
    client.register_attester(&attester, &String::from_str(&env, "MIT"), &key(&env));

    assert!(client.is_registered_attester(&attester));
    let profile = client.get_attester(&attester);
    assert_eq!(profile.institution_name, String::from_str(&env, "MIT"));
    assert!(profile.is_active);
    assert_eq!(profile.attestation_count, 0);
}

#[test]
#[should_panic]
fn test_register_attester_twice_fails() {
    let (env, cid, _admin) = setup();
    let client = AetherMintContractClient::new(&env, &cid);
    let attester = Address::generate(&env);
    client.register_attester(&attester, &String::from_str(&env, "MIT"), &key(&env));
    client.register_attester(&attester, &String::from_str(&env, "MIT2"), &key(&env));
}

#[test]
fn test_attest_and_verify_credential() {
    let (env, cid, admin) = setup();
    let client = AetherMintContractClient::new(&env, &cid);
    let recipient = Address::generate(&env);
    let attester = Address::generate(&env);

    let credential_id = create_credential(&client, &admin, &recipient);
    client.register_attester(&attester, &String::from_str(&env, "MIT"), &key(&env));

    assert!(!client.is_attested_by(&credential_id, &attester));

    client.attest_credential(
        &attester,
        &credential_id,
        &sig(&env),
        &String::from_str(&env, "verified transcript"),
    );

    assert!(client.is_attested_by(&credential_id, &attester));
    let attestations = client.get_attestations(&credential_id);
    assert_eq!(attestations.len(), 1);
    let record = attestations.get(0).unwrap();
    assert_eq!(record.attester, attester.clone());
    assert_eq!(record.credential_id, credential_id);
    assert_eq!(record.metadata, String::from_str(&env, "verified transcript"));

    assert_eq!(client.get_attestation_count(&credential_id), 1);
    assert_eq!(client.get_attester(&attester).attestation_count, 1);
}

#[test]
fn test_multiple_attesters() {
    let (env, cid, admin) = setup();
    let client = AetherMintContractClient::new(&env, &cid);
    let recipient = Address::generate(&env);
    let attester_a = Address::generate(&env);
    let attester_b = Address::generate(&env);

    let credential_id = create_credential(&client, &admin, &recipient);
    client.register_attester(&attester_a, &String::from_str(&env, "MIT"), &key(&env));
    client.register_attester(&attester_b, &String::from_str(&env, "Stanford"), &key(&env));

    client.attest_credential(&attester_a, &credential_id, &sig(&env), &String::from_str(&env, "a"));
    client.attest_credential(&attester_b, &credential_id, &sig(&env), &String::from_str(&env, "b"));

    assert_eq!(client.get_attestations(&credential_id).len(), 2);
    assert_eq!(client.get_attestation_count(&credential_id), 2);
    assert!(client.is_attested_by(&credential_id, &attester_a));
    assert!(client.is_attested_by(&credential_id, &attester_b));
}

#[test]
#[should_panic]
fn test_duplicate_attestation_fails() {
    let (env, cid, admin) = setup();
    let client = AetherMintContractClient::new(&env, &cid);
    let recipient = Address::generate(&env);
    let attester = Address::generate(&env);

    let credential_id = create_credential(&client, &admin, &recipient);
    client.register_attester(&attester, &String::from_str(&env, "MIT"), &key(&env));
    client.attest_credential(&attester, &credential_id, &sig(&env), &String::from_str(&env, "x"));
    client.attest_credential(&attester, &credential_id, &sig(&env), &String::from_str(&env, "y"));
}

#[test]
fn test_revoke_attestation() {
    let (env, cid, admin) = setup();
    let client = AetherMintContractClient::new(&env, &cid);
    let recipient = Address::generate(&env);
    let attester = Address::generate(&env);

    let credential_id = create_credential(&client, &admin, &recipient);
    client.register_attester(&attester, &String::from_str(&env, "MIT"), &key(&env));
    client.attest_credential(&attester, &credential_id, &sig(&env), &String::from_str(&env, "x"));
    assert_eq!(client.get_attestation_count(&credential_id), 1);

    client.revoke_attestation(&attester, &credential_id);

    assert!(!client.is_attested_by(&credential_id, &attester));
    assert_eq!(client.get_attestations(&credential_id).len(), 0);
    assert_eq!(client.get_attestation_count(&credential_id), 0);
    assert_eq!(client.get_attester(&attester).attestation_count, 0);
}

#[test]
#[should_panic]
fn test_revoke_nonexistent_attestation_fails() {
    let (env, cid, admin) = setup();
    let client = AetherMintContractClient::new(&env, &cid);
    let recipient = Address::generate(&env);
    let attester = Address::generate(&env);
    let credential_id = create_credential(&client, &admin, &recipient);
    client.register_attester(&attester, &String::from_str(&env, "MIT"), &key(&env));
    client.revoke_attestation(&attester, &credential_id);
}

#[test]
#[should_panic]
fn test_attest_by_unregistered_attester_fails() {
    let (env, cid, admin) = setup();
    let client = AetherMintContractClient::new(&env, &cid);
    let recipient = Address::generate(&env);
    let attester = Address::generate(&env);
    let credential_id = create_credential(&client, &admin, &recipient);
    client.attest_credential(&attester, &credential_id, &sig(&env), &String::from_str(&env, "x"));
}

#[test]
#[should_panic]
fn test_attest_nonexistent_credential_fails() {
    let (env, cid, _admin) = setup();
    let client = AetherMintContractClient::new(&env, &cid);
    let attester = Address::generate(&env);
    client.register_attester(&attester, &String::from_str(&env, "MIT"), &key(&env));
    client.attest_credential(&attester, &999u64, &sig(&env), &String::from_str(&env, "x"));
}

#[test]
fn test_deactivate_and_reactivate_attester() {
    let (env, cid, admin) = setup();
    let client = AetherMintContractClient::new(&env, &cid);
    let recipient = Address::generate(&env);
    let attester = Address::generate(&env);

    let credential_id = create_credential(&client, &admin, &recipient);
    client.register_attester(&attester, &String::from_str(&env, "MIT"), &key(&env));

    client.deactivate_attester(&admin, &attester);
    assert!(!client.get_attester(&attester).is_active);

    client.reactivate_attester(&admin, &attester);
    assert!(client.get_attester(&attester).is_active);

    client.attest_credential(&attester, &credential_id, &sig(&env), &String::from_str(&env, "x"));
    assert!(client.is_attested_by(&credential_id, &attester));
}

#[test]
#[should_panic]
fn test_deactivated_attester_cannot_attest() {
    let (env, cid, admin) = setup();
    let client = AetherMintContractClient::new(&env, &cid);
    let recipient = Address::generate(&env);
    let attester = Address::generate(&env);

    let credential_id = create_credential(&client, &admin, &recipient);
    client.register_attester(&attester, &String::from_str(&env, "MIT"), &key(&env));
    client.deactivate_attester(&admin, &attester);
    client.attest_credential(&attester, &credential_id, &sig(&env), &String::from_str(&env, "x"));
}

#[test]
#[should_panic]
fn test_deactivate_by_non_admin_fails() {
    let (env, cid, _admin) = setup();
    let client = AetherMintContractClient::new(&env, &cid);
    let attester = Address::generate(&env);
    let stranger = Address::generate(&env);
    client.register_attester(&attester, &String::from_str(&env, "MIT"), &key(&env));
    client.deactivate_attester(&stranger, &attester);
}
