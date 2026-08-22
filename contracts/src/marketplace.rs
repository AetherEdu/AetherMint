use crate::dynamic_fees::calculate_marketplace_fee;
use crate::utils::pause::PauseUtils;
use crate::utils::storage::StorageKey;
use soroban_sdk::{contracttype, symbol_short, Address, Env, String};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MarketplaceKey {
    Listing(u64),
    Escrow(u64),
    Rental(u64, Address),
    Stake(u64, Address),
    Dispute(u64),
    MarketplaceCount,
    ListingCount,
    EscrowCount,
    DisputeCount,
    TradeCount(u64),
    ItemListed(u64, u32),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ItemType {
    Credential = 0,
    Course = 1,
    NFT = 2,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Listing {
    pub credential_id: u64,
    pub seller: Address,
    pub price: u64,
    pub royalty_bps: u32,
    pub active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ItemListing {
    pub seller: Address,
    pub price: u64,
    pub item_id: u64,
    pub item_type: u32,
    pub status: u32,
    pub created_at: u64,
    pub updated_at: u64,
    pub escrow_id: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Escrow {
    pub listing_id: u64,
    pub buyer: Address,
    pub seller: Address,
    pub amount: u64,
    pub status: u32,
    pub created_at: u64,
    pub platform_fee: u64,
    pub seller_amount: u64,
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
    pub status: u32,
}

/// Calculate bonding curve price for a credential (placeholder)
fn calculate_bonding_price(_env: &Env, _credential_id: u64) -> u64 {
    100 // Default price placeholder
}

/// Initialize the marketplace
pub fn initialize(env: &Env, admin: &Address) {
    if env.storage().instance().has(&StorageKey::Admin) {
        panic!("Already initialized");
    }
    env.storage().instance().set(&StorageKey::Admin, admin);
    env.storage()
        .instance()
        .set(&MarketplaceKey::ListingCount, &0u64);
    env.storage()
        .instance()
        .set(&MarketplaceKey::EscrowCount, &0u64);
    env.storage()
        .instance()
        .set(&MarketplaceKey::DisputeCount, &0u64);
}

/// List a credential for sale with royalties
pub fn list_credential(
    env: &Env,
    seller: &Address,
    credential_id: u64,
    price: u64,
    royalty_bps: u32,
) -> u64 {
    PauseUtils::require_not_paused(env);
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
        (listing_id, credential_id, seller.clone(), price),
    );

    listing_id
}

/// List a generic item for sale
pub fn list_item(env: &Env, seller: &Address, item_id: u64, item_type: u32, price: u64) -> u64 {
    if item_type > 2 {
        panic!("Invalid item type");
    }
    if price == 0 {
        panic!("Price cannot be zero");
    }

    let dup_key = MarketplaceKey::ItemListed(item_id, item_type);
    if env.storage().instance().has(&dup_key) {
        panic!("Item already listed");
    }

    let listing_id = env
        .storage()
        .instance()
        .get(&MarketplaceKey::ListingCount)
        .unwrap_or(0u64)
        + 1;

    let now = env.ledger().timestamp();

    let listing = ItemListing {
        seller: seller.clone(),
        price,
        item_id,
        item_type,
        status: 0,
        created_at: now,
        updated_at: now,
        escrow_id: 0,
    };

    env.storage()
        .instance()
        .set(&MarketplaceKey::Listing(listing_id), &listing);
    env.storage()
        .instance()
        .set(&MarketplaceKey::ListingCount, &listing_id);
    env.storage().instance().set(&dup_key, &true);

    env.events().publish(
        (symbol_short!("market"), symbol_short!("listed")),
        (listing_id, item_id, seller.clone(), price),
    );

    listing_id
}

/// Purchase a listed credential
pub fn purchase_credential(env: &Env, buyer: &Address, listing_id: u64) {
    PauseUtils::require_not_paused(env);
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
        (listing_id, buyer.clone(), seller_amount, royalty_amount),
    );
}

/// Licensing: Rent a credential for a specific duration
pub fn rent_credential(env: &Env, tenant: &Address, credential_id: u64, duration: u64) {
    PauseUtils::require_not_paused(env);
    tenant.require_auth();

    let price = calculate_bonding_price(env, credential_id);
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
        (credential_id, tenant.clone(), expiry, price),
    );
}

/// Buy an item — transfers ownership with escrow holding funds
pub fn buy_item(env: &Env, buyer: &Address, listing_id: u64) {
    buyer.require_auth();

    let mut listing: ItemListing = env
        .storage()
        .instance()
        .get(&MarketplaceKey::Listing(listing_id))
        .unwrap_or_else(|| panic!("Listing not found"));

    if listing.seller == *buyer {
        panic!("Cannot buy your own item");
    }
    if listing.status == 1 {
        panic!("Item already sold");
    }
    if listing.status != 0 {
        panic!("Listing is not active");
    }

    let escrow_id = env
        .storage()
        .instance()
        .get(&MarketplaceKey::EscrowCount)
        .unwrap_or(0u64)
        + 1;

    let platform_fee =
        calculate_marketplace_fee(env.clone(), listing.seller.clone(), listing.price);

    let seller_amount = listing.price - platform_fee;

    let now = env.ledger().timestamp();

    let escrow = Escrow {
        listing_id,
        buyer: buyer.clone(),
        seller: listing.seller.clone(),
        amount: listing.price,
        status: 0,
        created_at: now,
        platform_fee,
        seller_amount,
    };

    listing.status = 1;
    listing.updated_at = now;
    listing.escrow_id = escrow_id;

    env.storage()
        .instance()
        .set(&MarketplaceKey::Listing(listing_id), &listing);
    env.storage()
        .instance()
        .set(&MarketplaceKey::Escrow(escrow_id), &escrow);
    env.storage()
        .instance()
        .set(&MarketplaceKey::EscrowCount, &escrow_id);

    let trade_count: u64 = env
        .storage()
        .instance()
        .get(&MarketplaceKey::TradeCount(listing.item_id))
        .unwrap_or(0);
    env.storage().instance().set(
        &MarketplaceKey::TradeCount(listing.item_id),
        &(trade_count + 1),
    );

    env.events().publish(
        (symbol_short!("market"), symbol_short!("purchased")),
        (listing_id, buyer.clone(), escrow_id, listing.price),
    );
}

/// Cancel an active listing by the seller
pub fn cancel_listing(env: &Env, seller: &Address, listing_id: u64) {
    seller.require_auth();

    let mut listing: ItemListing = env
        .storage()
        .instance()
        .get(&MarketplaceKey::Listing(listing_id))
        .unwrap_or_else(|| panic!("Listing not found"));

    if listing.seller != *seller {
        panic!("Only the seller can cancel");
    }
    if listing.status != 0 {
        panic!("Listing is not active");
    }

    listing.status = 2;
    listing.updated_at = env.ledger().timestamp();

    env.storage()
        .instance()
        .set(&MarketplaceKey::Listing(listing_id), &listing);

    let dup_key = MarketplaceKey::ItemListed(listing.item_id, listing.item_type);
    env.storage().instance().remove(&dup_key);
}

/// Staking: Stake a credential for verification rewards
pub fn stake_credential(env: &Env, staker: &Address, credential_id: u64, amount: u64) {
    PauseUtils::require_not_paused(env);
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
        (credential_id, staker.clone(), amount),
    );
}

