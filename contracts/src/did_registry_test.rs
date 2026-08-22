#![cfg(test)]

use crate::{AetherMintContract, AetherMintContractClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

/// Register the contract and return `(env, contract_id)`. The generated
/// client borrows the environment, so tests construct it inline.
fn setup_env() -> (Env, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, AetherMintContract);
    (env, contract_id)
}

fn test_key(env: &Env) -> String {
    String::from_str(
        env,
        "302a300506032b6570032100e08c319a9e2f8b6f6a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718",
    )
}

fn key_type(env: &Env) -> String {
    String::from_str(env, "Ed25519VerificationKey2020")
}

// ---------------------------------------------------------------------------
// Creation & resolution
// ---------------------------------------------------------------------------

#[test]
fn test_create_and_resolve_did() {
    let (env, contract_id) = setup_env();
    let client = AetherMintContractClient::new(&env, &contract_id);
    let wallet = Address::generate(&env);

    let did = client.create_did(&wallet, &test_key(&env), &key_type(&env));
    assert_eq!(did, String::from_str(&env, "did:aethermint:0"));

    let doc = client.resolve_did(&did);
    assert_eq!(doc.controller, wallet);
    assert!(!doc.deactivated);
    assert_eq!(doc.verification_methods.len(), 1);
    assert_eq!(
        doc.verification_methods.get(0).unwrap().id,
        String::from_str(&env, "did:aethermint:0#key-1")
    );
    assert_eq!(
        doc.verification_methods.get(0).unwrap().public_key,
        test_key(&env)
    );
    assert!(doc
        .verification_methods
        .get(0)
        .unwrap()
        .retired_at
        .is_none());
    assert!(!doc.verification_methods.get(0).unwrap().revoked);
}

#[test]
fn test_did_bound_to_wallet_and_counters() {
    let (env, contract_id) = setup_env();
    let client = AetherMintContractClient::new(&env, &contract_id);
    let wallet = Address::generate(&env);

    let did = client.create_did(&wallet, &test_key(&env), &key_type(&env));

    let by_wallet = client
        .get_did_by_wallet(&wallet)
        .expect("wallet should resolve to a DID");
    assert_eq!(by_wallet.id, did);

    assert!(client.did_exists(&did));
    assert!(!client.did_exists(&String::from_str(&env, "did:aethermint:999")));
    assert_eq!(client.get_total_dids(), 1);

    // Unknown wallets resolve to None.
    let stranger = Address::generate(&env);
    assert!(client.get_did_by_wallet(&stranger).is_none());
}

#[test]
#[should_panic(expected = "Wallet already has a DID")]
fn test_duplicate_wallet_rejected() {
    let (env, contract_id) = setup_env();
    let client = AetherMintContractClient::new(&env, &contract_id);
    let wallet = Address::generate(&env);

    let _ = client.create_did(&wallet, &test_key(&env), &key_type(&env));
    let _ = client.create_did(&wallet, &test_key(&env), &key_type(&env));
}

#[test]
#[should_panic(expected = "DID not found")]
fn test_resolve_unknown_did_panics() {
    let (env, contract_id) = setup_env();
    let client = AetherMintContractClient::new(&env, &contract_id);
    let _ = client.resolve_did(&String::from_str(&env, "did:aethermint:42"));
}

// ---------------------------------------------------------------------------
// Key management & rotation
// ---------------------------------------------------------------------------

#[test]
fn test_add_verification_method() {
    let (env, contract_id) = setup_env();
    let client = AetherMintContractClient::new(&env, &contract_id);
    let wallet = Address::generate(&env);

    let did = client.create_did(&wallet, &test_key(&env), &key_type(&env));

    let key2 = client.add_did_verification_method(
        &wallet,
        &did,
        &String::from_str(&env, "302a300506032b6570032100112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00"),
        &key_type(&env),
    );
    assert_eq!(key2, String::from_str(&env, "did:aethermint:0#key-2"));

    let doc = client.resolve_did(&did);
    assert_eq!(doc.verification_methods.len(), 2);

    assert!(client.verify_did_key(&did, &key2));
    assert!(client.verify_did_key(&did, &String::from_str(&env, "did:aethermint:0#key-1")));
}

