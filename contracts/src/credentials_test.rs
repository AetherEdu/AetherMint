#![cfg(test)]

use crate::access_control::{self, Role};
use crate::credentials::{
    get_credential, get_credential_count, get_user_credentials, issue_credential,
    revoke_credential, verify_credential,
};
use soroban_sdk::{testutils::Address as _, Address, Env, String, Symbol, Vec};

fn setup_env() -> (Env, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    access_control::set_initial_admin(&env, &admin);
    (env, admin)
}

#[test]
fn test_issue_and_verify_credential() {
    let (env, admin) = setup_env();
    let recipient = Address::generate(&env);
    let verifier = Address::generate(&env);

    // Grant Issuer role to admin so they can issue
    access_control::grant_role(&env, admin.clone(), admin.clone(), Role::Issuer);

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
    assert!(!cred.is_revoked());
    assert_eq!(cred.recipient, recipient);

    // Verify with auditor/verifier
    assert!(verify_credential(&env, cred_id, verifier.clone()));

    // Revoke (Admin role required)
    revoke_credential(&env, cred_id, admin.clone());

    let revoked_cred = get_credential(&env, cred_id);
    assert!(revoked_cred.is_revoked());

    // Verify should now return false
    assert!(!verify_credential(&env, cred_id, verifier));

    // User credential list
    let user_creds = get_user_credentials(&env, recipient);
    assert_eq!(user_creds.len(), 1);
    assert_eq!(user_creds.get(0).unwrap(), 1);

    // Integration: lifecycle events must be recorded by the unified
    // credential_events module so off-chain indexers can subscribe to them.
    let issued_records =
        crate::credential_events::get_credential_events(&env, cred_id);
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

/// AC: Non-issuer cannot issue credentials
#[test]
#[should_panic(expected = "Caller does not have Issuer role")]
fn test_non_issuer_cannot_issue() {
    let (env, _admin) = setup_env();
    let stranger = Address::generate(&env);
    let recipient = Address::generate(&env);

    issue_credential(
        &env,
        stranger,
        recipient,
        String::from_str(&env, "Title"),
        String::from_str(&env, "Desc"),
        String::from_str(&env, "course-001"),
        String::from_str(&env, "ipfs://x"),
    );
}

/// AC: Non-admin cannot grant roles
#[test]
#[should_panic(expected = "Caller does not have Admin role")]
fn test_non_admin_cannot_grant_roles() {
    let (env, _admin) = setup_env();
    let stranger = Address::generate(&env);
    let target = Address::generate(&env);

    access_control::grant_role(&env, stranger, target, Role::Issuer);
}

/// AC: Role revocation prevents future operations
#[test]
#[should_panic(expected = "Caller does not have Issuer role")]
fn test_revoked_issuer_cannot_issue() {
    let (env, admin) = setup_env();
    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Grant then revoke Issuer role
    access_control::grant_role(&env, admin.clone(), issuer.clone(), Role::Issuer);
    access_control::revoke_role(&env, admin.clone(), issuer.clone(), Role::Issuer);

    // Should panic — Issuer role was revoked
    issue_credential(
        &env,
        issuer,
        recipient,
        String::from_str(&env, "Title"),
        String::from_str(&env, "Desc"),
        String::from_str(&env, "course-001"),
        String::from_str(&env, "ipfs://x"),
    );
}

/// AC: Multiple roles per address supported
#[test]
fn test_multiple_roles_per_address() {
    let (env, admin) = setup_env();
    let user = Address::generate(&env);

    access_control::grant_role(&env, admin.clone(), user.clone(), Role::Issuer);
    access_control::grant_role(&env, admin.clone(), user.clone(), Role::Instructor);

    assert!(access_control::has_role(&env, &user, Role::Issuer));
    assert!(access_control::has_role(&env, &user, Role::Instructor));
    assert!(!access_control::has_role(&env, &user, Role::Admin));
}
