#![cfg(test)]

use crate::credentials::{
    get_credential, get_credential_count, get_user_credentials, issue_credential,
    revoke_credential, verify_credential, CredentialKey,
};
use soroban_sdk::{testutils::Address as _, Address, Env, String, Symbol, Vec};

#[test]
fn test_issue_and_verify_credential() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);
    let verifier = Address::generate(&env);

    env.storage()
        .instance()
        .set(&Symbol::new(&env, "admin"), &admin);

    let cred_id = issue_credential(
        &env,
        admin.clone(),
        recipient.clone(),
        String::from_str(&env, "Rust on Stellar"),
        String::from_str(&env, "Completed Soroban basics"),
        String::from_str(&env, "course-001"),
        String::from_str(&env, "ipfs://Qm..."),
    );

    assert_eq!(cred_id, 1);
    assert_eq!(get_credential_count(&env), 1);

    let cred = get_credential(&env, cred_id);
    assert_eq!(cred.recipient, recipient);
    assert!(!cred.is_revoked());
    assert_eq!(cred.recipient, recipient);

    assert!(verify_credential(&env, cred_id, verifier.clone()));

    // Revoke
    revoke_credential(&env, cred_id, admin.clone());
    let revoked_cred = get_credential(&env, cred_id);
    assert!(revoked_cred.is_revoked());

    // Verify should now return false
    assert!(!verify_credential(&env, cred_id, verifier.clone()));

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
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&Symbol::new(&env, "admin"), &admin);

    let cred_id = issue_credential(
        &env,
        admin,
        recipient,
        String::from_str(&env, "Title"),
        String::from_str(&env, "Desc"),
        String::from_str(&env, "course-001"),
        String::from_str(&env, "ipfs://Qm..."),
    );

    let cred = get_credential(&env, cred_id);
    let ledger_ts = env.ledger().timestamp();
    // Bit 0 reserved for revocation status, so issued_at = timestamp >> 1
    // round-trips to the ledger timestamp.
    assert_eq!(cred.issued_at(), ledger_ts);
    assert!(!cred.is_revoked());
}

#[test]
fn test_unauthorized_issuer() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&Symbol::new(&env, "admin"), &admin);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        issue_credential(
            &env,
            unauthorized,
            recipient,
            String::from_str(&env, "Title"),
            String::from_str(&env, "Desc"),
            String::from_str(&env, "course-001"),
            String::from_str(&env, "ipfs://Qm..."),
        );
    }));
    assert!(result.is_err());
}

#[test]
fn test_get_nonexistent_credential() {
    let env = Env::default();
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        get_credential(&env, 999);
    }));
    assert!(result.is_err());
}

#[test]
fn test_empty_string_inputs() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

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
}

#[test]
fn test_multiple_credentials_same_user() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&Symbol::new(&env, "admin"), &admin);

    let cred1 = issue_credential(
        &env,
        admin.clone(),
        recipient.clone(),
        String::from_str(&env, "Course 1"),
        String::from_str(&env, "Desc 1"),
        String::from_str(&env, "course-001"),
        String::from_str(&env, "ipfs://Qm1"),
    );

    let cred2 = issue_credential(
        &env,
        admin.clone(),
        recipient.clone(),
        String::from_str(&env, "Course 2"),
        String::from_str(&env, "Desc 2"),
        String::from_str(&env, "course-002"),
        String::from_str(&env, "ipfs://Qm2"),
    );

    let cred3 = issue_credential(
        &env,
        admin,
        recipient,
        String::from_str(&env, "Course 3"),
        String::from_str(&env, "Desc 3"),
        String::from_str(&env, "course-003"),
        String::from_str(&env, "ipfs://Qm3"),
    );

    assert_eq!(get_credential_count(&env), 3);

    let user_creds = get_user_credentials(&env, recipient);
    assert_eq!(user_creds.len(), 3);
}

#[test]
fn test_unauthorized_revocation() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&Symbol::new(&env, "admin"), &admin);

    let cred_id = issue_credential(
        &env,
        admin.clone(),
        recipient.clone(),
        String::from_str(&env, "Title"),
        String::from_str(&env, "Desc"),
        String::from_str(&env, "course-001"),
        String::from_str(&env, "ipfs://Qm..."),
    );

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        revoke_credential(&env, cred_id, unauthorized);
    }));
    assert!(result.is_err());
}

#[test]
fn test_revoke_nonexistent_credential() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    env.storage()
        .instance()
        .set(&Symbol::new(&env, "admin"), &admin);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        revoke_credential(&env, 999, admin);
    }));
    assert!(result.is_err());
}

#[test]
fn test_get_credential_description() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&Symbol::new(&env, "admin"), &admin);

    let description = String::from_str(&env, "Full course description here");
    let cred_id = issue_credential(
        &env,
        admin,
        recipient,
        String::from_str(&env, "Title"),
        description.clone(),
        String::from_str(&env, "course-001"),
        String::from_str(&env, "ipfs://Qm..."),
    );

    let retrieved_desc = get_credential_description(&env, cred_id);
    assert_eq!(retrieved_desc, Some(description));
}

#[test]
fn test_get_credential_revocation_time() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&Symbol::new(&env, "admin"), &admin);

    let cred_id = issue_credential(
        &env,
        admin.clone(),
        recipient,
        String::from_str(&env, "Title"),
        String::from_str(&env, "Desc"),
        String::from_str(&env, "course-001"),
        String::from_str(&env, "ipfs://Qm..."),
    );

    // Initially no revocation time
    assert_eq!(get_credential_revocation_time(&env, cred_id), None);

    // Revoke credential
    revoke_credential(&env, cred_id, admin.clone());

    // Now should have revocation time
    let revocation_time = get_credential_revocation_time(&env, cred_id);
    assert!(revocation_time.is_some());
    assert!(revocation_time.unwrap() > 0);
}

#[test]
fn test_get_user_credentials_empty() {
    let env = Env::default();
    let user = Address::generate(&env);

    let user_creds = get_user_credentials(&env, user);
    assert_eq!(user_creds.len(), 0);
}

#[test]
fn test_get_credential_count_zero() {
    let env = Env::default();
    assert_eq!(get_credential_count(&env), 0);
}

#[test]
fn test_verify_revoked_credential() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);
    let verifier = Address::generate(&env);

    env.storage()
        .instance()
        .set(&Symbol::new(&env, "admin"), &admin);

    let cred_id = issue_credential(
        &env,
        admin.clone(),
        recipient.clone(),
        String::from_str(&env, "Title"),
        String::from_str(&env, "Desc"),
        String::from_str(&env, "course-001"),
        String::from_str(&env, "ipfs://Qm..."),
    );

    // Revoke credential
    revoke_credential(&env, cred_id, admin);

    // Verify should return false
    assert!(!verify_credential(&env, cred_id, verifier));
}

#[test]
fn test_double_revocation() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&Symbol::new(&env, "admin"), &admin);

    let cred_id = issue_credential(
        &env,
        admin.clone(),
        recipient,
        String::from_str(&env, "Title"),
        String::from_str(&env, "Desc"),
        String::from_str(&env, "course-001"),
        String::from_str(&env, "ipfs://Qm..."),
    );

    // Revoke once
    revoke_credential(&env, cred_id, admin.clone());

    // Revoke again (should still work, just sets the bit again)
    revoke_credential(&env, cred_id, admin);

    let cred = get_credential(&env, cred_id);
    assert!(cred.is_revoked());
}
