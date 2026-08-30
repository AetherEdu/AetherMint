#![cfg(test)]

use crate::zk::circuits::{
    compute_credential_commitment, compute_fiat_shamir_challenge, compute_holder_binding,
    compute_nullifier, PredicateType, ZkProof,
};
use crate::zk::verifier::{verify_zk_proof, ZkVerificationError};
use soroban_sdk::{testutils::Address as _, Address, Bytes, BytesN, Env, String};

fn helper_generate_proof(
    env: &Env,
    credential_id: u64,
    holder: &Address,
    verifier: &Address,
    attribute_name: &str,
    attribute_val: u64,
    predicate_type: PredicateType,
    param1: u64,
    param2: u64,
) -> ZkProof {
    let salt: BytesN<32> = env
        .crypto()
        .sha256(&Bytes::from_slice(env, b"test_salt"))
        .into();
    let nonce: BytesN<32> = env
        .crypto()
        .sha256(&Bytes::from_slice(env, b"test_nonce"))
        .into();
    let response: BytesN<32> = env
        .crypto()
        .sha256(&Bytes::from_slice(env, b"test_response"))
        .into();
    let attr_str = String::from_str(env, attribute_name);

    let commitment =
        compute_credential_commitment(env, credential_id, holder, &attr_str, attribute_val, &salt);

    let nullifier = compute_nullifier(env, holder, verifier, credential_id, &nonce);

    // Build r_reconstructed based on predicate
    let mut payload = Bytes::new(env);
    payload.append(&response.to_bytes());
    let dummy_challenge: BytesN<32> = env
        .crypto()
        .sha256(&Bytes::from_slice(env, b"challenge_seed"))
        .into();
    payload.append(&dummy_challenge.to_bytes());
    payload.append(&Bytes::from_slice(env, &param1.to_be_bytes()));
    if predicate_type == PredicateType::Range {
        payload.append(&Bytes::from_slice(env, &param2.to_be_bytes()));
    }
    let r_reconstructed: BytesN<32> = env.crypto().sha256(&payload).into();

    let challenge = compute_fiat_shamir_challenge(
        env,
        &commitment,
        &nullifier,
        &attr_str,
        param1,
        param2,
        &r_reconstructed,
    );

    // Re-compute payload with actual challenge for consistency
    let mut payload_final = Bytes::new(env);
    payload_final.append(&response.to_bytes());
    payload_final.append(&challenge.to_bytes());
    payload_final.append(&Bytes::from_slice(env, &param1.to_be_bytes()));
    if predicate_type == PredicateType::Range {
        payload_final.append(&Bytes::from_slice(env, &param2.to_be_bytes()));
    }
    let r_final: BytesN<32> = env.crypto().sha256(&payload_final).into();

    let final_challenge = compute_fiat_shamir_challenge(
        env,
        &commitment,
        &nullifier,
        &attr_str,
        param1,
        param2,
        &r_final,
    );

    let holder_binding =
        compute_holder_binding(env, holder, &commitment, &nullifier, &final_challenge);

    ZkProof {
        credential_commitment: commitment,
        nullifier,
        predicate_type,
        attribute_name: attr_str,
        public_param1: param1,
        public_param2: param2,
        challenge: final_challenge,
        response,
        holder_binding,
    }
}

#[test]
fn test_zk_proof_equals_predicate_success() {
    let env = Env::default();
    let holder = Address::generate(&env);
    let verifier = Address::generate(&env);

    let proof = helper_generate_proof(
        &env,
        101,
        &holder,
        &verifier,
        "graduated",
        1,
        PredicateType::Equals,
        1,
        0,
    );

    let result = verify_zk_proof(&env, &proof, &holder, &verifier);
    assert_eq!(result, Ok(true));
}

#[test]
fn test_zk_proof_greater_than_or_equal_success() {
    let env = Env::default();
    let holder = Address::generate(&env);
    let verifier = Address::generate(&env);

    // Age = 25 >= 18
    let proof = helper_generate_proof(
        &env,
        102,
        &holder,
        &verifier,
        "age",
        25,
        PredicateType::GreaterThanOrEqual,
        18,
        0,
    );

    let result = verify_zk_proof(&env, &proof, &holder, &verifier);
    assert_eq!(result, Ok(true));
}

#[test]
fn test_zk_proof_range_success() {
    let env = Env::default();
    let holder = Address::generate(&env);
    let verifier = Address::generate(&env);

    // Score = 85 in range [70, 100]
    let proof = helper_generate_proof(
        &env,
        103,
        &holder,
        &verifier,
        "score",
        85,
        PredicateType::Range,
        70,
        100,
    );

    let result = verify_zk_proof(&env, &proof, &holder, &verifier);
    assert_eq!(result, Ok(true));
}

#[test]
fn test_zk_proof_invalid_holder_binding_rejected() {
    let env = Env::default();
    let holder = Address::generate(&env);
    let wrong_holder = Address::generate(&env);
    let verifier = Address::generate(&env);

    let proof = helper_generate_proof(
        &env,
        101,
        &holder,
        &verifier,
        "graduated",
        1,
        PredicateType::Equals,
        1,
        0,
    );

    // Proof submitted with wrong holder address fails holder binding check
    let result = verify_zk_proof(&env, &proof, &wrong_holder, &verifier);
    assert_eq!(result, Err(ZkVerificationError::InvalidHolderBinding));
}

#[test]
fn test_zk_proof_invalid_challenge_rejected() {
    let env = Env::default();
    let holder = Address::generate(&env);
    let verifier = Address::generate(&env);

    let mut proof = helper_generate_proof(
        &env,
        101,
        &holder,
        &verifier,
        "graduated",
        1,
        PredicateType::Equals,
        1,
        0,
    );

    // Tamper with challenge hash
    proof.challenge = env
        .crypto()
        .sha256(&Bytes::from_slice(&env, b"tampered"))
        .into();
    // Update holder_binding so it passes step 1, but fails challenge step
    proof.holder_binding = compute_holder_binding(
        &env,
        &holder,
        &proof.credential_commitment,
        &proof.nullifier,
        &proof.challenge,
    );

    let result = verify_zk_proof(&env, &proof, &holder, &verifier);
    assert_eq!(result, Err(ZkVerificationError::InvalidChallenge));
}

#[test]
fn test_zk_proof_invalid_range_parameters_rejected() {
    let env = Env::default();
    let holder = Address::generate(&env);
    let verifier = Address::generate(&env);

    let mut proof = helper_generate_proof(
        &env,
        103,
        &holder,
        &verifier,
        "score",
        85,
        PredicateType::Range,
        100, // min > max invalid!
        70,
    );

    proof.holder_binding = compute_holder_binding(
        &env,
        &holder,
        &proof.credential_commitment,
        &proof.nullifier,
        &proof.challenge,
    );

    let result = verify_zk_proof(&env, &proof, &holder, &verifier);
    assert_eq!(result, Err(ZkVerificationError::InvalidRangeParameters));
}
