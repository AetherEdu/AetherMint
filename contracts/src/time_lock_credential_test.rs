#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

fn create_test_credential_hash(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[1u8; 32])
}

#[test]
fn test_initialize() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TimeLockCredential);
    let client = TimeLockCredentialClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    // Verify initialization by checking we can issue a credential
    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let hash = create_test_credential_hash(&env);

    env.mock_all_auths();
    let credential_id = client.try_issue_credential(
        &issuer,
        &recipient,
        &hash,
        &"Test Credential".into_val(&env),
        &(env.ledger().timestamp() + 1000),
    );

    assert!(credential_id.is_ok());
}

#[test]
fn test_issue_credential() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TimeLockCredential);
    let client = TimeLockCredentialClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let hash = create_test_credential_hash(&env);
    let release_time = env.ledger().timestamp() + 1000;

    env.mock_all_auths();
    let credential_id = client.issue_credential(
        &issuer,
        &recipient,
        &hash,
        &"Graduation Certificate".into_val(&env),
        &release_time,
    );

    assert_eq!(credential_id, 0u64);

    // Verify credential was stored
    let credential = client.get_credential(&credential_id);
    assert_eq!(credential.id, 0u64);
    assert_eq!(credential.issuer, issuer);
    assert_eq!(credential.recipient, recipient);
    assert!(!credential.is_released);
    assert!(!credential.is_revoked);
}

#[test]
fn test_release_credential_after_time() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TimeLockCredential);
    let client = TimeLockCredentialClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let hash = create_test_credential_hash(&env);
    let release_time = env.ledger().timestamp() + 1000;

    env.mock_all_auths();
    let credential_id = client.issue_credential(
        &issuer,
        &recipient,
        &hash,
        &"Test".into_val(&env),
        &release_time,
    );

    // Advance time past release
    env.ledger().with_mut(|li| {
        li.timestamp = release_time + 100;
    });

    // Recipient releases credential
    env.mock_all_auths();
    client.release_credential(&credential_id, &recipient);

    // Verify released
    let credential = client.get_credential(&credential_id);
    assert!(credential.is_released);
}

#[test]
fn test_cannot_release_before_time() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TimeLockCredential);
    let client = TimeLockCredentialClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let hash = create_test_credential_hash(&env);
    let release_time = env.ledger().timestamp() + 1000;

    env.mock_all_auths();
    let credential_id = client.issue_credential(
        &issuer,
        &recipient,
        &hash,
        &"Test".into_val(&env),
        &release_time,
    );

    // Try to release before time (should fail)
    let result = client.try_release_credential(&credential_id, &recipient);
    assert!(result.is_err());
    assert!(result.err().unwrap().contains("Time lock not yet expired"));
}

#[test]
fn test_emergency_revoke() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TimeLockCredential);
    let client = TimeLockCredentialClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let hash = create_test_credential_hash(&env);
    let release_time = env.ledger().timestamp() + 1000;

    env.mock_all_auths();
    let credential_id = client.issue_credential(
        &issuer,
        &recipient,
        &hash,
        &"Test".into_val(&env),
        &release_time,
    );

    // Admin emergency revokes
    env.mock_all_auths();
    client.emergency_revoke(&credential_id, &admin, &"Security breach".into_val(&env));

    // Verify revoked
    let credential = client.get_credential(&credential_id);
    assert!(credential.is_revoked);
    assert_eq!(credential.emergency_override, Some(admin.clone()));

    // Try to release revoked credential (should fail)
    env.ledger().with_mut(|li| {
        li.timestamp = release_time + 100;
    });

    let result = client.try_release_credential(&credential_id, &recipient);
    assert!(result.is_err());
    assert!(result.err().unwrap().contains("revoked"));
}

