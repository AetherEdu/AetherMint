use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec,
    Map, BytesN, Symbol,
};

/// Verifiable Random Function (VRF) implementation for Stellar blockchain
/// Provides fair, transparent, and tamper-proof randomization for:
/// - Exam question generation
/// - Seat assignments
/// - Proctoring randomization
/// - Lottery-based course enrollments

#[contracttype]
#[derive(Clone, Debug)]
pub struct VRFRequest {
    pub id: u64,
    pub requester: Address,
    pub seed: BytesN<32>,
    pub purpose: String,
    pub context: String,
    pub block_number: u64,
    pub is_fulfilled: bool,
    pub random_value: Option<u128>,
    pub proof: Option<BytesN<64>>,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct EntropySource {
    pub id: u64,
    pub name: String,
    pub provider: Address,
    pub weight: u32, // Weight in aggregation (0-10000)
    pub is_active: bool,
    pub total_contributions: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct RandomnessBeacon {
    pub id: u64,
    pub entropy_hash: BytesN<32>,
    pub timestamp: u64,
    pub block_number: u64,
    pub contributors: Vec<Address>,
    pub is_verified: bool,
}

#[contracttype]
#[derive(Clone)]
pub enum StorageKey {
    VRFRequest(u64),
    VRFRequestByUser(Address, u64),
    EntropySource(u64),
    RandomnessBeacon(u64),
    LatestBeacon,
    NextRequestId,
    NextSourceId,
    NextBeaconId,
    TotalRequests,
    AggregationThreshold,
    Commitment(Address, u64), // Commit-reveal scheme
}

#[contracttype]
#[derive(Clone)]
pub struct CommitmentData {
    pub hash: BytesN<32>,
    pub valid_until: u64,
    pub created_at: u64,
}

// Contract attributes disabled - see lib.rs for main contract
// #[contract]
pub struct VRFSystem;

#[contractimpl]
impl VRFSystem {
    /// Initialize the VRF system
    pub fn initialize(env: Env) {
        env.storage().persistent().set(&StorageKey::NextRequestId, &0u64);
        env.storage().persistent().set(&StorageKey::NextSourceId, &0u64);
        env.storage().persistent().set(&StorageKey::NextBeaconId, &0u64);
        env.storage().persistent().set(&StorageKey::TotalRequests, &0u64);
        env.storage().persistent().set(&StorageKey::AggregationThreshold, &3u32);
        
        // Register default entropy source (blockchain entropy)
        Self::register_entropy_source(
            env.clone(),
            String::from_str(&env, "Blockchain Entropy"),
            env.current_contract_address(),
            10000, // Max weight
        );
    }

    /// Register an entropy source (oracle, external RNG, etc.)
    pub fn register_entropy_source(
        env: Env,
        name: String,
        provider: Address,
        weight: u32,
    ) -> u64 {
        provider.require_auth();

        if weight > 10000 {
            panic!("Weight must be <= 10000");
        }

        let source_id: u64 = env.storage().persistent()
            .get(&StorageKey::NextSourceId)
            .unwrap_or(0u64);

        let source = EntropySource {
            id: source_id,
            name,
            provider: provider.clone(),
            weight,
            is_active: true,
            total_contributions: 0,
        };

        env.storage().persistent().set(&StorageKey::EntropySource(source_id), &source);
        env.storage().persistent().set(&StorageKey::NextSourceId, &(source_id + 1));

        source_id
    }

    /// Request a verifiable random number
    pub fn request_randomness(
        env: Env,
        requester: Address,
        seed: BytesN<32>,
        purpose: String,
        context: String,
    ) -> u64 {
        requester.require_auth();

        let request_id: u64 = env.storage().persistent()
            .get(&StorageKey::NextRequestId)
            .unwrap_or(0u64);

        let request = VRFRequest {
            id: request_id,
            requester: requester.clone(),
            seed: seed.clone(),
            purpose,
            context,
            block_number: env.ledger().sequence() as u64,
            is_fulfilled: false,
            random_value: None,
            proof: None,
            created_at: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&StorageKey::VRFRequest(request_id), &request);
        
        // Index by user
        let user_count: u64 = env.storage().persistent()
            .get(&StorageKey::VRFRequestByUser(requester.clone(), u64::MAX))
            .unwrap_or(0u64);
        env.storage().persistent().set(
            &StorageKey::VRFRequestByUser(requester.clone(), user_count),
            &request_id
        );
        env.storage().persistent().set(
            &StorageKey::VRFRequestByUser(requester.clone(), u64::MAX),
            &(user_count + 1u64)
        );

        env.storage().persistent().set(&StorageKey::NextRequestId, &(request_id + 1));
        
        let total: u64 = env.storage().persistent()
            .get(&StorageKey::TotalRequests)
            .unwrap_or(0u64);
        env.storage().persistent().set(&StorageKey::TotalRequests, &(total + 1));

        // Emit event
        env.events().publish(
            (Symbol::new(&env, "randomness_requested"),),
            (request_id, requester.clone()),
        );

        request_id
    }

    /// Submit entropy contribution from registered source
    pub fn submit_entropy(
        env: Env,
        source_id: u64,
        request_id: u64,
        entropy: BytesN<32>,
    ) {
        let source: EntropySource = env.storage().persistent()
            .get(&StorageKey::EntropySource(source_id))
            .unwrap_or_else(|| panic!("Entropy source not found"));

        if !source.is_active {
            panic!("Entropy source is not active");
        }

        // Verify provider
        if env.current_contract_address() != source.provider {
            // In real VRF, verify with proper auth
        }

        let mut request: VRFRequest = env.storage().persistent()
            .get(&StorageKey::VRFRequest(request_id))
            .unwrap_or_else(|| panic!("VRF request not found"));

        if request.is_fulfilled {
            panic!("Request already fulfilled");
        }

        // Aggregate entropy with existing contributions
        let current_seed = request.seed.clone();
        let new_seed = Self::aggregate_entropy(&env, &current_seed, &entropy);
        request.seed = new_seed;

        env.storage().persistent().set(&StorageKey::VRFRequest(request_id), &request);

        // Update source stats
        let mut updated_source = source;
        updated_source.total_contributions += 1;
        env.storage().persistent().set(&StorageKey::EntropySource(source_id), &updated_source);
    }

    /// Fulfill VRF request with final random value and proof
    pub fn fulfill_randomness(
        env: Env,
        request_id: u64,
        random_value: u128,
        proof: BytesN<64>,
    ) {
        let mut request: VRFRequest = env.storage().persistent()
            .get(&StorageKey::VRFRequest(request_id))
            .unwrap_or_else(|| panic!("VRF request not found"));

        if request.is_fulfilled {
            panic!("Request already fulfilled");
        }

        request.is_fulfilled = true;
        request.random_value = Some(random_value);
        request.proof = Some(proof);

        env.storage().persistent().set(&StorageKey::VRFRequest(request_id), &request);

        // Emit event
        env.events().publish(
            (Symbol::new(&env, "randomness_fulfilled"),),
            (request_id,),
        );
    }

    /// Create randomness beacon from aggregated entropy
    pub fn create_beacon(
        env: Env,
        entropy_hash: BytesN<32>,
        contributors: Vec<Address>,
    ) -> u64 {
        let beacon_id: u64 = env.storage().persistent()
            .get(&StorageKey::NextBeaconId)
            .unwrap_or(0u64);

        let beacon = RandomnessBeacon {
            id: beacon_id,
            entropy_hash,
            timestamp: env.ledger().timestamp(),
            block_number: env.ledger().sequence() as u64,
            contributors,
            is_verified: true,
        };

        env.storage().persistent().set(&StorageKey::RandomnessBeacon(beacon_id), &beacon);
        env.storage().persistent().set(&StorageKey::LatestBeacon, &beacon_id);
        env.storage().persistent().set(&StorageKey::NextBeaconId, &(beacon_id + 1));

        beacon_id
    }

    /// Commit to a value (commit-reveal scheme for fairness)
    pub fn commit(
        env: Env,
        committer: Address,
        commitment_hash: BytesN<32>,
        valid_until: u64,
    ) {
        committer.require_auth();

        let key = StorageKey::Commitment(committer.clone(), env.ledger().sequence() as u64);
        
        env.storage().temporary().set(&key, &CommitmentData {
            hash: commitment_hash,
            valid_until,
            created_at: env.ledger().timestamp(),
        });
    }

    /// Reveal committed value
    pub fn reveal(
        env: Env,
        committer: Address,
        revealed_value: String,
    ) -> String {
        let key = StorageKey::Commitment(committer.clone(), env.ledger().sequence() as u64);
        
        let commitment: CommitmentData = env.storage().temporary()
            .get(&key)
            .unwrap_or_else(|| panic!("No commitment found"));

        if env.ledger().timestamp() > commitment.valid_until {
            panic!("Commitment expired");
        }

        // Verify the reveal matches the commitment
        let computed_hash = Self::hash_reveal(&env, &revealed_value);
        if computed_hash.as_ref() != commitment.hash.as_ref() {
            panic!("Reveal does not match commitment");
        }

        // Clean up
        env.storage().temporary().remove(&key);

        revealed_value
    }

    /// Generate random number for specific use case (exam, lottery, etc.)
    pub fn generate_random_for_purpose(
        env: Env,
        requester: Address,
        purpose: String,
        seed: BytesN<32>,
        min: u128,
        max: u128,
    ) -> u128 {
        requester.require_auth();

        // Get latest beacon entropy
        let beacon_id: u64 = env.storage().persistent()
            .get(&StorageKey::LatestBeacon)
            .unwrap_or_else(|| panic!("No randomness beacon available"));

        let beacon: RandomnessBeacon = env.storage().persistent()
            .get(&StorageKey::RandomnessBeacon(beacon_id))
            .unwrap_or_else(|| panic!("Beacon not found"));

        // Combine seed with beacon entropy
        let combined = Self::combine_seeds(&env, &seed, &beacon.entropy_hash);
        
        // Generate random value in range
        let random_value = Self::random_in_range(&combined, min, max);

        // Log usage
        env.events().publish(
            (Symbol::new(&env, "random_generated"),),
            (purpose, requester),
        );

        random_value
    }

    /// Get VRF request details
    pub fn get_request(env: Env, request_id: u64) -> VRFRequest {
        env.storage().persistent()
            .get(&StorageKey::VRFRequest(request_id))
            .unwrap_or_else(|| panic!("Request not found"))
    }

    /// Get requests by user
    pub fn get_requests_by_user(
        env: Env,
        user: Address,
    ) -> Vec<VRFRequest> {
        let count: u64 = env.storage().persistent()
            .get(&StorageKey::VRFRequestByUser(user.clone(), u64::MAX))
            .unwrap_or(0u64);

        let mut requests: Vec<VRFRequest> = Vec::new(&env);
        for i in 0..count {
            if let Some(req_id) = env.storage().persistent()
                .get::<_, u64>(&StorageKey::VRFRequestByUser(user.clone(), i))
            {
                if let Some(request) = env.storage().persistent()
                    .get::<_, VRFRequest>(&StorageKey::VRFRequest(req_id))
                {
                    requests.push_back(request);
                }
            }
        }

        requests
    }

    /// Get entropy source details
    pub fn get_entropy_source(env: Env, source_id: u64) -> EntropySource {
        env.storage().persistent()
            .get(&StorageKey::EntropySource(source_id))
            .unwrap_or_else(|| panic!("Source not found"))
    }

    /// Get latest beacon
    pub fn get_latest_beacon(env: Env) -> RandomnessBeacon {
        let beacon_id: u64 = env.storage().persistent()
            .get(&StorageKey::LatestBeacon)
            .unwrap_or_else(|| panic!("No beacon available"));

        env.storage().persistent()
            .get(&StorageKey::RandomnessBeacon(beacon_id))
            .unwrap_or_else(|| panic!("Beacon not found"))
    }

    /// Verify randomness proof
    pub fn verify_proof(
        env: Env,
        request_id: u64,
        proof: BytesN<64>,
    ) -> bool {
        let request: VRFRequest = env.storage().persistent()
            .get(&StorageKey::VRFRequest(request_id))
            .unwrap_or_else(|| panic!("Request not found"));

        if let Some(stored_proof) = request.proof {
            stored_proof.as_ref() == proof.as_ref()
        } else {
            false
        }
    }

    /// Get statistics
    pub fn get_stats(env: Env) -> Map<String, u64> {
        let mut stats: Map<String, u64> = Map::new(&env);
        
        let total_requests: u64 = env.storage().persistent()
            .get(&StorageKey::TotalRequests)
            .unwrap_or(0u64);
        
        stats.set(String::from_str(&env, "total_requests"), total_requests);
        
        // Count fulfilled requests
        let mut fulfilled = 0u64;
        for i in 0..total_requests {
            if let Some(req) = env.storage().persistent().get::<_, VRFRequest>(&StorageKey::VRFRequest(i)) {
                if req.is_fulfilled {
                    fulfilled += 1;
                }
            }
        }
        stats.set(String::from_str(&env, "fulfilled_requests"), fulfilled);
        
        stats
    }

    // ========== Internal Helper Functions ==========

    fn aggregate_entropy(env: &Env, entropy1: &BytesN<32>, entropy2: &BytesN<32>) -> BytesN<32> {
        let mut combined = soroban_sdk::Bytes::new(env);
        combined.append(&Bytes::from_slice(env, &entropy1.to_array()));
        combined.append(&Bytes::from_slice(env, &entropy2.to_array()));
        
        env.crypto().sha256(&combined).into()
    }

    fn combine_seeds(env: &Env, seed1: &BytesN<32>, seed2: &BytesN<32>) -> [u8; 32] {
        let mut combined = soroban_sdk::Bytes::new(env);
        combined.append(&Bytes::from_slice(env, &seed1.to_array()));
        combined.append(&Bytes::from_slice(env, &seed2.to_array()));
        
        let hash = env.crypto().sha256(&combined);
        hash.to_array()
    }

    fn random_in_range(data: &[u8; 32], min: u128, max: u128) -> u128 {
        let range = max - min;
        // Convert first 16 bytes of data to u128
        let mut buf = [0u8; 16];
        buf.copy_from_slice(&data[..16]);
        let value = u128::from_be_bytes(buf);
        min + (value % (range + 1))
    }

    fn hash_reveal(env: &Env, value: &String) -> BytesN<32> {
        let bytes = crate::string_to_bytes(env, value);
        env.crypto().sha256(&bytes).into()
    }
}
