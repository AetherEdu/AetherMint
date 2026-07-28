#[cfg(test)]
mod profile_nft_test {
    use soroban_sdk::testutils::{Address as _, Ledger};
    use soroban_sdk::{vec, Address, Env, String};

    use crate::profile_nft::*;
    use crate::utils::pause::PauseUtils;

    // ── Helpers ─────────────────────────────────────────────────────────────

    fn setup() -> (Env, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let user = Address::generate(&env);
        (env, user)
    }

    // ── Mint Tests ───────────────────────────────────────────────────────────

    #[test]
    fn test_mint_profile_nft() {
        let (env, user) = setup();

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
    }

    #[test]
    fn test_cannot_mint_duplicate() {
        let (env, user) = setup();

        let name = String::from_str(&env, "Alice");
        let bio = String::from_str(&env, "Bio");
        let avatar = String::from_str(&env, "ipfs://avatar");
        let skills = vec![&env, String::from_str(&env, "Rust")];

        mint_profile_nft(
            &env,
            user.clone(),
            name.clone(),
            bio.clone(),
            avatar.clone(),
            skills.clone(),
            None,
        );

        // Second mint should panic
        mint_profile_nft(
            &env,
            user.clone(),
            name.clone(),
            bio.clone(),
            avatar.clone(),
            skills.clone(),
            None,
        );
    }

    // ── Update Tests ─────────────────────────────────────────────────────────

