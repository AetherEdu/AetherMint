#![cfg(test)]

use crate::{
    attestation_protocol::AttestationError, credential_registry::BatchCredentialParams,
    AetherMintContract, AetherMintContractClient,
};
use soroban_sdk::{
    testutils::{Address as _, Events},
    Address, BytesN, Env, String, Vec,
};

fn setup_env() -> (
    Env,
    AetherMintContractClient<'static>,
    Address,
    Address,
    Address,
    Address,
) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(AetherMintContract, ());
    let client = AetherMintContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let attester = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    client.initialize(&admin);

    (env, client, admin, attester, user1, user2)
}

#[test]
#[should_panic(expected = "Contract already initialized")]
fn test_double_initialization() {
    let (_env, client, admin, _, _, _) = setup_env();
    client.initialize(&admin);
}

#[test]
fn test_admin_access_allowed() {
    let (env, client, admin, _, user1, _) = setup_env();

    // Admin can create course
    let course_id = client.create_course(
        &admin,
        &String::from_str(&env, "Course 101"),
        &String::from_str(&env, "Intro Course"),
        &100,
    );
    assert_eq!(course_id, 1);

    // Admin can issue credential
    let cred_id = client.issue_credential(
        &admin,
        &user1,
        &String::from_str(&env, "Title"),
        &String::from_str(&env, "Desc"),
        &String::from_str(&env, "Course101"),
        &String::from_str(&env, "ipfs://hash"),
    );
    assert_eq!(cred_id, 1);

    // Admin can issue credential with expiration
    let exp_cred_id = client.issue_credential_with_expiration(
        &admin,
        &user1,
        &String::from_str(&env, "ExpTitle"),
        &String::from_str(&env, "ExpDesc"),
        &String::from_str(&env, "Course101"),
        &String::from_str(&env, "ipfs://hash2"),
        &86400,
    );
    assert!(exp_cred_id > 0);

    // Admin can mint dynamic NFT
    let token_id = client.mint_dynamic_nft(
        &admin,
        &user1,
        &String::from_str(&env, "uri"),
        &String::from_str(&env, "meta"),
    );
    assert_eq!(token_id, 1);

    // Admin can revoke credential registry
    let revoked = client.revoke_credential_registry(&exp_cred_id, &admin);
    assert!(revoked);
}

#[test]
#[should_panic(expected = "Only admin can create courses")]
fn test_user_cannot_create_course() {
    let (env, client, _, _, user1, _) = setup_env();
    client.create_course(
        &user1,
        &String::from_str(&env, "Hacked Course"),
        &String::from_str(&env, "Hacked Desc"),
        &0,
    );
}

#[test]
#[should_panic(expected = "Only admin can issue credentials")]
fn test_user_cannot_issue_credential() {
    let (env, client, _, _, user1, user2) = setup_env();
    client.issue_credential(
        &user1,
        &user2,
        &String::from_str(&env, "Fake Cred"),
        &String::from_str(&env, "Fake"),
        &String::from_str(&env, "FakeCourse"),
        &String::from_str(&env, "ipfs"),
    );
}

#[test]
#[should_panic(expected = "Unauthorized issuer")]
fn test_user_cannot_issue_batch() {
    let (env, client, _, _, user1, user2) = setup_env();
    let mut params = Vec::new(&env);
    params.push_back(BatchCredentialParams {
        recipient: user2.clone(),
        title: String::from_str(&env, "T"),
        description: String::from_str(&env, "D"),
        course_id: String::from_str(&env, "C"),
        ipfs_hash: String::from_str(&env, "I"),
        validity_duration: 3600,
    });
    client.issue_credentials_batch(&user1, &params);
}

#[test]
fn test_attester_lifecycle_and_access() {
    let (env, client, admin, attester, user1, _) = setup_env();

    // Issue a credential first
    let cred_id = client.issue_credential_with_expiration(
        &admin,
        &user1,
        &String::from_str(&env, "C"),
        &String::from_str(&env, "D"),
        &String::from_str(&env, "ID"),
        &String::from_str(&env, "ipfs"),
        &86400,
    );

    let v_key = BytesN::from_array(&env, &[0; 32]);

    // Register attester (self serve)
    client.register_attester(&attester, &String::from_str(&env, "Institution"), &v_key);
    assert!(client.is_registered_attester(&attester));

    // Attest credential
    let sig = BytesN::from_array(&env, &[0; 64]);
    client.attest_credential(&attester, &cred_id, &sig, &String::from_str(&env, "Valid"));
    assert!(client.is_attested_by(&cred_id, &attester));

    // Deactivate attester by admin
    client.deactivate_attester(&admin, &attester);
    let attester_profile = client.get_attester(&attester);
    assert!(!attester_profile.is_active);

    // Reactivate
    client.reactivate_attester(&admin, &attester);
    let attester_profile_re = client.get_attester(&attester);
    assert!(attester_profile_re.is_active);

    // Revoke attestation as attester
    client.revoke_attestation(&attester, &cred_id);
    assert!(!client.is_attested_by(&cred_id, &attester));
}

