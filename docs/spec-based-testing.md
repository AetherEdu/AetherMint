# Specification-Based Testing and Formal Verification

This document describes the specification-based testing approach used in AetherMint to verify correctness of critical Soroban smart contracts (Issue #425).

## Overview

AetherMint uses **bounded model checking** — a form of formal verification — to check contract correctness beyond what ordinary unit tests cover.

Standard unit tests verify specific scenarios.  Spec-based tests verify *properties* (invariants, preconditions, postconditions) across a large, automatically generated set of scenarios by:

1. Defining formal specifications in `contracts/src/specs/mod.rs`.
2. Generating deterministic operation traces with a pseudo-random LCG.
3. Evaluating every specification after every operation in every trace.
4. Reporting the full trace + seed whenever a violation is found.

This is equivalent to **k-induction** for k = trace depth, which provides strong guarantees about the state space reachable from realistic initial conditions.

---

## Specification Files

| File | Purpose |
|------|---------|
| `contracts/src/specs/mod.rs` | Invariant, precondition, and postcondition definitions |
| `contracts/src/credential_registry_spec_test.rs` | Bounded model checking for `credential_registry` |
| `contracts/src/schema_registry_spec_test.rs` | Bounded model checking for `schema_registry` |
| `contracts/src/governance_spec_test.rs` | Bounded model checking for `governance` |

---

## Specification Language

Each specification is a plain Rust function that panics with a descriptive message if the condition is violated.  This makes every spec a runtime assertion.

### Invariant example

```rust
/// Invariant CR-1: The global credential count monotonically increases.
pub fn inv_count_monotone(count_before: u64, count_after: u64) {
    assert!(
        count_after > count_before,
        "[CR-1] Credential count decreased: before={count_before}, after={count_after}"
    );
}
```

### Precondition example

```rust
/// Precondition CR-P2: Only an Active credential may be renewed.
pub fn pre_credential_renewable(status: u32, credential_id: u64) {
    assert_eq!(
        status, 0,
        "[CR-P2] Credential {credential_id} must be Active to be renewed, got status {status}"
    );
}
```

### Postcondition example

```rust
/// Postcondition CR-Q1: After revoke, status must be Revoked (2).
pub fn post_revoked_status(status: u32, credential_id: u64) {
    assert_eq!(
        status, 2,
        "[CR-Q1] Credential {credential_id} must have status Revoked (2) after revoke, got {status}"
    );
}
```

---

## Covered Specifications

### CredentialRegistry (`credential_registry_spec`)

| ID | Type | Description |
|----|------|-------------|
| CR-1 | Invariant | Credential count monotonically increases |
| CR-2 | Invariant | Issued credential IDs are always positive (> 0) |
| CR-3 | Invariant | `issued_at` < `expires_at` for every credential |
| CR-4 | Invariant | Per-recipient list length equals issued-minus-revoked count |
| CR-5 | Invariant | Revoked credential never reports Active status |
| CR-6 | Invariant | Renewal count never decreases |
| CR-P1 | Precondition | Credential must exist before revoke/renew/check |
| CR-P2 | Precondition | Only Active credentials may be renewed |
| CR-Q1 | Postcondition | Status is Revoked after successful revoke |
| CR-Q2 | Postcondition | `expires_at` strictly increases after renew |

### SchemaRegistry (`schema_registry_spec`)

| ID | Type | Description |
|----|------|-------------|
| SR-1 | Invariant | Schema count monotonically increases |
| SR-2 | Invariant | Schema IDs are always positive (> 0) |
| SR-3 | Invariant | Status transitions are forward-only (Draft→Active→Deprecated→Sunset) |
| SR-4 | Invariant | Issuable iff and only if Active |
| SR-5 | Invariant | Verifiable unless Sunset |
| SR-P1 | Precondition | Schema must exist before lifecycle transitions |
| SR-P2 | Precondition | `activate_schema` requires Draft status |
| SR-P3 | Precondition | `deprecate_schema` requires Active status |
| SR-P4 | Precondition | `sunset_schema` requires Deprecated status |
| SR-Q1 | Postcondition | Status is Active after activation |
| SR-Q2 | Postcondition | Status is Deprecated after deprecation |
| SR-Q3 | Postcondition | Status is Sunset after sunset |

### Governance (`governance_spec`)

| ID | Type | Description |
|----|------|-------------|
| GOV-1 | Invariant | Proposal count monotonically increases |
| GOV-2 | Invariant | `end_time` > `start_time` for every proposal |
| GOV-3 | Invariant | One vote per address per proposal |
| GOV-4 | Invariant | `for + against + abstain` = sum of all voting powers |
| GOV-5 | Invariant | Vote tallies are always non-negative |
| GOV-P1 | Precondition | Voting only while proposal is Active |
| GOV-Q1 | Postcondition | Correct tally update after cast_vote |

---

## Verification Approach and Limits

### What is verified

- All reachable states within traces of depth `TRACE_DEPTH` (48 steps for credential_registry, 40 for schema_registry, 32 for governance).
- Multiple seeds (5 per contract) covering different operation orderings.
- Both happy-path and error-path behaviors.

### What is not verified

- States only reachable via traces longer than `TRACE_DEPTH`.
- Time-overflow scenarios (e.g. `u64::MAX` timestamps).
- Interactions between contracts (cross-contract invariants are not checked here).
- Economic properties that require token balances to be set up.

### Counterexample reproduction

Every spec violation includes the seed value in its panic message.  To reproduce:

1. Find the seed in the test output: `seed=42 step=7 op=Renew`.
2. Set `const SEEDS: &[u64] = &[42];` in the relevant test.
3. Set `const TRACE_DEPTH: u32 = 8;` (step + 1).
4. Run `cargo test spec_ -- --nocapture`.

The test will reproduce the exact failing trace.

---

## Running Spec Tests

```bash
# Run all specification-based tests
cd contracts
cargo test --lib --release -- spec_ --nocapture

# Run only credential registry specs
cargo test --lib --release -- spec_credential_registry --nocapture

# Run only schema registry specs
cargo test --lib --release -- spec_schema_registry --nocapture

# Run only governance specs
cargo test --lib --release -- spec_governance --nocapture
```

---

## Adding New Specifications

1. Add the invariant / pre / postcondition function to the appropriate module in `contracts/src/specs/mod.rs`.
2. Call it in the trace loop of the corresponding `*_spec_test.rs` file.
3. Add a regression counterexample test if the spec guards against a known failure mode.
4. The CI `spec-test-contracts` job picks it up automatically.

---

## CI Integration

The spec tests run as a dedicated job (`spec-test-contracts`) in `.github/workflows/ci-pr.yml`, separate from the `test-contracts` job.  This means:

- Spec violations are always reported, even if other tests pass.
- The `ci-status` gate fails the PR if spec tests fail.
- Test output is uploaded as a build artifact (`spec-test-report`) for every run.