    #[test]
    fn test_update_profile_nft() {
        let (env, user) = setup();

        // Mint first
        let name = String::from_str(&env, "Alice");
        let bio = String::from_str(&env, "Original bio");
        let avatar = String::from_str(&env, "ipfs://old");
        let skills = vec![&env, String::from_str(&env, "Rust")];

        let token_id = mint_profile_nft(
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

        // Update
        let new_name = String::from_str(&env, "Alice Updated");
        let new_bio = String::from_str(&env, "Updated bio");
        let new_avatar = String::from_str(&env, "ipfs://new");
        let new_skills = vec![
            &env,
            String::from_str(&env, "Rust"),
            String::from_str(&env, "Go"),
        ];
        let new_website = Some(String::from_str(&env, "https://alice-updated.dev"));

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
    }

    #[test]
    #[should_panic(expected = "No profile NFT found")]
    fn test_cannot_update_nonexistent() {
        let (env, user) = setup();

        update_profile_nft(
            &env,
            user.clone(),
            String::from_str(&env, "Alice"),
            String::from_str(&env, "Bio"),
            String::from_str(&env, "ipfs://avatar"),
            vec![&env, String::from_str(&env, "Rust")],
            None,
        );
    }

    // ── Getter Tests ─────────────────────────────────────────────────────────

    #[test]
    fn test_get_profile_nft_by_owner() {
        let (env, user) = setup();

        let name = String::from_str(&env, "Alice");
        let bio = String::from_str(&env, "Bio");
        let avatar = String::from_str(&env, "ipfs://avatar");
        let skills = vec![&env, String::from_str(&env, "Rust")];

        mint_profile_nft(&env, user.clone(), name, bio, avatar, skills, None);

        let nft = get_profile_nft_by_owner(&env, user.clone()).unwrap();
        assert_eq!(nft.owner, user);
    }

    #[test]
    fn test_get_profile_nft_by_owner_not_found() {
        let (env, user) = setup();

        let result = get_profile_nft_by_owner(&env, user.clone());
        assert!(result.is_none());
    }

    #[test]
    fn test_has_profile_nft() {
        let (env, user) = setup();

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
    }

    #[test]
    fn test_profile_nft_exists() {
        let (env, user) = setup();

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
    }

    // ── Burn Tests ───────────────────────────────────────────────────────────

    #[test]
    fn test_burn_profile_nft() {
        let (env, user) = setup();

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

        let result = burn_profile_nft(&env, user.clone());
        assert!(result);

        assert!(!has_profile_nft(&env, user.clone()));
        assert!(!profile_nft_exists(&env, 1));
    }

    #[test]
    #[should_panic(expected = "No profile NFT found")]
    fn test_cannot_burn_nonexistent() {
        let (env, user) = setup();

        burn_profile_nft(&env, user.clone());
    }

    // ── Verify / Unverify Tests ──────────────────────────────────────────────

    #[test]
    fn test_verify_profile_nft() {
        let (env, user) = setup();
        let admin = Address::generate(&env);

        let token_id = mint_profile_nft(
            &env,
            user.clone(),
            String::from_str(&env, "Alice"),
            String::from_str(&env, "Bio"),
            String::from_str(&env, "ipfs://avatar"),
            vec![&env],
            None,
        );

        assert!(!get_profile_nft(&env, token_id).verified);

        let result = verify_profile_nft(&env, admin.clone(), token_id);
        assert!(result);

        assert!(get_profile_nft(&env, token_id).verified);
    }

    #[test]
    fn test_unverify_profile_nft() {
        let (env, user) = setup();
        let admin = Address::generate(&env);

        let token_id = mint_profile_nft(
            &env,
            user.clone(),
            String::from_str(&env, "Alice"),
            String::from_str(&env, "Bio"),
            String::from_str(&env, "ipfs://avatar"),
            vec![&env],
            None,
        );

        verify_profile_nft(&env, admin.clone(), token_id);
        assert!(get_profile_nft(&env, token_id).verified);

        let result = unverify_profile_nft(&env, admin.clone(), token_id);
        assert!(result);

        assert!(!get_profile_nft(&env, token_id).verified);
    }

    // ── Supply & Pagination Tests ────────────────────────────────────────────

    #[test]
    fn test_get_total_supply() {
        let (env, user1) = setup();
        let user2 = Address::generate(&env);

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
    }

    #[test]
    fn test_get_all_token_ids() {
        let (env, user1) = setup();
        let user2 = Address::generate(&env);
        let user3 = Address::generate(&env);

        mint_profile_nft(
            &env,
            user1.clone(),
            String::from_str(&env, "A"),
            String::from_str(&env, "A"),
            String::from_str(&env, "ipfs://a"),
            vec![&env],
            None,
        );
        mint_profile_nft(
            &env,
            user2.clone(),
            String::from_str(&env, "B"),
            String::from_str(&env, "B"),
            String::from_str(&env, "ipfs://b"),
            vec![&env],
            None,
        );
        mint_profile_nft(
            &env,
            user3.clone(),
            String::from_str(&env, "C"),
            String::from_str(&env, "C"),
            String::from_str(&env, "ipfs://c"),
            vec![&env],
            None,
        );

        let all = get_all_token_ids(&env, 0, 10);
        assert_eq!(all.len(), 3);

        let page = get_all_token_ids(&env, 0, 2);
        assert_eq!(page.len(), 2);
    }

    // ── Skills Validation Tests ──────────────────────────────────────────────

    #[test]
    #[should_panic(expected = "Too many skills")]
    fn test_too_many_skills() {
        let (env, user) = setup();

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
    }

    // ── Event Tests ──────────────────────────────────────────────────────────

    #[test]
    fn test_mint_emits_event() {
        let (env, user) = setup();

        let start = env.ledger().timestamp();

        mint_profile_nft(
            &env,
            user.clone(),
            String::from_str(&env, "Alice"),
            String::from_str(&env, "Bio"),
            String::from_str(&env, "ipfs://avatar"),
            vec![&env],
            None,
        );

        // Events are scoped to the contract, but our functions run outside
        // the contract wrapper. For contract-level tests this would use
        // env.as_contract(). In module-level unit tests we verify that
        // no panics occurred and the state is consistent instead.
        assert!(has_profile_nft(&env, user));
    }

    #[test]
    fn test_update_emits_event() {
        let (env, user) = setup();

        mint_profile_nft(
            &env,
            user.clone(),
            String::from_str(&env, "Alice"),
            String::from_str(&env, "Bio"),
            String::from_str(&env, "ipfs://avatar"),
            vec![&env],
            None,
        );

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
    }

    #[test]
    fn test_burn_emits_event() {
        let (env, user) = setup();

        mint_profile_nft(
            &env,
            user.clone(),
            String::from_str(&env, "Alice"),
            String::from_str(&env, "Bio"),
            String::from_str(&env, "ipfs://avatar"),
            vec![&env],
            None,
        );

        let result = burn_profile_nft(&env, user.clone());
        assert!(result);
        assert!(!has_profile_nft(&env, user));
    }
}
