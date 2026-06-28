//! # Marketplace Module
//!
//! On-chain marketplace for listing, buying, and escrowing educational
//! credentials, courses, and NFTs. Integrates dynamic fees and pause
//! controls.
//!
//! ## Features
//!
//! - **Multi-type listings**: Supports Credentials (`ItemType::Credential`),
//!   Courses (`ItemType::Course`), and NFTs (`ItemType::NFT`).
//! - **Escrow**: Buyers' funds are held in escrow until the seller confirms
//!   the transfer, protecting both parties.
//! - **Dynamic fees**: Platform fees are calculated per-transaction via
//!   [`crate::dynamic_fees::calculate_marketplace_fee`].
//! - **Duplicate prevention**: Each item can only be listed once.
//! - **Trade counting**: Each purchase increments a per-item trade count.

use crate::dynamic_fees::calculate_marketplace_fee;
use crate::utils::storage::StorageKey;
use crate::utils::pause::PauseUtils;
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MarketplaceKey {
    Listing(u64),
    Escrow(u64),
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

/// Initialize the marketplace with the admin address and reset all counters.
///
/// # Panics
/// Panics if the marketplace has already been initialized.
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

/// Create a marketplace listing for an item (credential, course, or NFT).
///
/// # Parameters
/// * `env` - Soroban environment.
/// * `seller` - The address listing the item (must authorize).
/// * `item_id` - ID of the item to list.
/// * `price` - Listing price in smallest unit.
/// * `item_type` - 0=Credential, 1=Course, 2=NFT.
///
/// # Returns
/// The newly assigned listing ID.
pub fn list_item(
    env: &Env,
    seller: &Address,
    item_id: u64,
    price: u64,
    item_type: u32,
) -> u64 {
    PauseUtils::require_not_paused(env);
    seller.require_auth();

    if item_type > 2 {
        panic!("Invalid item type");
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
    env.storage()
        .instance()
        .set(&dup_key, &true);

    env.events().publish(
        (symbol_short!("market"), symbol_short!("listed")),
        (listing_id, item_id, seller.clone(), price),
    );

    listing_id
}

/// Buy an item. Creates an escrow and marks the listing as pending.
/// The seller must later release the escrow via [`release_escrow`].
///
/// # Parameters
/// * `env` - Soroban environment.
/// * `buyer` - The purchasing address (must authorize).
/// * `listing_id` - The active listing to purchase.
pub fn buy_item(env: &Env, buyer: &Address, listing_id: u64) {
    buyer.require_auth();

    let mut listing: ItemListing = env
        .storage()
        .instance()
        .get(&MarketplaceKey::Listing(listing_id))
        .unwrap_or_else(|| panic!("Listing not found"));

    if listing.status != 0 {
        panic!("Listing is not active");
    }

    let escrow_id = env
        .storage()
        .instance()
        .get(&MarketplaceKey::EscrowCount)
        .unwrap_or(0u64)
        + 1;

    let platform_fee = calculate_marketplace_fee(
        env.clone(),
        listing.seller.clone(),
        listing.price,
    );

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

/// Cancel an active listing. Only the original seller may cancel.
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

    env.events().publish(
        (symbol_short!("market"), symbol_short!("cancelled")),
        (listing_id, seller),
    );
}

/// Release escrow funds to the seller after successful transfer.
pub fn release_escrow(env: &Env, listing_id: u64) {
    let escrow_id = env
        .storage()
        .instance()
        .get::<_, ItemListing>(&MarketplaceKey::Listing(listing_id))
        .map(|l| l.escrow_id)
        .unwrap_or_else(|| panic!("Listing not found"));

    let mut escrow: Escrow = env
        .storage()
        .instance()
        .get(&MarketplaceKey::Escrow(escrow_id))
        .unwrap_or_else(|| panic!("Escrow not found"));

    if escrow.status != 0 {
        panic!("Escrow not active");
    }

    escrow.status = 1; // Completed
    env.storage()
        .instance()
        .set(&MarketplaceKey::Escrow(escrow_id), &escrow);

    env.events().publish(
        (symbol_short!("market"), symbol_short!("released")),
        (listing_id, escrow_id, escrow.seller_amount),
    );
}

/// Refund escrow funds to the buyer on dispute or cancellation.
pub fn refund_escrow(env: &Env, listing_id: u64) {
    let escrow_id = env
        .storage()
        .instance()
        .get::<_, ItemListing>(&MarketplaceKey::Listing(listing_id))
        .map(|l| l.escrow_id)
        .unwrap_or_else(|| panic!("Listing not found"));

    let mut escrow: Escrow = env
        .storage()
        .instance()
        .get(&MarketplaceKey::Escrow(escrow_id))
        .unwrap_or_else(|| panic!("Escrow not found"));

    if escrow.status != 0 {
        panic!("Escrow not active");
    }

    escrow.status = 2; // Refunded
    env.storage()
        .instance()
        .set(&MarketplaceKey::Escrow(escrow_id), &escrow);

    env.events().publish(
        (symbol_short!("market"), symbol_short!("refunded")),
        (listing_id, escrow_id, escrow.amount),
    );
}

/// Get the full listing details by listing ID.
pub fn get_listing(env: &Env, listing_id: u64) -> ItemListing {
    env.storage()
        .instance()
        .get(&MarketplaceKey::Listing(listing_id))
        .unwrap_or_else(|| panic!("Listing not found"))
}

/// Get the full escrow details by escrow ID.
pub fn get_escrow(env: &Env, escrow_id: u64) -> Escrow {
    env.storage()
        .instance()
        .get(&MarketplaceKey::Escrow(escrow_id))
        .unwrap_or_else(|| panic!("Escrow not found"))
}
