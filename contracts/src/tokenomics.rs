use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TokenomicsKey {
    TokenBalance(Address, u32), // Address, TokenType (0: Reward, 1: Governance, 2: Utility)
    TotalSupply(u32),
    StakePool(Address),
    StakePoolTotal,
    Proposal(u64),
    ProposalVote(u64, Address),
    ProposalCount,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Stake {
    pub staker: Address,
    pub amount: u64,
    pub start_time: u64,
    pub lock_duration: u64,
    pub apy_bps: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Proposal {
    pub id: u64,
    pub creator: Address,
    pub title: String,
    pub description: String,
    pub votes_for: u64,
    pub votes_against: u64,
    pub end_time: u64,
    pub status: u32, // 0: Open, 1: Passed, 2: Rejected, 3: Executed
}

// Contract attributes disabled - see lib.rs for main contract
// #[contract]
pub struct TokenomicsContract;

#[contractimpl]
impl TokenomicsContract {
    /// Initialize tokenomics system
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        env.storage()
            .instance()
            .set(&TokenomicsKey::ProposalCount, &0u64);
        env.storage().instance().set(&TokenomicsKey::StakePoolTotal, &0u64);
    }

    /// Distribute rewards for learning achievements
    pub fn mint_reward(env: Env, recipient: Address, amount: u64) {
        // In a real system, the caller would be the Proctoring or Course contract
        // recipient.require_auth(); // No auth needed as we are the "minter" or we'd check admin
        
        let token_type = 0u32; // Reward Token
        let balance = Self::get_token_balance(env.clone(), recipient.clone(), token_type);
        env.storage()
            .persistent()
            .set(&TokenomicsKey::TokenBalance(recipient.clone(), token_type), &(balance + amount));

        let total_supply = env.storage().instance().get::<_, u64>(&TokenomicsKey::TotalSupply(token_type)).unwrap_or(0);
        env.storage().instance().set(&TokenomicsKey::TotalSupply(token_type), &(total_supply + amount));

        env.events().publish(
            (symbol_short!("token"), symbol_short!("mint")),
            (recipient, amount, token_type),
        );
    }

    /// Stake tokens for course quality / platform rewards
    pub fn stake_tokens(env: Env, staker: Address, amount: u64, lock_duration: u64) {
        staker.require_auth();

        // Burn or transfer reward tokens to the stake pool
        let balance = Self::get_token_balance(env.clone(), staker.clone(), 0u32);
        if balance < amount {
            panic!("Insufficient balance");
        }

        env.storage()
            .persistent()
            .set(&TokenomicsKey::TokenBalance(staker.clone(), 0u32), &(balance - amount));

        // Variable APY based on lock duration (simplified)
        // 1 week: 5% (500 bps), 1 month: 10% (1000 bps), 1 year: 50% (5000 bps)
        let apy_bps = if lock_duration >= 31536000 { 5000 }
                      else if lock_duration >= 2592000 { 1000 }
                      else if lock_duration >= 604800 { 500 }
                      else { 100 };

        let stake = Stake {
            staker: staker.clone(),
            amount,
            start_time: env.ledger().timestamp(),
            lock_duration,
            apy_bps,
        };

        env.storage().persistent().set(&TokenomicsKey::StakePool(staker.clone()), &stake);
        
        let pool_total: u64 = env.storage().instance().get(&TokenomicsKey::StakePoolTotal).unwrap_or(0);
        env.storage().instance().set(&TokenomicsKey::StakePoolTotal, &(pool_total + amount));

        env.events().publish(
            (symbol_short!("token"), symbol_short!("stake")),
            (staker, amount, lock_duration),
        );
    }

    /// Claim rewards from staking
    pub fn unstake_and_claim(env: Env, staker: Address) {
        staker.require_auth();

        let stake: Stake = env.storage().persistent().get(&TokenomicsKey::StakePool(staker.clone())).unwrap_or_else(|| panic!("No stake found"));

        let now = env.ledger().timestamp();
        if now < (stake.start_time + stake.lock_duration) {
            panic!("Lock duration not met");
        }

        let time_elapsed = now - stake.start_time;
        // Reward = amount * APY * (time / year)
        let reward = (stake.amount as u128 * stake.apy_bps as u128 * time_elapsed as u128 / (31536000 * 10000)) as u64;

        let total_return = stake.amount + reward;
        
        // Mint reward tokens and give back original stake (simplified)
        let balance = Self::get_token_balance(env.clone(), staker.clone(), 0u32);
        env.storage()
            .persistent()
            .set(&TokenomicsKey::TokenBalance(staker.clone(), 0u32), &(balance + total_return));

        env.storage().persistent().remove(&TokenomicsKey::StakePool(staker.clone()));

        let pool_total: u64 = env.storage().instance().get(&TokenomicsKey::StakePoolTotal).unwrap_or(0);
        env.storage().instance().set(&TokenomicsKey::StakePoolTotal, &(pool_total - stake.amount));

        env.events().publish(
            (symbol_short!("token"), symbol_short!("unstake")),
            (staker, total_return),
        );
    }

    /// Quadratic Voting for Governance Proposals
    pub fn vote_on_proposal(env: Env, voter: Address, proposal_id: u64, votes_power: u64, approve: bool) {
        voter.require_auth();

        let gov_balance = Self::get_token_balance(env.clone(), voter.clone(), 1u32); // Governance token
        let cost = votes_power * votes_power; // Quadratic cost
        
        if gov_balance < cost {
            panic!("Insufficient governance tokens for this power");
        }

        // Deduct/Burn (Simplified)
        env.storage()
            .persistent()
            .set(&TokenomicsKey::TokenBalance(voter.clone(), 1u32), &(gov_balance - cost));

        let mut proposal: Proposal = env.storage().instance().get(&TokenomicsKey::Proposal(proposal_id)).unwrap_or_else(|| panic!("Proposal not found"));

        if approve {
            proposal.votes_for += votes_power;
        } else {
            proposal.votes_against += votes_power;
        }

        env.storage().instance().set(&TokenomicsKey::Proposal(proposal_id), &proposal);

        env.events().publish(
            (symbol_short!("token"), symbol_short!("vote")),
            (proposal_id, voter, votes_power),
        );
    }

    /// Create a new proposal
    pub fn create_proposal(env: Env, creator: Address, title: String, description: String, duration_seconds: u64) -> u64 {
        creator.require_auth();

        let id = env.storage().instance().get::<_, u64>(&TokenomicsKey::ProposalCount).unwrap_or(0) + 1;
        let proposal = Proposal {
            id,
            creator,
            title,
            description,
            votes_for: 0,
            votes_against: 0,
            end_time: env.ledger().timestamp() + duration_seconds,
            status: 0u32,
        };

        env.storage().instance().set(&TokenomicsKey::Proposal(id), &proposal);
        env.storage().instance().set(&TokenomicsKey::ProposalCount, &id);

        id
    }

    pub fn get_token_balance(env: Env, user: Address, token_type: u32) -> u64 {
        env.storage()
            .persistent()
            .get(&TokenomicsKey::TokenBalance(user, token_type))
            .unwrap_or(0)
    }

    pub fn total_supply(env: Env, token_type: u32) -> u64 {
        env.storage().instance().get(&TokenomicsKey::TotalSupply(token_type)).unwrap_or(0)
    }
}
