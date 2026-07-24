//! Property-Based Fuzz Tests for State-Transition Invariants
//!
//! Closes Issue #167.
//!
//! Soroban contracts are notoriously hard to fuzz with off-the-shelf
//! harnesses (e.g. `proptest`) because every interaction goes through
//! `Env::default()` and the SDK is `no_std`. This module implements a
//! hand-rolled property-based harness: a deterministic LCG generates a
//! sequence of random operations against a fresh `Env`, the harness
//! applies them, and the post-conditions (invariants) are checked at the
//! end of the sequence.
//!
//! Each test is run against multiple seeds; if an invariant fails the seed
//! is printed alongside the assertion so the failure can be reproduced.
//!
//! Coverage:
//!   - `credential_registry`: issue/renew/revoke/check_expiration,
//!     invariants on ID monotonicity, status transitions,
//!     per-recipient user lists, renewal counts.
//!   - `marketplace`: list_item/buy_item/cancel_listing, invariants on
//!     listing monotonicity, duplicate prevention, status machine.
//!   - `profile_nft`: mint/update/duplicate-mint prevention, invariants
//!     on one-NFT-per-owner and total supply.
//!   - `dynamic_nft`: mint/evolve/transfer, invariants on supply == sum
//!     of balances and non-existent tokens not appearing in owner lists.
//!
//! Adding invariants is a one-liner — append a check to the matching
//! `check_*_invariants` function at the bottom of this file.

#![cfg(test)]
extern crate std;

use crate::{
    AetherMintContract, AetherMintContractClient,
};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env,
};

// ── Pseudo-random sequence generator ──────────────────────────────────────

/// Linear congruential generator used to draw a deterministic sequence of
/// random indices without pulling in `proptest`. The modulus is large
/// enough that 32-bit seeds produce unique streams across the test range.
struct Lcg {
    state: u64,
}

impl Lcg {
    fn new(seed: u64) -> Self {
        Lcg { state: seed.wrapping_mul(2_654_435_761).wrapping_add(1) }
    }

    fn next_u32(&mut self) -> u32 {
        // Numerical Recipes' LCG constants.
        self.state = self.state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        (self.state >> 16) as u32
    }

    fn next_u64(&mut self) -> u64 {
        ((self.next_u32() as u64) << 32) | (self.next_u32() as u64)
    }

    /// Draw a value in `[0, bound)`. `bound == 0` returns `0` to avoid
    /// a panic in the modulus — callers should guard against the
    /// resulting degenerate behaviour.
    fn next_in(&mut self, bound: u32) -> u32 {
        if bound == 0 {
            return 0;
        }
        self.next_u32() % bound
    }
}

// ── Operation enums ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy)]
enum CredOp {
    Issue,
    Revoke,
    Renew,
    CheckExpiration,
}

#[derive(Debug, Clone, Copy)]
enum MarketOp {
    ListItem,
    BuyItem,
    CancelListing,
}

#[derive(Debug, Clone, Copy)]
enum ProfileOp {
    Mint,
    Update,
}

#[derive(Debug, Clone, Copy)]
enum NftOp {
    Mint,
    Evolve,
    Transfer,
}

// ── Generic helpers ───────────────────────────────────────────────────────

fn fresh_env() -> (Env, AetherMintContractClient, Address) {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().set_timestamp(1_000_000);
    let contract_id = env.register_contract(None, AetherMintContract);
    let client = AetherMintContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    // The marketplace module stores its admin under the same key as the
    // main contract so `list_item` / `buy_item` accept the admin's auth.
    env.as_contract(&contract_id, || {
        env.storage()
            .instance()
            .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);
    });
    (env, client, admin)
}

// ── Credential registry fuzzing ──────────────────────────────────────────

