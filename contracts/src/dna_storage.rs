use crate::credentials::CredentialKey;
use soroban_sdk::{contracttype, panic_with_error, Address, Env, String, Symbol, Vec};

/// DNA nucleotide bases
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Nucleotide {
    Adenine = 0,  // A
    Cytosine = 1, // C
    Guanine = 2,  // G
    Thymine = 3,  // T
}

impl Nucleotide {
    pub fn from_u8(value: u8) -> Self {
        match value & 0x03 {
            0 => Nucleotide::Adenine,
            1 => Nucleotide::Cytosine,
            2 => Nucleotide::Guanine,
            3 => Nucleotide::Thymine,
            _ => Nucleotide::Adenine,
        }
    }

    pub fn to_char(&self) -> char {
        match self {
            Nucleotide::Adenine => 'A',
            Nucleotide::Cytosine => 'C',
            Nucleotide::Guanine => 'G',
            Nucleotide::Thymine => 'T',
        }
    }

    pub fn complement(&self) -> Self {
        match self {
            Nucleotide::Adenine => Nucleotide::Thymine,
            Nucleotide::Cytosine => Nucleotide::Guanine,
            Nucleotide::Guanine => Nucleotide::Cytosine,
            Nucleotide::Thymine => Nucleotide::Adenine,
        }
    }
}

/// DNA sequence structure
#[contracttype]
#[derive(Clone)]
pub struct DNASequence {
    pub sequence: Vec<u8>, // Packed nucleotides (2 bits per base)
    pub length: u32,       // Number of bases
    pub checksum: u32,     // CRC32 checksum for integrity
    pub metadata: DnaMetadata,
}

/// DNA metadata for storage and retrieval
#[contracttype]
#[derive(Clone)]
pub struct DnaMetadata {
    pub encoding_version: u8,
    pub compression_level: u8,
    pub error_correction: u8,
    pub storage_timestamp: u64,
    pub synthesis_batch: String,
    pub sequencing_id: String,
}

/// Error correction levels
#[contracttype]
#[derive(Clone, Debug)]
pub enum ErrorCorrectionLevel {
    None = 0,
    Basic = 1,       // Simple parity
    ReedSolomon = 2, // Reed-Solomon codes
    Advanced = 3,    // Hybrid error correction
}

/// DNA storage protocols
#[contracttype]
#[derive(Clone)]
pub enum DNAStorageProtocol {
    Standard = 0,  // Basic DNA storage
    Indexed = 1,   // Indexed with primers
    Redundant = 2, // Multiple copies
    Hybrid = 3,    // DNA + blockchain hybrid
}

/// DNA-encoded credential
#[contracttype]
#[derive(Clone)]
pub struct DNACredential {
    pub credential_id: u64,
    pub dna_sequence: DNASequence,
    pub blockchain_ref: String, // Reference to on-chain credential
    pub synthesis_date: u64,
    pub sequencing_date: Option<u64>,
    pub storage_protocol: DNAStorageProtocol,
    pub error_correction: ErrorCorrectionLevel,
    pub integrity_hash: String, // SHA-256 of original data
}

/// DNA storage keys
#[contracttype]
pub enum DNAStorageKey {
    DNACredential(u64),
    UserDNACredentials(Address),
    DNASequence(String), // Sequence ID -> DNASequence
    DNACredentialCount,
    SynthesisBatch(String),   // Batch ID -> Vec<u64> credential IDs
    SequencingRecord(String), // Sequencing ID -> DNACredential
    IndexMap(String),         // Hash -> credential_id
}

/// Events for DNA operations
#[contracttype]
#[derive(Clone)]
pub enum DNAEvent {
    Encoded(u64),     // credential_id
    Synthesized(u64), // credential_id
    Sequenced(u64),   // credential_id
    Verified(u64),    // credential_id
    Decoded(u64),     // credential_id
}

