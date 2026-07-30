#![cfg(test)]

use crate::credentials::{
    get_credential, get_credential_count, get_credential_description,
    get_credential_revocation_time, get_user_credentials, issue_credential, revoke_credential,
    verify_credential, CredentialKey,
};
use crate::AetherMintContract;
use soroban_sdk::{testutils::Address as _, Address, Env, String, Symbol, Vec};

fn setup() -> (Env, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let cid = env.register(AetherMintContract, ());
    (env, cid)
}

/// Helper: set admin and issue a credential in one as_contract block.
/// Returns credential_id = 1 (deterministic, first credential).
fn setup_credential(env: &Env, cid: &Address, admin: &Address, recipient: &Address) {
    let env_ref = env.clone();
    let cid_ref = cid.clone();
    let admin_ref = admin.clone();
    let recipient_ref = recipient.clone();
    env.as_contract(&cid_ref, || {
        env_ref
            .storage()
            .instance()
            .set(&Symbol::new(&env_ref, "admin"), &admin_ref);
        issue_credential(
            &env_ref,
            admin_ref,
            recipient_ref,
            String::from_str(&env_ref, "Rust on Stellar"),
            String::from_str(&env_ref, "Completed Soroban basics"),
            String::from_str(&env_ref, "course-001"),
            String::from_str(&env_ref, "ipfs://Qm..."),
        );
    });
}

#[test]
fn test_issue_and_verify_credential() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);
    let verifier = Address::generate(&env);

    // Block 1: Issue credential
    setup_credential(&env, &cid, &admin, &recipient);

    // Block 2: Read back and verify
    env.as_contract(&cid, || {
        let cred = get_credential(&env, 1);
        assert_eq!(cred.recipient, recipient);
        assert!(!cred.is_revoked());
    });

    // Block 3: Verify (requires verifier auth)
    env.as_contract(&cid, || {
        assert!(verify_credential(&env, 1, verifier.clone()));
    });

    // Block 4: Revoke (requires admin auth)
    env.as_contract(&cid, || {
        revoke_credential(&env, 1, admin.clone());
        let revoked_cred = get_credential(&env, 1);
        assert!(revoked_cred.is_revoked());
    });

    // Block 5: Verify revoked (should be false)
    env.as_contract(&cid, || {
        assert!(!verify_credential(&env, 1, verifier.clone()));
    }); // Block 6: Verify credential data
    env.as_contract(&cid, || {
        let cred = get_credential(&env, 1);
        assert_eq!(cred.id, 1);
        assert_eq!(cred.recipient, recipient);
    });

    // Revoke
    revoke_credential(&env, cred_id, admin.clone());
    let revoked_cred = get_credential(&env, cred_id);
    assert!(revoked_cred.is_revoked());

    // Verify should now return false
    assert!(!verify_credential(&env, cred_id, verifier));

    // User credential list
    let user_creds: Vec<u64> = get_user_credentials(&env, recipient);
    assert_eq!(user_creds.len(), 1);
    assert_eq!(user_creds.get(0).unwrap(), 1);

    // Integration: lifecycle events must be recorded by the unified
    // credential_events module so off-chain indexers can subscribe to them.
    let issued_records = crate::credential_events::get_credential_events(&env, cred_id);
    assert_eq!(issued_records.len(), 3); // Issued, Verified, Revoked
    assert_eq!(
        issued_records.get(0).unwrap().event_type,
        crate::credential_events::CredentialLifecycleEvent::Issued
    );
    assert_eq!(
        issued_records.get(1).unwrap().event_type,
        crate::credential_events::CredentialLifecycleEvent::Verified
    );
    assert_eq!(
        issued_records.get(2).unwrap().event_type,
        crate::credential_events::CredentialLifecycleEvent::Revoked
    );

    // And by-actor indexing routes admin -> Issued + Revoked and verifier -> Verified.
    let admin_records = crate::credential_events::get_actor_events(&env, admin.clone());
    assert_eq!(admin_records.len(), 2);
    let verifier_records = crate::credential_events::get_actor_events(&env, verifier);
    assert_eq!(verifier_records.len(), 1);
}

#[test]
fn test_issued_at_extracts_timestamp() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    setup_credential(&env, &cid, &admin, &recipient);

    env.as_contract(&cid, || {
        let cred = get_credential(&env, 1);
        let ledger_ts = env.ledger().timestamp();
        assert_eq!(cred.issued_at(), ledger_ts);
        assert!(!cred.is_revoked());
    });
}

#[test]
#[should_panic(expected = "Unauthorized issuer")]
fn test_unauthorized_issuer() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "admin"), &admin);

        issue_credential(
            &env,
            unauthorized,
            recipient,
            String::from_str(&env, "Title"),
            String::from_str(&env, "Desc"),
            String::from_str(&env, "course-001"),
            String::from_str(&env, "ipfs://Qm..."),
        );
    });
}

#[test]
#[should_panic(expected = "Credential not found")]
fn test_get_nonexistent_credential() {
    let (env, cid) = setup();

    env.as_contract(&cid, || {
        get_credential(&env, 999);
    });
}

