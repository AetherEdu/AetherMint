#![cfg(test)]

use super::*;
use crate::{AetherMintContract, AetherMintContractClient};
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{Address, Env, String};

fn setup() -> (Env, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AetherMintContract, ());
    let admin = Address::generate(&env);
    let client = AetherMintContractClient::new(&env, &contract_id);
    client.initialize_bridge(&admin);
    (env, contract_id, admin)
}

fn str(env: &Env, s: &str) -> String {
    String::from_str(env, s)
}

fn advance(env: &Env, seconds: u64) {
    let now = env.ledger().timestamp();
    env.ledger().set_timestamp(now + seconds);
}

#[test]
fn test_register_relayer() {
    let (env, cid, _admin) = setup();
    let client = AetherMintContractClient::new(&env, &cid);
    let relayer = Address::generate(&env);

    client.register_relayer(&relayer, &(MIN_STAKE * 2));

    let record = client.get_relayer(&relayer);
    assert_eq!(record.status, RelayerStatus::Active);
    assert_eq!(record.stake, MIN_STAKE * 2);
    assert!(client.is_relayer_live(&relayer));
}

#[test]
#[should_panic(expected = "Stake below minimum")]
fn test_register_relayer_below_min_stake() {
    let (env, cid, _admin) = setup();
    let client = AetherMintContractClient::new(&env, &cid);
    let relayer = Address::generate(&env);
    client.register_relayer(&relayer, &(MIN_STAKE - 1));
}

#[test]
#[should_panic(expected = "Relayer already registered")]
fn test_register_relayer_twice_fails() {
    let (env, cid, _admin) = setup();
    let client = AetherMintContractClient::new(&env, &cid);
    let relayer = Address::generate(&env);
    client.register_relayer(&relayer, &MIN_STAKE);
    client.register_relayer(&relayer, &MIN_STAKE);
}

#[test]
fn test_heartbeat_keeps_relayer_live() {
    let (env, cid, _admin) = setup();
    let client = AetherMintContractClient::new(&env, &cid);
    let relayer = Address::generate(&env);
    client.register_relayer(&relayer, &MIN_STAKE);

    advance(&env, LIVENESS_WINDOW_SECONDS + 1);
    assert!(!client.is_relayer_live(&relayer));

    client.heartbeat(&relayer);
    assert!(client.is_relayer_live(&relayer));
}

#[test]
#[should_panic(expected = "Relayer is not live")]
fn test_submit_attestation_requires_live_relayer() {
    let (env, cid, _admin) = setup();
    let client = AetherMintContractClient::new(&env, &cid);
    let relayer = Address::generate(&env);
    client.register_relayer(&relayer, &MIN_STAKE);

    advance(&env, LIVENESS_WINDOW_SECONDS + 1);
    client.submit_attestation(&relayer, &str(&env, "msg-1"), &1, &2, &str(&env, "0xroot"));
}

#[test]
fn test_submit_and_finalize_attestation() {
    let (env, cid, _admin) = setup();
    let client = AetherMintContractClient::new(&env, &cid);
    let relayer = Address::generate(&env);
    client.register_relayer(&relayer, &MIN_STAKE);

    let id = client.submit_attestation(&relayer, &str(&env, "msg-1"), &1, &2, &str(&env, "0xroot"));
    assert_eq!(id, 1);
    assert_eq!(client.get_relayer(&relayer).attestation_count, 1);

    advance(&env, DISPUTE_WINDOW_SECONDS + 1);
    client.finalize_attestation(&id);
    assert_eq!(
        client.get_attestation(&id).status,
        AttestationStatus::Finalized
    );
}

#[test]
#[should_panic(expected = "Dispute window still open")]
fn test_finalize_within_window_fails() {
    let (env, cid, _admin) = setup();
    let client = AetherMintContractClient::new(&env, &cid);
    let relayer = Address::generate(&env);
    client.register_relayer(&relayer, &MIN_STAKE);

    let id = client.submit_attestation(&relayer, &str(&env, "msg-1"), &1, &2, &str(&env, "0xroot"));
    client.finalize_attestation(&id);
}

#[test]
fn test_fraud_proof_slashes_relayer() {
    let (env, cid, _admin) = setup();
    let client = AetherMintContractClient::new(&env, &cid);
    let relayer = Address::generate(&env);
    let challenger = Address::generate(&env);
    client.register_relayer(&relayer, &MIN_STAKE);

    let id = client.submit_attestation(&relayer, &str(&env, "msg-1"), &1, &2, &str(&env, "0xroot"));

    let result = client.submit_fraud_proof(&challenger, &id, &str(&env, "invalid root"));
    assert!(result);

    assert_eq!(
        client.get_attestation(&id).status,
        AttestationStatus::Challenged
    );
    assert_eq!(client.get_relayer(&relayer).status, RelayerStatus::Slashed);
    assert_eq!(client.get_relayer(&relayer).stake, 0);
}

#[test]
#[should_panic(expected = "Dispute window has closed")]
fn test_fraud_proof_after_window_fails() {
    let (env, cid, _admin) = setup();
    let client = AetherMintContractClient::new(&env, &cid);
    let relayer = Address::generate(&env);
    let challenger = Address::generate(&env);
    client.register_relayer(&relayer, &MIN_STAKE);

    let id = client.submit_attestation(&relayer, &str(&env, "msg-1"), &1, &2, &str(&env, "0xroot"));

    advance(&env, DISPUTE_WINDOW_SECONDS + 1);
    client.submit_fraud_proof(&challenger, &id, &str(&env, "too late"));
}

#[test]
fn test_freeze_and_unfreeze_relayer() {
    let (env, cid, admin) = setup();
    let client = AetherMintContractClient::new(&env, &cid);
    let relayer = Address::generate(&env);
    client.register_relayer(&relayer, &MIN_STAKE);

    client.freeze_relayer(&admin, &relayer);
    assert!(client.is_relayer_frozen(&relayer));

    client.unfreeze_relayer(&admin, &relayer);
    assert!(!client.is_relayer_frozen(&relayer));
}

#[test]
#[should_panic(expected = "Only bridge admin")]
fn test_freeze_by_non_admin_fails() {
    let (env, cid, _admin) = setup();
    let client = AetherMintContractClient::new(&env, &cid);
    let relayer = Address::generate(&env);
    let stranger = Address::generate(&env);
    client.register_relayer(&relayer, &MIN_STAKE);
    client.freeze_relayer(&stranger, &relayer);
}