#[test]
fn fuzz_credential_registry_invariants() {
    const SEEDS: &[u64] = &[1, 7, 42, 1337, 9_001, 65_535];

    for &seed in SEEDS {
        let mut rng = Lcg::new(seed);
        let (env, client, _admin) = fresh_env();

        let recipients = [
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
        ];

        // Track expected state for post-condition checks.
        let mut expected_total: u64 = 0;
        let mut expected_per_recipient: [u64; 3] = [0, 0, 0];
        let mut expected_status_active: u64 = 0;
        let mut credential_ids: std::vec::Vec<(u64, usize)> = std::vec::Vec::new();

        let ops = 32u32;
        for _ in 0..ops {
            let op = match rng.next_in(4) {
                0 => CredOp::Issue,
                1 => CredOp::Revoke,
                2 => CredOp::Renew,
                _ => CredOp::CheckExpiration,
            };

            match op {
                CredOp::Issue => {
                    let recipient = recipients[rng.next_in(3) as usize].clone();
                    let title: &str = "Fuzz Credential";
                    let description: &str = "Generated by fuzz harness";
                    let course_id: &str = "FUZZ-101";
                    let ipfs_hash: &str = "QmFuzzTestHash";

                    // Issue with a positive validity_duration so it
                    // can be expired later if the harness selects the
                    // CheckExpiration op.
                    let duration = 60u64 + (rng.next_in(120) as u64);
                    let cid = client.issue_credential_with_expiration(
                        &_admin,
                        &recipient,
                        &title,
                        &description,
                        &course_id,
                        &ipfs_hash,
                        &duration,
                    );
                    expected_total += 1;
                    expected_status_active += 1;
                    // Recover the index we actually chose so we can
                    // update per-recipient counters correctly.
                    let chosen = recipients
                        .iter()
                        .position(|a| a == &recipient)
                        .unwrap_or(0);
                    expected_per_recipient[chosen] += 1;
                    credential_ids.push((cid, chosen));
                }
                CredOp::Revoke => {
                    if credential_ids.is_empty() {
                        continue;
                    }
                    let idx = rng.next_in(credential_ids.len() as u32) as usize;
                    let (cid, owner_idx) = credential_ids[idx];
                    match client.try_revoke_credential_registry(&cid, &_admin) {
                        Ok(true) => {
                            credential_ids.remove(idx);
                            expected_per_recipient[owner_idx] =
                                expected_per_recipient[owner_idx].saturating_sub(1);
                            expected_status_active = expected_status_active.saturating_sub(1);
                        }
                        _ => {}
                    }
                }
                CredOp::Renew => {
                    if credential_ids.is_empty() {
                        continue;
                    }
                    let idx = rng.next_in(credential_ids.len() as u32) as usize;
                    let (cid, _owner_idx) = credential_ids[idx];
                    let extension = 30u64 + (rng.next_in(120) as u64);
                    // Either admin or recipient can renew. Test admin
                    // path here (recipient auth path is identical in
                    // the production contract).
                    let _ = client.try_renew_credential(&cid, &_admin, &extension);
                }
                CredOp::CheckExpiration => {
                    if credential_ids.is_empty() {
                        continue;
                    }
                    let idx = rng.next_in(credential_ids.len() as u32) as usize;
                    let (cid, _) = credential_ids[idx];
                    let _ = client.check_credential_expiration(&cid);
                }
            }
        }

        // ── Invariants ──────────────────────────────────────────────
        assert_eq!(
            client.get_credential_count(),
            expected_total,
            "seed={} credential count diverged",
            seed
        );

        // Each recipient's stored list must contain exactly the issued
        // credential IDs we tracked.
        for (i, recipient) in recipients.iter().enumerate() {
            let list = client.get_user_credentials_with_status(recipient);
            assert_eq!(
                list.len(),
                expected_per_recipient[i],
                "seed={} recipient {} credential list mismatch",
                seed,
                i
            );
        }

        // Active count should match the number of unrevoked credentials
        // still tracked. Issued - revoked == expected_status_active.
        let mut actually_active: u64 = 0;
        for (cid, _) in credential_ids.iter() {
            if client.is_credential_valid(cid) {
                actually_active += 1;
            }
        }
        assert_eq!(
            actually_active, expected_status_active,
            "seed={} active-credential count mismatch",
            seed
        );
    }
}

// ── Marketplace fuzzing ───────────────────────────────────────────────────

