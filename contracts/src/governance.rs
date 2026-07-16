use crate::utils::pause::PauseUtils;
use crate::utils::validation::{
    validate_non_zero_address, validate_string_length, MAX_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH,
};
use soroban_sdk::{contracttype, symbol_short, Address, Bytes, Env, Map, String, Symbol, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProposalStatus {
    Active,
    Succeeded,
    Defeated,
    Queued,
    Executed,
    Expired,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Proposal {
    pub id: u64,
    pub proposer: Address,
    pub title: String,
    pub description: String,
    pub action_data: Bytes,
    pub start_time: u64,
    pub end_time: u64,
    pub execution_time: u64,
    pub for_votes: i128,
    pub against_votes: i128,
    pub abstain_votes: i128,
    pub status: ProposalStatus,
    pub quorum: i128,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct VoteRecord {
    pub voter: Address,
    pub proposal_id: u64,
    pub support: u32,
    pub voting_power: i128,
}

#[contracttype]
pub enum GovernanceDataKey {
    Proposal(u64),
    ProposalCount,
    Vote(u64, Address),
    GovernanceToken,
    QuorumThreshold,
    VotingPeriod,
    TimelockDelay,
    ReputationMultiplier,
    Delegate(Address),
    TreasuryBalance,
}

/// Default timelock delay in seconds (1 day).
const DEFAULT_TIMELOCK_DELAY: u64 = 86400;
/// Default quorum threshold — overridden by the contract admin or proposer.
#[allow(dead_code)]
const DEFAULT_QUORUM_THRESHOLD: i128 = 1000;
/// Minimum voting period in seconds (1 hour).
const MIN_VOTING_PERIOD: u64 = 3600;
/// Maximum voting period in seconds (30 days).
const MAX_VOTING_PERIOD: u64 = 2_592_000;
/// Expiry window after end_time before a Succeeded proposal is considered
/// expired (7 days).
const EXPIRY_WINDOW: u64 = 604_800;

pub struct Governance;

impl Governance {
    pub fn get_voting_power(env: &Env, voter: Address, token: Address, reputation: u64) -> i128 {
        let token_client = soroban_sdk::token::Client::new(env, &token);
        let token_balance = token_client.balance(&voter);

        let sqrt_balance = Self::integer_sqrt(token_balance);

        let reputation_power = reputation as i128;

        sqrt_balance + reputation_power
    }

    pub fn create_proposal(
        env: Env,
        proposer: Address,
        title: String,
        description: String,
        action_data: Bytes,
        voting_period: u64,
        quorum: i128,
    ) -> u64 {
        PauseUtils::require_not_paused(&env);
        proposer.require_auth();

        validate_non_zero_address(&env, &proposer);
        validate_string_length(&env, &title, MAX_TITLE_LENGTH);
        validate_string_length(&env, &description, MAX_DESCRIPTION_LENGTH);
        if voting_period < MIN_VOTING_PERIOD {
            panic!("Voting period too short");
        }
        if voting_period > MAX_VOTING_PERIOD {
            panic!("Voting period too long");
        }
        if quorum <= 0 {
            panic!("Quorum must be positive");
        }

        let count: u64 = env
            .storage()
            .instance()
            .get(&GovernanceDataKey::ProposalCount)
            .unwrap_or(0);
        let id = count + 1;

        let start_time = env.ledger().timestamp();
        let end_time = start_time + voting_period;

        let proposal = Proposal {
            id,
            proposer: proposer.clone(),
            title,
            description,
            action_data,
            start_time,
            end_time,
            execution_time: 0,
            for_votes: 0,
            against_votes: 0,
            abstain_votes: 0,
            status: ProposalStatus::Active,
            quorum,
        };

        env.storage()
            .instance()
            .set(&GovernanceDataKey::Proposal(id), &proposal);
        env.storage()
            .instance()
            .set(&GovernanceDataKey::ProposalCount, &id);

        env.events().publish(
            (symbol_short!("govern"), symbol_short!("p_create")),
            (id, proposer.clone(), start_time, end_time),
        );

        id
    }

    pub fn cast_vote(env: Env, voter: Address, proposal_id: u64, support: u32, voting_power: i128) {
        PauseUtils::require_not_paused(&env);
        voter.require_auth();
        validate_non_zero_address(&env, &voter);

        let mut proposal: Proposal = env
            .storage()
            .instance()
            .get(&GovernanceDataKey::Proposal(proposal_id))
            .unwrap_or_else(|| panic!("Proposal not found"));

        if proposal.status != ProposalStatus::Active {
            panic!("Voting period ended");
        }

        if env.ledger().timestamp() > proposal.end_time {
            proposal.status = ProposalStatus::Expired;
            env.storage()
                .instance()
                .set(&GovernanceDataKey::Proposal(proposal_id), &proposal);
            panic!("Voting period ended");
        }

        if env
            .storage()
            .instance()
            .has(&GovernanceDataKey::Vote(proposal_id, voter.clone()))
        {
            panic!("Already voted");
        }

        match support {
            0 => proposal.against_votes += voting_power,
            1 => proposal.for_votes += voting_power,
            2 => proposal.abstain_votes += voting_power,
            _ => panic!("Invalid support option"),
        }

        env.storage()
            .instance()
            .set(&GovernanceDataKey::Proposal(proposal_id), &proposal);
        env.storage().instance().set(
            &GovernanceDataKey::Vote(proposal_id, voter.clone()),
            &support,
        );

        let now = env.ledger().timestamp();
        env.events().publish(
            (symbol_short!("govern"), symbol_short!("p_vote")),
            (proposal_id, voter.clone(), support, voting_power, now),
        );
    }

    pub fn execute_proposal(env: Env, proposal_id: u64) {
        PauseUtils::require_not_paused(&env);
        let mut proposal: Proposal = env
            .storage()
            .instance()
            .get(&GovernanceDataKey::Proposal(proposal_id))
            .unwrap_or_else(|| panic!("Proposal not found"));

        let now = env.ledger().timestamp();

        match proposal.status {
            ProposalStatus::Executed => {
                panic!("Already executed");
            }
            ProposalStatus::Defeated | ProposalStatus::Expired => {
                panic!("Proposal defeated");
            }
            ProposalStatus::Active => {
                if now <= proposal.end_time {
                    panic!("Voting period not ended");
                }

                let total_votes =
                    proposal.for_votes + proposal.against_votes + proposal.abstain_votes;

                if total_votes < proposal.quorum {
                    proposal.status = ProposalStatus::Defeated;
                    env.storage()
                        .instance()
                        .set(&GovernanceDataKey::Proposal(proposal_id), &proposal);
                    env.events().publish(
                        (symbol_short!("govern"), symbol_short!("p_defeat")),
                        (proposal_id, now),
                    );
                    return;
                }

                if proposal.for_votes <= proposal.against_votes {
                    proposal.status = ProposalStatus::Defeated;
                    env.storage()
                        .instance()
                        .set(&GovernanceDataKey::Proposal(proposal_id), &proposal);
                    env.events().publish(
                        (symbol_short!("govern"), symbol_short!("p_defeat")),
                        (proposal_id, now),
                    );
                    return;
                }

                proposal.status = ProposalStatus::Succeeded;
                let timelock_delay: u64 = env
                    .storage()
                    .instance()
                    .get(&GovernanceDataKey::TimelockDelay)
                    .unwrap_or(DEFAULT_TIMELOCK_DELAY);
                proposal.execution_time = now + timelock_delay;
                env.storage()
                    .instance()
                    .set(&GovernanceDataKey::Proposal(proposal_id), &proposal);
                env.events().publish(
                    (symbol_short!("govern"), symbol_short!("p_success")),
                    (proposal_id, proposal.execution_time, now),
                );
            }
            ProposalStatus::Succeeded | ProposalStatus::Queued => {
                if now < proposal.execution_time {
                    panic!("Timelock not ended");
                }

                if now > proposal.end_time + EXPIRY_WINDOW {
                    proposal.status = ProposalStatus::Expired;
                    env.storage()
                        .instance()
                        .set(&GovernanceDataKey::Proposal(proposal_id), &proposal);
                    env.events().publish(
                        (symbol_short!("govern"), symbol_short!("p_expired")),
                        (proposal_id, now),
                    );
                    panic!("Proposal expired");
                }

                proposal.status = ProposalStatus::Executed;
                env.storage()
                    .instance()
                    .set(&GovernanceDataKey::Proposal(proposal_id), &proposal);
                env.events().publish(
                    (symbol_short!("govern"), symbol_short!("executed")),
                    (proposal_id, now),
                );
            }
        }
    }

    pub fn get_proposal(env: &Env, proposal_id: u64) -> Proposal {
        env.storage()
            .instance()
            .get(&GovernanceDataKey::Proposal(proposal_id))
            .unwrap_or_else(|| panic!("Proposal not found"))
    }

    pub fn delegate(env: Env, from: Address, to: Address) {
        PauseUtils::require_not_paused(&env);
        from.require_auth();
        validate_non_zero_address(&env, &from);
        validate_non_zero_address(&env, &to);

        let from_clone = from.clone();
        env.storage()
            .instance()
            .set(&GovernanceDataKey::Delegate(from), &to);

        let now = env.ledger().timestamp();
        env.events().publish(
            (symbol_short!("govern"), symbol_short!("delegate")),
            (from_clone, to, now),
        );
    }

    pub fn get_delegate(env: &Env, voter: Address) -> Address {
        env.storage()
            .instance()
            .get(&GovernanceDataKey::Delegate(voter.clone()))
            .unwrap_or(voter)
    }

    pub fn deposit_to_treasury(env: Env, from: Address, amount: i128) {
        PauseUtils::require_not_paused(&env);
        let current: i128 = env
            .storage()
            .instance()
            .get(&GovernanceDataKey::TreasuryBalance)
            .unwrap_or(0);
        let new_balance = current + amount;
        env.storage()
            .instance()
            .set(&GovernanceDataKey::TreasuryBalance, &new_balance);

        let now = env.ledger().timestamp();
        env.events().publish(
            (symbol_short!("govern"), symbol_short!("deposit")),
            (from, amount, new_balance, now),
        );
    }

    pub fn withdraw_from_treasury(env: Env, amount: i128, recipient: Address) {
        // This should only be called by the contract itself during proposal execution
        PauseUtils::require_not_paused(&env);
        let current: i128 = env
            .storage()
            .instance()
            .get(&GovernanceDataKey::TreasuryBalance)
            .unwrap_or(0);
        if current < amount {
            panic!("Insufficient treasury funds");
        }
        let new_balance = current - amount;
        env.storage()
            .instance()
            .set(&GovernanceDataKey::TreasuryBalance, &new_balance);

        let now = env.ledger().timestamp();
        env.events().publish(
            (symbol_short!("govern"), symbol_short!("tr_withdr")),
            (recipient, amount, new_balance, now),
        );
    }

    fn integer_sqrt(n: i128) -> i128 {
        if n < 0 {
            return 0;
        }
        if n < 2 {
            return n;
        }
        let mut x = n / 2;
        let mut y = (x + n / x) / 2;
        while y < x {
            x = y;
            y = (x + n / x) / 2;
        }
        x
    }
}

// Free-function wrappers for contract entry points
pub fn create_proposal(
    env: Env,
    proposer: Address,
    title: String,
    description: String,
    action_data: Bytes,
    voting_period: u64,
    quorum: i128,
) -> u64 {
    Governance::create_proposal(
        env,
        proposer,
        title,
        description,
        action_data,
        voting_period,
        quorum,
    )
}

pub fn cast_vote(env: Env, voter: Address, proposal_id: u64, support: u32, voting_power: i128) {
    Governance::cast_vote(env, voter, proposal_id, support, voting_power)
}

pub fn execute_proposal(env: Env, proposal_id: u64) {
    Governance::execute_proposal(env, proposal_id)
}

pub fn get_proposal(env: &Env, proposal_id: u64) -> Proposal {
    Governance::get_proposal(env, proposal_id)
}

pub fn delegate(env: Env, from: Address, to: Address) {
    Governance::delegate(env, from, to)
}

pub fn get_delegate(env: &Env, voter: Address) -> Address {
    Governance::get_delegate(env, voter)
}
