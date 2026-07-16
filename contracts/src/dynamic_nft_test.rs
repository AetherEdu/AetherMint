#![cfg(test)]
use crate::dynamic_nft::{
    balance_of, evolve_nft, fuse_nfts, get_nft, get_owner_tokens, get_total_supply,
    mint_dynamic_nft, nft_exists, owner_of, token_uri, transfer_nft, DynamicNFT, EvolutionStage,
    RarityTier,
};
use alloc::format;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env, String, Vec};

#[test]
fn test_mint_dynamic_nft() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Initialize contract with admin
    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
    let initial_metadata = String::from_str(&env, "QmInitialMetadata");

    let token_id = mint_dynamic_nft(
        &env,
        admin.clone(),
        recipient.clone(),
        base_uri.clone(),
        initial_metadata.clone(),
    );

    assert!(token_id > 0);
    assert!(nft_exists(&env, token_id));
    assert_eq!(owner_of(&env, token_id), recipient.clone());
    assert_eq!(balance_of(&env, recipient.clone()), 1);
    assert_eq!(get_total_supply(&env), 1);

    let nft = get_nft(&env, token_id);
    assert_eq!(nft.token_id, token_id);
    assert_eq!(nft.owner, recipient);
    assert_eq!(nft.creator, admin);
    assert_eq!(nft.base_uri, base_uri);
    assert_eq!(nft.current_level, 1);
    assert_eq!(nft.experience_points, 0);
    assert_eq!(nft.evolution_stage, EvolutionStage::Novice);
    assert_eq!(nft.visual_traits.rarity_tier, RarityTier::Common);
}

#[test]
fn test_evolve_nft() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
    let initial_metadata = String::from_str(&env, "QmInitialMetadata");

    let token_id = mint_dynamic_nft(&env, admin, recipient.clone(), base_uri, initial_metadata);

    // Evolve with achievement
    let achievement_id = 1;
    let new_metadata = String::from_str(&env, "QmEvolvedMetadata");
    let evolved = evolve_nft(&env, token_id, achievement_id, new_metadata.clone());

    assert!(evolved);

    let nft = get_nft(&env, token_id);
    assert!(nft.achievements.contains(&achievement_id));
    assert!(nft.experience_points > 0);
    assert_eq!(nft.metadata_ipfs, new_metadata);
}

#[test]
fn test_multiple_evolutions() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
    let initial_metadata = String::from_str(&env, "QmInitialMetadata");

    let token_id = mint_dynamic_nft(&env, admin, recipient, base_uri, initial_metadata);

    // Add multiple achievements to trigger evolution
    for i in 1..=20 {
        let new_metadata = String::from_str(&env, &alloc::format!("QmMetadata{}", i));
        evolve_nft(&env, token_id, i, new_metadata);
    }

    let nft = get_nft(&env, token_id);
    assert!(nft.current_level > 1);
    assert!(nft.evolution_stage as u8 > EvolutionStage::Novice as u8);
}

#[test]
fn test_fuse_nfts() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");

    // Mint two NFTs
    let token1_id = mint_dynamic_nft(
        &env,
        admin.clone(),
        recipient.clone(),
        base_uri.clone(),
        String::from_str(&env, "QmMetadata1"),
    );
    let token2_id = mint_dynamic_nft(
        &env,
        admin,
        recipient.clone(),
        base_uri,
        String::from_str(&env, "QmMetadata2"),
    );

    // Evolve both NFTs
    evolve_nft(&env, token1_id, 1, String::from_str(&env, "QmEvolved1"));
    evolve_nft(&env, token2_id, 2, String::from_str(&env, "QmEvolved2"));

    // Fuse NFTs
    let fused_token_id = fuse_nfts(&env, token1_id, token2_id, recipient.clone());

    assert!(fused_token_id > 0);
    assert!(nft_exists(&env, fused_token_id));
    assert!(!nft_exists(&env, token1_id)); // Original should be burned
    assert!(!nft_exists(&env, token2_id)); // Original should be burned

    let fused_nft = get_nft(&env, fused_token_id);
    assert_eq!(fused_nft.owner, recipient);
    assert!(fused_nft.achievements.len() >= 2); // Should have combined achievements
}

#[test]
fn test_transfer_nft() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let new_owner = Address::generate(&env);

    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
    let initial_metadata = String::from_str(&env, "QmInitialMetadata");

    let token_id = mint_dynamic_nft(&env, admin, owner.clone(), base_uri, initial_metadata);

    assert_eq!(balance_of(&env, owner.clone()), 1);
    assert_eq!(balance_of(&env, new_owner.clone()), 0);

    // Transfer NFT
    transfer_nft(&env, owner.clone(), new_owner.clone(), token_id);

    assert_eq!(owner_of(&env, token_id), new_owner);
    assert_eq!(balance_of(&env, owner), 0);
    assert_eq!(balance_of(&env, new_owner), 1);
}

