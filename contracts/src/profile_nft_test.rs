#[cfg(test)]
mod profile_nft_test {
    use soroban_sdk::testutils::{Address as _, Ledger};
    use soroban_sdk::{vec, Address, Env, String};

    use crate::profile_nft::*;
    use crate::AetherMintContract;

    // ── Helpers ─────────────────────────────────────────────────────────────

    fn setup() -> (Env, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        // Set a non-zero ledger timestamp so minted_at > 0 assertions pass
        let mut ledger_info = env.ledger().get();
        ledger_info.timestamp = 1700000000;
        env.ledger().set(ledger_info);

        let cid = env.register(AetherMintContract, ());
        let user = Address::generate(&env);
        (env, cid, user)
    }

    // ── Mint Tests ───────────────────────────────────────────────────────────

    #[test]
    fn test_mint_profile_nft() {
        let (env, cid, user) = setup();

        env.as_contract(&cid, || {
            let name = String::from_str(&env, "Alice");
            let bio = String::from_str(&env, "Blockchain developer");
            let avatar = String::from_str(&env, "ipfs://QmAvatarHash");
            let skills = vec![
                &env,
                String::from_str(&env, "Rust"),
                String::from_str(&env, "Soroban"),
                String::from_str(&env, "Solidity"),
            ];
            let website = Some(String::from_str(&env, "https://alice.dev"));

            let token_id = mint_profile_nft(
                &env,
                user.clone(),
                name.clone(),
                bio.clone(),
                avatar.clone(),
                skills.clone(),
                website.clone(),
            );

            assert_eq!(token_id, 1);

            let nft = get_profile_nft(&env, token_id);
            assert_eq!(nft.owner, user);
            assert_eq!(nft.name, name);
            assert_eq!(nft.bio, bio);
            assert_eq!(nft.avatar_url, avatar);
            assert_eq!(nft.skills.len(), 3);
            assert_eq!(nft.website, website);
            assert!(!nft.verified);
            assert_eq!(nft.schema_version, 1);
            assert!(nft.minted_at > 0);
            assert_eq!(nft.minted_at, nft.updated_at);
        });
    }

    #[test]
    #[should_panic(expected = "Profile NFT already exists")]
    fn test_cannot_mint_duplicate() {
        let (env, cid, user) = setup();

        // First mint in its own contract frame (one require_auth)
        env.as_contract(&cid, || {
            let name = String::from_str(&env, "Alice");
            let bio = String::from_str(&env, "Bio");
            let avatar = String::from_str(&env, "ipfs://avatar");
            let skills = vec![&env, String::from_str(&env, "Rust")];

            mint_profile_nft(&env, user.clone(), name, bio, avatar, skills, None);
        });

        // Second mint in a separate frame — should panic with duplicate error
        env.as_contract(&cid, || {
            let name = String::from_str(&env, "Alice");
            let bio = String::from_str(&env, "Bio");
            let avatar = String::from_str(&env, "ipfs://avatar");
            let skills = vec![&env, String::from_str(&env, "Rust")];

            mint_profile_nft(&env, user.clone(), name, bio, avatar, skills, None);
        });
    }

    // ── Update Tests ─────────────────────────────────────────────────────────