#[test]
fn test_rotate_key_keeps_old_key_valid() {
    let (env, contract_id) = setup_env();
    let client = AetherMintContractClient::new(&env, &contract_id);
    let wallet = Address::generate(&env);

    let did = client.create_did(&wallet, &test_key(&env), &key_type(&env));
    let old_key = String::from_str(&env, "did:aethermint:0#key-1");

    let new_key = client.rotate_did_key(
        &wallet,
        &did,
        &String::from_str(&env, "302a300506032b6570032100ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100"),
        &key_type(&env),
    );
    assert_eq!(new_key, String::from_str(&env, "did:aethermint:0#key-2"));

    let doc = client.resolve_did(&did);
    assert_eq!(doc.verification_methods.len(), 2);

    // The old key is retired but remains valid for verification so
    // credentials signed under it are not broken by rotation.
    let old_method = doc.verification_methods.get(0).unwrap();
    assert!(old_method.retired_at.is_some());
    assert!(!old_method.revoked);
    assert!(client.verify_did_key(&did, &old_key));
    assert!(client.verify_did_key(&did, &new_key));
}

#[test]
fn test_revoke_verification_method() {
    let (env, contract_id) = setup_env();
    let client = AetherMintContractClient::new(&env, &contract_id);
    let wallet = Address::generate(&env);

    let did = client.create_did(&wallet, &test_key(&env), &key_type(&env));
    let key1 = String::from_str(&env, "did:aethermint:0#key-1");

    let revoked = client.revoke_did_verification_method(&wallet, &did, &key1);
    assert_eq!(revoked, key1);

    // Explicitly revoked keys stop verifying (unlike rotated keys).
    assert!(!client.verify_did_key(&did, &key1));

    let doc = client.resolve_did(&did);
    assert!(doc.verification_methods.get(0).unwrap().revoked);
}

#[test]
#[should_panic(expected = "Verification method not found")]
fn test_revoke_unknown_key_panics() {
    let (env, contract_id) = setup_env();
    let client = AetherMintContractClient::new(&env, &contract_id);
    let wallet = Address::generate(&env);

    let did = client.create_did(&wallet, &test_key(&env), &key_type(&env));
    let _ = client.revoke_did_verification_method(
        &wallet,
        &did,
        &String::from_str(&env, "did:aethermint:0#key-99"),
    );
}

// ---------------------------------------------------------------------------
// Deactivation
// ---------------------------------------------------------------------------

#[test]
fn test_deactivate_did() {
    let (env, contract_id) = setup_env();
    let client = AetherMintContractClient::new(&env, &contract_id);
    let wallet = Address::generate(&env);

    let did = client.create_did(&wallet, &test_key(&env), &key_type(&env));
    let key1 = String::from_str(&env, "did:aethermint:0#key-1");

    client.deactivate_did(&wallet, &did);

    // Document stays resolvable but no key verifies anymore.
    let doc = client.resolve_did(&did);
    assert!(doc.deactivated);
    assert!(!client.verify_did_key(&did, &key1));
}

#[test]
#[should_panic(expected = "DID is already deactivated")]
fn test_deactivate_twice_panics() {
    let (env, contract_id) = setup_env();
    let client = AetherMintContractClient::new(&env, &contract_id);
    let wallet = Address::generate(&env);

    let did = client.create_did(&wallet, &test_key(&env), &key_type(&env));
    client.deactivate_did(&wallet, &did);
    client.deactivate_did(&wallet, &did);
}

// ---------------------------------------------------------------------------
// Issued credentials reference the holder's DID
// ---------------------------------------------------------------------------

#[test]
fn test_attach_and_list_credentials() {
    let (env, contract_id) = setup_env();
    let client = AetherMintContractClient::new(&env, &contract_id);
    let wallet = Address::generate(&env);

    let did = client.create_did(&wallet, &test_key(&env), &key_type(&env));

    client.attach_did_credential(&wallet, &did, &String::from_str(&env, "cred-001"));
    client.attach_did_credential(&wallet, &did, &String::from_str(&env, "cred-002"));

    let refs = client.get_did_credentials(&did);
    assert_eq!(refs.len(), 2);
    assert_eq!(refs.get(0).unwrap(), String::from_str(&env, "cred-001"));
    assert_eq!(refs.get(1).unwrap(), String::from_str(&env, "cred-002"));

    let doc = client.resolve_did(&did);
    assert_eq!(doc.credential_refs.len(), 2);
}

#[test]
#[should_panic(expected = "Credential already attached to this DID")]
fn test_attach_duplicate_credential_panics() {
    let (env, contract_id) = setup_env();
    let client = AetherMintContractClient::new(&env, &contract_id);
    let wallet = Address::generate(&env);

    let did = client.create_did(&wallet, &test_key(&env), &key_type(&env));
    client.attach_did_credential(&wallet, &did, &String::from_str(&env, "cred-001"));
    client.attach_did_credential(&wallet, &did, &String::from_str(&env, "cred-001"));
}