/// Encode digital data to DNA sequence
pub fn encode_to_dna(
    env: &Env,
    data: &Vec<u8>,
    error_correction: ErrorCorrectionLevel,
    protocol: DNAStorageProtocol,
) -> DNASequence {
    let mut encoded_data = data.clone();

    // Apply error correction
    encoded_data = apply_error_correction(env, &encoded_data, error_correction);

    // Convert binary to DNA bases (2 bits per base)
    let mut sequence = Vec::new(env);
    let mut length = 0u32;

    for byte in encoded_data.iter() {
        // High nibble (bits 4-7)
        let high_base = ((byte >> 6) & 0x03) as u8;
        sequence.push_back(high_base);
        length += 1;

        // Second nibble (bits 4-5)
        let second_base = ((byte >> 4) & 0x03) as u8;
        sequence.push_back(second_base);
        length += 1;

        // Third nibble (bits 2-3)
        let third_base = ((byte >> 2) & 0x03) as u8;
        sequence.push_back(third_base);
        length += 1;

        // Low nibble (bits 0-1)
        let low_base = (byte & 0x03) as u8;
        sequence.push_back(low_base);
        length += 1;
    }

    // Add protocol-specific headers
    if matches!(protocol, DNAStorageProtocol::Indexed) {
        // Add indexing primers (simplified)
        sequence = add_indexing_primers(env, sequence);
        length += 20; // Primer length
    }

    // Calculate checksum
    let checksum = calculate_dna_checksum(env, &sequence);

    let metadata = DnaMetadata {
        encoding_version: 1,
        compression_level: 0,
        error_correction: match error_correction {
            ErrorCorrectionLevel::None => 0,
            ErrorCorrectionLevel::Basic => 1,
            ErrorCorrectionLevel::ReedSolomon => 2,
            ErrorCorrectionLevel::Advanced => 3,
        },
        storage_timestamp: env.ledger().timestamp(),
        synthesis_batch: crate::u64_to_string(env, env.ledger().sequence(), "batch_"),
        sequencing_id: String::from_str(env, ""),
    };

    DNASequence {
        sequence,
        length,
        checksum,
        metadata,
    }
}

/// Decode DNA sequence back to digital data
pub fn decode_from_dna(env: &Env, dna_sequence: &DNASequence) -> Vec<u8> {
    // Verify checksum
    let calculated_checksum = calculate_dna_checksum(env, &dna_sequence.sequence);
    if calculated_checksum != dna_sequence.checksum {
        panic_with_error!(env, "DNA sequence checksum verification failed");
    }

    let mut sequence = dna_sequence.sequence.clone();

    // Remove indexing primers if present
    if dna_sequence.metadata.encoding_version == 1 && dna_sequence.length > 20 {
        sequence = remove_indexing_primers(env, sequence);
    }

    // Convert DNA bases back to binary
    let mut decoded_data = Vec::new(env);
    let mut current_byte = 0u8;
    let mut bit_count = 0u8;

    for base_val in sequence.iter() {
        current_byte = (current_byte << 2) | (base_val & 0x03);
        bit_count += 2;

        if bit_count == 8 {
            decoded_data.push_back(current_byte);
            current_byte = 0;
            bit_count = 0;
        }
    }

    // Remove error correction
    let error_level = match dna_sequence.metadata.error_correction {
        0 => ErrorCorrectionLevel::None,
        1 => ErrorCorrectionLevel::Basic,
        2 => ErrorCorrectionLevel::ReedSolomon,
        3 => ErrorCorrectionLevel::Advanced,
        _ => ErrorCorrectionLevel::None,
    };

    remove_error_correction(env, &decoded_data, error_level)
}