/// Claim staking rewards based on reputation
pub fn claim_rewards(env: &Env, staker: &Address, credential_id: u64) -> u64 {
    PauseUtils::require_not_paused(env);
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
        (staker.clone(), total_reward),
    );

    total_reward
}

/// Automated Dispute Resolution: Open a dispute
pub fn open_dispute(env: &Env, buyer: &Address, listing_id: u64, reason: String) -> u64 {
    PauseUtils::require_not_paused(env);
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
        (dispute_id, listing_id, buyer.clone()),
    );

    dispute_id
}

/// Resolve a dispute (Admin only)
pub fn resolve_dispute(env: &Env, admin: &Address, dispute_id: u64, resolved: bool) {
    PauseUtils::require_not_paused(env);
    admin.require_auth();

    let stored_admin: Address = env
        .storage()
        .instance()
        .get(&StorageKey::Admin)
        .unwrap_or_else(|| panic!("Admin not set"));

    if *admin != stored_admin {
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

/// Release escrow funds to the seller after successful transfer.
pub fn release_escrow(env: &Env, listing_id: u64) {
    let escrow_id = env
        .storage()
        .instance()
        .get::<_, u64>(&symbol_short!("esc_cnt"))
        .unwrap_or(1);

    let mut escrow: Escrow = env
        .storage()
        .instance()
        .get(&MarketplaceKey::Escrow(escrow_id))
        .unwrap_or_else(|| panic!("Escrow not found"));

    if escrow.status != 0 {
        panic!("Escrow already processed");
    }

    escrow.status = 1; // Released
    env.storage()
        .instance()
        .set(&MarketplaceKey::Escrow(escrow_id), &escrow);

    env.events().publish(
        (symbol_short!("market"), symbol_short!("release")),
        (listing_id, escrow_id),
    );
}

/// Refund escrow to buyer on dispute or cancellation.
pub fn refund_escrow(env: &Env, listing_id: u64) {
    let escrow_id = env
        .storage()
        .instance()
        .get::<_, u64>(&symbol_short!("esc_cnt"))
        .unwrap_or(1);

    let mut escrow: Escrow = env
        .storage()
        .instance()
        .get(&MarketplaceKey::Escrow(escrow_id))
        .unwrap_or_else(|| panic!("Escrow not found"));

    if escrow.status != 0 {
        panic!("Escrow already processed");
    }

    escrow.status = 2; // Refunded
    env.storage()
        .instance()
        .set(&MarketplaceKey::Escrow(escrow_id), &escrow);

    env.events().publish(
        (symbol_short!("market"), symbol_short!("refund")),
        (listing_id, escrow_id),
    );
}

/// Get listing details by ID.
pub fn get_listing(env: &Env, listing_id: u64) -> ItemListing {
    env.storage()
        .instance()
        .get(&MarketplaceKey::Listing(listing_id))
        .unwrap_or_else(|| panic!("Listing not found"))
}

/// Get escrow details by ID.
pub fn get_escrow(env: &Env, escrow_id: u64) -> Escrow {
    env.storage()
        .instance()
        .get(&MarketplaceKey::Escrow(escrow_id))
        .unwrap_or_else(|| panic!("Escrow not found"))
}

/// Escrow: Initiate a secure transaction with time-lock
pub fn initiate_escrow(env: &Env, buyer: &Address, listing_id: u64, timeout: u64) -> u64 {
    PauseUtils::require_not_paused(env);
    buyer.require_auth();

    // Logical escrow ID
    let escrow_id = env
        .storage()
        .instance()
        .get::<_, u64>(&symbol_short!("esc_cnt"))
        .unwrap_or(0)
        + 1;
    env.storage()
        .instance()
        .set(&symbol_short!("esc_cnt"), &escrow_id);

    let release_time = env.ledger().timestamp() + timeout;
    env.storage()
        .instance()
        .set(&symbol_short!("escrow_t"), &release_time);

    env.events().publish(
        (symbol_short!("market"), symbol_short!("escrow")),
        (escrow_id, buyer.clone(), listing_id, release_time),
    );

    escrow_id
}