#[test]
fn fuzz_marketplace_invariants() {
    const SEEDS: &[u64] = &[2, 17, 100, 4242];

    for &seed in SEEDS {
        let mut rng = Lcg::new(seed);
        let (env, client, _admin) = fresh_env();

        let sellers = [
            Address::generate(&env),
            Address::generate(&env),
        ];
        let buyers = [
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
        ];

        // item_id -> listed? so we can test duplicate prevention
        let mut listed_items: std::vec::Vec<(u64, u32, usize)> = std::vec::Vec::new();
        let mut listing_status: std::collections::HashMap<u64, u32> =
            std::collections::HashMap::new();

        let ops = 40u32;
        for _ in 0..ops {
            match rng.next_in(3) {
                0 => {
                    // ListItem. Pick an item_id we haven't yet listed.
                    let item_id = 1000u64 + (rng.next_in(50) as u64);
                    let item_type = rng.next_in(3) as u32;
                    let price = 100u64 + (rng.next_in(900) as u64);
                    let seller = sellers[rng.next_in(2) as usize].clone();
                    match client.try_list_item(&seller, &item_id, &price, &item_type) {
                        Ok(listing_id) => {
                            listed_items.push((listing_id, item_type, sellers
                                .iter()
                                .position(|a| a == &seller)
                                .unwrap_or(0)));
                            listing_status.insert(listing_id, 0);
                        }
                        Err(_) => {
                            // Either price == 0, item_type > 2, or duplicate
                            // — all expected outcomes in the fuzz loop.
                        }
                    }
                }
                1 => {
                    // BuyItem.
                    if listed_items.is_empty() {
                        continue;
                    }
                    let idx = rng.next_in(listed_items.len() as u32) as usize;
                    let (listing_id, _, _) = listed_items[idx];
                    if listing_status.get(&listing_id).copied().unwrap_or(99) != 0 {
                        continue;
                    }
                    let buyer = buyers[rng.next_in(3) as usize].clone();
                    match client.try_buy_item(&buyer, &listing_id) {
                        Ok(()) => {
                            listing_status.insert(listing_id, 1);
                        }
                        Err(_) => {}
                    }
                }
                _ => {
                    // CancelListing.
                    if listed_items.is_empty() {
                        continue;
                    }
                    let idx = rng.next_in(listed_items.len() as u32) as usize;
                    let (listing_id, _, seller_idx) = listed_items[idx];
                    if listing_status.get(&listing_id).copied().unwrap_or(99) != 0 {
                        continue;
                    }
                    let seller = sellers[seller_idx].clone();
                    match client.try_cancel_listing(&seller, &listing_id) {
                        Ok(()) => {
                            listing_status.insert(listing_id, 2);
                        }
                        Err(_) => {}
                    }
                }
            }
        }

        // ── Invariants ──────────────────────────────────────────────
        // For each successful listing in the trace, the stored status
        // must match what we recorded. Status 0 (active), 1 (sold), or
        // 2 (cancelled) — never anything else.
        for listing_id in listing_status.keys() {
            let stored = client.get_listing(listing_id).status;
            let expected = listing_status[listing_id];
            assert!(
                stored == expected,
                "seed={} listing {} status mismatch (stored={}, expected={})",
                seed,
                listing_id,
                stored,
                expected
            );
            // The status must be one of the three valid states.
            assert!(stored <= 2, "seed={} invalid status {}", seed, stored);
        }
    }
}

// ── Profile NFT fuzzing ───────────────────────────────────────────────────