#[test]
fn test_batch_release() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TimeLockCredential);
    let client = TimeLockCredentialClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let hash = create_test_credential_hash(&env);

    env.mock_all_auths();

    // Issue multiple credentials
    let mut credential_ids: Vec<u64> = Vec::new(&env);
    for i in 0..5 {
        let cred_id = client.issue_credential(
            &issuer,
            &recipient,
            &hash,
            &format!("Credential {}", i).into_val(&env),
            &(env.ledger().timestamp() + 1000),
        );
        credential_ids.push_back(cred_id);
    }

    // Advance time
    env.ledger().with_mut(|li| {
        li.timestamp += 1000;
    });

    // Batch release
    let results = client.batch_release_credentials(&credential_ids, &recipient);

    // All should succeed
    assert_eq!(results.len(), 5);
    for i in 0..results.len() {
        assert!(results.get(i).unwrap().is_ok());
    }
}

#[test]
fn test_create_release_schedule() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TimeLockCredential);
    let client = TimeLockCredentialClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let hash = create_test_credential_hash(&env);

    env.mock_all_auths();

    // Issue credentials
    let cred1 = client.issue_credential(
        &issuer,
        &recipient,
        &hash,
        &"C1".into_val(&env),
        &(env.ledger().timestamp() + 1000),
    );
    let cred2 = client.issue_credential(
        &issuer,
        &recipient,
        &hash,
        &"C2".into_val(&env),
        &(env.ledger().timestamp() + 2000),
    );

    // Create schedule
    let credential_ids = Vec::from_array(&env, [cred1, cred2]);
    let release_times = Vec::from_array(
        &env,
        [
            env.ledger().timestamp() + 1000,
            env.ledger().timestamp() + 2000,
        ],
    );

    let schedule_id = client.create_release_schedule(&issuer, &credential_ids, &release_times);
    assert_eq!(schedule_id, 0u64);

    // Verify schedule
    let schedule = client.get_release_schedule(&schedule_id);
    assert_eq!(schedule.credentials.len(), 2);
    assert_eq!(schedule.release_times.len(), 2);
}

#[test]
fn test_get_credentials_by_recipient() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TimeLockCredential);
    let client = TimeLockCredentialClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let hash = create_test_credential_hash(&env);

    env.mock_all_auths();

    // Issue 3 credentials to same recipient
    client.issue_credential(
        &issuer,
        &recipient,
        &hash,
        &"C1".into_val(&env),
        &(env.ledger().timestamp() + 1000),
    );
    client.issue_credential(
        &issuer,
        &recipient,
        &hash,
        &"C2".into_val(&env),
        &(env.ledger().timestamp() + 2000),
    );
    client.issue_credential(
        &issuer,
        &recipient,
        &hash,
        &"C3".into_val(&env),
        &(env.ledger().timestamp() + 3000),
    );

    let credentials = client.get_credentials_by_recipient(&recipient);
    assert_eq!(credentials.len(), 3);
}

#[test]
fn test_check_upcoming_releases() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TimeLockCredential);
    let client = TimeLockCredentialClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let hash = create_test_credential_hash(&env);

    env.mock_all_auths();

    // Issue credentials with different release times
    client.issue_credential(
        &issuer,
        &recipient,
        &hash,
        &"Soon".into_val(&env),
        &(env.ledger().timestamp() + 500),
    );
    client.issue_credential(
        &issuer,
        &recipient,
        &hash,
        &"Later".into_val(&env),
        &(env.ledger().timestamp() + 5000),
    );

    // Check upcoming releases in next 1000 seconds
    let upcoming = client.check_upcoming_releases(&recipient, &1000);
    assert_eq!(upcoming.len(), 1);
    assert_eq!(
        upcoming.get(0).unwrap().metadata,
        String::from_str(&env, "Soon")
    );
}