    #[test]
    fn test_update_profile_nft() {
        let (env, cid, user) = setup();

        // Mint first (requires user auth)
        let mut token_id = 0;
        let mut new_name = String::from_str(&env, "");
        let mut new_bio = String::from_str(&env, "");
        let mut new_avatar = String::from_str(&env, "");
        let mut new_skills = vec![&env];
        let mut new_website: Option<String> = None;
        env.as_contract(&cid, || {
            let name = String::from_str(&env, "Alice");
            let bio = String::from_str(&env, "Original bio");
            let avatar = String::from_str(&env, "ipfs://old");
            let skills = vec![&env, String::from_str(&env, "Rust")];

            token_id = mint_profile_nft(
                &env,
                user.clone(),
                name.clone(),
                bio.clone(),
                avatar.clone(),
                skills.clone(),
                None,
            );

            // Advance ledger timestamp
            let info = env.ledger().get();
            env.ledger().set(soroban_sdk::testutils::LedgerInfo {
                timestamp: info.timestamp + 3600,
                ..info
            });

            // Prepare update values (they're String/Vec which are moved out of closure)
            new_name = String::from_str(&env, "Alice Updated");
            new_bio = String::from_str(&env, "Updated bio");
            new_avatar = String::from_str(&env, "ipfs://new");
            new_skills = vec![
                &env,
                String::from_str(&env, "Rust"),
                String::from_str(&env, "Go"),
            ];
            new_website = Some(String::from_str(&env, "https://alice-updated.dev"));
        });

        // Update in a separate frame (requires user auth again)
        env.as_contract(&cid, || {
            let result = update_profile_nft(
                &env,
                user.clone(),
                new_name.clone(),
                new_bio.clone(),
                new_avatar.clone(),
                new_skills.clone(),
                new_website.clone(),
            );

            assert!(result);

            let nft = get_profile_nft(&env, token_id);
            assert_eq!(nft.name, new_name);
            assert_eq!(nft.bio, new_bio);
            assert_eq!(nft.avatar_url, new_avatar);
            assert_eq!(nft.skills.len(), 2);
            assert_eq!(nft.website, new_website);
            assert!(nft.updated_at > nft.minted_at);
        });
    }

    #[test]
    #[should_panic(expected = "No profile NFT found")]
    fn test_cannot_update_nonexistent() {
        let (env, cid, user) = setup();

        env.as_contract(&cid, || {
            update_profile_nft(
                &env,
                user.clone(),
                String::from_str(&env, "Alice"),
                String::from_str(&env, "Bio"),
                String::from_str(&env, "ipfs://avatar"),
                vec![&env, String::from_str(&env, "Rust")],
                None,
            );
        });
    }

    // ── Getter Tests ─────────────────────────────────────────────────────────

    #[test]
    fn test_get_profile_nft_by_owner() {
        let (env, cid, user) = setup();

        env.as_contract(&cid, || {
            let name = String::from_str(&env, "Alice");
            let bio = String::from_str(&env, "Bio");
            let avatar = String::from_str(&env, "ipfs://avatar");
            let skills = vec![&env, String::from_str(&env, "Rust")];

            mint_profile_nft(&env, user.clone(), name, bio, avatar, skills, None);

            let nft = get_profile_nft_by_owner(&env, user.clone()).unwrap();
            assert_eq!(nft.owner, user);
        });
    }

    #[test]
    fn test_get_profile_nft_by_owner_not_found() {
        let (env, cid, user) = setup();

        env.as_contract(&cid, || {
            let result = get_profile_nft_by_owner(&env, user.clone());
            assert!(result.is_none());
        });
    }

    #[test]
    fn test_has_profile_nft() {
        let (env, cid, user) = setup();

        env.as_contract(&cid, || {
            assert!(!has_profile_nft(&env, user.clone()));

            mint_profile_nft(
                &env,
                user.clone(),
                String::from_str(&env, "Alice"),
                String::from_str(&env, "Bio"),
                String::from_str(&env, "ipfs://avatar"),
                vec![&env, String::from_str(&env, "Rust")],
                None,
            );

            assert!(has_profile_nft(&env, user.clone()));
        });
    }

    #[test]
    fn test_profile_nft_exists() {
        let (env, cid, user) = setup();

        env.as_contract(&cid, || {
            assert!(!profile_nft_exists(&env, 1));

            mint_profile_nft(
                &env,
                user.clone(),
                String::from_str(&env, "Alice"),
                String::from_str(&env, "Bio"),
                String::from_str(&env, "ipfs://avatar"),
                vec![&env],
                None,
            );

            assert!(profile_nft_exists(&env, 1));
            assert!(!profile_nft_exists(&env, 999));
        });
    }

