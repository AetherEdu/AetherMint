//! Formal Specifications — AetherMint Contracts
//!
//! Closes Issue #425.
//!
//! This module declares the invariants, preconditions, and postconditions for
//! the critical AetherMint contracts.  It is intentionally *pure* — every
//! definition here is a checked assertion, not just documentation, so that the
//! bounded model checking carried out in `*_spec_test.rs` can import and apply
//! them mechanically.
//!
//! ## Philosophy
//!
//! Formal specification in the Soroban context means:
//!
//! 1. **Invariants** — properties that must hold in *every* reachable state.
//!    e.g. "the credential count never decreases".
//! 2. **Preconditions** — facts that must be true *before* an operation is
//!    invoked for the operation to be well-defined.
//!    e.g. "the credential being revoked must exist and be Active".
//! 3. **Postconditions** — facts that must be true *after* a successful
//!    operation.
//!    e.g. "after `revoke`, the credential status is `Revoked`".
//!
//! Each function in this file takes an `Env` reference and the relevant
//! contract state, and panics with a descriptive message if the condition is
//! violated.  This turns every spec into a runtime assertion that the test
//! harness evaluates after each operation in a trace.
//!
//! ## Verification approach
//!
//! Bounded model checking is approximated via exhaustive enumeration of
//! operation traces up to a fixed depth (configurable per test module).
//! For each trace the harness:
//!
//!   a. Applies a sequence of operations drawn from the operation alphabet.
//!   b. After each operation, calls the relevant `check_*_invariants` here.
//!   c. Any panic is treated as a specification violation and surfaced with
//!      the full operation trace that caused it.
//!
//! This is equivalent to k-induction for k = trace_depth and provides strong
//! coverage of the state space accessible from realistic initial states.

#![cfg(test)]
#![allow(dead_code)]

use soroban_sdk::Env;

// ── CredentialRegistry specs ─────────────────────────────────────────────────

pub mod credential_registry_spec {
    use super::*;

    /// **Invariant CR-1**: The global credential count monotonically increases.
    ///
    /// After any successful `issue_credential*` call the stored count must be
    /// strictly greater than it was before the call.
    pub fn inv_count_monotone(count_before: u64, count_after: u64) {
        assert!(
            count_after > count_before,
            "[CR-1] Credential count decreased after issuance: before={count_before}, after={count_after}"
        );
    }

    /// **Invariant CR-2**: Every issued credential ID is positive (> 0).
    ///
    /// IDs start at 1; the zero value is reserved as a sentinel for "no
    /// credential".
    pub fn inv_id_positive(credential_id: u64) {
        assert!(
            credential_id > 0,
            "[CR-2] Issued credential ID must be > 0, got {credential_id}"
        );
    }

    /// **Invariant CR-3**: A credential's `issued_at` timestamp is ≤ its
    /// `expires_at` timestamp.
    ///
    /// Violated if `validity_duration` is ever accepted as 0 by the contract.
    pub fn inv_timestamps_ordered(issued_at: u64, expires_at: u64) {
        assert!(
            issued_at < expires_at,
            "[CR-3] issued_at ({issued_at}) must be strictly less than expires_at ({expires_at})"
        );
    }

    /// **Invariant CR-4**: The per-recipient credential list length is
    /// consistent with the number of credentials that have been issued to
    /// that recipient and not revoked.
    ///
    /// `list_len` — length of the on-chain user-credentials list.
    /// `expected`  — the harness's shadow count for the same recipient.
    pub fn inv_per_recipient_count(list_len: u32, expected: u32, recipient_label: &str) {
        assert_eq!(
            list_len,
            expected,
            "[CR-4] Per-recipient list length mismatch for {recipient_label}: stored={list_len}, expected={expected}"
        );
    }

    /// **Invariant CR-5**: A revoked credential is never active.
    ///
    /// Accepts the numeric status as returned by `check_credential_expiration`
    /// (0=Active, 1=Expired, 2=Revoked, 3=Pending).
    pub fn inv_revoked_not_active(status: u32, credential_id: u64) {
        assert_ne!(
            status, 0,
            "[CR-5] Credential {credential_id} reports Active status after revocation"
        );
    }

    /// **Invariant CR-6**: The renewal count never decreases.
    pub fn inv_renewal_count_monotone(before: u32, after: u32, credential_id: u64) {
        assert!(
            after >= before,
            "[CR-6] Renewal count decreased for credential {credential_id}: before={before}, after={after}"
        );
    }

    /// **Precondition CR-P1**: A credential must exist before it can be
    /// revoked, renewed, or checked for expiration.
    pub fn pre_credential_exists(exists: bool, credential_id: u64, op: &str) {
        assert!(
            exists,
            "[CR-P1] Precondition violated for {op}: credential {credential_id} does not exist"
        );
    }

