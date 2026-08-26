use soroban_sdk::{contracttype, Address, Bytes, BytesN, Env, String};

/// Predicate types supported by the selective disclosure ZK scheme
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PredicateType {
    /// Proves that attribute value equals expected value (e.g. graduated == 1)
    Equals = 0,
    /// Proves that numeric attribute value >= min_value (e.g. age >= 18)
    GreaterThanOrEqual = 1,
    /// Proves that numeric attribute value is in range [min_value, max_value]
    Range = 2,
}

/// ZK Proof structure for selective disclosure of credential attributes
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ZkProof {
    /// Credential commitment: SHA256(credential_id || holder || attribute_name || attribute_value || salt)
    pub credential_commitment: BytesN<32>,
    /// Verifier-scoped nullifier: SHA256(holder || verifier || credential_id || nonce)
    pub nullifier: BytesN<32>,
    /// The predicate type being proven
    pub predicate_type: PredicateType,
    /// Name of the attribute being disclosed (e.g., "graduated", "age", "score")
    pub attribute_name: String,
    /// Public parameter 1 (e.g. target_val for Equals, min_value for GreaterThanOrEqual/Range)
    pub public_param1: u64,
    /// Public parameter 2 (e.g. max_value for Range, 0 otherwise)
    pub public_param2: u64,
    /// Fiat-Shamir challenge hash
    pub challenge: BytesN<32>,
    /// Response proof scalar/payload
    pub response: BytesN<32>,
    /// Holder binding hash: SHA256(holder || credential_commitment || nullifier || challenge)
    pub holder_binding: BytesN<32>,
}

/// Compute credential commitment: SHA256(credential_id || holder || attribute_name || attribute_val || salt)
pub fn compute_credential_commitment(
    env: &Env,
    credential_id: u64,
    holder: &Address,
    attribute_name: &String,
    attribute_val: u64,
    salt: &BytesN<32>,
) -> BytesN<32> {
    let mut payload = Bytes::new(env);
    payload.append(&credential_id.to_be_bytes().into());
    payload.append(&holder.to_xdr(env));
    payload.append(&crate::string_to_bytes(env, attribute_name));
    payload.append(&attribute_val.to_be_bytes().into());
    payload.append(&salt.to_bytes());
    env.crypto().sha256(&payload).into()
}

/// Compute verifier-scoped nullifier: SHA256(holder || verifier || credential_id || nonce)
pub fn compute_nullifier(
    env: &Env,
    holder: &Address,
    verifier: &Address,
    credential_id: u64,
    nonce: &BytesN<32>,
) -> BytesN<32> {
    let mut payload = Bytes::new(env);
    payload.append(&holder.to_xdr(env));
    payload.append(&verifier.to_xdr(env));
    payload.append(&credential_id.to_be_bytes().into());
    payload.append(&nonce.to_bytes());
    env.crypto().sha256(&payload).into()
}

/// Compute holder binding digest: SHA256(holder || commitment || nullifier || challenge)
pub fn compute_holder_binding(
    env: &Env,
    holder: &Address,
    commitment: &BytesN<32>,
    nullifier: &BytesN<32>,
    challenge: &BytesN<32>,
) -> BytesN<32> {
    let mut payload = Bytes::new(env);
    payload.append(&holder.to_xdr(env));
    payload.append(&commitment.to_bytes());
    payload.append(&nullifier.to_bytes());
    payload.append(&challenge.to_bytes());
    env.crypto().sha256(&payload).into()
}

/// Compute Fiat-Shamir challenge: SHA256(commitment || nullifier || attribute_name || param1 || param2 || response_randomness)
pub fn compute_fiat_shamir_challenge(
    env: &Env,
    commitment: &BytesN<32>,
    nullifier: &BytesN<32>,
    attribute_name: &String,
    param1: u64,
    param2: u64,
    r_commitment: &BytesN<32>,
) -> BytesN<32> {
    let mut payload = Bytes::new(env);
    payload.append(&commitment.to_bytes());
    payload.append(&nullifier.to_bytes());
    payload.append(&crate::string_to_bytes(env, attribute_name));
    payload.append(&param1.to_be_bytes().into());
    payload.append(&param2.to_be_bytes().into());
    payload.append(&r_commitment.to_bytes());
    env.crypto().sha256(&payload).into()
}