#[test]
#[should_panic(expected = "AlreadyAttested")]
fn test_attester_duplicate_attestation_panics() {
    let (env, client, admin, attester, user1, _) = setup_env();

    let cred_id = client.issue_credential_with_expiration(
        &admin,
        &user1,
        &String::from_str(&env, "C"),
        &String::from_str(&env, "D"),
        &String::from_str(&env, "ID"),
        &String::from_str(&env, "ipfs"),
        &86400,
    );

    client.register_attester(
        &attester,
        &String::from_str(&env, "Inst"),
        &BytesN::from_array(&env, &[0; 32]),
    );

    let sig = BytesN::from_array(&env, &[0; 64]);
    client.attest_credential(&attester, &cred_id, &sig, &String::from_str(&env, "Meta"));

    // Second time should panic
    client.attest_credential(&attester, &cred_id, &sig, &String::from_str(&env, "Meta2"));
}

#[test]
#[should_panic(expected = "AttesterInactive")]
fn test_deactivated_attester_cannot_attest() {
    let (env, client, admin, attester, user1, _) = setup_env();

    let cred_id = client.issue_credential_with_expiration(
        &admin,
        &user1,
        &String::from_str(&env, "C"),
        &String::from_str(&env, "D"),
        &String::from_str(&env, "ID"),
        &String::from_str(&env, "ipfs"),
        &86400,
    );

    client.register_attester(
        &attester,
        &String::from_str(&env, "Inst"),
        &BytesN::from_array(&env, &[0; 32]),
    );
    client.deactivate_attester(&admin, &attester);

    let sig = BytesN::from_array(&env, &[1; 64]);
    client.attest_credential(&attester, &cred_id, &sig, &String::from_str(&env, "Meta"));
}

#[test]
fn test_user_renewal_and_transfer_permissions() {
    let (env, client, admin, _, user1, user2) = setup_env();

    let cred_id = client.issue_credential_with_expiration(
        &admin,
        &user1,
        &String::from_str(&env, "C"),
        &String::from_str(&env, "D"),
        &String::from_str(&env, "ID"),
        &String::from_str(&env, "ipfs"),
        &86400,
    );

    // Recipient can renew
    let renewed = client.renew_credential(&cred_id, &user1, &3600);
    assert!(renewed);

    // Admin mints NFT to user1
    let token_id = client.mint_dynamic_nft(
        &admin,
        &user1,
        &String::from_str(&env, "uri"),
        &String::from_str(&env, "meta"),
    );

    assert_eq!(client.owner_of(&token_id), user1);

    // User1 can transfer
    client.transfer_nft(&user1, &user2, &token_id);
    assert_eq!(client.owner_of(&token_id), user2);
}

#[test]
#[should_panic(expected = "Unauthorized to renew credential")]
fn test_unrelated_user_cannot_renew() {
    let (env, client, admin, _, user1, user2) = setup_env();
    let cred_id = client.issue_credential_with_expiration(
        &admin,
        &user1,
        &String::from_str(&env, "C"),
        &String::from_str(&env, "D"),
        &String::from_str(&env, "ID"),
        &String::from_str(&env, "ipfs"),
        &86400,
    );
    // User 2 cannot renew User 1's credential
    client.renew_credential(&cred_id, &user2, &3600);
}

#[test]
fn test_end_to_end_matrix() {
    let (env, client, admin, attester, user1, _user2) = setup_env();

    // 1. Array of batch credentials created by ADMIN
    let mut params = Vec::new(&env);
    params.push_back(BatchCredentialParams {
        recipient: user1.clone(),
        title: String::from_str(&env, "E2E T1"),
        description: String::from_str(&env, "E2E D1"),
        course_id: String::from_str(&env, "E2EC1"),
        ipfs_hash: String::from_str(&env, "ipfs1"),
        validity_duration: 3600,
    });

    let ids = client.issue_credentials_batch(&admin, &params);
    let cred_id = ids.get(0).unwrap();

    // 2. ATTESTER self registers and attests
    client.register_attester(
        &attester,
        &String::from_str(&env, "GlobalInst"),
        &BytesN::from_array(&env, &[0; 32]),
    );
    client.attest_credential(
        &attester,
        &cred_id,
        &BytesN::from_array(&env, &[0; 64]),
        &String::from_str(&env, "Perfect"),
    );
    assert_eq!(client.get_attestation_count(&cred_id), 1);

    // 3. USER renews their own credential
    assert!(client.renew_credential(&cred_id, &user1, &86400));

    // 4. ADMIN revokes attester
    client.deactivate_attester(&admin, &attester);

    // 5. ADMIN revokes credential
    assert!(client.revoke_credential_registry(&cred_id, &admin));
    let cred = client.get_credential_with_status(&cred_id);
    assert_eq!(cred.status as u32, 2); // Revoked
}
