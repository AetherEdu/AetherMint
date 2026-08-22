#[cfg(test)]
mod tests {
    use crate::dna_services::verify_integrity;
    use crate::dna_storage::{
        create_checkpoint, delete_checkpoint, list_checkpoints, restore_checkpoint, DNACredential,
        DNASequence, DNAStorageKey, DNAStorageProtocol, DnaMetadata, ErrorCorrectionLevel,
        MAX_CHECKPOINTS,
    };
    use crate::lib::DataKey;
    use soroban_sdk::{testutils::Address as _, Address, Env, String, Vec};

    // ── helpers ──────────────────────────────────────────────────────────────

    fn setup(env: &Env) -> Address {
        let admin = Address::generate(env);
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::CredentialCount, &0u64);
        env.storage()
            .instance()
            .set(&DNAStorageKey::DNACredentialCount, &0u64);
        admin
    }

    fn insert_dummy_credential(env: &Env, id: u64) {
        let seq = DNASequence {
            sequence: Vec::new(env),
            length: 0,
            checksum: 0,
            metadata: DnaMetadata {
                encoding_version: 1,
                compression_level: 0,
                error_correction: 0,
                storage_timestamp: env.ledger().timestamp(),
                synthesis_batch: String::from_str(env, ""),
                sequencing_id: String::from_str(env, ""),
            },
        };
        let cred = DNACredential {
            credential_id: id,
            dna_sequence: seq,
            blockchain_ref: String::from_str(env, "cred_test"),
            synthesis_date: env.ledger().timestamp(),
            sequencing_date: None,
            storage_protocol: DNAStorageProtocol::Standard,
            error_correction: ErrorCorrectionLevel::None,
            integrity_hash: String::from_str(env, "hash"),
        };
        env.storage()
            .persistent()
            .set(&DNAStorageKey::DNACredential(id), &cred);
        let count: u64 = env
            .storage()
            .instance()
            .get(&DNAStorageKey::DNACredentialCount)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DNAStorageKey::DNACredentialCount, &(count.max(id)));
    }

    // ── tests ────────────────────────────────────────────────────────────────

    #[test]
    fn test_create_checkpoint() {
        let env = Env::default();
        setup(&env);
        insert_dummy_credential(&env, 1);
        insert_dummy_credential(&env, 2);

        let cp_id = create_checkpoint(&env, String::from_str(&env, "v1"));
        let list = list_checkpoints(&env);

        assert_eq!(list.len(), 1);
        assert_eq!(list.get(0).unwrap().data_size, 2);
        assert_eq!(list.get(0).unwrap().checkpoint_id, cp_id);
    }

    #[test]
    fn test_list_checkpoints() {
        let env = Env::default();
        setup(&env);

        env.ledger().with_mut(|l| l.sequence_number = 1);
        create_checkpoint(&env, String::from_str(&env, "a"));
        env.ledger().with_mut(|l| l.sequence_number = 2);
        create_checkpoint(&env, String::from_str(&env, "b"));
        env.ledger().with_mut(|l| l.sequence_number = 3);
        create_checkpoint(&env, String::from_str(&env, "c"));

        let list = list_checkpoints(&env);
        assert_eq!(list.len(), 3);
    }

    #[test]
    fn test_restore_checkpoint() {
        let env = Env::default();
        setup(&env);
        insert_dummy_credential(&env, 1);
        insert_dummy_credential(&env, 2);

        let cp_id = create_checkpoint(&env, String::from_str(&env, "snap"));

        // Add a credential after checkpoint
        insert_dummy_credential(&env, 3);
        assert_eq!(
            env.storage()
                .instance()
                .get::<_, u64>(&DNAStorageKey::DNACredentialCount)
                .unwrap(),
            3
        );

        // Restore should remove credential 3
        let ok = restore_checkpoint(&env, cp_id);
        assert!(ok);

        assert_eq!(
            env.storage()
                .instance()
                .get::<_, u64>(&DNAStorageKey::DNACredentialCount)
                .unwrap(),
            2
        );
        assert!(!env
            .storage()
            .persistent()
            .has(&DNAStorageKey::DNACredential(3)));
    }

    #[test]
    fn test_delete_checkpoint() {
        let env = Env::default();
        setup(&env);

        let cp_id = create_checkpoint(&env, String::from_str(&env, "del_me"));
        assert_eq!(list_checkpoints(&env).len(), 1);

        let deleted = delete_checkpoint(&env, cp_id);
        assert!(deleted);
        assert_eq!(list_checkpoints(&env).len(), 0);

        // Deleting again returns false
        assert!(!delete_checkpoint(&env, cp_id));
    }

    #[test]
    #[should_panic(expected = "Maximum checkpoint limit reached")]
    fn test_max_checkpoint_limit() {
        let env = Env::default();
        setup(&env);

        for i in 0..=MAX_CHECKPOINTS {
            // bump ledger sequence so each checkpoint gets a unique ID
            env.ledger().with_mut(|l| l.sequence_number += 1);
            create_checkpoint(&env, String::from_str(&env, "cp"));
        }
    }

    #[test]
    fn test_checkpoint_metadata_fields() {
        let env = Env::default();
        setup(&env);
        insert_dummy_credential(&env, 1);

        let cp_id = create_checkpoint(&env, String::from_str(&env, "meta_test"));
        let list = list_checkpoints(&env);
        let meta = list.get(0).unwrap();

        assert_eq!(meta.checkpoint_id, cp_id);
        assert_eq!(meta.data_size, 1);
        assert!(meta.hash != 0);
        assert!(meta.timestamp > 0);
    }

    #[test]
    fn test_verify_integrity_empty() {
        let env = Env::default();
        setup(&env);

        let report = verify_integrity(&env);
        assert!(report.is_healthy);
        assert_eq!(report.total_credentials, 0);
    }

    #[test]
    fn test_checkpoint_roundtrip_no_data_loss() {
        let env = Env::default();
        setup(&env);
        insert_dummy_credential(&env, 1);
        insert_dummy_credential(&env, 2);

        let cp_id = create_checkpoint(&env, String::from_str(&env, "roundtrip"));
        let ok = restore_checkpoint(&env, cp_id);
        assert!(ok);

        // Both credentials still present
        assert!(env
            .storage()
            .persistent()
            .has(&DNAStorageKey::DNACredential(1)));
        assert!(env
            .storage()
            .persistent()
            .has(&DNAStorageKey::DNACredential(2)));
    }
}
