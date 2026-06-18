#![cfg(test)]

use crate::access_control::{self, Role};
use crate::credentials::{
    get_credential, get_credential_count, get_user_credentials, issue_credential,
    revoke_credential, verify_credential,
};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

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
    assert_eq!(cred.recipient, recipient);

    // Verify: revocation bit should be clear
    assert!(verify_credential(&env, cred_id));

    // Revoke (Admin role required)
    revoke_credential(&env, cred_id, admin.clone());

    // After revocation, verify returns false
    assert!(!verify_credential(&env, cred_id));

    // User credential list
    let user_creds = get_user_credentials(&env, recipient);
    assert_eq!(user_creds.len(), 1);
    assert_eq!(user_creds.get(0).unwrap(), 1);
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
