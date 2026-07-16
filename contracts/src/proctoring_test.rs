#![cfg(test)]
extern crate std;

use crate::{credential_registry, proctoring, AetherMintContract, AetherMintContractClient};
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, String};

fn setup_contract(env: &Env) -> (AetherMintContractClient, Address, Address, Address) {
    let contract_id = env.register_contract(None, AetherMintContract);
    let client = AetherMintContractClient::new(env, &contract_id);

    let admin = Address::generate(env);
    let student = Address::generate(env);
    let proctor = Address::generate(env);

    client.initialize(&admin);

    (client, admin, student, proctor)
}

fn signature(env: &Env, seed: u8) -> BytesN<64> {
    BytesN::from_array(env, &[seed; 64])
}

#[test]
fn test_proctoring_session_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, student, proctor) = setup_contract(&env);

    let session_id =
        client.start_proctoring_session(&String::from_str(&env, "exam-101"), &student, &proctor);

    let session = client.get_proctoring_session(&session_id);
    assert_eq!(session.exam_id, String::from_str(&env, "exam-101"));
    assert_eq!(session.student, student);
    assert_eq!(session.proctor, proctor);
    assert_eq!(session.status, proctoring::ProctoringStatus::Pending);
    assert_eq!(client.get_proctoring_session_count(), 1);

    client.submit_proctoring_result(
        &session_id,
        &String::from_str(&env, "passed with minor review notes"),
        &signature(&env, 7),
    );

    let completed_session = client.get_proctoring_session(&session_id);
    assert_eq!(
        completed_session.status,
        proctoring::ProctoringStatus::Completed
    );
    assert!(client.get_proctoring_result(&session_id).is_some());

    let credential_id = client.issue_proctored_cred_with_exp(
        &admin,
        &student,
        &String::from_str(&env, "Proctored Credential"),
        &String::from_str(&env, "Issued after proctoring"),
        &String::from_str(&env, "exam-101"),
        &String::from_str(&env, "QmProctoredHash"),
        &1000u64,
        &session_id,
    );

    let credential = credential_registry::get_credential(&env, credential_id);
    assert!(credential.proctored);
    assert!(client.is_proctored_credential(&credential_id));

    let linked_session = client.get_proctoring_session(&session_id);
    assert_eq!(linked_session.linked_credential_id, Some(credential_id));
}

#[test]
fn test_challenge_and_resolution_flow() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, student, proctor) = setup_contract(&env);
    let challenger = Address::generate(&env);

    let session_id =
        client.start_proctoring_session(&String::from_str(&env, "exam-202"), &student, &proctor);

    client.submit_proctoring_result(
        &session_id,
        &String::from_str(&env, "needs review"),
        &signature(&env, 8),
    );

    client.challenge_proctoring_result(
        &session_id,
        &challenger,
        &String::from_str(&env, "camera feed mismatch"),
    );

    let challenged = client.get_proctoring_session(&session_id);
    assert_eq!(challenged.status, proctoring::ProctoringStatus::Challenged);
    assert!(client.get_proctoring_challenge(&session_id).is_some());

    client.resolve_challenge(
        &session_id,
        &proctoring::ChallengeResolution::Upheld,
        &admin,
    );

    let resolved = client.get_proctoring_session(&session_id);
    assert_eq!(resolved.status, proctoring::ProctoringStatus::Resolved);
    assert!(client.get_proctoring_resolution(&session_id).is_some());
    assert!(client.proctored_credential_is_eligible(&session_id));

    let credential_id = client.issue_proctored_cred_with_exp(
        &admin,
        &student,
        &String::from_str(&env, "Resolved Proctored Credential"),
        &String::from_str(&env, "Issued after challenge resolution"),
        &String::from_str(&env, "exam-202"),
        &String::from_str(&env, "QmResolvedHash"),
        &500u64,
        &session_id,
    );

    assert!(client.is_proctored_credential(&credential_id));
    let linked_session = client.get_proctoring_session(&session_id);
    assert_eq!(linked_session.linked_credential_id, Some(credential_id));
}

