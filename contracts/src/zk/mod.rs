pub mod circuits;
pub mod verifier;

#[cfg(test)]
pub mod zk_test;

pub use circuits::{
    compute_credential_commitment, compute_fiat_shamir_challenge, compute_holder_binding,
    compute_nullifier, PredicateType, ZkProof,
};
pub use verifier::{verify_zk_proof, ZkVerificationError};
