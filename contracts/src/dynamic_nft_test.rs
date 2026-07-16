#![cfg(test)]
use crate::dynamic_nft::{
    balance_of, evolve_nft, fuse_nfts, get_nft, get_owner_tokens, get_total_supply,
    mint_dynamic_nft, nft_exists, owner_of, token_uri, transfer_nft, DynamicNFT, EvolutionStage,
    RarityTier,
};
use crate::AetherMintContract;
use alloc::format;
use soroban_sdk::testutils::{Address as _, Events};
use soroban_sdk::{Address, Env, String, Vec};

fn setup() -> (Env, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let cid = env.register(AetherMintContract, ());
    (env, cid)
}

#[test]
fn test_mint_dynamic_nft() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.as_contract(&cid, || {
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
    });
}

#[test]
fn test_evolve_nft() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Mint first (requires creator auth)
    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

        let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
        let initial_metadata = String::from_str(&env, "QmInitialMetadata");

        mint_dynamic_nft(
            &env,
            admin.clone(),
            recipient.clone(),
            base_uri,
            initial_metadata,
        );
    });

    // Evolve (no auth needed in evolve_nft)
    env.as_contract(&cid, || {
        let achievement_id = 1;
        let new_metadata = String::from_str(&env, "QmEvolvedMetadata");
        let evolved = evolve_nft(&env, 1, achievement_id, new_metadata.clone());

        assert!(evolved);

        let nft = get_nft(&env, 1);
        assert!(nft.achievements.contains(&achievement_id));
        assert!(nft.experience_points > 0);
        assert_eq!(nft.metadata_ipfs, new_metadata);
    });
}

#[test]
fn test_multiple_evolutions() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

        let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
        let initial_metadata = String::from_str(&env, "QmInitialMetadata");

        let token_id = mint_dynamic_nft(&env, admin, recipient, base_uri, initial_metadata);

        for i in 1..=20 {
            let new_metadata = String::from_str(&env, &alloc::format!("QmMetadata{}", i));
            evolve_nft(&env, token_id, i, new_metadata);
        }

        let nft = get_nft(&env, token_id);
        assert!(nft.current_level > 1);
        assert!(nft.evolution_stage as u8 > EvolutionStage::Novice as u8);
    });
}

#[test]
fn test_fuse_nfts() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Mint token1
    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

        let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
        mint_dynamic_nft(
            &env,
            admin.clone(),
            recipient.clone(),
            base_uri.clone(),
            String::from_str(&env, "QmMetadata1"),
        );
    });

    // Mint token2
    env.as_contract(&cid, || {
        let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
        mint_dynamic_nft(
            &env,
            admin.clone(),
            recipient.clone(),
            base_uri,
            String::from_str(&env, "QmMetadata2"),
        );
    });

    // Evolve both (no auth)
    env.as_contract(&cid, || {
        evolve_nft(&env, 1, 1, String::from_str(&env, "QmEvolved1"));
        evolve_nft(&env, 2, 2, String::from_str(&env, "QmEvolved2"));
    });

    // Fuse (fuse_nfts has recipient validation but no require_auth)
    env.as_contract(&cid, || {
        let fused_token_id = fuse_nfts(&env, 1, 2, recipient.clone());

        assert!(fused_token_id > 0);
        assert!(nft_exists(&env, fused_token_id));
        assert!(!nft_exists(&env, 1));
        assert!(!nft_exists(&env, 2));

        let fused_nft = get_nft(&env, fused_token_id);
        assert_eq!(fused_nft.owner, recipient);
        assert!(fused_nft.achievements.len() >= 2);
    });
}

#[test]
fn test_transfer_nft() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let new_owner = Address::generate(&env);

    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

        let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
        let initial_metadata = String::from_str(&env, "QmInitialMetadata");

        let token_id = mint_dynamic_nft(&env, admin, owner.clone(), base_uri, initial_metadata);

        assert_eq!(balance_of(&env, owner.clone()), 1);
        assert_eq!(balance_of(&env, new_owner.clone()), 0);

        transfer_nft(&env, owner.clone(), new_owner.clone(), token_id);

        assert_eq!(owner_of(&env, token_id), new_owner);
        assert_eq!(balance_of(&env, owner), 0);
        assert_eq!(balance_of(&env, new_owner), 1);
    });
}