#[test]
fn test_token_uri() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
    let initial_metadata = String::from_str(&env, "QmInitialMetadata");

    let token_id = mint_dynamic_nft(
        &env,
        admin,
        recipient,
        base_uri.clone(),
        initial_metadata.clone(),
    );

    let uri = token_uri(&env, token_id);
    let expected = String::from_str(&env, &alloc::format!("{}/{}", base_uri, initial_metadata));
    assert_eq!(uri, expected);
}

#[test]
fn test_get_owner_tokens() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");

    // Mint multiple NFTs
    let token1_id = mint_dynamic_nft(
        &env,
        admin.clone(),
        recipient.clone(),
        base_uri.clone(),
        String::from_str(&env, "QmMetadata1"),
    );
    let token2_id = mint_dynamic_nft(
        &env,
        admin,
        recipient.clone(),
        base_uri,
        String::from_str(&env, "QmMetadata2"),
    );

    let owner_tokens = get_owner_tokens(&env, recipient);
    assert_eq!(owner_tokens.len(), 2);
    assert!(owner_tokens.contains(&token1_id));
    assert!(owner_tokens.contains(&token2_id));
}

#[test]
#[should_panic(expected = "NFT not found")]
fn test_get_nonexistent_nft() {
    let env = Env::default();
    get_nft(&env, 999);
}

#[test]
#[should_panic(expected = "Not the owner")]
fn test_unauthorized_transfer() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
    let initial_metadata = String::from_str(&env, "QmInitialMetadata");

    let token_id = mint_dynamic_nft(&env, admin, owner, base_uri, initial_metadata);

    // Try to transfer with unauthorized address
    transfer_nft(&env, unauthorized, recipient, token_id);
}

// ---------------------------------------------------------------------------
// Event emission verification tests
// ---------------------------------------------------------------------------

#[test]
fn test_mint_nft_emits_events() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
    let initial_metadata = String::from_str(&env, "QmInitialMetadata");

    let token_id = mint_dynamic_nft(&env, admin, recipient, base_uri, initial_metadata);

    assert!(token_id > 0, "NFT must be minted successfully");

    let events = env.events().all();
    // Mint emits: Transfer + nft:minted = at least 2 events
    assert!(
        events.events().len() >= 2,
        "mint must emit Transfer and nft:minted events, got {}",
        events.events().len()
    );
}

#[test]
fn test_evolve_nft_emits_events() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let token_id = mint_dynamic_nft(
        &env,
        admin,
        recipient.clone(),
        String::from_str(&env, "https://api.aethermint.com/nft"),
        String::from_str(&env, "QmInitial"),
    );

    let evolved = evolve_nft(&env, token_id, 1, String::from_str(&env, "QmEvolved"));

    assert!(evolved, "NFT must evolve");

    let events = env.events().all();
    // Evolve emits: AchievementUnlocked (and possibly Evolution if stages change)
    assert!(
        events.events().len() >= 1,
        "evolve must emit at least one event, got {}",
        events.events().len()
    );
}

#[test]
fn test_transfer_nft_emits_event() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let new_owner = Address::generate(&env);

    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let token_id = mint_dynamic_nft(
        &env,
        admin,
        owner.clone(),
        String::from_str(&env, "https://api.aethermint.com/nft"),
        String::from_str(&env, "QmInitial"),
    );

    transfer_nft(&env, owner, new_owner, token_id);

    let events = env.events().all();
    // Transfer emits: Transfer event
    assert!(
        events.events().len() >= 1,
        "transfer must emit at least one event, got {}",
        events.events().len()
    );
}

#[test]
fn test_empty_metadata() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
    let empty_metadata = String::from_str(&env, "");

    let token_id = mint_dynamic_nft(&env, admin, recipient, base_uri, empty_metadata);

    assert!(token_id > 0);
    let nft = get_nft(&env, token_id);
    assert_eq!(nft.metadata_ipfs.len(), 0);
}

#[test]
fn test_empty_base_uri() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let empty_uri = String::from_str(&env, "");
    let metadata = String::from_str(&env, "QmMetadata");

    let token_id = mint_dynamic_nft(&env, admin, recipient, empty_uri, metadata);

    assert!(token_id > 0);
    let nft = get_nft(&env, token_id);
    assert_eq!(nft.base_uri.len(), 0);
}

#[test]
fn test_fuse_same_nft() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");

    let token_id = mint_dynamic_nft(
        &env,
        admin.clone(),
        recipient.clone(),
        base_uri.clone(),
        String::from_str(&env, "QmMetadata"),
    );

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        fuse_nfts(&env, token_id, token_id, recipient);
    }));
    assert!(result.is_err());
}

#[test]
fn test_fuse_nonexistent_nfts() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        fuse_nfts(&env, 999, 1000, recipient);
    }));
    assert!(result.is_err());
}

