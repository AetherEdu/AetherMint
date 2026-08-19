use crate::dna_storage::{verify_dna_credential, DNACredential, DNAStorageKey, DNAStorageProtocol};
use soroban_sdk::{contracttype, Address, Bytes, Env, String, Symbol, Vec};

/// DNA synthesis request structure
#[contracttype]
#[derive(Clone)]
pub struct SynthesisRequest {
    pub request_id: u64,
    pub credential_ids: Vec<u64>,
    pub synthesis_protocol: DNAStorageProtocol,
    pub priority_level: u32, // 0=low, 1=medium, 2=high
    pub requested_by: Address,
    pub timestamp: u64,
    pub status: SynthesisStatus,
    pub estimated_completion: u64,
}

/// Synthesis status enumeration
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SynthesisStatus {
    Pending = 0,
    InProgress = 1,
    Completed = 2,
    Failed = 3,
    Cancelled = 4,
}

/// DNA sequencing result structure
#[contracttype]
#[derive(Clone)]
pub struct SequencingResult {
    pub sequencing_id: String,
    pub credential_id: u64,
    pub raw_sequence: Bytes,
    pub quality_score: u32,  // Phred quality score scaled by 10
    pub coverage_depth: u32, // Sequencing coverage
    pub error_rate: u32,     // Measured error rate in basis points (10000 = 100%)
    pub timestamp: u64,
    pub verification_status: bool,
}

/// Hybrid storage reference
#[contracttype]
#[derive(Clone)]
pub struct HybridStorageRef {
    pub credential_id: u64,
    pub dna_sequence_id: String,
    pub blockchain_tx_hash: String,
    pub ipfs_hash: String,
    pub synthesis_batch: String,
    pub sequencing_id: Option<String>,
    pub created_at: u64,
    pub last_verified: u64,
}

/// DNA synthesis and sequencing service interface
#[contracttype]
pub enum DNABioService {
    SynthesisRequest(u64),
    SequencingResult(String),
    ServiceStatus,
    QueuePosition(u64),
}

/// Quality metrics for DNA storage
#[contracttype]
#[derive(Clone)]
pub struct DNAQualityMetrics {
    pub data_density: u32,            // Bits per base, scaled by 10000
    pub error_rate: u32,              // Measured error rate in basis points
    pub retention_time: u64,          // Expected retention (years)
    pub synthesis_success_rate: u32,  // basis points
    pub sequencing_success_rate: u32, // basis points
    pub overall_reliability: u32,     // basis points
}

/// Request DNA synthesis for credentials
pub fn request_dna_synthesis(
    env: &Env,
    credential_ids: Vec<u64>,
    protocol: DNAStorageProtocol,
    priority: u8,
    requester: Address,
) -> u64 {
    requester.require_auth();

    // Validate credentials exist
    for cred_id in credential_ids.iter() {
        if !env
            .storage()
            .persistent()
            .has(&DNAStorageKey::DNACredential(cred_id))
        {
            panic!("Credential {} not found in DNA storage", cred_id);
        }
    }

    let request_id = env.ledger().sequence() as u64 + 1000; // Use sequence for unique ID
    let current_time = env.ledger().timestamp();

    // Estimate completion time based on priority and protocol
    let base_time = match protocol {
        DNAStorageProtocol::Standard => 86400 * 7,   // 1 week
        DNAStorageProtocol::Indexed => 86400 * 10,   // 10 days
        DNAStorageProtocol::Redundant => 86400 * 14, // 2 weeks
        DNAStorageProtocol::Hybrid => 86400 * 5,     // 5 days
    };

    let estimated_completion = current_time
        + match priority {
            0 => base_time * 2, // Low priority - slower
            1 => base_time,     // Medium priority
            2 => base_time / 2, // High priority - faster
            _ => base_time,
        };

    let synthesis_request = SynthesisRequest {
        request_id,
        credential_ids: credential_ids.clone(),
        synthesis_protocol: protocol,
        priority_level: priority as u32,
        requested_by: requester,
        timestamp: current_time,
        status: SynthesisStatus::Pending,
        estimated_completion,
    };

    // Store synthesis request
    env.storage().persistent().set(
        &DNABioService::SynthesisRequest(request_id),
        &synthesis_request,
    );

    // Add to synthesis queue
    add_to_synthesis_queue(env, request_id, priority);

    // Emit event
    env.events().publish(
        (
            Symbol::new(env, "dna"),
            Symbol::new(env, "synthesis_requested"),
        ),
        (request_id, credential_ids.len()),
    );

    request_id
}

