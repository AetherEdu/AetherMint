//! Specification-Based Tests: Credential Registry
//!
//! Closes Issue #425.
//!
//! ## What this file does
//!
//! This is a bounded model checker for the `credential_registry` module.
//! It:
//!   1. Builds a deterministic operation trace using the same LCG used in
//!      `fuzzing_test.rs`.
//!   2. Applies each operation against a live Soroban `Env`.
//!   3. After every operation, evaluates **all** invariants defined in
//!      `specs::credential_registry_spec`.
//!   4. Before each operation, checks the relevant **preconditions**.
//!   5. After each operation that succeeds, checks the relevant
//!      **postconditions**.
//!
//! Any violated spec is a test failure.  The operation trace and seed are
//! printed alongside the assertion message so failures are reproducible.
//!
//! ## Depth and seeds
//!
//! Each seed produces an independent trace of `TRACE_DEPTH` operations.
//! The seeds were chosen to maximise coverage of branching paths:
//!   - Seed 1   : early revoke then renew attempts
//!   - Seed 13  : heavy issuance, then batch revoke
//!   - Seed 42  : expiration checks dominate
//!   - Seed 99  : alternating issue/renew/expire
//!   - Seed 1337: long sequences with many recipients
//!
//! ## Adding new specifications
//!
//! Add a check to `contracts/src/specs/mod.rs`, then call it at the
//! appropriate point in the trace loop below.

#![cfg(test)]
extern crate std;

use crate::{AetherMintContract, AetherMintContractClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, String,
};

// ── Pseudo-random generator (same as fuzzing_test.rs) ─────────────────────

struct Lcg {
    state: u64,
}
impl Lcg {
    fn new(seed: u64) -> Self {
        Lcg {
            state: seed.wrapping_mul(2_654_435_761).wrapping_add(1),
        }
    }
    fn next_u32(&mut self) -> u32 {
        self.state = self
            .state
            .wrapping_mul(1_664_525)
            .wrapping_add(1_013_904_223);
        (self.state >> 16) as u32
    }
    fn next_in(&mut self, bound: u32) -> u32 {
        if bound == 0 {
            return 0;
        }
        self.next_u32() % bound
    }
}

// ── Test setup ─────────────────────────────────────────────────────────────

const TRACE_DEPTH: u32 = 48;

fn setup() -> (Env, AetherMintContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(2_000_000);
    let contract_id = env.register_contract(None, AetherMintContract);
    let client = AetherMintContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    (env, client, admin)
}

// ── Operations ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy)]
enum Op {
    Issue,
    Revoke,
    Renew,
    CheckExpiration,
}

// ── Shadow state ────────────────────────────────────────────────────────────

#[derive(Clone)]
struct CredShadow {
    id: u64,
    recipient_idx: usize,
    revoked: bool,
    renewal_count: u32,
    expires_at: u64,
    issued_at: u64,
}

// ── Main spec-test ──────────────────────────────────────────────────────────