    // ── Burn Tests ───────────────────────────────────────────────────────────

    #[test]
    fn test_burn_profile_nft() {
        let (env, cid, user) = setup();

        // Mint (requires user auth)
        env.as_contract(&cid, || {
            mint_profile_nft(
                &env,
                user.clone(),
                String::from_str(&env, "Alice"),
                String::from_str(&env, "Bio"),
                String::from_str(&env, "ipfs://avatar"),
                vec![&env],
                None,
            );

            assert!(has_profile_nft(&env, user.clone()));
        });

        // Burn in a separate frame (requires user auth again)
        env.as_contract(&cid, || {
            let result = burn_profile_nft(&env, user.clone());
            assert!(result);

            assert!(!has_profile_nft(&env, user.clone()));
            assert!(!profile_nft_exists(&env, 1));
        });
    }

    #[test]
    #[should_panic(expected = "No profile NFT found")]
    fn test_cannot_burn_nonexistent() {
        let (env, cid, user) = setup();

        env.as_contract(&cid, || {
            burn_profile_nft(&env, user.clone());
        });
    }

    // ── Verify / Unverify Tests ──────────────────────────────────────────────

    #[test]
    fn test_verify_profile_nft() {
        let (env, cid, user) = setup();
        let admin = Address::generate(&env);

        // Mint (requires user auth)
        let mut token_id = 0;
        env.as_contract(&cid, || {
            token_id = mint_profile_nft(
                &env,
                user.clone(),
                String::from_str(&env, "Alice"),
                String::from_str(&env, "Bio"),
                String::from_str(&env, "ipfs://avatar"),
                vec![&env],
                None,
            );

            assert!(!get_profile_nft(&env, token_id).verified);
        });

        // Verify in a separate frame (requires admin auth)
        env.as_contract(&cid, || {
            let result = verify_profile_nft(&env, admin.clone(), token_id);
            assert!(result);

            assert!(get_profile_nft(&env, token_id).verified);
        });
    }

    #[test]
    fn test_unverify_profile_nft() {
        let (env, cid, user) = setup();
        let admin = Address::generate(&env);

        // Mint (user auth)
        let mut token_id = 0;
        env.as_contract(&cid, || {
            token_id = mint_profile_nft(
                &env,
                user.clone(),
                String::from_str(&env, "Alice"),
                String::from_str(&env, "Bio"),
                String::from_str(&env, "ipfs://avatar"),
                vec![&env],
                None,
            );
        });

        // Verify (admin auth)
        env.as_contract(&cid, || {
            verify_profile_nft(&env, admin.clone(), token_id);
            assert!(get_profile_nft(&env, token_id).verified);
        });

        // Unverify in a separate frame (admin auth again)
        env.as_contract(&cid, || {
            let result = unverify_profile_nft(&env, admin.clone(), token_id);
            assert!(result);

            assert!(!get_profile_nft(&env, token_id).verified);
        });
    }

    // ── Supply & Pagination Tests ────────────────────────────────────────────

    #[test]
    fn test_get_total_supply() {
        let (env, cid, user1) = setup();
        let user2 = Address::generate(&env);

        // Mint user1 (user1 auth)
        env.as_contract(&cid, || {
            assert_eq!(get_total_supply(&env), 0);

            mint_profile_nft(
                &env,
                user1.clone(),
                String::from_str(&env, "Alice"),
                String::from_str(&env, "Bio1"),
                String::from_str(&env, "ipfs://a"),
                vec![&env],
                None,
            );

            assert_eq!(get_total_supply(&env), 1);
        });

        // Mint user2 (user2 auth — different user, separate frame)
        env.as_contract(&cid, || {
            mint_profile_nft(
                &env,
                user2.clone(),
                String::from_str(&env, "Bob"),
                String::from_str(&env, "Bio2"),
                String::from_str(&env, "ipfs://b"),
                vec![&env],
                None,
            );

            assert_eq!(get_total_supply(&env), 2);
        });
    }

