#![cfg(test)]

use crate::tokenomics_events::{
    get_tokenomics_actor_events, get_tokenomics_event, get_tokenomics_event_count,
    publish_tokenomics_event, record_tokenomics_event, TokenomicsEvent,
};
use soroban_sdk::{testutils::Address as _, testutils::Events as _, Address, Env};

#[test]
fn test_publish_records_event_and_indexes_it() {
    let env = Env::default();
    env.mock_all_auths();

    let recipient = Address::generate(&env);
    let amount: u64 = 500;

    let event_id =
        publish_tokenomics_event(&env, TokenomicsEvent::Minted, amount, recipient.clone());

    assert_eq!(event_id, 1);
    assert_eq!(get_tokenomics_event_count(&env), 1);

    let record = get_tokenomics_event(&env, event_id).unwrap();
    assert_eq!(record.id, event_id);
    assert_eq!(record.event_type, TokenomicsEvent::Minted);
    assert_eq!(record.entity_id, amount);
    assert_eq!(record.actor, recipient);
    assert_eq!(record.timestamp, env.ledger().timestamp());

    // Indexed by actor.
    let by_actor = get_tokenomics_actor_events(&env, recipient.clone());
    assert_eq!(by_actor.len(), 1);
    assert_eq!(by_actor.get(0).unwrap().id, event_id);
}

#[test]
fn test_publish_emits_on_chain_event_with_expected_topics_and_payload_minted() {
    let env = Env::default();
    env.mock_all_auths();

    let recipient = Address::generate(&env);
    let amount: u64 = 1000;

    publish_tokenomics_event(&env, TokenomicsEvent::Minted, amount, recipient.clone());

    let all = env.events().all();
    assert_eq!(all.len(), 1);

    let event = &all.get(0).unwrap();
    // Topics: (token_op, minted).
    assert_eq!(event.1.len(), 2);
    assert_eq!(
        event.1.get(0).unwrap(),
        soroban_sdk::Symbol::new(&env, "token_op")
    );
    assert_eq!(
        event.1.get(1).unwrap(),
        soroban_sdk::Symbol::new(&env, "minted")
    );

    // Payload: (entity_id, actor, timestamp).
    let payload = &event.2;
    assert_eq!(payload.len(), 3);
    assert_eq!(payload.get(0).unwrap(), amount);
    assert_eq!(payload.get(1).unwrap(), recipient);
    assert_eq!(payload.get(2).unwrap(), env.ledger().timestamp());
}

#[test]
fn test_staked_event_on_chain_topics() {
    let env = Env::default();
    env.mock_all_auths();

    let staker = Address::generate(&env);
    publish_tokenomics_event(&env, TokenomicsEvent::Staked, 200, staker.clone());

    let all = env.events().all();
    assert_eq!(all.len(), 1);
    let event = &all.get(0).unwrap();
    assert_eq!(
        event.1.get(0).unwrap(),
        soroban_sdk::Symbol::new(&env, "token_op")
    );
    assert_eq!(
        event.1.get(1).unwrap(),
        soroban_sdk::Symbol::new(&env, "staked")
    );
}

#[test]
fn test_unstaked_event_on_chain_topics() {
    let env = Env::default();
    env.mock_all_auths();

    let staker = Address::generate(&env);
    publish_tokenomics_event(&env, TokenomicsEvent::Unstaked, 220, staker.clone());

    let all = env.events().all();
    assert_eq!(all.len(), 1);
    let event = &all.get(0).unwrap();
    assert_eq!(
        event.1.get(1).unwrap(),
        soroban_sdk::Symbol::new(&env, "unstaked")
    );
}

#[test]
fn test_voted_event_on_chain_topics() {
    let env = Env::default();
    env.mock_all_auths();

    let voter = Address::generate(&env);
    let proposal_id: u64 = 3;

    publish_tokenomics_event(&env, TokenomicsEvent::Voted, proposal_id, voter.clone());

    let all = env.events().all();
    assert_eq!(all.len(), 1);
    let event = &all.get(0).unwrap();
    assert_eq!(
        event.1.get(1).unwrap(),
        soroban_sdk::Symbol::new(&env, "voted")
    );
    // Payload entity_id = proposal_id.
    assert_eq!(event.2.get(0).unwrap(), proposal_id);
}

#[test]
fn test_proposal_created_event_on_chain_topics() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let proposal_id: u64 = 7;

    publish_tokenomics_event(
        &env,
        TokenomicsEvent::ProposalCreated,
        proposal_id,
        creator.clone(),
    );

    let all = env.events().all();
    assert_eq!(all.len(), 1);
    let event = &all.get(0).unwrap();
    assert_eq!(
        event.1.get(1).unwrap(),
        soroban_sdk::Symbol::new(&env, "prop_new")
    );
    assert_eq!(event.2.get(0).unwrap(), proposal_id);
    assert_eq!(event.2.get(1).unwrap(), creator);
}