/// Process DNA synthesis results
pub fn process_synthesis_results(
    env: &Env,
    request_id: u64,
    batch_id: String,
    success: bool,
    processed_credentials: Vec<u64>,
) -> bool {
    // Validate request exists
    let mut request: SynthesisRequest = env
        .storage()
        .persistent()
        .get(&DNABioService::SynthesisRequest(request_id))
        .unwrap_or_else(|| panic!("Synthesis request not found"));

    if request.status != SynthesisStatus::Pending && request.status != SynthesisStatus::InProgress {
        panic!("Request cannot be processed in current status");
    }

    // Update request status
    request.status = if success {
        SynthesisStatus::Completed
    } else {
        SynthesisStatus::Failed
    };

    // Update credential synthesis information
    for cred_id in processed_credentials.iter() {
        if let Some(mut dna_cred) = env
            .storage()
            .persistent()
            .get::<_, DNACredential>(&DNAStorageKey::DNACredential(cred_id))
        {
            dna_cred.dna_sequence.metadata.synthesis_batch = batch_id.clone();
            dna_cred.synthesis_date = env.ledger().timestamp();
            env.storage()
                .persistent()
                .set(&DNAStorageKey::DNACredential(cred_id), &dna_cred);
        }
    }

    // Store updated request
    env.storage()
        .persistent()
        .set(&DNABioService::SynthesisRequest(request_id), &request);

    // Remove from queue
    remove_from_synthesis_queue(env, request_id);

    // Emit event
    env.events().publish(
        (
            Symbol::new(env, "dna"),
            Symbol::new(env, "synthesis_completed"),
        ),
        (request_id, success),
    );

    true
}

/// Request DNA sequencing for verification
pub fn request_dna_sequencing(
    env: &Env,
    credential_id: u64,
    verification_level: u8, // 0=basic, 1=enhanced, 2=comprehensive
    requester: Address,
) -> String {
    requester.require_auth();

    // Validate credential exists and has been synthesized
    let dna_credential: DNACredential = env
        .storage()
        .persistent()
        .get(&DNAStorageKey::DNACredential(credential_id))
        .unwrap_or_else(|| panic!("DNA credential not found"));

    if dna_credential
        .dna_sequence
        .metadata
        .synthesis_batch
        .is_empty()
    {
        panic!("Credential must be synthesized before sequencing");
    }

    let sequencing_id = crate::str_cat(
        env,
        &crate::u64_to_string(env, credential_id, "seq_"),
        &crate::u64_to_string(env, env.ledger().timestamp(), "_"),
    );
    let current_time = env.ledger().timestamp();

    // Create sequencing request (simplified - in production would interface with lab)
    let sequencing_result = SequencingResult {
        sequencing_id: sequencing_id.clone(),
        credential_id,
        raw_sequence: dna_credential.dna_sequence.sequence.clone(),
        quality_score: 350, // Typical Phred score (35.0 * 10)
        coverage_depth: match verification_level {
            0 => 30,  // Basic coverage
            1 => 100, // Enhanced coverage
            2 => 200, // Comprehensive coverage
            _ => 30,
        },
        error_rate: 10, // Target error rate (0.1% = 10 bps)
        timestamp: current_time,
        verification_status: false, // Will be updated after verification
    };

    // Store sequencing result
    env.storage().persistent().set(
        &DNABioService::SequencingResult(sequencing_id.clone()),
        &sequencing_result,
    );

    // Update credential
    if let Some(mut cred) = env
        .storage()
        .persistent()
        .get::<_, DNACredential>(&DNAStorageKey::DNACredential(credential_id))
    {
        cred.sequencing_date = Some(current_time);
        cred.dna_sequence.metadata.sequencing_id = sequencing_id.clone();
        env.storage()
            .persistent()
            .set(&DNAStorageKey::DNACredential(credential_id), &cred);
    }

    // Emit event
    env.events().publish(
        (
            Symbol::new(env, "dna"),
            Symbol::new(env, "sequencing_requested"),
        ),
        (credential_id, sequencing_id.clone()),
    );

    sequencing_id
}

