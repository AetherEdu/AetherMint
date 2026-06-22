use crate::utils::storage::StorageKey;
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MarketplaceKey {
    Listing(u64),
    Rental(u64, Address),
    Stake(u64, Address),
    Dispute(u64),
    MarketplaceCount,
    ListingCount,
    DisputeCount,
    TradeCount(u64), // Trade count per credential for bonding curve
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Listing {
    pub credential_id: u64,
    pub seller: Address,
    pub price: u64,
    pub royalty_bps: u32, // Basis points (100 = 1%)
    pub active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Rental {
    pub credential_id: u64,
    pub tenant: Address,
    pub expiry: u64,
    pub price: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Stake {
    pub credential_id: u64,
    pub staker: Address,
    pub amount: u64,
    pub start_time: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Dispute {
    pub id: u64,
    pub listing_id: u64,
    pub buyer: Address,
    pub reason: String,
    pub status: u32, // 0: Open, 1: Resolved, 2: Cancelled
}

// Contract attribute disabled - this is a module used by main contract in lib.rs
// #[contract]
pub struct MarketplaceContract;

#[contractimpl]
impl MarketplaceContract {
    /// Initialize the marketplace
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&StorageKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&StorageKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&MarketplaceKey::ListingCount, &0u64);
        env.storage()
            .instance()
            .set(&MarketplaceKey::DisputeCount, &0u64);
    }

    /// List a credential for sale with royalties
    pub fn list_credential(
        env: Env,
        seller: Address,
        credential_id: u64,
        price: u64,
        royalty_bps: u32,
    ) -> u64 {
        seller.require_auth();

        // Ensure royalty is reasonable (max 30%)
        if royalty_bps > 3000 {
            panic!("Royalty too high");
        }

        let listing_id = env
            .storage()
            .instance()
            .get(&MarketplaceKey::ListingCount)
            .unwrap_or(0u64)
            + 1;

        let listing = Listing {
            credential_id,
            seller: seller.clone(),
            price,
            royalty_bps,
            active: true,
        };

        env.storage()
            .instance()
            .set(&MarketplaceKey::Listing(listing_id), &listing);
        env.storage()
            .instance()
            .set(&MarketplaceKey::ListingCount, &listing_id);

        env.events().publish(
            (symbol_short!("market"), symbol_short!("listed")),
            (listing_id, credential_id, seller, price),
        );

        listing_id
    }

    /// Purchase a listed credential
    pub fn purchase_credential(env: Env, buyer: Address, listing_id: u64) {
        buyer.require_auth();

        let mut listing: Listing = env
            .storage()
            .instance()
            .get(&MarketplaceKey::Listing(listing_id))
            .unwrap_or_else(|| panic!("Listing not found"));

        if !listing.active {
            panic!("Listing is inactive");
        }

        // Logic for transferring tokens should go here (using a token contract)
        // For this implementation, we focus on state changes and royalty math

        let royalty_amount = (listing.price as u128 * listing.royalty_bps as u128 / 10000) as u64;
        let seller_amount = listing.price - royalty_amount;

        // Mark listing as sold
        listing.active = false;
        env.storage()
            .instance()
            .set(&MarketplaceKey::Listing(listing_id), &listing);

        // Update trade count for bonding curve price discovery
        let trade_count: u64 = env
            .storage()
            .instance()
            .get(&MarketplaceKey::TradeCount(listing.credential_id))
            .unwrap_or(0);
        env.storage().instance().set(
            &MarketplaceKey::TradeCount(listing.credential_id),
            &(trade_count + 1),
        );

        env.events().publish(
            (symbol_short!("market"), symbol_short!("sold")),
            (listing_id, buyer, seller_amount, royalty_amount),
        );
    }

    /// Licensing: Rent a credential for a specific duration
    pub fn rent_credential(env: Env, tenant: Address, credential_id: u64, duration: u64) {
        tenant.require_auth();

        let price = Self::calculate_bonding_price(env.clone(), credential_id);
        let expiry = env.ledger().timestamp() + duration;

        let rental = Rental {
            credential_id,
            tenant: tenant.clone(),
            expiry,
            price,
        };

        env.storage().instance().set(
            &MarketplaceKey::Rental(credential_id, tenant.clone()),
            &rental,
        );

        env.events().publish(
            (symbol_short!("market"), symbol_short!("rented")),
            (credential_id, tenant, expiry, price),
        );
    }

    /// Bonding curve logic for price discovery
    /// Price = BasePrice + (Slope * Trades^2)
    pub fn calculate_bonding_price(env: Env, credential_id: u64) -> u64 {
        let base_price = 100u64; // Minimum price
        let slope = 10u64;

        let trades: u64 = env
            .storage()
            .instance()
            .get(&MarketplaceKey::TradeCount(credential_id))
            .unwrap_or(0);

        base_price + slope * trades * trades
    }

    /// Staking: Stake a credential for verification rewards
    pub fn stake_credential(env: Env, staker: Address, credential_id: u64, amount: u64) {
        staker.require_auth();

        let stake = Stake {
            credential_id,
            staker: staker.clone(),
            amount,
            start_time: env.ledger().timestamp(),
        };

        env.storage().instance().set(
            &MarketplaceKey::Stake(credential_id, staker.clone()),
            &stake,
        );

        env.events().publish(
            (symbol_short!("stake"), symbol_short!("staked")),
            (credential_id, staker, amount),
        );
    }

    /// Claim staking rewards based on reputation
    pub fn claim_rewards(env: Env, staker: Address, credential_id: u64) -> u64 {
        staker.require_auth();

        let stake: Stake = env
            .storage()
            .instance()
            .get(&MarketplaceKey::Stake(credential_id, staker.clone()))
            .unwrap_or_else(|| panic!("No stake found"));

        let now = env.ledger().timestamp();
        let duration = now - stake.start_time;

        // Reward = Amount * Duration * RewardRate
        // Basic reward rate: 1% per day (86400 seconds)
        let base_reward = (stake.amount as u128 * duration as u128 / 8640000) as u64;

        // Reputation bonus (hypothetical integration)
        // In a real system, we'd call the UserProfileContract
        let reputation_bonus = 100; // placeholder for +10% bonus
        let total_reward = base_reward + (base_reward * reputation_bonus / 1000);

        // Reset stake time
        let mut new_stake = stake;
        new_stake.start_time = now;
        env.storage().instance().set(
            &MarketplaceKey::Stake(credential_id, staker.clone()),
            &new_stake,
        );

        env.events().publish(
            (symbol_short!("stake"), symbol_short!("claimed")),
            (staker, total_reward),
        );

        total_reward
    }

    /// Automated Dispute Resolution: Open a dispute
    pub fn open_dispute(env: Env, buyer: Address, listing_id: u64, reason: String) -> u64 {
        buyer.require_auth();

        let dispute_id = env
            .storage()
            .instance()
            .get(&MarketplaceKey::DisputeCount)
            .unwrap_or(0u64)
            + 1;

        let dispute = Dispute {
            id: dispute_id,
            listing_id,
            buyer: buyer.clone(),
            reason,
            status: 0, // Open
        };

        env.storage()
            .instance()
            .set(&MarketplaceKey::Dispute(dispute_id), &dispute);
        env.storage()
            .instance()
            .set(&MarketplaceKey::DisputeCount, &dispute_id);

        env.events().publish(
            (symbol_short!("dispute"), symbol_short!("opened")),
            (dispute_id, listing_id, buyer),
        );

        dispute_id
    }

    /// Resolve a dispute (Admin only)
    pub fn resolve_dispute(env: Env, admin: Address, dispute_id: u64, resolved: bool) {
        admin.require_auth();

        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&StorageKey::Admin)
            .unwrap_or_else(|| panic!("Admin not set"));

        if admin != stored_admin {
            panic!("Unauthorized");
        }

        let mut dispute: Dispute = env
            .storage()
            .instance()
            .get(&MarketplaceKey::Dispute(dispute_id))
            .unwrap_or_else(|| panic!("Dispute not found"));

        dispute.status = if resolved { 1 } else { 2 };
        env.storage()
            .instance()
            .set(&MarketplaceKey::Dispute(dispute_id), &dispute);

        env.events().publish(
            (symbol_short!("dispute"), symbol_short!("resolved")),
            (dispute_id, dispute.status),
        );
    }

    /// Escrow: Initiate a secure transaction with time-lock
    pub fn initiate_escrow(env: Env, buyer: Address, listing_id: u64, timeout: u64) -> u64 {
        buyer.require_auth();
        
        // Logical escrow ID
        let escrow_id = env.storage().instance().get::<_, u64>(&symbol_short!("esc_cnt")).unwrap_or(0) + 1;
        env.storage().instance().set(&symbol_short!("esc_cnt"), &escrow_id);
        
        let release_time = env.ledger().timestamp() + timeout;
        env.storage().instance().set(&symbol_short!("escrow_t"), &release_time);
        
        env.events().publish(
            (symbol_short!("market"), symbol_short!("escrow")),
            (escrow_id, buyer, listing_id, release_time),
        );
        
        escrow_id
    }
}
