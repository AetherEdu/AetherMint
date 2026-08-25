#![cfg(test)]

//! Unit tests for the DID registry (issue #397).
//!
//! Ed25519 fixtures below are precomputed with Node's `crypto` module and
//! verified offline before being embedded here:
//!
//! - `key_1` / `key_2` are two distinct ed25519 public keys.
//! - `sig_1` is `key_1`'s signature over `MESSAGE`; `sig_2` is `key_2`'s
//!   signature over the same `MESSAGE`.
//! - The accept/reject behavior is asserted in
//!   [`test_verify_signature_checks_the_document`] and
//!   [`test_rotation_updates_document_and_preserves_history`].

use crate::credential_registry::BatchCredentialParams;
use crate::did_registry::{
    deactivate_did, did_exists, get_credentials_for_did, get_did_for_controller, get_key_history,
    register_did, resolve_did, rotate_did_key, verify_signature, DID_METHOD,
};
use crate::AetherMintContract;
use soroban_sdk::{
    bytesn, testutils::Address as _, testutils::Ledger as _, Address, Bytes, BytesN, Env, String,
    Symbol, Vec,
};

const MESSAGE: &[u8] = b"AetherMint DID challenge v1";

fn key_1(env: &Env) -> BytesN<32> {
    bytesn!(
        env,
        0x8a88e3dd7409f195fd52db2d3cba5d72ca6709bf1d94121bf3748801b40f6f5c
    )
}

fn key_2(env: &Env) -> BytesN<32> {
    bytesn!(
        env,
        0x8139770ea87d175f56a35466c34c7ecccb8d8a91b4ee37a25df60f5b8fc9b394
    )
}

fn sig_1(env: &Env) -> BytesN<64> {
    bytesn!(env, 0xbd7a296987f28756b2df132cb76a12cc728d0da87933da14c6ba33bfb20d7bef4e4f4f9131d9856b886607903722ff2dbb75d6ae9d577d79e732dfc38864bc08)
}

fn sig_2(env: &Env) -> BytesN<64> {
    bytesn!(env, 0x554750955d3675cd9c889b5f22dfcb279f1ed6a849fc6c0c6179cb5c15500f484cf0bed462b441f1bf6f8daaeae678496dc4a591f2b7540d3ef71b718d491f0e)
}

const TEST_TIMESTAMP: u64 = 1_700_000_000;

fn setup_env() -> (Env, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(TEST_TIMESTAMP);
    let cid = env.register(AetherMintContract, ());
    let admin = Address::generate(&env);
    env.as_contract(&cid, || {
        // Mirror the credential registry tests: record the admin so admin-gated
        // helpers resolve, and bootstrap the RBAC roles so the credential
        // linkage test can mint credentials for the DID holder.
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "admin"), &admin);
        crate::access_control::set_initial_admin(&env, &admin);
        crate::access_control::grant_role(
            &env,
            admin.clone(),
            admin.clone(),
            crate::access_control::Role::Issuer,
        );
    });
    (env, cid, admin)
}

fn message(env: &Env) -> Bytes {
    Bytes::from_slice(env, MESSAGE)
}

fn expected_did(env: &Env, controller: &Address) -> String {
    crate::str_cat(
        env,
        &String::from_str(env, DID_METHOD),
        &controller.to_string(),
    )
}

// ---------------------------------------------------------------------------
// Registration & resolution (acceptance criteria 1 & 2)
// ---------------------------------------------------------------------------

#[test]
fn test_register_did_binds_controller_and_verification_key() {
    let (env, cid, _admin) = setup_env();
    let controller = Address::generate(&env);

    env.as_contract(&cid, || {
        let did = register_did(&env, controller.clone(), key_1(&env));
        assert_eq!(did, expected_did(&env, &controller));

        let doc = resolve_did(&env, did);
        assert_eq!(doc.controller, controller);
        assert_eq!(doc.verification_key, key_1(&env));
        assert_eq!(doc.key_version, 1);
        assert!(doc.active);
        assert_eq!(doc.created_at, TEST_TIMESTAMP);
        assert_eq!(doc.updated_at, doc.created_at);
    });
}

#[test]
#[should_panic]
fn test_second_registration_for_same_wallet_rejected() {
    let (env, cid, _admin) = setup_env();
    let controller = Address::generate(&env);

    env.as_contract(&cid, || {
        register_did(&env, controller.clone(), key_1(&env));
        register_did(&env, controller, key_2(&env));
    });
}

