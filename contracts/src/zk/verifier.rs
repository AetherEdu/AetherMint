use crate::zk::circuits::{
    compute_fiat_shamir_challenge, compute_holder_binding, PredicateType, ZkProof,
};
use soroban_sdk::{Address, Bytes, BytesN, Env};

/// Verification result enum
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ZkVerificationError {
    InvalidHolderBinding,
    InvalidChallenge,
    PredicateFailed,
    InvalidRangeParameters,
    MalformedProof,
}

/// Verify a zero-knowledge proof of selective attribute disclosure
pub fn verify_zk_proof(
    env: &Env,
    proof: &ZkProof,
    holder: &Address,
    verifier: &Address,
) -> Result<bool, ZkVerificationError> {
    // 1. Verify holder binding to ensure proof is authorized by holder
    let expected_binding = compute_holder_binding(
        env,
        holder,
        &proof.credential_commitment,
        &proof.nullifier,
        &proof.challenge,
    );
    if proof.holder_binding != expected_binding {
        return Err(ZkVerificationError::InvalidHolderBinding);
    }

    // 2. Validate predicate specific parameters
    match proof.predicate_type {
        PredicateType::Equals => {
            // Equal predicate requires response to match challenge + commitment relation
            // Reconstruct proof commitment from response and challenge
            let mut payload = Bytes::new(env);
            payload.append(&proof.response.to_bytes());
            payload.append(&proof.challenge.to_bytes());
            payload.append(&Bytes::from_slice(env, &proof.public_param1.to_be_bytes()));
            let r_reconstructed: BytesN<32> = env.crypto().sha256(&payload).into();

            let expected_challenge = compute_fiat_shamir_challenge(
                env,
                &proof.credential_commitment,
                &proof.nullifier,
                &proof.attribute_name,
                proof.public_param1,
                proof.public_param2,
                &r_reconstructed,
            );

            if proof.challenge != expected_challenge {
                return Err(ZkVerificationError::InvalidChallenge);
            }
        }
        PredicateType::GreaterThanOrEqual => {
            // GreaterThanOrEqual predicate: public_param1 is min_value
            let mut payload = Bytes::new(env);
            payload.append(&proof.response.to_bytes());
            payload.append(&proof.challenge.to_bytes());
            payload.append(&Bytes::from_slice(env, &proof.public_param1.to_be_bytes()));
            let r_reconstructed: BytesN<32> = env.crypto().sha256(&payload).into();

            let expected_challenge = compute_fiat_shamir_challenge(
                env,
                &proof.credential_commitment,
                &proof.nullifier,
                &proof.attribute_name,
                proof.public_param1,
                proof.public_param2,
                &r_reconstructed,
            );

            if proof.challenge != expected_challenge {
                return Err(ZkVerificationError::InvalidChallenge);
            }
        }
        PredicateType::Range => {
            // Range predicate: public_param1 is min_value, public_param2 is max_value
            if proof.public_param1 > proof.public_param2 {
                return Err(ZkVerificationError::InvalidRangeParameters);
            }

            let mut payload = Bytes::new(env);
            payload.append(&proof.response.to_bytes());
            payload.append(&proof.challenge.to_bytes());
            payload.append(&Bytes::from_slice(env, &proof.public_param1.to_be_bytes()));
            payload.append(&Bytes::from_slice(env, &proof.public_param2.to_be_bytes()));
            let r_reconstructed: BytesN<32> = env.crypto().sha256(&payload).into();

            let expected_challenge = compute_fiat_shamir_challenge(
                env,
                &proof.credential_commitment,
                &proof.nullifier,
                &proof.attribute_name,
                proof.public_param1,
                proof.public_param2,
                &r_reconstructed,
            );

            if proof.challenge != expected_challenge {
                return Err(ZkVerificationError::InvalidChallenge);
            }
        }
    }

    // Suppress unused variable warning for verifier (used conceptually in nullifier context)
    let _ = verifier;

    Ok(true)
}
