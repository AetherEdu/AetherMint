#![cfg(test)]
use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::{Address, Bytes, Env, String};

use crate::governance::{
    cast_vote, create_proposal, delegate, execute_proposal, get_delegate, get_proposal,
    Governance, GovernanceDataKey, ProposalStatus,
};
use crate::AetherMintContract;

fn setup_env() -> (Env, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register_contract(None, AetherMintContract);
    (env, admin, contract_id)
}

fn with_contract<T>(env: &Env, contract_id: &Address, f: impl FnOnce() -> T) -> T {
    env.as_contract(contract_id, f)
}

#[test]
fn test_create_proposal() {
    let (env, admin, cid) = setup_env();

    let id = with_contract(&env, &cid, || {
        create_proposal(
            env.clone(),
            admin.clone(),
            String::from_str(&env, "Test Proposal"),
            String::from_str(&env, "A test proposal"),
            Bytes::new(&env),
            86400,
            100,
        )
    });

    assert_eq!(id, 1);

    let proposal = with_contract(&env, &cid, || get_proposal(&env, id));
    assert_eq!(proposal.id, 1);
    assert_eq!(proposal.proposer, admin);
    assert_eq!(proposal.title, String::from_str(&env, "Test Proposal"));
    assert_eq!(proposal.description, String::from_str(&env, "A test proposal"));
    assert_eq!(proposal.status, ProposalStatus::Active);
    assert_eq!(proposal.for_votes, 0);
    assert_eq!(proposal.against_votes, 0);
    assert_eq!(proposal.abstain_votes, 0);
    assert_eq!(proposal.quorum, 100);
    assert!(proposal.end_time > proposal.start_time);
}

#[test]
fn test_create_proposal_increments_id() {
    let (env, _admin, cid) = setup_env();

    let ids = with_contract(&env, &cid, || {
        let p1 = Address::generate(&env);
        let id1 = create_proposal(
            env.clone(),
            p1,
            String::from_str(&env, "P1"),
            String::from_str(&env, "First"),
            Bytes::new(&env),
            86400,
            100,
        );
        let p2 = Address::generate(&env);
        let id2 = create_proposal(
            env.clone(),
            p2,
            String::from_str(&env, "P2"),
            String::from_str(&env, "Second"),
            Bytes::new(&env),
            86400,
            100,
        );
        let p3 = Address::generate(&env);
        let id3 = create_proposal(
            env.clone(),
            p3,
            String::from_str(&env, "P3"),
            String::from_str(&env, "Third"),
            Bytes::new(&env),
            86400,
            100,
        );
        (id1, id2, id3)
    });

    assert_eq!(ids.0, 1);
    assert_eq!(ids.1, 2);
    assert_eq!(ids.2, 3);
}

#[test]
fn test_cast_vote_for() {
    let (env, admin, cid) = setup_env();
    let voter = Address::generate(&env);

    let id = with_contract(&env, &cid, || {
        let id = create_proposal(
            env.clone(),
            admin.clone(),
            String::from_str(&env, "P1"),
            String::from_str(&env, "Test"),
            Bytes::new(&env),
            86400,
            100,
        );
        cast_vote(env.clone(), voter.clone(), id, 1, 500);
        id
    });

    let proposal = with_contract(&env, &cid, || get_proposal(&env, id));
    assert_eq!(proposal.for_votes, 500);
    assert_eq!(proposal.against_votes, 0);
    assert_eq!(proposal.abstain_votes, 0);
}

#[test]
fn test_cast_vote_against() {
    let (env, admin, cid) = setup_env();
    let voter = Address::generate(&env);

    let id = with_contract(&env, &cid, || {
        let id = create_proposal(
            env.clone(),
            admin.clone(),
            String::from_str(&env, "P1"),
            String::from_str(&env, "Test"),
            Bytes::new(&env),
            86400,
            100,
        );
        cast_vote(env.clone(), voter.clone(), id, 0, 300);
        id
    });

    let proposal = with_contract(&env, &cid, || get_proposal(&env, id));
    assert_eq!(proposal.for_votes, 0);
    assert_eq!(proposal.against_votes, 300);
    assert_eq!(proposal.abstain_votes, 0);
}

#[test]
#[should_panic(expected = "Already voted")]
fn test_double_vote_prevention() {
    let (env, admin, cid) = setup_env();
    let voter = Address::generate(&env);

    let id = with_contract(&env, &cid, || {
        create_proposal(
            env.clone(),
            admin.clone(),
            String::from_str(&env, "P1"),
            String::from_str(&env, "Test"),
            Bytes::new(&env),
            86400,
            100,
        )
    });
    with_contract(&env, &cid, || {
        cast_vote(env.clone(), voter.clone(), id, 1, 100);
    });
    with_contract(&env, &cid, || {
        cast_vote(env.clone(), voter, id, 1, 100);
    });
}