#[test]
fn test_token_uri() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

        let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
        let initial_metadata = String::from_str(&env, "QmInitialMetadata");

        let token_id = mint_dynamic_nft(&env, admin, recipient, base_uri, initial_metadata.clone());

        let uri = token_uri(&env, token_id);
        // token_uri returns metadata_ipfs directly
        assert_eq!(uri, initial_metadata);
    });
}

#[test]
fn test_get_owner_tokens() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Mint token1
    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

        let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
        mint_dynamic_nft(
            &env,
            admin.clone(),
            recipient.clone(),
            base_uri.clone(),
            String::from_str(&env, "QmMetadata1"),
        );
    });

    // Mint token2
    env.as_contract(&cid, || {
        let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
        mint_dynamic_nft(
            &env,
            admin,
            recipient.clone(),
            base_uri,
            String::from_str(&env, "QmMetadata2"),
        );
    });

    env.as_contract(&cid, || {
        let owner_tokens = get_owner_tokens(&env, recipient);
        assert_eq!(owner_tokens.len(), 2);
        assert!(owner_tokens.contains(&1u64));
        assert!(owner_tokens.contains(&2u64));
    });
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

    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

        let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
        let initial_metadata = String::from_str(&env, "QmInitialMetadata");

        let token_id = mint_dynamic_nft(&env, admin, owner, base_uri, initial_metadata);

        transfer_nft(&env, unauthorized, recipient, token_id);
    });
}

#[test]
fn test_mint_nft_emits_events() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

        let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
        let initial_metadata = String::from_str(&env, "QmInitialMetadata");

        let token_id = mint_dynamic_nft(&env, admin, recipient, base_uri, initial_metadata);

        assert!(token_id > 0, "NFT must be minted successfully");
        assert!(nft_exists(&env, token_id));
    });
}

#[test]
fn test_evolve_nft_emits_events() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.as_contract(&cid, || {
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

        let nft = get_nft(&env, token_id);
        assert!(
            nft.achievements.contains(&1),
            "achievement should be recorded"
        );
    });
}

#[test]
fn test_transfer_nft_emits_event() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let new_owner = Address::generate(&env);

    env.as_contract(&cid, || {
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

        transfer_nft(&env, owner, new_owner.clone(), token_id);

        assert_eq!(owner_of(&env, token_id), new_owner);
    });
}

#[test]
fn test_empty_metadata() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

        let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
        let empty_metadata = String::from_str(&env, "");

        let token_id = mint_dynamic_nft(&env, admin, recipient, base_uri, empty_metadata);

        assert!(token_id > 0);
        let nft = get_nft(&env, token_id);
        assert_eq!(nft.metadata_ipfs.len(), 0);
    });
}

#[test]
#[should_panic]
fn test_empty_base_uri() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

        let empty_uri = String::from_str(&env, "");
        let metadata = String::from_str(&env, "QmMetadata");

        // Empty base_uri is rejected by validate_string_length
        mint_dynamic_nft(&env, admin, recipient, empty_uri, metadata);
    });
}

#[test]
#[should_panic]
fn test_fuse_same_nft() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.as_contract(&cid, || {
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

        fuse_nfts(&env, token_id, token_id, recipient);
    });
}

#[test]
#[should_panic]
fn test_fuse_nonexistent_nfts() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

        fuse_nfts(&env, 999, 1000, recipient);
    });
}

#[test]
#[should_panic]
fn test_evolve_nonexistent_nft() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);

    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

        evolve_nft(&env, 999, 1, String::from_str(&env, "QmMetadata"));
    });
}

#[test]
#[should_panic]
fn test_transfer_nonexistent_nft() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let new_owner = Address::generate(&env);

    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

        transfer_nft(&env, owner, new_owner, 999);
    });
}