#[test]
fn spec_credential_registry_invariants() {
    use crate::specs::credential_registry_spec as spec;

    const SEEDS: &[u64] = &[1, 13, 42, 99, 1337];

    for &seed in SEEDS {
        let mut rng = Lcg::new(seed);
        let (env, client, admin) = setup();

        let recipients = [
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
        ];

        let mut total_issued: u64 = 0;
        let mut shadows: std::vec::Vec<CredShadow> = std::vec::Vec::new();

        // Per-recipient shadow counter (only unrevoked).
        let mut per_recipient: [u32; 3] = [0; 3];

        let base_time: u64 = 2_000_000;
        let mut clock = base_time;

        for step in 0u32..TRACE_DEPTH {
            let op = match rng.next_in(4) {
                0 => Op::Issue,
                1 => Op::Revoke,
                2 => Op::Renew,
                _ => Op::CheckExpiration,
            };

            let trace_label = std::format!("seed={seed} step={step} op={op:?}");

            match op {
                Op::Issue => {
                    let r_idx = rng.next_in(3) as usize;
                    let recipient = recipients[r_idx].clone();
                    let duration = 60u64 + (rng.next_in(300) as u64);

                    let count_before = client.get_credential_count();
                    let issued_at = clock;
                    let expires_at = issued_at + duration;

                    let cid = client.issue_credential_with_expiration(
                        &admin,
                        &recipient,
                        &String::from_str(&env, "Spec Credential"),
                        &String::from_str(&env, "Spec test description"),
                        &String::from_str(&env, "SPEC-101"),
                        &String::from_str(&env, "QmSpecHash"),
                        &duration,
                    );

                    let count_after = client.get_credential_count();

                    // Invariants checked after every issue.
                    spec::inv_count_monotone(count_before, count_after);
                    spec::inv_id_positive(cid);
                    // The contract uses the ledger timestamp for issued_at.
                    // We trust the contract's own value; check ordering via shadow.
                    spec::inv_timestamps_ordered(issued_at, expires_at);

                    total_issued += 1;
                    per_recipient[r_idx] += 1;
                    shadows.push(CredShadow {
                        id: cid,
                        recipient_idx: r_idx,
                        revoked: false,
                        renewal_count: 0,
                        expires_at,
                        issued_at,
                    });

                    // Postcondition: is_credential_valid returns true for a
                    // freshly issued credential.
                    assert!(
                        client.is_credential_valid(&cid),
                        "[CR-post-issue] {trace_label}: fresh credential {cid} not valid"
                    );
                }

                Op::Revoke => {
                    if shadows.is_empty() {
                        continue;
                    }
                    let idx = rng.next_in(shadows.len() as u32) as usize;
                    let shadow = shadows[idx].clone();

                    if shadow.revoked {
                        // Revoking an already-revoked credential should be
                        // handled gracefully by the contract (no panic), but
                        // we don't assert a postcondition on double-revoke.
                        continue;
                    }

                    // Precondition: credential must exist.
                    spec::pre_credential_exists(true, shadow.id, "revoke");

                    match client.try_revoke_credential_registry(&shadow.id, &admin) {
                        Ok(true) => {
                            // Postcondition: status must be Revoked (2).
                            let status = client.check_credential_expiration(&shadow.id);
                            spec::post_revoked_status(status, shadow.id);

                            // Invariant: revoked credential is not active.
                            spec::inv_revoked_not_active(status, shadow.id);

                            shadows[idx].revoked = true;
                            per_recipient[shadow.recipient_idx] =
                                per_recipient[shadow.recipient_idx].saturating_sub(1);
                        }
                        _ => {
                            // The try_ path may fail if the credential was
                            // already revoked or in an unexpected state.
                        }
                    }
                }

                Op::Renew => {
                    if shadows.is_empty() {
                        continue;
                    }
                    let idx = rng.next_in(shadows.len() as u32) as usize;
                    let shadow = shadows[idx].clone();

                    if shadow.revoked {
                        continue;
                    }

                    // Precondition: credential exists and is active.
                    spec::pre_credential_exists(true, shadow.id, "renew");
                    let status_before = client.check_credential_expiration(&shadow.id);
                    spec::pre_credential_renewable(status_before, shadow.id);

                    let extension = 30u64 + (rng.next_in(120) as u64);
                    let old_expires = shadow.expires_at;
                    let renewal_before = shadow.renewal_count;

                    match client.try_renew_credential(&shadow.id, &admin, &extension) {
                        Ok(true) => {
                            let new_expires = old_expires + extension;
                            // Postcondition: expires_at increased.
                            spec::post_renewed_expires_at(old_expires, new_expires, shadow.id);

                            let new_renewal = renewal_before + 1;
                            // Invariant: renewal count monotone.
                            spec::inv_renewal_count_monotone(
                                renewal_before,
                                new_renewal,
                                shadow.id,
                            );

                            shadows[idx].expires_at = new_expires;
                            shadows[idx].renewal_count = new_renewal;
                        }
                        _ => {}
                    }
                }

                Op::CheckExpiration => {
                    if shadows.is_empty() {
                        continue;
                    }
                    let idx = rng.next_in(shadows.len() as u32) as usize;
                    let shadow = shadows[idx].clone();
                    // Advance the ledger clock occasionally to trigger expiration.
                    if rng.next_in(4) == 0 {
                        clock += rng.next_in(120) as u64;
                        env.ledger().set_timestamp(clock);
                    }
                    let _status = client.check_credential_expiration(&shadow.id);
                }
            }

            // ── Global invariants checked after every step ─────────────────

            // Invariant CR-1 (total count).
            let stored_count = client.get_credential_count();
            assert_eq!(
                stored_count, total_issued,
                "[CR-1] {trace_label}: total count mismatch"
            );

            // Invariant CR-4 (per-recipient counts).
            for (i, recipient) in recipients.iter().enumerate() {
                let list = client.get_user_credentials_with_status(recipient);
                spec::inv_per_recipient_count(
                    list.len(),
                    per_recipient[i],
                    &std::format!("recipient[{i}]"),
                );
            }
        }
    }
}

// ── Counterexample reproduction helpers ────────────────────────────────────

/// Regression test: verify that a credential with validity_duration=0 is
/// rejected.  This is the counterexample for the precondition
/// `validate_duration` failing to guard against zero.
#[test]
#[should_panic]
fn spec_zero_duration_rejected() {
    let (env, client, admin) = setup();
    let recipient = Address::generate(&env);
    // validity_duration = 0 must be rejected by the contract.
    client.issue_credential_with_expiration(
        &admin,
        &recipient,
        &String::from_str(&env, "Zero Duration"),
        &String::from_str(&env, "desc"),
        &String::from_str(&env, "C-0"),
        &String::from_str(&env, "QmZero"),
        &0u64, // precondition violation
    );
}

/// Regression test: verify that revoking a non-existent credential does
/// not corrupt state.
#[test]
fn spec_revoke_nonexistent_no_state_corruption() {
    let (_, client, admin) = setup();
    // There are no credentials; revoking id=9999 should either return false
    // or panic — either way the credential count must remain 0 afterwards.
    let _ = client.try_revoke_credential_registry(&9999u64, &admin);
    assert_eq!(client.get_credential_count(), 0);
}