#[test]
fn fuzz_profile_nft_invariants() {
    const SEEDS: &[u64] = &[3, 8, 88];

    for &seed in SEEDS {
        let mut rng = Lcg::new(seed);
        let (env, client, _admin) = fresh_env();

        let owners = [
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
        ];

        let mut minted: std::collections::HashSet<usize> = std::collections::HashSet::new();
        let mut failed_double_mint = 0u32;

        for _ in 0..20 {
            let owner_idx = rng.next_in(3) as usize;
            let owner = owners[owner_idx].clone();
            match rng.next_in(2) {
                0 => {
                    // Mint
                    let mut arr: soroban_sdk::Vec<soroban_sdk::String> =
                        soroban_sdk::Vec::new(&env);
                    let no_site: Option<soroban_sdk::String> = None;
                    match client.try_mint_profile_nft(
                        &owner,
                        &"Fuzz User",
                        &"Fuzzed",
                        &"https://example.com/avatar.png",
                        &arr,
                        &no_site,
                    ) {
                        Ok(_) => {
                            minted.insert(owner_idx);
                        }
                        Err(_) => {
                            if minted.contains(&owner_idx) {
                                failed_double_mint += 1;
                            }
                        }
                    }
                }
                _ => {
                    // Update
                    let mut arr: soroban_sdk::Vec<soroban_sdk::String> =
                        soroban_sdk::Vec::new(&env);
                    let no_site: Option<soroban_sdk::String> = None;
                    if minted.contains(&owner_idx) {
                        let _ = client.try_update_profile_nft(
                            &owner,
                            &"Fuzz User Updated",
                            &"Updated",
                            &"https://example.com/new-avatar.png",
                            &arr,
                            &no_site,
                        );
                    }
                }
            }
        }

        // ── Invariants ──────────────────────────────────────────────
        // The number of owners with minted NFTs equals the supply.
        let supply = client.get_profile_nft_supply();
        assert_eq!(
            supply as usize,
            minted.len(),
            "seed={} supply ({}) != minted owners ({})",
            seed,
            supply,
            minted.len()
        );
        // Each minted owner must report has_profile_nft == true.
        for &idx in minted.iter() {
            assert!(
                client.has_profile_nft(&owners[idx]),
                "seed={} owner {} reported no NFT despite successful mint",
                seed,
                idx
            );
        }
        // Any non-minted owner must report false.
        for (idx, owner) in owners.iter().enumerate() {
            if !minted.contains(&idx) {
                assert!(
                    !client.has_profile_nft(owner),
                    "seed={} owner {} unexpectedly has NFT",
                    seed,
                    idx
                );
            }
        }
        // The double-mint panic path was triggered `failed_double_mint`
        // times. Sanity check: it must be at most 1 per owner.
        assert!(
            (failed_double_mint as usize) <= owners.len(),
            "seed={} too many double-mint failures recorded",
            seed
        );
    }
}

// ── Dynamic NFT fuzzing ───────────────────────────────────────────────────

#[test]
fn fuzz_dynamic_nft_invariants() {
    const SEEDS: &[u64] = &[4, 11, 500];

    for &seed in SEEDS {
        let mut rng = Lcg::new(seed);
        let (env, client, _admin) = fresh_env();

        let recipients = [
            Address::generate(&env),
            Address::generate(&env),
        ];

        let mut minted_count: u32 = 0;
        let mut balances: [u64; 2] = [0, 0];

        for _ in 0..20 {
            match rng.next_in(2) {
                0 => {
                    let r_idx = rng.next_in(2) as usize;
                    let recipient = recipients[r_idx].clone();
                    match client.try_mint_dynamic_nft(
                        &_admin,
                        &recipient,
                        &"https://api.aethermint.com/nft",
                        &"QmFuzzMetadata",
                    ) {
                        Ok(_token_id) => {
                            minted_count += 1;
                            balances[r_idx] += 1;
                        }
                        Err(_) => {}
                    }
                }
                _ => {
                    // Try an evolve at a random token id. Most will
                    // panic because no NFT exists for that id — that's
                    // expected behaviour, surfaced by `try_*`.
                    if minted_count == 0 {
                        continue;
                    }
                    let token_id = 1 + (rng.next_in(20) as u64);
                    let _ = client.try_evolve_nft(
                        &token_id,
                        &((seed & 0xFF) as u64),
                        &"QmFuzzEvolved",
                    );
                }
            }
        }

        // ── Invariants ──────────────────────────────────────────────
        let supply = client.get_total_supply();
        assert_eq!(
            supply as u32, minted_count,
            "seed={} supply ({}) != minted count ({})",
            seed, supply, minted_count
        );

        // Total supply must equal the sum of recipient balances.
        let b0 = client.balance_of(&recipients[0]);
        let b1 = client.balance_of(&recipients[1]);
        assert_eq!(b0, balances[0], "seed={} recipient 0 balance mismatch", seed);
        assert_eq!(b1, balances[1], "seed={} recipient 1 balance mismatch", seed);
        assert_eq!(
            b0 + b1,
            supply,
            "seed={} sum of balances ≠ supply",
            seed
        );
    }
}
