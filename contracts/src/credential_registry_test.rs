#![cfg(test)]

use crate::credential_registry::{
    get_credential, get_user_credentials, issue_credentials_batch, BatchCredentialParams,
    CredentialStatus, MAX_BATCH_SIZE,
};
use soroban_sdk::{testutils::Address as _, Address, Env, String, Symbol, Vec};

fn setup_env() -> (Env, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    env.storage()
        .instance()
        .set(&Symbol::new(&env, "admin"), &admin);
    (env, admin)
}

fn make_params(env: &Env, recipient: Address, _idx: u32) -> BatchCredentialParams {
    BatchCredentialParams {
        recipient,
        title: String::from_str(env, "Soroban Bootcamp"),
        description: String::from_str(env, "Completed Soroban smart contract fundamentals"),
        course_id: String::from_str(env, "course-001"),
        ipfs_hash: String::from_str(env, "ipfs://QmTestHash"),
        validity_duration: 365 * 24 * 60 * 60, // 1 year
    }
}

// ---------------------------------------------------------------------------
// Successful batch
// ---------------------------------------------------------------------------

#[test]
fn test_batch_issues_multiple_credentials() {
    let (env, admin) = setup_env();

    let mut params: Vec<BatchCredentialParams> = Vec::new(&env);
    let r0 = Address::generate(&env);
    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);
    params.push_back(make_params(&env, r0.clone(), 0));
    params.push_back(make_params(&env, r1.clone(), 1));
    params.push_back(make_params(&env, r2.clone(), 2));
    let recipients = [r0, r1, r2];

    let ids = issue_credentials_batch(&env, admin.clone(), params);

    assert_eq!(ids.len(), 3);

    // IDs must be sequential and unique.
    let id0 = ids.get(0).unwrap();
    let id1 = ids.get(1).unwrap();
    let id2 = ids.get(2).unwrap();
    assert_eq!(id1, id0 + 1);
    assert_eq!(id2, id0 + 2);

    // Each credential is independently retrievable and Active.
    for (i, r) in recipients.iter().enumerate() {
        let cred = get_credential(&env, ids.get(i as u32).unwrap());
        assert_eq!(cred.recipient, r.clone());
        assert_eq!(cred.status, CredentialStatus::Active);
        assert_eq!(cred.issuer, admin);
        assert_eq!(cred.renewal_count, 0);
    }
}

#[test]
fn test_batch_credentials_stored_in_user_list() {
    let (env, admin) = setup_env();

    let recipient = Address::generate(&env);
    let mut params: Vec<BatchCredentialParams> = Vec::new(&env);
    // Issue 5 credentials to the same recipient.
    for i in 0..5u32 {
        params.push_back(make_params(&env, recipient.clone(), i));
    }

    let ids = issue_credentials_batch(&env, admin, params);

    let user_creds = get_user_credentials(&env, recipient);
    assert_eq!(user_creds.len(), 5);
    for i in 0..5u32 {
        assert_eq!(user_creds.get(i).unwrap(), ids.get(i).unwrap());
    }
}

#[test]
fn test_single_credential_batch_fallback() {
    let (env, admin) = setup_env();

    let recipient = Address::generate(&env);
    let mut params: Vec<BatchCredentialParams> = Vec::new(&env);
    params.push_back(make_params(&env, recipient.clone(), 0));

    let ids = issue_credentials_batch(&env, admin, params);

    assert_eq!(ids.len(), 1);
    let cred = get_credential(&env, ids.get(0).unwrap());
    assert_eq!(cred.recipient, recipient);
    assert_eq!(cred.status, CredentialStatus::Active);
}

// ---------------------------------------------------------------------------
// Empty batch rejection
// ---------------------------------------------------------------------------

#[test]
#[should_panic(expected = "Batch must contain at least one credential")]
fn test_empty_batch_rejected() {
    let (env, admin) = setup_env();
    let params: Vec<BatchCredentialParams> = Vec::new(&env);
    issue_credentials_batch(&env, admin, params);
}

// ---------------------------------------------------------------------------
// Max batch size enforcement
// ---------------------------------------------------------------------------

#[test]
#[should_panic(expected = "Batch size exceeds maximum allowed limit")]
fn test_oversized_batch_rejected() {
    let (env, admin) = setup_env();

    let mut params: Vec<BatchCredentialParams> = Vec::new(&env);
    // MAX_BATCH_SIZE + 1 entries.
    for _ in 0..(MAX_BATCH_SIZE + 1) {
        let r = Address::generate(&env);
        params.push_back(make_params(&env, r, 0));
    }

    issue_credentials_batch(&env, admin, params);
}

#[test]
fn test_max_batch_size_is_accepted() {
    let (env, admin) = setup_env();

    let mut params: Vec<BatchCredentialParams> = Vec::new(&env);
    for _ in 0..MAX_BATCH_SIZE {
        let r = Address::generate(&env);
        params.push_back(make_params(&env, r, 0));
    }

    let ids = issue_credentials_batch(&env, admin, params);
    assert_eq!(ids.len(), MAX_BATCH_SIZE);
}

// ---------------------------------------------------------------------------
// Authorization failure
// ---------------------------------------------------------------------------

#[test]
#[should_panic(expected = "Unauthorized issuer")]
fn test_non_admin_issuer_rejected() {
    let (env, _admin) = setup_env();

    let impostor = Address::generate(&env);
    let recipient = Address::generate(&env);

    let mut params: Vec<BatchCredentialParams> = Vec::new(&env);
    params.push_back(make_params(&env, recipient, 0));

    issue_credentials_batch(&env, impostor, params);
}

// ---------------------------------------------------------------------------
// Lifecycle events emitted for every credential in the batch
// ---------------------------------------------------------------------------

#[test]
fn test_batch_emits_lifecycle_events_for_each_credential() {
    let (env, admin) = setup_env();

    let mut params: Vec<BatchCredentialParams> = Vec::new(&env);
    for _ in 0..3u32 {
        let r = Address::generate(&env);
        params.push_back(make_params(&env, r, 0));
    }

    let ids = issue_credentials_batch(&env, admin.clone(), params);

    for i in 0..3u32 {
        let cred_id = ids.get(i).unwrap();
        let events = crate::credential_events::get_credential_events(&env, cred_id);
        assert_eq!(
            events.len(),
            1,
            "credential {} should have exactly 1 event",
            cred_id
        );
        assert_eq!(
            events.get(0).unwrap().event_type,
            crate::credential_events::CredentialLifecycleEvent::Issued,
        );
    }

    // Admin actor index should have one entry per credential.
    let admin_events = crate::credential_events::get_actor_events(&env, admin);
    assert_eq!(admin_events.len(), 3);
}