/// Verify sequencing results against original DNA
pub fn verify_sequencing_results(
    env: &Env,
    sequencing_id: String,
    actual_sequence: Bytes,
    quality_metrics: DNAQualityMetrics,
) -> bool {
    // Get sequencing result
    let mut result: SequencingResult = env
        .storage()
        .persistent()
        .get(&DNABioService::SequencingResult(sequencing_id.clone()))
        .unwrap_or_else(|| panic!("Sequencing result not found"));

    // Get original DNA credential
    let dna_credential: DNACredential = env
        .storage()
        .persistent()
        .get(&DNAStorageKey::DNACredential(result.credential_id))
        .unwrap_or_else(|| panic!("DNA credential not found"));

    // Compare sequences
    let sequence_match =
        compare_dna_sequences(&dna_credential.dna_sequence.sequence, &actual_sequence);

    // Update result with actual metrics
    result.raw_sequence = actual_sequence;
    // Convert synthesis success rate to a Phred-scaled score (bps * 40 -> scale by 10).
    result.quality_score = quality_metrics.synthesis_success_rate * 4 / 100;
    // Convert bits-per-base (scaled by 10000) into a coverage depth.
    result.coverage_depth = quality_metrics.data_density * 100 / 10000;
    result.error_rate = quality_metrics.error_rate;
    result.verification_status = sequence_match;

    // Store updated result
    env.storage().persistent().set(
        &DNABioService::SequencingResult(sequencing_id.clone()),
        &result,
    );

    // Update credential verification status
    if sequence_match {
        if let Some(mut cred) = env
            .storage()
            .persistent()
            .get::<_, DNACredential>(&DNAStorageKey::DNACredential(result.credential_id))
        {
            cred.dna_sequence.metadata.sequencing_id = sequencing_id.clone();
            env.storage()
                .persistent()
                .set(&DNAStorageKey::DNACredential(result.credential_id), &cred);
        }
    }

    // Emit verification event
    env.events().publish(
        (
            Symbol::new(env, "dna"),
            Symbol::new(env, "sequencing_verified"),
        ),
        (result.credential_id, sequence_match),
    );

    sequence_match
}

/// Create hybrid storage reference
pub fn create_hybrid_reference(
    env: &Env,
    credential_id: u64,
    blockchain_tx: String,
    ipfs_hash: String,
) -> String {
    let dna_credential: DNACredential = env
        .storage()
        .persistent()
        .get(&DNAStorageKey::DNACredential(credential_id))
        .unwrap_or_else(|| panic!("DNA credential not found"));

    let current_time = env.ledger().timestamp();
    let reference_id = crate::str_cat(
        env,
        &crate::u64_to_string(env, credential_id, "hybrid_"),
        &crate::u64_to_string(env, current_time, "_"),
    );

    let hybrid_ref = HybridStorageRef {
        credential_id,
        dna_sequence_id: crate::u64_to_string(env, credential_id, "seq_"),
        blockchain_tx_hash: blockchain_tx.clone(),
        ipfs_hash,
        synthesis_batch: dna_credential.dna_sequence.metadata.synthesis_batch.clone(),
        sequencing_id: Some(dna_credential.dna_sequence.metadata.sequencing_id.clone()),
        created_at: current_time,
        last_verified: current_time,
    };

    // Store hybrid reference
    env.storage().persistent().set(
        &DNAStorageKey::IndexMap(reference_id.clone()),
        &credential_id,
    );
    env.storage()
        .persistent()
        .set(&DNAStorageKey::HybridRef(reference_id.clone()), &hybrid_ref);

    // Update credential with blockchain reference
    if let Some(mut cred) = env
        .storage()
        .persistent()
        .get::<_, DNACredential>(&DNAStorageKey::DNACredential(credential_id))
    {
        cred.blockchain_ref = blockchain_tx;
        env.storage()
            .persistent()
            .set(&DNAStorageKey::DNACredential(credential_id), &cred);
    }

    reference_id
}

/// Verify hybrid storage integrity
pub fn verify_hybrid_storage(env: &Env, reference_id: String) -> bool {
    let credential_id: u64 = env
        .storage()
        .instance()
        .get(&DNAStorageKey::IndexMap(reference_id))
        .unwrap_or_else(|| panic!("Hybrid reference not found"));

    // Verify DNA storage
    let dna_valid = verify_dna_credential(env, credential_id);

    // Verify blockchain reference
    let dna_credential: DNACredential = env
        .storage()
        .persistent()
        .get(&DNAStorageKey::DNACredential(credential_id))
        .unwrap_or_else(|| panic!("DNA credential not found"));

    let blockchain_valid = verify_blockchain_reference(&dna_credential.blockchain_ref);

    // Combined verification
    let overall_valid = dna_valid && blockchain_valid;

    // Update last verified timestamp
    if overall_valid {
        if let Some(mut cred) = env
            .storage()
            .persistent()
            .get::<_, DNACredential>(&DNAStorageKey::DNACredential(credential_id))
        {
            cred.synthesis_date = env.ledger().timestamp(); // Reuse field as last_verified
            env.storage()
                .persistent()
                .set(&DNAStorageKey::DNACredential(credential_id), &cred);
        }
    }

    overall_valid
}

/// Get synthesis request status
pub fn get_synthesis_status(env: &Env, request_id: u64) -> SynthesisRequest {
    env.storage()
        .persistent()
        .get(&DNABioService::SynthesisRequest(request_id))
        .unwrap_or_else(|| panic!("Synthesis request not found"))
}