#[test]
fn test_overturned_challenge_blocks_proctored_issuance() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, student, proctor) = setup_contract(&env);
    let challenger = Address::generate(&env);

    let session_id =
        client.start_proctoring_session(&String::from_str(&env, "exam-303"), &student, &proctor);

    client.submit_proctoring_result(
        &session_id,
        &String::from_str(&env, "disputed"),
        &signature(&env, 9),
    );

    client.challenge_proctoring_result(
        &session_id,
        &challenger,
        &String::from_str(&env, "inconsistent answers"),
    );

    client.resolve_challenge(
        &session_id,
        &proctoring::ChallengeResolution::Overturned,
        &admin,
    );

    assert!(!client.proctored_credential_is_eligible(&session_id));

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.issue_proctored_cred_with_exp(
            &admin,
            &student,
            &String::from_str(&env, "Should Fail"),
            &String::from_str(&env, "Challenge overturned"),
            &String::from_str(&env, "exam-303"),
            &String::from_str(&env, "QmFailHash"),
            &500u64,
            &session_id,
        );
    }));

    assert!(result.is_err());
}

#[test]
fn test_duplicate_result_submission_and_early_challenge_fail() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, student, proctor) = setup_contract(&env);

    let session_id =
        client.start_proctoring_session(&String::from_str(&env, "exam-404"), &student, &proctor);

    client.submit_proctoring_result(
        &session_id,
        &String::from_str(&env, "first result"),
        &signature(&env, 10),
    );

    let duplicate_submission = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.submit_proctoring_result(
            &session_id,
            &String::from_str(&env, "second result"),
            &signature(&env, 11),
        );
    }));
    assert!(duplicate_submission.is_err());

    let before_result_env = Env::default();
    before_result_env.mock_all_auths();
    let (client2, _admin2, student2, proctor2) = setup_contract(&before_result_env);
    let challenger = Address::generate(&before_result_env);
    let session_id2 = client2.start_proctoring_session(
        &String::from_str(&before_result_env, "exam-405"),
        &student2,
        &proctor2,
    );

    let early_challenge = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client2.challenge_proctoring_result(
            &session_id2,
            &challenger,
            &String::from_str(&before_result_env, "no result yet"),
        );
    }));
    assert!(early_challenge.is_err());
}

#[test]
fn test_resolution_requires_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, student, proctor) = setup_contract(&env);
    let non_admin = Address::generate(&env);

    let session_id =
        client.start_proctoring_session(&String::from_str(&env, "exam-406"), &student, &proctor);

    client.submit_proctoring_result(
        &session_id,
        &String::from_str(&env, "ready"),
        &signature(&env, 12),
    );

    client.challenge_proctoring_result(
        &session_id,
        &non_admin,
        &String::from_str(&env, "evidence"),
    );

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.resolve_challenge(
            &session_id,
            &proctoring::ChallengeResolution::Upheld,
            &non_admin,
        );
    }));

    assert!(result.is_err());
}

#[test]
fn test_challenge_after_linked_credential_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, student, proctor) = setup_contract(&env);
    let challenger = Address::generate(&env);

    let session_id =
        client.start_proctoring_session(&String::from_str(&env, "exam-407"), &student, &proctor);

    client.submit_proctoring_result(
        &session_id,
        &String::from_str(&env, "verified"),
        &signature(&env, 13),
    );

    let credential_id = client.issue_proctored_cred_with_exp(
        &admin,
        &student,
        &String::from_str(&env, "Linked Credential"),
        &String::from_str(&env, "Linked before challenge"),
        &String::from_str(&env, "exam-407"),
        &String::from_str(&env, "QmLinkedHash"),
        &800u64,
        &session_id,
    );

    assert!(client.is_proctored_credential(&credential_id));

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.challenge_proctoring_result(
            &session_id,
            &challenger,
            &String::from_str(&env, "late evidence"),
        );
    }));

    assert!(result.is_err());
}