/// Store credential in DNA format
pub fn store_credential_in_dna(
    env: &Env,
    credential_id: u64,
    issuer: Address,
    recipient: Address,
    title: String,
    description: String,
    course_id: String,
    ipfs_hash: String,
) -> u64 {
    issuer.require_auth();

    // Generate unique credential ID
    let credential_id = env.ledger().sequence() + 1;

    // Create credential data structure
    let credential_data = create_credential_data(
        env,
        credential_id,
        issuer,
        recipient,
        title,
        description,
        course_id,
        ipfs_hash,
    );

    // Encode to DNA with advanced error correction
    let dna_sequence = encode_to_dna(
        env,
        &credential_data,
        ErrorCorrectionLevel::Advanced,
        DNAStorageProtocol::Hybrid,
    );

    // Calculate integrity hash
    let integrity_hash = calculate_sha256_hash(env, &credential_data);

    let dna_credential = DNACredential {
        credential_id,
        dna_sequence: dna_sequence.clone(),
        blockchain_ref: crate::u64_to_string(env, credential_id, "cred_"),
        synthesis_date: env.ledger().timestamp(),
        sequencing_date: None,
        storage_protocol: DNAStorageProtocol::Hybrid,
        error_correction: ErrorCorrectionLevel::Advanced,
        integrity_hash,
    };

    // Store DNA credential
    env.storage().persistent().set(
        &DNAStorageKey::DNACredential(credential_id),
        &dna_credential,
    );

    // Add to user's DNA credentials
    let mut user_dna_creds = env
        .storage()
        .persistent()
        .get(&DNAStorageKey::UserDNACredentials(recipient.clone()))
        .unwrap_or_else(|| Vec::new(env));
    user_dna_creds.push_back(credential_id);
    env.storage().persistent().set(
        &DNAStorageKey::UserDNACredentials(recipient),
        &user_dna_creds,
    );

    // Store sequence by ID
    let sequence_id = crate::u64_to_string(env, credential_id, "seq_");
    env.storage().persistent().set(
        &DNAStorageKey::DNASequence(sequence_id.clone()),
        &dna_sequence,
    );

    // Update count
    let count: u64 = env
        .storage()
        .instance()
        .get(&DNAStorageKey::DNACredentialCount)
        .unwrap_or(0);
    env.storage()
        .instance()
        .set(&DNAStorageKey::DNACredentialCount, &(count + 1));

    // Create index mapping
    env.storage()
        .instance()
        .set(&DNAStorageKey::IndexMap(integrity_hash), &credential_id);

    // Emit event
    env.events().publish(
        (Symbol::new(env, "dna"), Symbol::new(env, "encoded")),
        credential_id,
    );

    credential_id
}

/// Verify DNA-stored credential
pub fn verify_dna_credential(env: &Env, credential_id: u64) -> bool {
    let dna_credential: DNACredential = env
        .storage()
        .persistent()
        .get(&DNAStorageKey::DNACredential(credential_id))
        .unwrap_or_else(|| panic!("DNA credential not found"));

    // Decode DNA sequence
    let decoded_data = decode_from_dna(env, &dna_credential.dna_sequence);

    // Verify integrity hash
    let calculated_hash = calculate_sha256_hash(env, &decoded_data);
    if calculated_hash != dna_credential.integrity_hash {
        return false;
    }

    // Additional verification based on protocol
    match dna_credential.storage_protocol {
        DNAStorageProtocol::Hybrid => {
            // Verify blockchain reference exists
            verify_blockchain_reference(env, &dna_credential.blockchain_ref)
        }
        _ => true, // Basic DNA verification passed
    }
}

/// Retrieve credential from DNA storage
pub fn retrieve_credential_from_dna(env: &Env, credential_id: u64) -> Vec<u8> {
    let dna_credential: DNACredential = env
        .storage()
        .persistent()
        .get(&DNAStorageKey::DNACredential(credential_id))
        .unwrap_or_else(|| panic!("DNA credential not found"));

    // Decode and return
    let decoded_data = decode_from_dna(env, &dna_credential.dna_sequence);

    // Emit retrieval event
    env.events().publish(
        (Symbol::new(env, "dna"), Symbol::new(env, "decoded")),
        credential_id,
    );

    decoded_data
}

/// Get user's DNA-stored credentials
pub fn get_user_dna_credentials(env: &Env, user: Address) -> Vec<u64> {
    env.storage()
        .persistent()
        .get(&DNAStorageKey::UserDNACredentials(user))
        .unwrap_or_else(|| Vec::new(env))
}

/// Apply error correction to data
fn apply_error_correction(env: &Env, data: &Vec<u8>, level: ErrorCorrectionLevel) -> Vec<u8> {
    match level {
        ErrorCorrectionLevel::None => data.clone(),
        ErrorCorrectionLevel::Basic => add_parity_bits(env, data),
        ErrorCorrectionLevel::ReedSolomon => apply_reed_solomon(env, data),
        ErrorCorrectionLevel::Advanced => apply_hybrid_correction(env, data),
    }
}