#[test]
fn test_audit_log() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TimeLockCredential);
    let client = TimeLockCredentialClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let hash = create_test_credential_hash(&env);

    env.mock_all_auths();

    // Issue credential
    let credential_id = client.issue_credential(
        &issuer,
        &recipient,
        &hash,
        &"Test".into_val(&env),
        &(env.ledger().timestamp() + 1000),
    );

    // Get audit log
    let audit_entries = client.get_audit_log(&0, &10);
    assert!(audit_entries.len() > 0);

    // First entry should be ISSUE_CREDENTIAL
    let first_entry = audit_entries.get(0).unwrap();
    assert_eq!(
        first_entry.operation,
        String::from_str(&env, "ISSUE_CREDENTIAL")
    );
    assert_eq!(first_entry.credential_id, credential_id);
}

#[test]
fn test_unauthorized_release() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TimeLockCredential);
    let client = TimeLockCredentialClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    let hash = create_test_credential_hash(&env);

    env.mock_all_auths();
    let credential_id = client.issue_credential(
        &issuer,
        &recipient,
        &hash,
        &"Test".into_val(&env),
        &(env.ledger().timestamp() + 1000),
    );

    // Advance time
    env.ledger().with_mut(|li| {
        li.timestamp += 1000;
    });

    // Unauthorized user tries to release
    env.mock_all_auths();
    let result = client.try_release_credential(&credential_id, &unauthorized);
    assert!(result.is_err());
    assert!(result.err().unwrap().contains("Unauthorized"));
}

#[test]
fn test_empty_metadata() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TimeLockCredential);
    let client = TimeLockCredentialClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let hash = create_test_credential_hash(&env);

    env.mock_all_auths();
    let credential_id = client.issue_credential(
        &issuer,
        &recipient,
        &hash,
        &"".into_val(&env),
        &(env.ledger().timestamp() + 1000),
    );

    let credential = client.get_credential(&credential_id);
    assert_eq!(credential.metadata.len(), 0);
}

#[test]
fn test_zero_release_time() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TimeLockCredential);
    let client = TimeLockCredentialClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let hash = create_test_credential_hash(&env);

    env.mock_all_auths();
    let credential_id = client.issue_credential(
        &issuer,
        &recipient,
        &hash,
        &"Test".into_val(&env),
        &0,
    );

    // Should be immediately releasable
    let result = client.try_release_credential(&credential_id, &recipient);
    assert!(result.is_ok());
}

#[test]
fn test_unauthorized_emergency_revoke() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TimeLockCredential);
    let client = TimeLockCredentialClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    let hash = create_test_credential_hash(&env);

    env.mock_all_auths();
    let credential_id = client.issue_credential(
        &issuer,
        &recipient,
        &hash,
        &"Test".into_val(&env),
        &(env.ledger().timestamp() + 1000),
    );

    env.mock_all_auths();
    let result = client.try_emergency_revoke(&credential_id, &unauthorized, &"Test".into_val(&env));
    assert!(result.is_err());
}

#[test]
fn test_release_already_released() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TimeLockCredential);
    let client = TimeLockCredentialClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let hash = create_test_credential_hash(&env);
    let release_time = env.ledger().timestamp() + 1000;

    env.mock_all_auths();
    let credential_id = client.issue_credential(
        &issuer,
        &recipient,
        &hash,
        &"Test".into_val(&env),
        &release_time,
    );

    env.ledger().with_mut(|li| {
        li.timestamp = release_time + 100;
    });

    env.mock_all_auths();
    client.release_credential(&credential_id, &recipient);

    // Try to release again
    env.mock_all_auths();
    let result = client.try_release_credential(&credential_id, &recipient);
    assert!(result.is_err());
}

