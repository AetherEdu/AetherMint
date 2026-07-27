#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

fn create_test_seed(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[42u8; 32])
}

#[test]
fn test_initialize() {
    let env = Env::default();
    let contract_id = env.register_contract(None, VRFSystem);
    let client = VRFSystemClient::new(&env, &contract_id);

    client.initialize();

    // Verify initialization by requesting randomness
    let requester = Address::generate(&env);
    let seed = create_test_seed(&env);

    env.mock_all_auths();
    let request_id = client.request_randomness(
        &requester,
        &seed,
        &"Test".into_val(&env),
        &"Context".into_val(&env),
    );

    assert_eq!(request_id, 0u64);
}

#[test]
fn test_register_entropy_source() {
    let env = Env::default();
    let contract_id = env.register_contract(None, VRFSystem);
    let client = VRFSystemClient::new(&env, &contract_id);

    client.initialize();

    let provider = Address::generate(&env);
    env.mock_all_auths();

    let source_id =
        client.register_entropy_source(&"Test Source".into_val(&env), &provider, &5000u32);

    assert_eq!(source_id, 1u64); // 0 is default blockchain entropy

    // Verify source was registered
    let source = client.get_entropy_source(&source_id);
    assert_eq!(source.name, String::from_str(&env, "Test Source"));
    assert_eq!(source.provider, provider);
    assert_eq!(source.weight, 5000u32);
    assert!(source.is_active);
}

#[test]
fn test_request_randomness() {
    let env = Env::default();
    let contract_id = env.register_contract(None, VRFSystem);
    let client = VRFSystemClient::new(&env, &contract_id);

    client.initialize();

    let requester = Address::generate(&env);
    let seed = create_test_seed(&env);

    env.mock_all_auths();
    let request_id = client.request_randomness(
        &requester,
        &seed,
        &"Exam Question Generation".into_val(&env),
        &"Math Exam 101".into_val(&env),
    );

    assert_eq!(request_id, 0u64);

    // Verify request details
    let request = client.get_request(&request_id);
    assert_eq!(request.requester, requester);
    assert!(!request.is_fulfilled);
    assert_eq!(
        request.purpose,
        String::from_str(&env, "Exam Question Generation")
    );
}

#[test]
fn test_fulfill_randomness() {
    let env = Env::default();
    let contract_id = env.register_contract(None, VRFSystem);
    let client = VRFSystemClient::new(&env, &contract_id);

    client.initialize();

    let requester = Address::generate(&env);
    let seed = create_test_seed(&env);

    env.mock_all_auths();
    let request_id = client.request_randomness(
        &requester,
        &seed,
        &"Test".into_val(&env),
        &"Context".into_val(&env),
    );

    // Fulfill the request
    let random_value = U256::from_u32(12345);
    let proof = BytesN::from_array(&env, &[99u8; 64]);

    env.mock_all_auths();
    client.fulfill_randomness(&request_id, &random_value, &proof);

    // Verify fulfillment
    let request = client.get_request(&request_id);
    assert!(request.is_fulfilled);
    assert_eq!(request.random_value, Some(random_value));
    assert_eq!(request.proof, Some(proof));
}

#[test]
fn test_submit_entropy() {
    let env = Env::default();
    let contract_id = env.register_contract(None, VRFSystem);
    let client = VRFSystemClient::new(&env, &contract_id);

    client.initialize();

    let provider = Address::generate(&env);
    let requester = Address::generate(&env);
    let seed = create_test_seed(&env);

    env.mock_all_auths();
    let source_id = client.register_entropy_source(&"Oracle".into_val(&env), &provider, &10000u32);

    let request_id = client.request_randomness(
        &requester,
        &seed,
        &"Test".into_val(&env),
        &"Context".into_val(&env),
    );

    // Submit entropy
    let entropy = BytesN::from_array(&env, &[77u8; 32]);

    env.mock_all_auths();
    client.submit_entropy(&source_id, &request_id, &entropy);

    // Verify entropy was submitted (check total_contributions)
    let source = client.get_entropy_source(&source_id);
    assert_eq!(source.total_contributions, 1u64);
}

#[test]
fn test_create_beacon() {
    let env = Env::default();
    let contract_id = env.register_contract(None, VRFSystem);
    let client = VRFSystemClient::new(&env, &contract_id);

    client.initialize();

    let entropy_hash = BytesN::from_array(&env, &[55u8; 32]);
    let contributors = Vec::from_array(
        &env,
        [
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
        ],
    );

    env.mock_all_auths();
    let beacon_id = client.create_beacon(&entropy_hash, &contributors);

    assert_eq!(beacon_id, 0u64);

    // Verify beacon
    let beacon = client.get_latest_beacon();
    assert_eq!(beacon.id, 0u64);
    assert_eq!(beacon.entropy_hash, entropy_hash);
    assert_eq!(beacon.contributors.len(), 3);
    assert!(beacon.is_verified);
}