#[test]
fn test_evolve_nonexistent_nft() {
    let env = Env::default();
    let admin = Address::generate(&env);

    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        evolve_nft(&env, 999, 1, String::from_str(&env, "QmMetadata"));
    }));
    assert!(result.is_err());
}

#[test]
fn test_transfer_nonexistent_nft() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let new_owner = Address::generate(&env);

    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        transfer_nft(&env, owner, new_owner, 999);
    }));
    assert!(result.is_err());
}

#[test]
fn test_max_supply_boundary() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");

    // Mint multiple NFTs to test supply tracking
    for i in 0..10 {
        mint_dynamic_nft(
            &env,
            admin.clone(),
            recipient.clone(),
            base_uri.clone(),
            String::from_str(&env, &alloc::format!("QmMetadata{}", i)),
        );
    }

    assert_eq!(get_total_supply(&env), 10);
}

#[test]
fn test_achievement_duplication() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
    let initial_metadata = String::from_str(&env, "QmInitialMetadata");

    let token_id = mint_dynamic_nft(&env, admin, recipient, base_uri, initial_metadata);

    // Add same achievement twice
    evolve_nft(&env, token_id, 1, String::from_str(&env, "QmMetadata1"));
    evolve_nft(&env, token_id, 1, String::from_str(&env, "QmMetadata2"));

    let nft = get_nft(&env, token_id);
    // Check if achievement is only counted once or multiple times
    assert!(nft.achievements.contains(&1));
}

#[test]
fn test_balance_of_zero() {
    let env = Env::default();
    let user = Address::generate(&env);

    assert_eq!(balance_of(&env, user), 0);
}

#[test]
fn test_get_owner_tokens_empty() {
    let env = Env::default();
    let user = Address::generate(&env);

    let tokens = get_owner_tokens(&env, user);
    assert_eq!(tokens.len(), 0);
}

#[test]
fn test_rarity_tier_progression() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
    let initial_metadata = String::from_str(&env, "QmInitialMetadata");

    let token_id = mint_dynamic_nft(&env, admin, recipient, base_uri, initial_metadata);

    let nft = get_nft(&env, token_id);
    assert_eq!(nft.visual_traits.rarity_tier, RarityTier::Common);

    // Add many achievements to potentially change rarity
    for i in 1..=50 {
        evolve_nft(
            &env,
            token_id,
            i,
            String::from_str(&env, &alloc::format!("QmMetadata{}", i)),
        );
    }

    let evolved_nft = get_nft(&env, token_id);
    assert!(evolved_nft.current_level > 1);
}

#[test]
fn test_evolution_stage_progression() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
    let initial_metadata = String::from_str(&env, "QmInitialMetadata");

    let token_id = mint_dynamic_nft(&env, admin, recipient, base_uri, initial_metadata);

    let nft = get_nft(&env, token_id);
    assert_eq!(nft.evolution_stage, EvolutionStage::Novice);

    // Add achievements to progress evolution
    for i in 1..=30 {
        evolve_nft(
            &env,
            token_id,
            i,
            String::from_str(&env, &alloc::format!("QmMetadata{}", i)),
        );
    }

    let evolved_nft = get_nft(&env, token_id);
    assert!(evolved_nft.evolution_stage as u8 > EvolutionStage::Novice as u8);
}

#[test]
fn test_experience_points_accumulation() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
    let initial_metadata = String::from_str(&env, "QmInitialMetadata");

    let token_id = mint_dynamic_nft(&env, admin, recipient, base_uri, initial_metadata);

    let nft = get_nft(&env, token_id);
    assert_eq!(nft.experience_points, 0);

    // Add achievements
    for i in 1..=10 {
        evolve_nft(
            &env,
            token_id,
            i,
            String::from_str(&env, &alloc::format!("QmMetadata{}", i)),
        );
    }

    let evolved_nft = get_nft(&env, token_id);
    assert!(evolved_nft.experience_points > 0);
}

#[test]
fn test_token_uri_with_empty_metadata() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
    let empty_metadata = String::from_str(&env, "");

    let token_id = mint_dynamic_nft(&env, admin, recipient, base_uri.clone(), empty_metadata);

    let uri = token_uri(&env, token_id);
    let expected = String::from_str(&env, &alloc::format!("{}/{}", base_uri, ""));
    assert_eq!(uri, expected);
}

#[test]
fn test_multiple_transfers() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let owner1 = Address::generate(&env);
    let owner2 = Address::generate(&env);
    let owner3 = Address::generate(&env);

    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
    let initial_metadata = String::from_str(&env, "QmInitialMetadata");

    let token_id = mint_dynamic_nft(&env, admin, owner1.clone(), base_uri, initial_metadata);

    assert_eq!(owner_of(&env, token_id), owner1);

    transfer_nft(&env, owner1.clone(), owner2.clone(), token_id);
    assert_eq!(owner_of(&env, token_id), owner2);

    transfer_nft(&env, owner2, owner3, token_id);
    assert_eq!(owner_of(&env, token_id), owner3);
}
