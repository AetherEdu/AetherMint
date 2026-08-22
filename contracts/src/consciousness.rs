use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Bytes, BytesN, Env, Map, Symbol, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ConsciousnessData {
    pub consciousness_id: Bytes,
    pub owner: Address,
    pub encoding_version: u32,
    pub neural_hash: BytesN<32>,
    pub knowledge_vector: Bytes,
    pub experience_timestamp: u64,
    pub continuity_proof: Bytes,
    pub evolution_stage: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContinuityProof {
    pub previous_consciousness_id: Option<Bytes>,
    pub lifetime_transition_hash: BytesN<32>,
    pub knowledge_transfer_ratio: u32, // Percentage 0-10000 (0-100%)
    pub memory_integrity_score: u32,   // 0-10000
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ConsciousnessMarketplaceItem {
    pub consciousness_id: Bytes,
    pub price: u64,
    pub access_duration: u64, // In seconds
    pub license_type: u32,     // 0: Full, 1: ReadOnly, 2: Learning
    pub verification_required: bool,
}

// Contract attribute disabled - this is a module used by main contract in lib.rs
// #[contract]
pub struct ConsciousnessContract;

#[contractimpl]
impl ConsciousnessContract {
    /// Upload consciousness data to blockchain
    pub fn upload_consciousness(
        env: Env,
        owner: Address,
        neural_data: Bytes,
        encoding_version: u32,
        continuity_proof: Option<ContinuityProof>,
    ) -> Bytes {
        // Generate unique consciousness ID using sha256
        let owner_str: soroban_sdk::String = owner.to_string();
        let owner_bytes: soroban_sdk::Bytes = crate::string_to_bytes(&env, &owner_str);
        
        let mut combined_id = Bytes::new(&env);
        combined_id.append(&owner_bytes);
        combined_id.append(&neural_data);
        let consciousness_id_hash = env.crypto().sha256(&combined_id);
        let consciousness_id = Bytes::from_slice(&env, &consciousness_id_hash.to_array());

        // Create neural hash for verification
        let neural_hash = env.crypto().sha256(&neural_data).into();

        // Create consciousness data structure
        let consciousness_data = ConsciousnessData {
            consciousness_id: consciousness_id.clone(),
            owner: owner.clone(),
            encoding_version,
            neural_hash,
            knowledge_vector: neural_data,
            experience_timestamp: env.ledger().timestamp(),
            continuity_proof: continuity_proof
                .as_ref()
                .map(|_proof| Bytes::from_slice(&env, &[0u8; 32]))
                .unwrap_or_else(|| Bytes::from_slice(&env, &[0u8; 32])),
            evolution_stage: 1u32,
        };

        // Store consciousness data
        let consciousness_key = Symbol::new(&env, "consciousness");
        let mut consciousness_map: Map<Bytes, ConsciousnessData> = env
            .storage()
            .instance()
            .get(&consciousness_key)
            .unwrap_or_else(|| Map::new(&env));

        consciousness_map.set(consciousness_id.clone(), consciousness_data);
        env.storage()
            .instance()
            .set(&consciousness_key, &consciousness_map);

        // Update owner's consciousness list
        let owner_key = Symbol::new(&env, "owner_consciousnesses");
        let mut owner_map: Map<Address, Vec<Bytes>> = env
            .storage()
            .instance()
            .get(&owner_key)
            .unwrap_or_else(|| Map::new(&env));

        let mut consciousness_list = owner_map
            .get(owner.clone())
            .unwrap_or_else(|| Vec::new(&env));
        consciousness_list.push_back(consciousness_id.clone());
        owner_map.set(owner, consciousness_list);
        env.storage().instance().set(&owner_key, &owner_map);

        consciousness_id
    }

    /// Verify consciousness integrity and authenticity
    pub fn verify_consciousness(env: Env, consciousness_id: Bytes, verification_hash: BytesN<32>) -> bool {
        let consciousness_key = Symbol::new(&env, "consciousness");
        let consciousness_map: Map<Bytes, ConsciousnessData> = env
            .storage()
            .instance()
            .get(&consciousness_key)
            .unwrap_or_else(|| Map::new(&env));

        if let Some(consciousness_data) = consciousness_map.get(consciousness_id) {
            // Verify neural hash matches
            let verification_hash_bytes: BytesN<32> = verification_hash.into();
            consciousness_data.neural_hash == verification_hash_bytes
        } else {
            false
        }
    }

    /// Transfer consciousness between platforms or owners
    pub fn transfer_consciousness(
        env: Env,
        consciousness_id: Bytes,
        new_owner: Address,
        transfer_proof: Bytes,
    ) -> bool {
        let consciousness_key = Symbol::new(&env, "consciousness");
        let mut consciousness_map: Map<Bytes, ConsciousnessData> = env
            .storage()
            .instance()
            .get(&consciousness_key)
            .unwrap_or_else(|| Map::new(&env));

        if let Some(consciousness_data) = consciousness_map.get(consciousness_id.clone()) {
            let old_owner = consciousness_data.owner.clone();

            // Verify transfer proof (simplified)
            let proof_hash: BytesN<32> = env.crypto().sha256(&transfer_proof).into();
            
            let mut expected_data = Bytes::new(&env);
            expected_data.append(&consciousness_id);
            expected_data.append(&Bytes::from_slice(&env, b"transfer"));
            let expected_hash: BytesN<32> = env.crypto().sha256(&expected_data).into();

            if proof_hash != expected_hash {
                return false;
            }

            // Update owner
            let mut updated_data = consciousness_data;
            updated_data.owner = new_owner.clone();
            consciousness_map.set(consciousness_id.clone(), updated_data);
            env.storage()
                .instance()
                .set(&consciousness_key, &consciousness_map);

            // Update owner consciousness lists
            let owner_key = Symbol::new(&env, "owner_consciousnesses");
            let mut owner_map: Map<Address, Vec<Bytes>> = env
                .storage()
                .instance()
                .get(&owner_key)
                .unwrap_or_else(|| Map::new(&env));

            // Remove from old owner
            if let Some(old_list) = owner_map.get(old_owner.clone()) {
                let mut new_list: Vec<Bytes> = Vec::new(&env);
                for i in 0..old_list.len() {
                    let id = old_list.get(i).unwrap();
                    if id != consciousness_id {
                        new_list.push_back(id);
                    }
                }
                owner_map.set(old_owner, new_list);
            }

            // Add to new owner
            let mut new_list = owner_map
                .get(new_owner.clone())
                .unwrap_or_else(|| Vec::new(&env));
            new_list.push_back(consciousness_id.clone());
            owner_map.set(new_owner, new_list);
            env.storage().instance().set(&owner_key, &owner_map);

            true
        } else {
            false
        }
    }

    /// Create continuity proof for lifetime transitions
    pub fn create_continuity_proof(
        env: Env,
        current_consciousness_id: Bytes,
        previous_consciousness_id: Option<Bytes>,
        knowledge_transfer_data: Bytes,
    ) -> ContinuityProof {
        let mut combined_hash = Bytes::new(&env);
        combined_hash.append(&current_consciousness_id);
        combined_hash.append(&knowledge_transfer_data);
        let lifetime_transition_hash: BytesN<32> = env.crypto().sha256(&combined_hash).into();

        // Calculate knowledge transfer ratio
        let knowledge_transfer_ratio = if knowledge_transfer_data.is_empty() {
            0
        } else {
            let ratio = knowledge_transfer_data.len() as u32 * 10;
            if ratio > 10000 { 10000 } else { ratio }
        };

        // Calculate memory integrity score
        let memory_integrity_score = if knowledge_transfer_data.is_empty() {
            5000
        } else {
            let score = knowledge_transfer_data.len() as u32 * 15;
            if score > 10000 { 10000 } else { score }
        };

        ContinuityProof {
            previous_consciousness_id,
            lifetime_transition_hash,
            knowledge_transfer_ratio,
            memory_integrity_score,
        }
    }

    /// List consciousness on marketplace
    pub fn list_on_marketplace(
        env: Env,
        consciousness_id: Bytes,
        price: u64,
        access_duration: u64,
        license_type: u32,
    ) -> bool {
        let consciousness_key = Symbol::new(&env, "consciousness");
        let consciousness_map: Map<Bytes, ConsciousnessData> = env
            .storage()
            .instance()
            .get(&consciousness_key)
            .unwrap_or_else(|| Map::new(&env));

        // Verify consciousness exists and caller is owner
        if let Some(_consciousness_data) = consciousness_map.get(consciousness_id.clone()) {
            let marketplace_key = Symbol::new(&env, "marketplace");
            let mut marketplace_map: Map<Bytes, ConsciousnessMarketplaceItem> = env
                .storage()
                .instance()
                .get(&marketplace_key)
                .unwrap_or_else(|| Map::new(&env));

            let marketplace_item = ConsciousnessMarketplaceItem {
                consciousness_id: consciousness_id.clone(),
                price,
                access_duration,
                license_type,
                verification_required: true,
            };

            marketplace_map.set(consciousness_id, marketplace_item);
            env.storage()
                .instance()
                .set(&marketplace_key, &marketplace_map);

            true
        } else {
            false
        }
    }

    /// Purchase access to consciousness data
    pub fn purchase_consciousness_access(
        env: Env,
        consciousness_id: Bytes,
        buyer: Address,
        payment_proof: Bytes,
    ) -> bool {
        let marketplace_key = Symbol::new(&env, "marketplace");
        let marketplace_map: Map<Bytes, ConsciousnessMarketplaceItem> = env
            .storage()
            .instance()
            .get(&marketplace_key)
            .unwrap_or_else(|| Map::new(&env));

        if let Some(marketplace_item) = marketplace_map.get(consciousness_id.clone()) {
            // Verify payment (simplified)
            let payment_hash: BytesN<32> = env.crypto().sha256(&payment_proof).into();
            let buyer_str: soroban_sdk::String = buyer.to_string();
            let buyer_bytes: soroban_sdk::Bytes = crate::string_to_bytes(&env, &buyer_str);
            let mut expected_data = Bytes::new(&env);
            expected_data.append(&Bytes::from_slice(&env, b"payment"));
            expected_data.append(&buyer_bytes);
            let expected_hash: BytesN<32> = env.crypto().sha256(&expected_data).into();

            if payment_hash != expected_hash {
                return false;
            }

            // Grant access by creating access record
            let access_key = Symbol::new(&env, "access_grants");
            let mut access_map: Map<Address, Vec<(Bytes, u64)>> = env
                .storage()
                .instance()
                .get(&access_key)
                .unwrap_or_else(|| Map::new(&env));

            let mut access_list = access_map
                .get(buyer.clone())
                .unwrap_or_else(|| Vec::new(&env));
            let expiry_time = env.ledger().timestamp() + marketplace_item.access_duration;
            access_list.push_back((consciousness_id, expiry_time));
            access_map.set(buyer, access_list);
            env.storage().instance().set(&access_key, &access_map);

            true
        } else {
            false
        }
    }

    /// Update consciousness evolution stage
    pub fn update_evolution(env: Env, consciousness_id: Bytes, new_knowledge: Bytes) -> bool {
        let consciousness_key = Symbol::new(&env, "consciousness");
        let mut consciousness_map: Map<Bytes, ConsciousnessData> = env
            .storage()
            .instance()
            .get(&consciousness_key)
            .unwrap_or_else(|| Map::new(&env));

        if let Some(mut consciousness_data) = consciousness_map.get(consciousness_id.clone()) {
            // Update knowledge vector and evolution stage
            consciousness_data.knowledge_vector = new_knowledge;
            consciousness_data.evolution_stage += 1u32;
            consciousness_data.experience_timestamp = env.ledger().timestamp();

            // Recalculate neural hash
            consciousness_data.neural_hash =
                env.crypto().sha256(&consciousness_data.knowledge_vector).into();

            consciousness_map.set(consciousness_id, consciousness_data);
            env.storage()
                .instance()
                .set(&consciousness_key, &consciousness_map);

            true
        } else {
            false
        }
    }

    /// Get consciousness metadata
    pub fn get_consciousness_metadata(env: Env, consciousness_id: Bytes) -> ConsciousnessData {
        let consciousness_key = Symbol::new(&env, "consciousness");
        let consciousness_map: Map<Bytes, ConsciousnessData> = env
            .storage()
            .instance()
            .get(&consciousness_key)
            .unwrap_or_else(|| Map::new(&env));

        let cid = consciousness_id.clone();
        let result = consciousness_map
            .get(cid.clone())
            .unwrap_or_else(|| panic!("Consciousness not found"));
        result
    }

    /// Get all consciousnesses owned by an address
    pub fn get_owned_consciousnesses(env: Env, owner: Address) -> Vec<Bytes> {
        let owner_key = Symbol::new(&env, "owner_consciousnesses");
        let owner_map: Map<Address, Vec<Bytes>> = env
            .storage()
            .instance()
            .get(&owner_key)
            .unwrap_or_else(|| Map::new(&env));

        owner_map.get(owner.clone()).unwrap_or_else(|| Vec::new(&env))
    }
}