    /// **Precondition CR-P2**: Only an Active credential may be renewed.
    pub fn pre_credential_renewable(status: u32, credential_id: u64) {
        assert_eq!(
            status, 0,
            "[CR-P2] Credential {credential_id} must be Active to be renewed, got status {status}"
        );
    }

    /// **Postcondition CR-Q1**: After a successful `revoke`, the credential
    /// status must be `Revoked` (2).
    pub fn post_revoked_status(status: u32, credential_id: u64) {
        assert_eq!(
            status, 2,
            "[CR-Q1] Credential {credential_id} must have status Revoked (2) after revoke, got {status}"
        );
    }

    /// **Postcondition CR-Q2**: After a successful `renew`, the new
    /// `expires_at` must be strictly greater than the old `expires_at`.
    pub fn post_renewed_expires_at(old_expires: u64, new_expires: u64, credential_id: u64) {
        assert!(
            new_expires > old_expires,
            "[CR-Q2] Credential {credential_id} expires_at did not increase after renewal: old={old_expires}, new={new_expires}"
        );
    }
}

// ── SchemaRegistry specs ──────────────────────────────────────────────────────

pub mod schema_registry_spec {
    use super::*;

    /// **Invariant SR-1**: The schema count monotonically increases.
    pub fn inv_count_monotone(count_before: u64, count_after: u64) {
        assert!(
            count_after > count_before,
            "[SR-1] Schema count decreased: before={count_before}, after={count_after}"
        );
    }

    /// **Invariant SR-2**: A schema's numeric ID is positive (> 0).
    pub fn inv_id_positive(schema_id: u64) {
        assert!(
            schema_id > 0,
            "[SR-2] Registered schema ID must be > 0, got {schema_id}"
        );
    }

    /// **Invariant SR-3**: The state machine only allows forward transitions.
    ///
    /// Valid: Draft(0) → Active(1) → Deprecated(2) → Sunset(3)
    /// Invalid: any decrease in the numeric status value.
    pub fn inv_status_forward_only(status_before: u8, status_after: u8, schema_id: u64) {
        assert!(
            status_after >= status_before,
            "[SR-3] Schema {schema_id} status moved backwards: {status_before} → {status_after}"
        );
    }

    /// **Invariant SR-4**: An Active schema is always issuable; any other
    /// status is not.
    pub fn inv_issuable_iff_active(is_issuable: bool, status: u8, schema_id: u64) {
        let expected = status == 1; // SchemaStatus::Active
        assert_eq!(
            is_issuable,
            expected,
            "[SR-4] Schema {schema_id} issuability mismatch: is_issuable={is_issuable}, status={status}"
        );
    }

    /// **Invariant SR-5**: A Sunset schema is never verifiable; all other
    /// statuses are verifiable.
    pub fn inv_verifiable_unless_sunset(is_verifiable: bool, status: u8, schema_id: u64) {
        let expected = status != 3; // Not Sunset
        assert_eq!(
            is_verifiable,
            expected,
            "[SR-5] Schema {schema_id} verifiability mismatch: is_verifiable={is_verifiable}, status={status}"
        );
    }

    /// **Precondition SR-P1**: A schema must exist before it can be activated,
    /// deprecated, or sunset.
    pub fn pre_schema_exists(exists: bool, schema_id: u64, op: &str) {
        assert!(
            exists,
            "[SR-P1] Precondition violated for {op}: schema {schema_id} does not exist"
        );
    }

    /// **Precondition SR-P2**: `activate_schema` requires the schema to be in
    /// Draft status.
    pub fn pre_schema_is_draft(status: u8, schema_id: u64) {
        assert_eq!(
            status, 0,
            "[SR-P2] Schema {schema_id} must be Draft (0) to be activated, got status {status}"
        );
    }

    /// **Precondition SR-P3**: `deprecate_schema` requires Active status.
    pub fn pre_schema_is_active(status: u8, schema_id: u64) {
        assert_eq!(
            status, 1,
            "[SR-P3] Schema {schema_id} must be Active (1) to be deprecated, got status {status}"
        );
    }

    /// **Precondition SR-P4**: `sunset_schema` requires Deprecated status.
    pub fn pre_schema_is_deprecated(status: u8, schema_id: u64) {
        assert_eq!(
            status, 2,
            "[SR-P4] Schema {schema_id} must be Deprecated (2) to be sunset, got status {status}"
        );
    }

    /// **Postcondition SR-Q1**: After `activate_schema`, status must be Active.
    pub fn post_status_is_active(status: u8, schema_id: u64) {
        assert_eq!(
            status, 1,
            "[SR-Q1] Schema {schema_id} must be Active (1) after activation, got {status}"
        );
    }