#[test]
fn test_generate_random_for_purpose() {
    let env = Env::default();
    let contract_id = env.register_contract(None, VRFSystem);
    let client = VRFSystemClient::new(&env, &contract_id);

    client.initialize();

    // Create a beacon first
    let entropy_hash = BytesN::from_array(&env, &[55u8; 32]);
    let contributors = Vec::from_array(&env, [Address::generate(&env)]);

    env.mock_all_auths();
    client.create_beacon(&entropy_hash, &contributors);

    let requester = Address::generate(&env);
    let seed = create_test_seed(&env);
    let min = U256::from_u32(1);
    let max = U256::from_u32(100);

    env.mock_all_auths();
    let random_value = client.generate_random_for_purpose(
        &requester,
        &"Lottery".into_val(&env),
        &seed,
        &min,
        &max,
    );

    // Verify value is in range
    assert!(random_value >= min && random_value <= max);
}

#[test]
fn test_commit_reveal_scheme() {
    let env = Env::default();
    let contract_id = env.register_contract(None, VRFSystem);
    let client = VRFSystemClient::new(&env, &contract_id);

    client.initialize();

    let committer = Address::generate(&env);
    let commitment_hash = BytesN::from_array(&env, &[33u8; 32]);
    let valid_until = env.ledger().timestamp() + 1000;

    env.mock_all_auths();
    client.commit(&committer, &commitment_hash, &valid_until);

    // Reveal
    let revealed_value = String::from_str(&env, "My Secret Value");

    env.mock_all_auths();
    let result = client.reveal(&committer, &revealed_value);

    assert_eq!(result, revealed_value);
}

#[test]
fn test_get_requests_by_user() {
    let env = Env::default();
    let contract_id = env.register_contract(None, VRFSystem);
    let client = VRFSystemClient::new(&env, &contract_id);

    client.initialize();

    let user = Address::generate(&env);
    let seed = create_test_seed(&env);

    env.mock_all_auths();

    // Create 3 requests
    client.request_randomness(
        &user,
        &seed,
        &"Purpose 1".into_val(&env),
        &"Context 1".into_val(&env),
    );
    client.request_randomness(
        &user,
        &seed,
        &"Purpose 2".into_val(&env),
        &"Context 2".into_val(&env),
    );
    client.request_randomness(
        &user,
        &seed,
        &"Purpose 3".into_val(&env),
        &"Context 3".into_val(&env),
    );

    let requests = client.get_requests_by_user(&user);
    assert_eq!(requests.len(), 3);
}

#[test]
fn test_verify_proof() {
    let env = Env::default();
    let contract_id = env.register_contract(None, VRFSystem);
    let client = VRFSystemClient::new(&env, &contract_id);

    client.initialize();

    let requester = Address::generate(&env);
    let seed = create_test_seed(&env);

    env.mock_all_auths();
    let request_id = client.request_randomness(
        &requester,
        &seed,
        &"Test".into_val(&env),
        &"Context".into_val(&env),
    );

    let random_value = U256::from_u32(12345);
    let proof = BytesN::from_array(&env, &[99u8; 64]);

    env.mock_all_auths();
    client.fulfill_randomness(&request_id, &random_value, &proof);

    // Verify proof
    let is_valid = client.verify_proof(&request_id, &proof);
    assert!(is_valid);

    // Wrong proof should fail
    let wrong_proof = BytesN::from_array(&env, &[88u8; 64]);
    let is_invalid = client.try_verify_proof(&request_id, &wrong_proof);
    assert!(is_invalid.is_err());
}

#[test]
fn test_statistics() {
    let env = Env::default();
    let contract_id = env.register_contract(None, VRFSystem);
    let client = VRFSystemClient::new(&env, &contract_id);

    client.initialize();

    let requester = Address::generate(&env);
    let seed = create_test_seed(&env);

    env.mock_all_auths();

    // Create and fulfill 2 requests
    let req1 = client.request_randomness(
        &requester,
        &seed,
        &"Test 1".into_val(&env),
        &"Context".into_val(&env),
    );
    let req2 = client.request_randomness(
        &requester,
        &seed,
        &"Test 2".into_val(&env),
        &"Context".into_val(&env),
    );

    client.fulfill_randomness(
        &req1,
        &U256::from_u32(111),
        &BytesN::from_array(&env, &[1u8; 64]),
    );
    client.fulfill_randomness(
        &req2,
        &U256::from_u32(222),
        &BytesN::from_array(&env, &[2u8; 64]),
    );

    let stats = client.get_stats();
    assert_eq!(stats.get("total_requests".into_val(&env)).unwrap(), 2u64);
    assert_eq!(
        stats.get("fulfilled_requests".into_val(&env)).unwrap(),
        2u64
    );
}

#[test]
fn test_unauthorized_entropy_submission() {
    let env = Env::default();
    let contract_id = env.register_contract(None, VRFSystem);
    let client = VRFSystemClient::new(&env, &contract_id);

    client.initialize();

    let provider = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    let requester = Address::generate(&env);
    let seed = create_test_seed(&env);

    env.mock_all_auths();
    let source_id = client.register_entropy_source(&"Oracle".into_val(&env), &provider, &10000u32);

    let request_id = client.request_randomness(
        &requester,
        &seed,
        &"Test".into_val(&env),
        &"Context".into_val(&env),
    );

    // Unauthorized user tries to submit entropy
    let entropy = BytesN::from_array(&env, &[77u8; 32]);

    env.mock_all_auths();
    let result = client.try_submit_entropy(&source_id, &request_id, &entropy);
    assert!(result.is_err());
    assert!(result.err().unwrap().contains("Unauthorized"));
}