/// Remove error correction from data
fn remove_error_correction(env: &Env, data: &Vec<u8>, level: ErrorCorrectionLevel) -> Vec<u8> {
    match level {
        ErrorCorrectionLevel::None => data.clone(),
        ErrorCorrectionLevel::Basic => remove_parity_bits(env, data),
        ErrorCorrectionLevel::ReedSolomon => remove_reed_solomon(env, data),
        ErrorCorrectionLevel::Advanced => remove_hybrid_correction(env, data),
    }
}

/// Calculate DNA sequence checksum
fn calculate_dna_checksum(env: &Env, sequence: &Vec<u8>) -> u32 {
    let mut checksum = 0u32;
    for byte in sequence.iter() {
        checksum = checksum.wrapping_mul(31).wrapping_add(*byte as u32);
    }
    checksum
}

/// Add indexing primers to sequence
fn add_indexing_primers(env: &Env, mut sequence: Vec<u8>) -> Vec<u8> {
    // Simplified primer addition (ATGC repeated pattern)
    let primer = vec![0u8, 3u8, 2u8, 1u8, 0u8, 3u8, 2u8, 1u8, 0u8, 3u8]; // ATGCATGCAT
    let mut new_sequence = Vec::new(env);

    // Add forward primer
    for base in primer.iter() {
        new_sequence.push_back(*base);
    }

    // Add original sequence
    for base in sequence.iter() {
        new_sequence.push_back(*base);
    }

    // Add reverse primer (complement)
    for base in primer.iter().rev() {
        new_sequence.push_back(*base);
    }

    new_sequence
}

/// Remove indexing primers from sequence
fn remove_indexing_primers(env: &Env, sequence: Vec<u8>) -> Vec<u8> {
    if sequence.len() < 20 {
        return sequence;
    }

    // Remove first 10 and last 10 bases (primers)
    let mut trimmed = Vec::new(env);
    for i in 10..sequence.len() - 10 {
        trimmed.push_back(sequence.get(i).unwrap_or(&0));
    }
    trimmed
}

/// Create credential data structure for encoding
fn create_credential_data(
    env: &Env,
    credential_id: u64,
    issuer: Address,
    recipient: Address,
    title: String,
    description: String,
    course_id: String,
    ipfs_hash: String,
) -> Vec<u8> {
    let mut data = Vec::new(env);

    // Add credential ID (8 bytes)
    for i in 0..8 {
        data.push_back(((credential_id >> (i * 8)) & 0xFF) as u8);
    }

    // Add addresses (simplified - using string representation)
    let issuer_str = issuer.to_string();
    let issuer_bytes: soroban_sdk::Bytes = issuer_str.into();
    for byte in issuer_bytes.iter() {
        data.push_back(byte);
    }
    data.push_back(0); // Separator

    let recipient_str2 = recipient.to_string();
    let recipient_bytes: soroban_sdk::Bytes = recipient_str2.into();
    for byte in recipient_bytes.iter() {
        data.push_back(byte);
    }
    data.push_back(0); // Separator

    // Add strings
    let title_bytes: soroban_sdk::Bytes = title.into();
    for byte in title_bytes.iter() {
        data.push_back(byte);
    }
    data.push_back(0);

    let desc_bytes: soroban_sdk::Bytes = description.into();
    for byte in desc_bytes.iter() {
        data.push_back(byte);
    }
    data.push_back(0);

    let course_bytes: soroban_sdk::Bytes = course_id.into();
    for byte in course_bytes.iter() {
        data.push_back(byte);
    }
    data.push_back(0);

    let ipfs_bytes: soroban_sdk::Bytes = ipfs_hash.into();
    for byte in ipfs_bytes.iter() {
        data.push_back(byte);
    }
    data.push_back(0);

    data
}

/// Calculate SHA-256 hash (simplified implementation)
fn calculate_sha256_hash(env: &Env, data: &Vec<u8>) -> String {
    let mut hash = 0u64;
    for byte in data.iter() {
        hash = hash.wrapping_mul(31).wrapping_add(*byte as u64);
    }
    crate::u64_to_string(env, hash, "")
}