#[test]
fn test_batch_release_with_errors() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TimeLockCredential);
    let client = TimeLockCredentialClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let hash = create_test_credential_hash(&env);

    env.mock_all_auths();

    // Issue credentials with different release times
    let cred1 = client.issue_credential(
        &issuer,
        &recipient,
        &hash,
        &"C1".into_val(&env),
        &(env.ledger().timestamp() + 1000),
    );
    let cred2 = client.issue_credential(
        &issuer,
        &recipient,
        &hash,
        &"C2".into_val(&env),
        &(env.ledger().timestamp() + 500), // Earlier release
    );
    let cred3 = client.issue_credential(
        &issuer,
        &recipient,
        &hash,
        &"C3".into_val(&env),
        &(env.ledger().timestamp() + 2000), // Later release
    );

    // Advance time past cred2 only
    env.ledger().with_mut(|li| {
        li.timestamp += 750;
    });

    let credential_ids = Vec::from_array(&env, [cred1, cred2, cred3]);
    let results = client.batch_release_credentials(&credential_ids, &recipient);

    // cred2 should succeed, cred1 and cred3 should fail
    assert!(results.get(0).unwrap().is_err()); // cred1 not yet released
    assert!(results.get(1).unwrap().is_ok());  // cred2 released
    assert!(results.get(2).unwrap().is_err()); // cred3 not yet released
}

#[test]
fn test_get_nonexistent_credential() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TimeLockCredential);
    let client = TimeLockCredentialClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.get_credential(&999);
    }));
    assert!(result.is_err());
}

#[test]
fn test_get_credentials_by_recipient_empty() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TimeLockCredential);
    let client = TimeLockCredentialClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let recipient = Address::generate(&env);

    let credentials = client.get_credentials_by_recipient(&recipient);
    assert_eq!(credentials.len(), 0);
}

#[test]
fn test_get_nonexistent_schedule() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TimeLockCredential);
    let client = TimeLockCredentialClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.get_release_schedule(&999);
    }));
    assert!(result.is_err());
}

#[test]
fn test_check_upcoming_releases_empty() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TimeLockCredential);
    let client = TimeLockCredentialClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let recipient = Address::generate(&env);

    let upcoming = client.check_upcoming_releases(&recipient, &1000);
    assert_eq!(upcoming.len(), 0);
}

#[test]
fn test_audit_log_pagination() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TimeLockCredential);
    let client = TimeLockCredentialClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let hash = create_test_credential_hash(&env);

    env.mock_all_auths();

    // Create multiple credentials to populate audit log
    for i in 0..5 {
        client.issue_credential(
            &issuer,
            &recipient,
            &hash,
            &format!("Credential {}", i).into_val(&env),
            &(env.ledger().timestamp() + 1000),
        );
    }

    // Get first page
    let page1 = client.get_audit_log(&0, &3);
    assert_eq!(page1.len(), 3);

    // Get second page
    let page2 = client.get_audit_log(&3, &3);
    assert!(page2.len() > 0);
}

#[test]
fn test_multiple_recipients() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TimeLockCredential);
    let client = TimeLockCredentialClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let issuer = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    let recipient2 = Address::generate(&env);
    let recipient3 = Address::generate(&env);
    let hash = create_test_credential_hash(&env);

    env.mock_all_auths();

    let cred1 = client.issue_credential(
        &issuer,
        &recipient1,
        &hash,
        &"C1".into_val(&env),
        &(env.ledger().timestamp() + 1000),
    );
    let cred2 = client.issue_credential(
        &issuer,
        &recipient2,
        &hash,
        &"C2".into_val(&env),
        &(env.ledger().timestamp() + 1000),
    );
    let cred3 = client.issue_credential(
        &issuer,
        &recipient3,
        &hash,
        &"C3".into_val(&env),
        &(env.ledger().timestamp() + 1000),
    );

    let creds1 = client.get_credentials_by_recipient(&recipient1);
    let creds2 = client.get_credentials_by_recipient(&recipient2);
    let creds3 = client.get_credentials_by_recipient(&recipient3);

    assert_eq!(creds1.len(), 1);
    assert_eq!(creds2.len(), 1);
    assert_eq!(creds3.len(), 1);
    assert_eq!(creds1.get(0).unwrap(), cred1);
    assert_eq!(creds2.get(0).unwrap(), cred2);
    assert_eq!(creds3.get(0).unwrap(), cred3);
}
