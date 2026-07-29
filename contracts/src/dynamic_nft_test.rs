#![cfg(test)]
use crate::dynamic_nft::{
    balance_of, evolve_nft, fuse_nfts, get_nft, get_owner_tokens, get_total_supply,
    mint_dynamic_nft, nft_exists, owner_of, token_uri, transfer_nft, DynamicNFT, EvolutionStage,
    RarityTier,
};
use soroban_sdk::{Address, Env, String, Vec};

#[test]
fn test_mint_dynamic_nft() {
    let (env, cid) = setup();
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
        admin,
        recipient.clone(),
        base_uri.clone(),
        initial_metadata.clone(),
    );

    assert!(token_id > 0);
    assert!(nft_exists(&env, token_id));
    assert_eq!(owner_of(&env, token_id), recipient);
    assert_eq!(balance_of(&env, recipient), 1);
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
    let (env, cid) = setup();
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
    let (env, cid) = setup();
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
        let new_metadata = String::from_str(&env, &format!("QmMetadata{}", i));
        evolve_nft(&env, token_id, i, new_metadata);
    }

    let nft = get_nft(&env, token_id);
    assert!(nft.current_level > 1);
    assert!(nft.evolution_stage as u8 > EvolutionStage::Novice as u8);
}

#[test]
fn test_fuse_nfts() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");

    // Mint two NFTs
    let token1_id = mint_dynamic_nft(
        &env,
        admin,
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
    let (env, cid) = setup();
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
    let (env, cid) = setup();
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
    assert_eq!(uri, format!("{}/{}", base_uri, initial_metadata));
}

#[test]
fn test_get_owner_tokens() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.storage()
        .instance()
        .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

    let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");

    // Mint multiple NFTs
    let token1_id = mint_dynamic_nft(
        &env,
        admin,
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
    let (env, cid) = setup();

    env.as_contract(&cid, || {
        get_nft(&env, 999);
    });
}

#[test]
#[should_panic(expected = "Not the owner")]
fn test_unauthorized_transfer() {
    let (env, cid) = setup();
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