#[test]
#[should_panic]
fn test_resolve_unknown_did_rejected() {
    let (env, cid, _admin) = setup_env();

    env.as_contract(&cid, || {
        let stranger = Address::generate(&env);
        resolve_did(&env, expected_did(&env, &stranger));
    });
}

#[test]
#[should_panic]
fn test_resolve_malformed_did_rejected() {
    let (env, cid, _admin) = setup_env();

    env.as_contract(&cid, || {
        resolve_did(&env, String::from_str(&env, "did:example:alice"));
    });
}

#[test]
fn test_did_exists_and_reverse_lookup() {
    let (env, cid, _admin) = setup_env();
    let controller = Address::generate(&env);

    env.as_contract(&cid, || {
        assert!(!did_exists(&env, expected_did(&env, &controller)));
        assert_eq!(get_did_for_controller(&env, controller.clone()), None);

        let did = register_did(&env, controller.clone(), key_1(&env));

        assert!(did_exists(&env, did.clone()));
        assert_eq!(get_did_for_controller(&env, controller), Some(did));
    });
}

// ---------------------------------------------------------------------------
// Signature verification (acceptance criterion 4)
// ---------------------------------------------------------------------------

#[test]
fn test_verify_signature_accepts_valid_signature() {
    let (env, cid, _admin) = setup_env();
    let controller = Address::generate(&env);

    env.as_contract(&cid, || {
        let did = register_did(&env, controller, key_1(&env));

        // key_1's signature over MESSAGE validates against the document.
        assert!(verify_signature(&env, did, message(&env), sig_1(&env)));
    });
}

#[test]
#[should_panic]
fn test_verify_signature_rejects_wrong_key() {
    let (env, cid, _admin) = setup_env();
    let controller = Address::generate(&env);

    env.as_contract(&cid, || {
        let did = register_did(&env, controller, key_1(&env));
        // key_2's signature must NOT validate against a document holding key_1.
        verify_signature(&env, did, message(&env), sig_2(&env));
    });
}

#[test]
#[should_panic]
fn test_verify_signature_rejects_tampered_message() {
    let (env, cid, _admin) = setup_env();
    let controller = Address::generate(&env);

    env.as_contract(&cid, || {
        let did = register_did(&env, controller, key_1(&env));
        let tampered = Bytes::from_slice(&env, b"AetherMint DID challenge v2");
        verify_signature(&env, did, tampered, sig_1(&env));
    });
}

#[test]
#[should_panic]
fn test_verify_signature_unknown_did_rejected() {
    let (env, cid, _admin) = setup_env();

    env.as_contract(&cid, || {
        let stranger = Address::generate(&env);
        verify_signature(
            &env,
            expected_did(&env, &stranger),
            message(&env),
            sig_1(&env),
        );
    });
}

// ---------------------------------------------------------------------------
// Key rotation (acceptance criterion 5)
// ---------------------------------------------------------------------------

#[test]
fn test_rotation_updates_document_and_preserves_history() {
    let (env, cid, _admin) = setup_env();
    let controller = Address::generate(&env);

    env.as_contract(&cid, || {
        let did = register_did(&env, controller.clone(), key_1(&env));

        // Proof of possession: key_2 must sign the challenge.
        let new_version =
            rotate_did_key(&env, did.clone(), key_2(&env), message(&env), sig_2(&env));
        assert_eq!(new_version, 2);

        let doc = resolve_did(&env, did.clone());
        assert_eq!(doc.verification_key, key_2(&env));
        assert_eq!(doc.key_version, 2);
        assert!(doc.active);

        // Rotation history records old -> new.
        let history = get_key_history(&env, did.clone());
        assert_eq!(history.len(), 1);
        let record = history.get(0).unwrap();
        assert_eq!(record.old_key, key_1(&env));
        assert_eq!(record.new_key, key_2(&env));
        assert_eq!(record.rotated_by, controller);
        assert_eq!(record.rotated_at, TEST_TIMESTAMP); // Rotation timestamps come from the ledger.
        assert!(verify_signature(&env, did, message(&env), sig_2(&env)));
    });
}

#[test]
#[should_panic]
fn test_old_key_rejected_after_rotation() {
    let (env, cid, _admin) = setup_env();
    let controller = Address::generate(&env);

    env.as_contract(&cid, || {
        let did = register_did(&env, controller, key_1(&env));
        rotate_did_key(&env, did.clone(), key_2(&env), message(&env), sig_2(&env));
        // key_1's signature is no longer valid for the document.
        verify_signature(&env, did, message(&env), sig_1(&env));
    });
}