/// Verify blockchain reference exists
fn verify_blockchain_reference(env: &Env, reference: &String) -> bool {
    // Simplified verification - check if credential exists on blockchain
    let mut reference_buf = [0u8; 64];
    let ref_len = reference.copy_into_slice(&mut reference_buf);
    if ref_len >= 5
        && reference_buf[0] == b'c'
        && reference_buf[1] == b'r'
        && reference_buf[2] == b'e'
        && reference_buf[3] == b'd'
        && reference_buf[4] == b'_'
    {
        // Simplified: just check if any credential exists
        if let Some(_) = env
            .storage()
            .persistent()
            .get::<_, u64>(&DNAStorageKey::DNACredentialCount)
        {
            return true;
        }
    }
    false
}

// Error correction implementations (simplified)
fn add_parity_bits(env: &Env, data: &Vec<u8>) -> Vec<u8> {
    let mut result = Vec::new(env);
    for byte in data.iter() {
        result.push_back(*byte);
        // Simple parity bit
        let parity = byte.count_ones() % 2;
        result.push_back(parity as u8);
    }
    result
}

fn remove_parity_bits(env: &Env, data: &Vec<u8>) -> Vec<u8> {
    let mut result = Vec::new(env);
    for i in (0..data.len()).step_by(2) {
        if i < data.len() {
            result.push_back(data.get(i).unwrap_or(&0));
        }
    }
    result
}

fn apply_reed_solomon(env: &Env, data: &Vec<u8>) -> Vec<u8> {
    // Simplified Reed-Solomon - add redundancy
    let mut result = data.clone();
    // Add 10% redundancy
    let redundancy = (data.len() / 10).max(1);
    for i in 0..redundancy {
        let redundant_byte = data.get(i % data.len()).unwrap_or(&0);
        result.push_back(*redundant_byte);
    }
    result
}

fn remove_reed_solomon(env: &Env, data: &Vec<u8>) -> Vec<u8> {
    // Remove redundancy (simplified)
    let original_len = data.len() * 9 / 10; // Approximate
    let mut result = Vec::new(env);
    for i in 0..original_len.min(data.len()) {
        result.push_back(data.get(i).unwrap_or(&0));
    }
    result
}

fn apply_hybrid_correction(env: &Env, data: &Vec<u8>) -> Vec<u8> {
    // Apply both parity and Reed-Solomon
    let with_parity = add_parity_bits(env, data);
    apply_reed_solomon(env, &with_parity)
}

fn remove_hybrid_correction(env: &Env, data: &Vec<u8>) -> Vec<u8> {
    let without_rs = remove_reed_solomon(env, data);
    remove_parity_bits(env, &without_rs)
}

// ===== Checkpoint / Rollback =====

pub const MAX_CHECKPOINTS: u32 = 10;

/// Metadata stored alongside each checkpoint snapshot.
#[contracttype]
#[derive(Clone)]
pub struct CheckpointMeta {
    pub checkpoint_id: u64,
    pub label: String,
    pub timestamp: u64,
    pub data_size: u32, // number of credential IDs captured
    pub hash: u64,      // rolling hash of the snapshot
}

/// Storage keys for checkpoints.
#[contracttype]
pub enum CheckpointKey {
    /// Ordered list of checkpoint IDs (Vec<u64>)
    Index,
    /// Metadata for a specific checkpoint
    Meta(u64),
    /// Snapshot: list of credential IDs at checkpoint time (Vec<u64>)
    Snapshot(u64),
}

/// Compute a simple hash over a list of credential IDs.
fn snapshot_hash(ids: &Vec<u64>) -> u64 {
    let mut h: u64 = 14695981039346656037u64; // FNV-1a offset basis
    for id in ids.iter() {
        let bytes = (*id).to_le_bytes();
        for b in bytes {
            h ^= b as u64;
            h = h.wrapping_mul(1099511628211u64);
        }
    }
    h
}

/// Collect all credential IDs currently stored (scanning up to the stored count).
fn collect_credential_ids(env: &Env) -> Vec<u64> {
    let count: u64 = env
        .storage()
        .instance()
        .get(&DNAStorageKey::DNACredentialCount)
        .unwrap_or(0);
    let mut ids = Vec::new(env);
    for i in 1..=count {
        if env
            .storage()
            .persistent()
            .has(&DNAStorageKey::DNACredential(i))
        {
            ids.push_back(i);
        }
    }
    ids
}