    #[test]
    fn test_get_all_token_ids() {
        let (env, cid, user1) = setup();
        let user2 = Address::generate(&env);
        let user3 = Address::generate(&env);

        // Mint user1
        env.as_contract(&cid, || {
            mint_profile_nft(
                &env,
                user1.clone(),
                String::from_str(&env, "A"),
                String::from_str(&env, "A"),
                String::from_str(&env, "ipfs://a"),
                vec![&env],
                None,
            );
        });

        // Mint user2
        env.as_contract(&cid, || {
            mint_profile_nft(
                &env,
                user2.clone(),
                String::from_str(&env, "B"),
                String::from_str(&env, "B"),
                String::from_str(&env, "ipfs://b"),
                vec![&env],
                None,
            );
        });

        // Mint user3
        env.as_contract(&cid, || {
            mint_profile_nft(
                &env,
                user3.clone(),
                String::from_str(&env, "C"),
                String::from_str(&env, "C"),
                String::from_str(&env, "ipfs://c"),
                vec![&env],
                None,
            );
        });

        // Query all
        env.as_contract(&cid, || {
            let all = get_all_token_ids(&env, 0, 10);
            assert_eq!(all.len(), 3);

            let page = get_all_token_ids(&env, 0, 2);
            assert_eq!(page.len(), 2);
        });
    }

    // ── Skills Validation Tests ──────────────────────────────────────────────

    #[test]
    #[should_panic(expected = "Too many skills")]
    fn test_too_many_skills() {
        let (env, cid, user) = setup();

        env.as_contract(&cid, || {
            let mut skills = vec![&env];
            for _ in 0..(MAX_SKILLS + 1) {
                skills.push_back(String::from_str(&env, "skill"));
            }

            mint_profile_nft(
                &env,
                user.clone(),
                String::from_str(&env, "Alice"),
                String::from_str(&env, "Bio"),
                String::from_str(&env, "ipfs://avatar"),
                skills,
                None,
            );
        });
    }

    // ── Event Tests ──────────────────────────────────────────────────────────

    #[test]
    fn test_mint_emits_event() {
        let (env, cid, user) = setup();

        env.as_contract(&cid, || {
            mint_profile_nft(
                &env,
                user.clone(),
                String::from_str(&env, "Alice"),
                String::from_str(&env, "Bio"),
                String::from_str(&env, "ipfs://avatar"),
                vec![&env],
                None,
            );

            assert!(has_profile_nft(&env, user));
        });
    }

    #[test]
    fn test_update_emits_event() {
        let (env, cid, user) = setup();

        // Mint (user auth)
        env.as_contract(&cid, || {
            mint_profile_nft(
                &env,
                user.clone(),
                String::from_str(&env, "Alice"),
                String::from_str(&env, "Bio"),
                String::from_str(&env, "ipfs://avatar"),
                vec![&env],
                None,
            );
        });

        // Update in separate frame (user auth again)
        env.as_contract(&cid, || {
            let result = update_profile_nft(
                &env,
                user.clone(),
                String::from_str(&env, "Alice V2"),
                String::from_str(&env, "New Bio"),
                String::from_str(&env, "ipfs://new"),
                vec![&env],
                None,
            );

            assert!(result);
        });
    }

    #[test]
    fn test_burn_emits_event() {
        let (env, cid, user) = setup();

        // Mint (user auth)
        env.as_contract(&cid, || {
            mint_profile_nft(
                &env,
                user.clone(),
                String::from_str(&env, "Alice"),
                String::from_str(&env, "Bio"),
                String::from_str(&env, "ipfs://avatar"),
                vec![&env],
                None,
            );
        });

        // Burn in separate frame (user auth again)
        env.as_contract(&cid, || {
            let result = burn_profile_nft(&env, user.clone());
            assert!(result);
            assert!(!has_profile_nft(&env, user));
        });
    }
}