#[test]
fn test_rotation_can_happen_multiple_times() {
    let (env, cid, _admin) = setup_env();
    let controller = Address::generate(&env);

    env.as_contract(&cid, || {
        let did = register_did(&env, controller, key_1(&env));

        rotate_did_key(&env, did.clone(), key_2(&env), message(&env), sig_2(&env));
        // Rotate back to key_1 (key_1 signs the new challenge).
        let version = rotate_did_key(&env, did.clone(), key_1(&env), message(&env), sig_1(&env));
        assert_eq!(version, 3);

        let history = get_key_history(&env, did.clone());
        assert_eq!(history.len(), 2);
        let second = history.get(1).unwrap();
        assert_eq!(second.old_key, key_2(&env));
        assert_eq!(second.new_key, key_1(&env));
    });
}

#[test]
#[should_panic]
fn test_rotation_rejects_same_key() {
    let (env, cid, _admin) = setup_env();
    let controller = Address::generate(&env);

    env.as_contract(&cid, || {
        let did = register_did(&env, controller, key_1(&env));
        rotate_did_key(&env, did, key_1(&env), message(&env), sig_1(&env));
    });
}

#[test]
#[should_panic]
fn test_rotation_rejects_bad_proof_of_possession() {
    let (env, cid, _admin) = setup_env();
    let controller = Address::generate(&env);

    env.as_contract(&cid, || {
        let did = register_did(&env, controller, key_1(&env));
        // key_2 is claimed as the new key, but the signature is key_1's.
        rotate_did_key(&env, did, key_2(&env), message(&env), sig_1(&env));
    });
}

// ---------------------------------------------------------------------------
// Deactivation
// ---------------------------------------------------------------------------

#[test]
fn test_deactivation_blocks_verification_but_keeps_document() {
    let (env, cid, _admin) = setup_env();
    let controller = Address::generate(&env);

    env.as_contract(&cid, || {
        let did = register_did(&env, controller, key_1(&env));
        assert!(verify_signature(
            &env,
            did.clone(),
            message(&env),
            sig_1(&env)
        ));

        assert!(deactivate_did(&env, did.clone()));

        // Document remains resolvable (history stays attributable)...
        let doc = resolve_did(&env, did.clone());
        assert!(!doc.active);

        // ...but verification stops succeeding.
        assert!(!verify_signature(&env, did, message(&env), sig_1(&env)));
    });
}

#[test]
#[should_panic]
fn test_deactivating_twice_rejected() {
    let (env, cid, _admin) = setup_env();
    let controller = Address::generate(&env);

    env.as_contract(&cid, || {
        let did = register_did(&env, controller, key_1(&env));
        deactivate_did(&env, did.clone());
        deactivate_did(&env, did);
    });
}

// ---------------------------------------------------------------------------
// Issued credentials reference the holder's DID (acceptance criterion 3)
// ---------------------------------------------------------------------------

#[test]
fn test_credentials_issued_to_holder_are_resolvable_via_did() {
    let (env, cid, admin) = setup_env();
    let controller = Address::generate(&env);

    env.as_contract(&cid, || {
        let did = register_did(&env, controller.clone(), key_1(&env));

        // No credentials yet.
        assert_eq!(get_credentials_for_did(&env, did.clone()).len(), 0);

        // Mint two credentials to the DID's controlling wallet in one batch
        // (a single issuer auth covers the whole batch).
        let mut params = Vec::new(&env);
        params.push_back(BatchCredentialParams {
            recipient: controller.clone(),
            title: String::from_str(&env, "Soroban Bootcamp"),
            description: String::from_str(&env, "Completed Soroban smart contract fundamentals"),
            course_id: String::from_str(&env, "course-001"),
            ipfs_hash: String::from_str(&env, "ipfs://QmTestHash1"),
            validity_duration: 365 * 24 * 60 * 60,
        });
        params.push_back(BatchCredentialParams {
            recipient: controller,
            title: String::from_str(&env, "DID Workshop"),
            description: String::from_str(&env, "Completed the self-sovereign identity workshop"),
            course_id: String::from_str(&env, "course-002"),
            ipfs_hash: String::from_str(&env, "ipfs://QmTestHash2"),
            validity_duration: 365 * 24 * 60 * 60,
        });
        let ids = crate::credential_registry::issue_credentials_batch(&env, admin, params);
        assert_eq!(ids.len(), 2);

        // Both credentials are linked to the holder's DID.
        let linked = get_credentials_for_did(&env, did);
        assert_eq!(linked.len(), 2);
        assert!(linked.contains(ids.get(0).unwrap()));
        assert!(linked.contains(ids.get(1).unwrap()));
    });
}
