#![cfg(test)]

use crate::credential_events::{
    get_actor_events, get_credential_event, get_credential_event_count,
    get_credential_events, publish_credential_event, record_event,
    CredentialLifecycleEvent,
};
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn test_publish_records_event_and_indexes_it() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);
    let cred_id: u64 = 42;

    let event_id = publish_credential_event(
        &env,
        CredentialLifecycleEvent::Issued,
        cred_id,
        admin.clone(),
    );

    assert_eq!(event_id, 1);
    assert_eq!(get_credential_event_count(&env), 1);

    let record = get_credential_event(&env, event_id).unwrap();
    assert_eq!(record.id, event_id);
    assert_eq!(record.event_type, CredentialLifecycleEvent::Issued);
    assert_eq!(record.credential_id, cred_id);
    assert_eq!(record.actor, admin);
    assert_eq!(record.timestamp, env.ledger().timestamp());

    let by_cred = get_credential_events(&env, cred_id);
    assert_eq!(by_cred.len(), 1);
    assert_eq!(by_cred.get(0).unwrap().id, event_id);

    let by_actor = get_actor_events(&env, admin.clone());
    assert_eq!(by_actor.len(), 1);
    assert_eq!(by_actor.get(0).unwrap().id, event_id);

    // Recipient never acted on this credential, so their actor list is empty.
    let recipient_events = get_actor_events(&env, recipient.clone());
    assert_eq!(recipient_events.len(), 0);
}

#[test]
fn test_publish_appends_multiple_events_per_credential() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let verifier = Address::generate(&env);
    let revoker = Address::generate(&env);
    let cred_id: u64 = 7;

    let issued_id = publish_credential_event(
        &env,
        CredentialLifecycleEvent::Issued,
        cred_id,
        admin.clone(),
    );
    let verified_id = publish_credential_event(
        &env,
        CredentialLifecycleEvent::Verified,
        cred_id,
        verifier.clone(),
    );
    let revoked_id = publish_credential_event(
        &env,
        CredentialLifecycleEvent::Revoked,
        cred_id,
        revoker.clone(),
    );

    assert_eq!(issued_id, 1);
    assert_eq!(verified_id, 2);
    assert_eq!(revoked_id, 3);
    assert_eq!(get_credential_event_count(&env), 3);

    let cred_events = get_credential_events(&env, cred_id);
    assert_eq!(cred_events.len(), 3);
    assert_eq!(cred_events.get(0).unwrap().event_type, CredentialLifecycleEvent::Issued);
    assert_eq!(cred_events.get(1).unwrap().event_type, CredentialLifecycleEvent::Verified);
    assert_eq!(cred_events.get(2).unwrap().event_type, CredentialLifecycleEvent::Revoked);

    assert_eq!(get_actor_events(&env, admin.clone()).len(), 1);
    assert_eq!(get_actor_events(&env, verifier.clone()).len(), 1);
    assert_eq!(get_actor_events(&env, revoker.clone()).len(), 1);
}

#[test]
fn test_publish_distinguishes_credentials_by_id() {
    let env = Env::default();
    env.mock_all_auths();

    let actor = Address::generate(&env);
    publish_credential_event(&env, CredentialLifecycleEvent::Issued, 1, actor.clone());
    publish_credential_event(&env, CredentialLifecycleEvent::Issued, 2, actor.clone());
    publish_credential_event(
        &env,
        CredentialLifecycleEvent::Renewed,
        1,
        actor.clone(),
    );

    assert_eq!(get_credential_events(&env, 1).len(), 2);
    assert_eq!(get_credential_events(&env, 2).len(), 1);
    assert_eq!(get_actor_events(&env, actor).len(), 3);
}

#[test]
fn test_publish_emits_on_chain_event_with_expected_topics_and_payload() {
    // Verifies the on-chain indexable event: topics and payload must match
    // the contract so off-chain indexers (Horizon/RPC) can reliably filter
    // credential lifecycle changes.
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    publish_credential_event(&env, CredentialLifecycleEvent::Issued, 99, admin.clone());

    let all = env.events().all();
    assert_eq!(all.len(), 1);

    let event = &all.get(0).unwrap();
    // Two topics: (cred_op, issued).
    assert_eq!(event.1.len(), 2);
    assert_eq!(
        event.1.get(0).unwrap(),
        soroban_sdk::Symbol::new(&env, "cred_op")
    );
    assert_eq!(
        event.1.get(1).unwrap(),
        soroban_sdk::Symbol::new(&env, "issued")
    );

    // Payload must be (credential_id, actor, timestamp) in that order.
    let payload = &event.2;
    assert_eq!(payload.len(), 3);
    assert_eq!(payload.get(0).unwrap(), 99u64);
    assert_eq!(payload.get(1).unwrap(), admin);
    assert_eq!(payload.get(2).unwrap(), env.ledger().timestamp());
}

#[test]
fn test_record_event_does_not_publish_but_still_indexes() {
    let env = Env::default();
    env.mock_all_auths();

    let actor = Address::generate(&env);
    let cred_id: u64 = 99;

    let event_id = record_event(
        &env,
        CredentialLifecycleEvent::Verified,
        cred_id,
        actor.clone(),
        env.ledger().timestamp(),
    );

    assert_eq!(event_id, 1);
    assert_eq!(get_credential_event_count(&env), 1);
    assert_eq!(get_credential_events(&env, cred_id).len(), 1);
    assert_eq!(get_actor_events(&env, actor).len(), 1);
}

#[test]
fn test_get_credential_event_for_unknown_id_returns_none() {
    let env = Env::default();
    assert!(get_credential_event(&env, 123).is_none());
    assert_eq!(get_credential_event_count(&env), 0);
    assert_eq!(get_credential_events(&env, 123).len(), 0);
}

#[test]
fn test_topic_mapping_is_stable_and_distinct() {
    // We pin the exact topic strings so future renames are caught by tests
    // rather than silently changing on-chain event topics (which downstream
    // indexers depend on for filtering).
    let env = Env::default();
    assert_eq!(
        CredentialLifecycleEvent::Issued.topic(),
        soroban_sdk::Symbol::new(&env, "issued")
    );
    assert_eq!(
        CredentialLifecycleEvent::Verified.topic(),
        soroban_sdk::Symbol::new(&env, "verified")
    );
    assert_eq!(
        CredentialLifecycleEvent::Revoked.topic(),
        soroban_sdk::Symbol::new(&env, "revoked")
    );
    assert_eq!(
        CredentialLifecycleEvent::Renewed.topic(),
        soroban_sdk::Symbol::new(&env, "renewed")
    );
    assert_eq!(
        CredentialLifecycleEvent::Expired.topic(),
        soroban_sdk::Symbol::new(&env, "expired")
    );

    // And ensure each event variant produces a distinct topic so topics
    // never collide (the symbols used here must all fit in 9 chars).
    assert_ne!(
        CredentialLifecycleEvent::Issued.topic(),
        CredentialLifecycleEvent::Verified.topic()
    );
    assert_ne!(
        CredentialLifecycleEvent::Issued.topic(),
        CredentialLifecycleEvent::Revoked.topic()
    );
    assert_ne!(
        CredentialLifecycleEvent::Issued.topic(),
        CredentialLifecycleEvent::Renewed.topic()
    );
    assert_ne!(
        CredentialLifecycleEvent::Issued.topic(),
        CredentialLifecycleEvent::Expired.topic()
    );
}