/// Get sequencing result
pub fn get_sequencing_result(env: &Env, sequencing_id: String) -> SequencingResult {
    env.storage()
        .persistent()
        .get(&DNABioService::SequencingResult(sequencing_id))
        .unwrap_or_else(|| panic!("Sequencing result not found"))
}

/// Get DNA quality metrics
pub fn get_dna_quality_metrics(env: &Env, credential_id: u64) -> DNAQualityMetrics {
    let dna_credential: DNACredential = env
        .storage()
        .persistent()
        .get(&DNAStorageKey::DNACredential(credential_id))
        .unwrap_or_else(|| panic!("DNA credential not found"));

    // Calculate metrics based on sequence characteristics
    let sequence_length = dna_credential.dna_sequence.length;
    let data_size_bits = dna_credential.dna_sequence.sequence.len() as u64 * 2; // 2 bits per base

    DNAQualityMetrics {
        data_density: if sequence_length == 0 {
            0
        } else {
            (data_size_bits * 10000 / sequence_length as u64) as u32
        },
        error_rate: 10,                // Target error rate for DNA storage (0.1%)
        retention_time: 1000,          // 1000 years for DNA storage
        synthesis_success_rate: 9800,  // 98% success rate
        sequencing_success_rate: 9500, // 95% success rate
        overall_reliability: 9300,     // Combined reliability
    }
}

// Helper functions

/// Map a priority level to its synthesis-queue storage key.
fn priority_queue_symbol(env: &Env, priority: u8) -> Symbol {
    match priority {
        0 => Symbol::new(env, "queue_0"),
        1 => Symbol::new(env, "queue_1"),
        2 => Symbol::new(env, "queue_2"),
        _ => Symbol::new(env, "queue_x"),
    }
}

fn add_to_synthesis_queue(env: &Env, request_id: u64, priority: u8) {
    let queue_key = priority_queue_symbol(env, priority);
    let mut queue: Vec<u64> = env
        .storage()
        .instance()
        .get(&queue_key)
        .unwrap_or_else(|| Vec::new(env));
    queue.push_back(request_id);
    env.storage().instance().set(&queue_key, &queue);
}

fn remove_from_synthesis_queue(env: &Env, request_id: u64) {
    for priority in 0..3u8 {
        let queue_key = priority_queue_symbol(env, priority);
        if let Some(queue) = env.storage().instance().get::<_, Vec<u64>>(&queue_key) {
            let mut found = false;
            let mut new_queue = Vec::new(env);

            for id in queue.iter() {
                if id == request_id {
                    found = true;
                } else {
                    new_queue.push_back(id);
                }
            }

            if found {
                env.storage().instance().set(&queue_key, &new_queue);
                break;
            }
        }
    }
}

fn compare_dna_sequences(original: &Bytes, sequenced: &Bytes) -> bool {
    if original.len() != sequenced.len() {
        return false;
    }

    let total = original.len();
    if total == 0 {
        return true;
    }

    let mut mismatches = 0u32;
    for i in 0..total {
        if original.get(i).unwrap_or(0) != sequenced.get(i).unwrap_or(0) {
            mismatches += 1;
        }
    }

    // Allow up to 0.1% mismatches (accounting for sequencing errors).
    let error_rate_bps = mismatches * 10000 / total;
    error_rate_bps <= 10
}

fn verify_blockchain_reference(reference: &String) -> bool {
    // Simplified blockchain verification
    !reference.is_empty() && reference.len() > 10
}

// ===== Integrity Verification Service =====

/// Result of an integrity verification pass.
#[contracttype]
#[derive(Clone)]
pub struct IntegrityReport {
    pub total_credentials: u64,
    pub valid_count: u64,
    pub invalid_count: u64,
    pub is_healthy: bool,
}

/// Verify the integrity of all DNA credentials currently in storage.
/// For each credential, re-decodes the DNA sequence and re-computes the hash,
/// comparing against the stored `integrity_hash`.
pub fn verify_integrity(env: &Env) -> IntegrityReport {
    let count: u64 = env
        .storage()
        .instance()
        .get(&DNAStorageKey::DNACredentialCount)
        .unwrap_or(0);

    let mut valid: u64 = 0;
    let mut invalid: u64 = 0;

    for i in 1..=count {
        if env
            .storage()
            .persistent()
            .has(&DNAStorageKey::DNACredential(i))
        {
            if verify_dna_credential(env, i) {
                valid += 1;
            } else {
                invalid += 1;
            }
        }
    }

    IntegrityReport {
        total_credentials: valid + invalid,
        valid_count: valid,
        invalid_count: invalid,
        is_healthy: invalid == 0,
    }
}