#[test]
fn test_multiple_voters_summed() {
    let (env, admin, cid) = setup_env();
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);
    let voter3 = Address::generate(&env);

    let id = with_contract(&env, &cid, || {
        let id = create_proposal(
            env.clone(),
            admin.clone(),
            String::from_str(&env, "P1"),
            String::from_str(&env, "Test"),
            Bytes::new(&env),
            86400,
            100,
        );
        cast_vote(env.clone(), voter1, id, 1, 100);
        cast_vote(env.clone(), voter2, id, 1, 200);
        cast_vote(env.clone(), voter3, id, 2, 50);
        id
    });

    let proposal = with_contract(&env, &cid, || get_proposal(&env, id));
    assert_eq!(proposal.for_votes, 300);
    assert_eq!(proposal.against_votes, 0);
    assert_eq!(proposal.abstain_votes, 50);
}

#[test]
#[should_panic(expected = "Voting period ended")]
fn test_cast_vote_after_voting_period() {
    let (env, admin, cid) = setup_env();
    let voter = Address::generate(&env);

    with_contract(&env, &cid, || {
        let id = create_proposal(
            env.clone(),
            admin.clone(),
            String::from_str(&env, "P1"),
            String::from_str(&env, "Test"),
            Bytes::new(&env),
            3600,
            100,
        );

        env.ledger().set_timestamp(5000);

        cast_vote(env.clone(), voter, id, 1, 100);
    });
}

#[test]
#[should_panic(expected = "Invalid support option")]
fn test_invalid_support_option() {
    let (env, admin, cid) = setup_env();
    let voter = Address::generate(&env);

    with_contract(&env, &cid, || {
        let id = create_proposal(
            env.clone(),
            admin.clone(),
            String::from_str(&env, "P1"),
            String::from_str(&env, "Test"),
            Bytes::new(&env),
            86400,
            100,
        );

        cast_vote(env.clone(), voter, id, 99, 100);
    });
}

#[test]
fn test_execute_proposal_flow() {
    let (env, admin, cid) = setup_env();
    let voter = Address::generate(&env);

    let start_time = 1000u64;
    env.ledger().set_timestamp(start_time);
    let voting_period = 3600u64;

    with_contract(&env, &cid, || {
        let id = create_proposal(
            env.clone(),
            admin.clone(),
            String::from_str(&env, "P1"),
            String::from_str(&env, "Test"),
            Bytes::new(&env),
            voting_period,
            50,
        );

        cast_vote(env.clone(), voter.clone(), id, 1, 100);

        env.ledger().set_timestamp(start_time + voting_period + 1);

        execute_proposal(env.clone(), id);

        let proposal = get_proposal(&env, id);
        assert_eq!(proposal.status, ProposalStatus::Succeeded);
        assert!(proposal.execution_time > 0);
        assert!(proposal.execution_time > proposal.end_time);

        env.ledger().set_timestamp(proposal.execution_time + 1);

        execute_proposal(env.clone(), id);

        let proposal = get_proposal(&env, id);
        assert_eq!(proposal.status, ProposalStatus::Executed);
    });
}

#[test]
fn test_execute_proposal_defeated_by_quorum() {
    let (env, admin, cid) = setup_env();
    let voter = Address::generate(&env);

    let start_time = 1000u64;
    env.ledger().set_timestamp(start_time);

    with_contract(&env, &cid, || {
        let id = create_proposal(
            env.clone(),
            admin.clone(),
            String::from_str(&env, "P1"),
            String::from_str(&env, "Test"),
            Bytes::new(&env),
            3600,
            200,
        );

        cast_vote(env.clone(), voter.clone(), id, 1, 100);

        env.ledger().set_timestamp(start_time + 3601);

        execute_proposal(env.clone(), id);

        let proposal = get_proposal(&env, id);
        assert_eq!(proposal.status, ProposalStatus::Defeated);
    });
}

#[test]
fn test_execute_proposal_defeated_by_vote() {
    let (env, admin, cid) = setup_env();
    let voter = Address::generate(&env);

    let start_time = 1000u64;
    env.ledger().set_timestamp(start_time);

    with_contract(&env, &cid, || {
        let id = create_proposal(
            env.clone(),
            admin.clone(),
            String::from_str(&env, "P1"),
            String::from_str(&env, "Test"),
            Bytes::new(&env),
            3600,
            10,
        );

        cast_vote(env.clone(), voter.clone(), id, 0, 100);

        env.ledger().set_timestamp(start_time + 3601);

        execute_proposal(env.clone(), id);

        let proposal = get_proposal(&env, id);
        assert_eq!(proposal.status, ProposalStatus::Defeated);
    });
}