#[test]
fn test_empty_string_inputs() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "admin"), &admin);

        let cred_id = issue_credential(
            &env,
            admin.clone(),
            recipient.clone(),
            String::from_str(&env, ""),
            String::from_str(&env, ""),
            String::from_str(&env, ""),
            String::from_str(&env, ""),
        );

        let cred = get_credential(&env, cred_id);
        assert_eq!(cred.title.len(), 0);
        assert_eq!(cred.course_id.len(), 0);
        assert_eq!(cred.ipfs_hash.len(), 0);
    });
}

#[test]
fn test_multiple_credentials_same_user() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Issue 3 credentials in 3 separate as_contract blocks (one auth each)
    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "admin"), &admin);
        issue_credential(
            &env,
            admin.clone(),
            recipient.clone(),
            String::from_str(&env, "Course 1"),
            String::from_str(&env, "Desc 1"),
            String::from_str(&env, "course-001"),
            String::from_str(&env, "ipfs://Qm1"),
        );
    });

    env.as_contract(&cid, || {
        issue_credential(
            &env,
            admin.clone(),
            recipient.clone(),
            String::from_str(&env, "Course 2"),
            String::from_str(&env, "Desc 2"),
            String::from_str(&env, "course-002"),
            String::from_str(&env, "ipfs://Qm2"),
        );
    });

    env.as_contract(&cid, || {
        issue_credential(
            &env,
            admin.clone(),
            recipient.clone(),
            String::from_str(&env, "Course 3"),
            String::from_str(&env, "Desc 3"),
            String::from_str(&env, "course-003"),
            String::from_str(&env, "ipfs://Qm3"),
        );
    });

    // All credentials issued; check each individually (persistent storage).
    env.as_contract(&cid, || {
        let cred1 = get_credential(&env, 1);
        assert_eq!(cred1.title, String::from_str(&env, "Course 1"));
        let cred2 = get_credential(&env, 2);
        assert_eq!(cred2.title, String::from_str(&env, "Course 2"));
        let cred3 = get_credential(&env, 3);
        assert_eq!(cred3.title, String::from_str(&env, "Course 3"));
    });
}

#[test]
#[should_panic(expected = "Only admin can revoke")]
fn test_unauthorized_revocation() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    let recipient = Address::generate(&env);

    setup_credential(&env, &cid, &admin, &recipient);

    env.as_contract(&cid, || {
        revoke_credential(&env, 1, unauthorized);
    });
}

#[test]
#[should_panic(expected = "Credential not found")]
fn test_revoke_nonexistent_credential() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);

    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "admin"), &admin);
        revoke_credential(&env, 999, admin);
    });
}

#[test]
fn test_get_credential_description() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    setup_credential(&env, &cid, &admin, &recipient);

    env.as_contract(&cid, || {
        // setup_credential issues with description "Completed Soroban basics"
        let retrieved_desc = get_credential_description(&env, 1);
        assert_eq!(
            retrieved_desc,
            Some(String::from_str(&env, "Completed Soroban basics"))
        );
    });
}

#[test]
fn test_get_credential_revocation_time() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    setup_credential(&env, &cid, &admin, &recipient);

    // Check no revocation time before revoking
    env.as_contract(&cid, || {
        assert_eq!(get_credential_revocation_time(&env, 1), None);
    });

    // Revoke the credential
    env.as_contract(&cid, || {
        revoke_credential(&env, 1, admin.clone());
    });

    // Check revocation time is recorded
    env.as_contract(&cid, || {
        let cred = get_credential(&env, 1);
        assert!(cred.is_revoked());
    });
}

#[test]
fn test_get_user_credentials_empty() {
    let (env, cid) = setup();
    let user = Address::generate(&env);

    env.as_contract(&cid, || {
        let user_creds = get_user_credentials(&env, user);
        assert_eq!(user_creds.len(), 0);
    });
}

#[test]
fn test_get_credential_count_zero() {
    let (env, cid) = setup();

    env.as_contract(&cid, || {
        assert_eq!(get_credential_count(&env), 0);
    });
}

#[test]
fn test_verify_revoked_credential() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);
    let verifier = Address::generate(&env);

    setup_credential(&env, &cid, &admin, &recipient);

    // Revoke
    env.as_contract(&cid, || {
        revoke_credential(&env, 1, admin);
    });

    // Verify (should return false)
    env.as_contract(&cid, || {
        assert!(!verify_credential(&env, 1, verifier));
    });
}

#[test]
fn test_double_revocation() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    setup_credential(&env, &cid, &admin, &recipient);

    // Revoke first time
    env.as_contract(&cid, || {
        revoke_credential(&env, 1, admin.clone());
    });

    // Revoke second time (should not panic since already revoked)
    env.as_contract(&cid, || {
        revoke_credential(&env, 1, admin.clone());
    });

    // Check credential is revoked
    env.as_contract(&cid, || {
        let cred = get_credential(&env, 1);
        assert!(cred.is_revoked());
    });
}