#[test]
fn test_multiple_events_accumulate_by_actor() {
    let env = Env::default();
    env.mock_all_auths();

    let user = Address::generate(&env);

    publish_tokenomics_event(&env, TokenomicsEvent::Minted, 100, user.clone());
    publish_tokenomics_event(&env, TokenomicsEvent::Staked, 80, user.clone());
    publish_tokenomics_event(&env, TokenomicsEvent::Voted, 1, user.clone());
    publish_tokenomics_event(&env, TokenomicsEvent::Unstaked, 90, user.clone());

    assert_eq!(get_tokenomics_event_count(&env), 4);
    let actor_events = get_tokenomics_actor_events(&env, user);
    assert_eq!(actor_events.len(), 4);
    assert_eq!(
        actor_events.get(0).unwrap().event_type,
        TokenomicsEvent::Minted
    );
    assert_eq!(
        actor_events.get(1).unwrap().event_type,
        TokenomicsEvent::Staked
    );
    assert_eq!(
        actor_events.get(2).unwrap().event_type,
        TokenomicsEvent::Voted
    );
    assert_eq!(
        actor_events.get(3).unwrap().event_type,
        TokenomicsEvent::Unstaked
    );
}

#[test]
fn test_events_by_different_actors_are_separate() {
    let env = Env::default();
    env.mock_all_auths();

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    publish_tokenomics_event(&env, TokenomicsEvent::Minted, 100, alice.clone());
    publish_tokenomics_event(&env, TokenomicsEvent::Staked, 50, bob.clone());
    publish_tokenomics_event(&env, TokenomicsEvent::Minted, 200, alice.clone());

    assert_eq!(get_tokenomics_actor_events(&env, alice).len(), 2);
    assert_eq!(get_tokenomics_actor_events(&env, bob).len(), 1);
    assert_eq!(get_tokenomics_event_count(&env), 3);
}

#[test]
fn test_record_event_does_not_publish_but_still_indexes() {
    let env = Env::default();
    env.mock_all_auths();

    let actor = Address::generate(&env);

    let event_id = record_tokenomics_event(
        &env,
        TokenomicsEvent::Staked,
        300,
        actor.clone(),
        env.ledger().timestamp(),
    );

    assert_eq!(event_id, 1);
    assert_eq!(get_tokenomics_event_count(&env), 1);
    assert_eq!(get_tokenomics_actor_events(&env, actor).len(), 1);

    // record_tokenomics_event does NOT publish an on-chain event.
    assert_eq!(env.events().all().len(), 0);
}

#[test]
fn test_get_tokenomics_event_for_unknown_id_returns_none() {
    let env = Env::default();
    assert!(get_tokenomics_event(&env, 999).is_none());
    assert_eq!(get_tokenomics_event_count(&env), 0);
}

#[test]
fn test_topic_mapping_is_stable_and_distinct() {
    let env = Env::default();

    assert_eq!(
        TokenomicsEvent::Minted.topic(),
        soroban_sdk::Symbol::new(&env, "minted")
    );
    assert_eq!(
        TokenomicsEvent::Staked.topic(),
        soroban_sdk::Symbol::new(&env, "staked")
    );
    assert_eq!(
        TokenomicsEvent::Unstaked.topic(),
        soroban_sdk::Symbol::new(&env, "unstaked")
    );
    assert_eq!(
        TokenomicsEvent::Voted.topic(),
        soroban_sdk::Symbol::new(&env, "voted")
    );
    assert_eq!(
        TokenomicsEvent::ProposalCreated.topic(),
        soroban_sdk::Symbol::new(&env, "prop_new")
    );

    // All topics are distinct.
    assert_ne!(
        TokenomicsEvent::Minted.topic(),
        TokenomicsEvent::Staked.topic()
    );
    assert_ne!(
        TokenomicsEvent::Staked.topic(),
        TokenomicsEvent::Unstaked.topic()
    );
    assert_ne!(
        TokenomicsEvent::Unstaked.topic(),
        TokenomicsEvent::Voted.topic()
    );
    assert_ne!(
        TokenomicsEvent::Voted.topic(),
        TokenomicsEvent::ProposalCreated.topic()
    );
    assert_ne!(
        TokenomicsEvent::Minted.topic(),
        TokenomicsEvent::ProposalCreated.topic()
    );
}