#[test]
fn test_delegation() {
    let (env, _admin, cid) = setup_env();
    let from = Address::generate(&env);
    let to = Address::generate(&env);

    with_contract(&env, &cid, || {
        assert_eq!(get_delegate(&env, from.clone()), from);

        delegate(env.clone(), from.clone(), to.clone());

        assert_eq!(get_delegate(&env, from), to);
    });
}

#[test]
fn test_delegate_self_when_not_set() {
    let (env, _admin, cid) = setup_env();
    let voter = Address::generate(&env);

    with_contract(&env, &cid, || {
        assert_eq!(get_delegate(&env, voter.clone()), voter);
    });
}

#[test]
#[should_panic(expected = "Proposal not found")]
fn test_get_proposal_not_found() {
    let (env, _admin, cid) = setup_env();
    with_contract(&env, &cid, || {
        get_proposal(&env, 999);
    });
}

#[test]
fn test_proposal_status_transitions() {
    let (env, admin, cid) = setup_env();
    let voter = Address::generate(&env);

    let start_time = 1000u64;
    env.ledger().set_timestamp(start_time);

    with_contract(&env, &cid, || {
        let id = create_proposal(
            env.clone(),
            admin.clone(),
            String::from_str(&env, "P1"),
            String::from_str(&env, "Test"),
            Bytes::new(&env),
            3600,
            50,
        );

        let p = get_proposal(&env, id);
        assert_eq!(p.status, ProposalStatus::Active);

        cast_vote(env.clone(), voter.clone(), id, 1, 100);

        env.ledger().set_timestamp(start_time + 3601);

        execute_proposal(env.clone(), id);
        let p = get_proposal(&env, id);
        assert_eq!(p.status, ProposalStatus::Succeeded);

        env.ledger().set_timestamp(p.execution_time + 1);

        execute_proposal(env.clone(), id);
        let p = get_proposal(&env, id);
        assert_eq!(p.status, ProposalStatus::Executed);
    });
}

#[test]
fn test_deposit_and_withdraw_treasury() {
    let (env, admin, cid) = setup_env();
    let user = Address::generate(&env);

    with_contract(&env, &cid, || {
        let initial: i128 = env.storage().instance().get(&GovernanceDataKey::TreasuryBalance).unwrap_or(0);
        assert_eq!(initial, 0);

        Governance::deposit_to_treasury(env.clone(), user.clone(), 1000);

        let after_deposit: i128 = env.storage().instance().get(&GovernanceDataKey::TreasuryBalance).unwrap_or(0);
        assert_eq!(after_deposit, 1000);

        Governance::withdraw_from_treasury(env.clone(), 400, user.clone());

        let after_withdraw: i128 = env.storage().instance().get(&GovernanceDataKey::TreasuryBalance).unwrap_or(0);
        assert_eq!(after_withdraw, 600);
    });
}

#[test]
#[should_panic(expected = "Insufficient treasury funds")]
fn test_treasury_insufficient_funds() {
    let (env, _admin, cid) = setup_env();
    let user = Address::generate(&env);

    with_contract(&env, &cid, || {
        Governance::withdraw_from_treasury(env.clone(), 100, user);
    });
}

#[test]
fn test_vote_counting_accuracy() {
    let (env, admin, cid) = setup_env();
    let for_voter = Address::generate(&env);
    let against_voter = Address::generate(&env);
    let abstain_voter = Address::generate(&env);

    let id = with_contract(&env, &cid, || {
        let id = create_proposal(
            env.clone(),
            admin.clone(),
            String::from_str(&env, "P1"),
            String::from_str(&env, "Test"),
            Bytes::new(&env),
            86400,
            10,
        );

        cast_vote(env.clone(), for_voter, id, 1, 250);
        cast_vote(env.clone(), against_voter, id, 0, 100);
        cast_vote(env.clone(), abstain_voter, id, 2, 50);
        id
    });

    let proposal = with_contract(&env, &cid, || get_proposal(&env, id));
    assert_eq!(proposal.for_votes, 250);
    assert_eq!(proposal.against_votes, 100);
    assert_eq!(proposal.abstain_votes, 50);

    let total = proposal.for_votes + proposal.against_votes + proposal.abstain_votes;
    assert_eq!(total, 400);
    assert!(total >= proposal.quorum);
    assert!(proposal.for_votes > proposal.against_votes);
}