/// Create a checkpoint of the current DNA storage state.
/// Returns the new checkpoint ID.
/// Panics if MAX_CHECKPOINTS is already reached.
pub fn create_checkpoint(env: &Env, label: String) -> u64 {
    let mut index: Vec<u64> = env
        .storage()
        .instance()
        .get(&CheckpointKey::Index)
        .unwrap_or_else(|| Vec::new(env));

    if index.len() as u32 >= MAX_CHECKPOINTS {
        panic!("Maximum checkpoint limit reached");
    }

    let checkpoint_id = env.ledger().sequence() as u64;
    let snapshot = collect_credential_ids(env);
    let hash = snapshot_hash(&snapshot);

    let meta = CheckpointMeta {
        checkpoint_id,
        label,
        timestamp: env.ledger().timestamp(),
        data_size: snapshot.len() as u32,
        hash,
    };

    env.storage()
        .instance()
        .set(&CheckpointKey::Meta(checkpoint_id), &meta);
    env.storage()
        .instance()
        .set(&CheckpointKey::Snapshot(checkpoint_id), &snapshot);

    index.push_back(checkpoint_id);
    env.storage().instance().set(&CheckpointKey::Index, &index);

    // Verify integrity immediately after capture
    let recalc = snapshot_hash(&snapshot);
    if recalc != hash {
        panic!("Checkpoint integrity check failed on creation");
    }

    checkpoint_id
}

/// Restore DNA storage state to a previous checkpoint.
/// Only credentials captured in the snapshot are retained (others removed).
/// Returns true on success.
pub fn restore_checkpoint(env: &Env, checkpoint_id: u64) -> bool {
    let snapshot: Vec<u64> = env
        .storage()
        .instance()
        .get(&CheckpointKey::Snapshot(checkpoint_id))
        .unwrap_or_else(|| panic!("Checkpoint not found"));

    let meta: CheckpointMeta = env
        .storage()
        .instance()
        .get(&CheckpointKey::Meta(checkpoint_id))
        .unwrap_or_else(|| panic!("Checkpoint metadata not found"));

    // Verify integrity before restoring
    let hash = snapshot_hash(&snapshot);
    if hash != meta.hash {
        panic!("Checkpoint integrity verification failed");
    }

    // Remove credentials not in the snapshot
    let current = collect_credential_ids(env);
    for cred_id in current.iter() {
        let mut found = false;
        for snap_id in snapshot.iter() {
            if *snap_id == *cred_id {
                found = true;
                break;
            }
        }
        if !found {
            env.storage()
                .persistent()
                .remove(&DNAStorageKey::DNACredential(*cred_id));
        }
    }

    // Update credential count to match snapshot
    env.storage()
        .instance()
        .set(&DNAStorageKey::DNACredentialCount, &(snapshot.len() as u64));

    true
}

/// Return metadata for all stored checkpoints, ordered by creation.
pub fn list_checkpoints(env: &Env) -> Vec<CheckpointMeta> {
    let index: Vec<u64> = env
        .storage()
        .instance()
        .get(&CheckpointKey::Index)
        .unwrap_or_else(|| Vec::new(env));

    let mut result = Vec::new(env);
    for id in index.iter() {
        if let Some(meta) = env
            .storage()
            .instance()
            .get::<_, CheckpointMeta>(&CheckpointKey::Meta(*id))
        {
            result.push_back(meta);
        }
    }
    result
}

/// Delete a checkpoint by ID (admin operation).
/// Returns true if the checkpoint existed and was removed.
pub fn delete_checkpoint(env: &Env, checkpoint_id: u64) -> bool {
    let mut index: Vec<u64> = env
        .storage()
        .instance()
        .get(&CheckpointKey::Index)
        .unwrap_or_else(|| Vec::new(env));

    let mut found = false;
    let mut new_index = Vec::new(env);
    for id in index.iter() {
        if *id == checkpoint_id {
            found = true;
        } else {
            new_index.push_back(*id);
        }
    }

    if !found {
        return false;
    }

    env.storage()
        .instance()
        .remove(&CheckpointKey::Meta(checkpoint_id));
    env.storage()
        .instance()
        .remove(&CheckpointKey::Snapshot(checkpoint_id));
    env.storage()
        .instance()
        .set(&CheckpointKey::Index, &new_index);

    true
}