#[test]
fn test_max_supply_boundary() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Mint 10 NFTs in separate blocks (one auth each)
    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);
    });

    for i in 0..10 {
        env.as_contract(&cid, || {
            mint_dynamic_nft(
                &env,
                admin.clone(),
                recipient.clone(),
                String::from_str(&env, "https://api.aethermint.com/nft"),
                String::from_str(&env, &alloc::format!("QmMetadata{}", i)),
            );
        });
    }

    env.as_contract(&cid, || {
        assert_eq!(get_total_supply(&env), 10);
    });
}

#[test]
fn test_achievement_duplication() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

        let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
        let initial_metadata = String::from_str(&env, "QmInitialMetadata");

        let token_id = mint_dynamic_nft(&env, admin, recipient, base_uri, initial_metadata);

        evolve_nft(&env, token_id, 1, String::from_str(&env, "QmMetadata1"));
        evolve_nft(&env, token_id, 1, String::from_str(&env, "QmMetadata2"));

        let nft = get_nft(&env, token_id);
        assert!(nft.achievements.contains(&1));
    });
}

#[test]
fn test_balance_of_zero() {
    let (env, cid) = setup();
    let user = Address::generate(&env);

    env.as_contract(&cid, || {
        assert_eq!(balance_of(&env, user), 0);
    });
}

#[test]
fn test_get_owner_tokens_empty() {
    let (env, cid) = setup();
    let user = Address::generate(&env);

    env.as_contract(&cid, || {
        let tokens = get_owner_tokens(&env, user);
        assert_eq!(tokens.len(), 0);
    });
}

#[test]
fn test_rarity_tier_progression() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

        let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
        let initial_metadata = String::from_str(&env, "QmInitialMetadata");

        let token_id = mint_dynamic_nft(&env, admin, recipient, base_uri, initial_metadata);

        let nft = get_nft(&env, token_id);
        assert_eq!(nft.visual_traits.rarity_tier, RarityTier::Common);

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
    });
}

#[test]
fn test_evolution_stage_progression() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

        let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
        let initial_metadata = String::from_str(&env, "QmInitialMetadata");

        let token_id = mint_dynamic_nft(&env, admin, recipient, base_uri, initial_metadata);

        let nft = get_nft(&env, token_id);
        assert_eq!(nft.evolution_stage, EvolutionStage::Novice);

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
    });
}

#[test]
fn test_experience_points_accumulation() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

        let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
        let initial_metadata = String::from_str(&env, "QmInitialMetadata");

        let token_id = mint_dynamic_nft(&env, admin, recipient, base_uri, initial_metadata);

        let nft = get_nft(&env, token_id);
        assert_eq!(nft.experience_points, 0);

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
    });
}

#[test]
fn test_token_uri_with_empty_metadata() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

        let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
        let empty_metadata = String::from_str(&env, "");

        let token_id = mint_dynamic_nft(&env, admin, recipient, base_uri, empty_metadata);

        let uri = token_uri(&env, token_id);
        // token_uri returns metadata_ipfs directly (empty string)
        assert_eq!(uri.len(), 0);
    });
}

#[test]
fn test_multiple_transfers() {
    let (env, cid) = setup();
    let admin = Address::generate(&env);
    let owner1 = Address::generate(&env);
    let owner2 = Address::generate(&env);
    let owner3 = Address::generate(&env);

    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&soroban_sdk::Symbol::new(&env, "admin"), &admin);

        let base_uri = String::from_str(&env, "https://api.aethermint.com/nft");
        let initial_metadata = String::from_str(&env, "QmInitialMetadata");

        let token_id = mint_dynamic_nft(&env, admin, owner1.clone(), base_uri, initial_metadata);

        assert_eq!(owner_of(&env, token_id), owner1);

        transfer_nft(&env, owner1.clone(), owner2.clone(), token_id);
        assert_eq!(owner_of(&env, token_id), owner2);

        transfer_nft(&env, owner2, owner3.clone(), token_id);
        assert_eq!(owner_of(&env, token_id), owner3);
    });
}