#[test]
fn test_create_proposal_with_action_data() {
    let (env, admin, cid) = setup_env();

    let action_data = Bytes::from_slice(&env, &[0u8, 1u8, 2u8, 3u8]);
    let id = with_contract(&env, &cid, || {
        create_proposal(
            env.clone(),
            admin.clone(),
            String::from_str(&env, "Action Proposal"),
            String::from_str(&env, "With action data"),
            action_data.clone(),
            86400,
            100,
        )
    });

    let proposal = with_contract(&env, &cid, || get_proposal(&env, id));
    assert_eq!(proposal.action_data, action_data);
}

#[test]
fn test_voting_power_with_reputation() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let voter = Address::generate(&env);

    let token = env.register_stellar_asset_contract(admin);
    let power = Governance::get_voting_power(&env, voter.clone(), token, 50);
    assert_eq!(power, 50);

    let token2 = env.register_stellar_asset_contract(Address::generate(&env));
    let power2 = Governance::get_voting_power(&env, voter, token2, 100);
    assert_eq!(power2, 100);
}

// ---------------------------------------------------------------------------
// Event emission verification tests
// ---------------------------------------------------------------------------

#[test]
fn test_create_proposal_emits_event() {
    let (env, admin, cid) = setup_env();

    with_contract(&env, &cid, || {
        create_proposal(
            env.clone(),
            admin,
            String::from_str(&env, "Event Test Proposal"),
            String::from_str(&env, "Verify events are emitted"),
            Bytes::new(&env),
            86400,
            100,
        );
    });

    let events = env.events().all();
    assert!(events.events().len() > 0, "create_proposal must emit events");
}

#[test]
fn test_cast_vote_emits_event() {
    let (env, admin, cid) = setup_env();
    let voter = Address::generate(&env);

    let id = with_contract(&env, &cid, || {
        create_proposal(
            env.clone(),
            admin,
            String::from_str(&env, "Vote Event Test"),
            String::from_str(&env, "Check vote event"),
            Bytes::new(&env),
            86400,
            100,
        )
    });

    with_contract(&env, &cid, || {
        cast_vote(env.clone(), voter, id, 1, 500);
    });

    let events = env.events().all();
    assert!(events.events().len() > 1, "cast_vote must emit additional events");
}

#[test]
fn test_execute_proposal_emits_event() {
    let (env, admin, cid) = setup_env();
    let voter = Address::generate(&env);

    let start_time = 1000u64;
    env.ledger().set_timestamp(start_time);

    let id = with_contract(&env, &cid, || {
        let id = create_proposal(
            env.clone(),
            admin.clone(),
            String::from_str(&env, "Execute Event Test"),
            String::from_str(&env, "Check execution event"),
            Bytes::new(&env),
            3600,
            50,
        );
        cast_vote(env.clone(), voter.clone(), id, 1, 100);
        env.ledger().set_timestamp(start_time + 3601);
        execute_proposal(env.clone(), id);
        id
    });

    let proposal = with_contract(&env, &cid, || get_proposal(&env, id));
    assert_eq!(proposal.status, ProposalStatus::Succeeded);

    let events = env.events().all();
    assert!(events.events().len() > 0, "execute_proposal must emit events");
}

#[test]
fn test_delegate_emits_event() {
    let (env, _admin, cid) = setup_env();
    let from = Address::generate(&env);
    let to = Address::generate(&env);

    with_contract(&env, &cid, || {
        Governance::delegate(env.clone(), from, to);
    });

    let events = env.events().all();
    assert!(events.events().len() > 0, "delegate must emit events");
}

#[test]
fn test_set_quorum_and_timelock() {
    let (env, admin, cid) = setup_env();

    with_contract(&env, &cid, || {
        Governance::set_quorum_threshold(env.clone(), admin.clone(), 5000);
    });
    with_contract(&env, &cid, || {
        Governance::set_timelock_delay(env.clone(), admin.clone(), 3600);
    });
}

#[test]
#[should_panic(expected = "Voting period too short")]
fn test_voting_period_too_short() {
    let (env, admin, cid) = setup_env();
    with_contract(&env, &cid, || {
        create_proposal(
            env.clone(),
            admin,
            String::from_str(&env, "P1"),
            String::from_str(&env, "Test"),
            Bytes::new(&env),
            100,
            100,
        );
    });
}

#[test]
#[should_panic(expected = "Quorum must be positive")]
fn test_quorum_must_be_positive() {
    let (env, admin, cid) = setup_env();
    with_contract(&env, &cid, || {
        create_proposal(
            env.clone(),
            admin,
            String::from_str(&env, "P1"),
            String::from_str(&env, "Test"),
            Bytes::new(&env),
            86400,
            0,
        );
    });
}