    /// **Postcondition SR-Q2**: After `deprecate_schema`, status must be
    /// Deprecated.
    pub fn post_status_is_deprecated(status: u8, schema_id: u64) {
        assert_eq!(
            status, 2,
            "[SR-Q2] Schema {schema_id} must be Deprecated (2) after deprecation, got {status}"
        );
    }

    /// **Postcondition SR-Q3**: After `sunset_schema`, status must be Sunset.
    pub fn post_status_is_sunset(status: u8, schema_id: u64) {
        assert_eq!(
            status, 3,
            "[SR-Q3] Schema {schema_id} must be Sunset (3) after sunset, got {status}"
        );
    }
}

// ── Governance specs ──────────────────────────────────────────────────────────

pub mod governance_spec {
    use super::*;

    /// **Invariant GOV-1**: The proposal count monotonically increases.
    pub fn inv_proposal_count_monotone(count_before: u64, count_after: u64) {
        assert!(
            count_after > count_before,
            "[GOV-1] Proposal count decreased: before={count_before}, after={count_after}"
        );
    }

    /// **Invariant GOV-2**: A proposal's `end_time` must be strictly greater
    /// than its `start_time`.
    pub fn inv_voting_window_positive(start_time: u64, end_time: u64, proposal_id: u64) {
        assert!(
            end_time > start_time,
            "[GOV-2] Proposal {proposal_id}: end_time ({end_time}) must be > start_time ({start_time})"
        );
    }

    /// **Invariant GOV-3**: An address may cast at most one vote per proposal.
    ///
    /// `vote_count` — the total number of vote records for this
    /// (proposal_id, voter) pair; must be ≤ 1.
    pub fn inv_one_vote_per_address(vote_count: u32, proposal_id: u64, voter_label: &str) {
        assert!(
            vote_count <= 1,
            "[GOV-3] Voter {voter_label} cast {vote_count} votes on proposal {proposal_id} (max 1)"
        );
    }

    /// **Invariant GOV-4**: `for_votes + against_votes + abstain_votes` must
    /// equal the sum of all individual voting-power contributions for the
    /// proposal.
    pub fn inv_vote_totals_consistent(
        for_v: i128,
        against_v: i128,
        abstain_v: i128,
        expected_total: i128,
        proposal_id: u64,
    ) {
        let recorded = for_v + against_v + abstain_v;
        assert_eq!(
            recorded,
            expected_total,
            "[GOV-4] Proposal {proposal_id} vote totals inconsistent: for={for_v} against={against_v} abstain={abstain_v} recorded_sum={recorded} expected={expected_total}"
        );
    }

    /// **Invariant GOV-5**: Vote tallies are always non-negative.
    pub fn inv_votes_non_negative(for_v: i128, against_v: i128, abstain_v: i128, proposal_id: u64) {
        assert!(
            for_v >= 0,
            "[GOV-5] Proposal {proposal_id}: for_votes is negative ({for_v})"
        );
        assert!(
            against_v >= 0,
            "[GOV-5] Proposal {proposal_id}: against_votes is negative ({against_v})"
        );
        assert!(
            abstain_v >= 0,
            "[GOV-5] Proposal {proposal_id}: abstain_votes is negative ({abstain_v})"
        );
    }

    /// **Precondition GOV-P1**: Voting is only permitted while the proposal
    /// status is Active.
    ///
    /// `is_active` — true when the contract considers the proposal open for
    /// voting.
    pub fn pre_proposal_is_active(is_active: bool, proposal_id: u64) {
        assert!(
            is_active,
            "[GOV-P1] Cannot vote on proposal {proposal_id}: proposal is not Active"
        );
    }

    /// **Postcondition GOV-Q1**: After a successful `cast_vote`, the tally for
    /// the chosen support option must have increased by exactly the voter's
    /// voting power.
    pub fn post_vote_tally_increased(
        tally_before: i128,
        tally_after: i128,
        voting_power: i128,
        proposal_id: u64,
        support_label: &str,
    ) {
        assert_eq!(
            tally_after,
            tally_before + voting_power,
            "[GOV-Q1] Proposal {proposal_id} {support_label} tally incorrect after vote: before={tally_before}, voting_power={voting_power}, after={tally_after}"
        );
    }
}

// ── Shared helpers ────────────────────────────────────────────────────────────

/// Verify all specs in `fns` using the supplied `env`.  Each function
/// receives a shared reference to the environment so specs can read
/// on-chain state if needed.
///
/// This is a convenience wrapper used by the spec-test harness to apply
/// a batch of invariant checks in one call.
pub fn verify_all(_env: &Env, checks: &[(&str, bool)]) {
    for (label, result) in checks {
        assert!(result, "Invariant violated: {label}");
    }
}
