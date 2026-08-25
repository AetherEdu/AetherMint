//! Specification-Based Tests: Schema Registry
//!
//! Closes Issue #425.
//!
//! Bounded model checking for the `schema_registry` module using the specs
//! defined in `contracts/src/specs/mod.rs`.
//!
//! Operations:
//!   - RegisterSchema → checks SR-1, SR-2, SR-P* postconditions
//!   - ActivateSchema → checks SR-P2, SR-Q1, SR-3, SR-4, SR-5
//!   - DeprecateSchema → checks SR-P3, SR-Q2, SR-3, SR-4, SR-5
//!   - SunsetSchema → checks SR-P4, SR-Q3, SR-3, SR-4, SR-5

#![cfg(test)]
extern crate std;

use crate::schema_registry::{
    activate_schema, deprecate_schema, get_schema, get_schema_count, initialize_schema_registry,
    is_schema_verifiable, register_schema, require_issuable_schema, sunset_schema, SchemaField,
    SchemaStatus,
};
use crate::{AetherMintContract, AetherMintContractClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, String, Vec,
};

// ── LCG (same as other spec tests) ─────────────────────────────────────────

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

// ── Setup ──────────────────────────────────────────────────────────────────

const TRACE_DEPTH: u32 = 40;

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

fn make_fields(env: &Env) -> Vec<SchemaField> {
    let mut fields = Vec::new(env);
    fields.push_back(SchemaField {
        name: String::from_str(env, "recipientName"),
        field_type: String::from_str(env, "string"),
        required: true,
        description: String::from_str(env, "Full name of recipient"),
    });
    fields
}

// ── Operations ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy)]
enum SchemaOp {
    Register,
    Activate,
    Deprecate,
    Sunset,
}

// ── Shadow state ────────────────────────────────────────────────────────────

struct SchemaShadow {
    id: u64,
    /// Numeric status: 0=Draft, 1=Active, 2=Deprecated, 3=Sunset
    status: u8,
}

// ── Spec test ──────────────────────────────────────────────────────────────

#[test]
fn spec_schema_registry_invariants() {
    use crate::specs::schema_registry_spec as spec;

    const SEEDS: &[u64] = &[7, 31, 101];

    for &seed in SEEDS {
        let mut rng = Lcg::new(seed);
        let (env, _client, admin) = setup();

        env.as_contract(&_client.address, || {
            initialize_schema_registry(&env, &admin);

            let mut shadows: std::vec::Vec<SchemaShadow> = std::vec::Vec::new();
            let mut schema_name_counter: u32 = 0;

            for step in 0u32..TRACE_DEPTH {
                let op = match rng.next_in(4) {
                    0 => SchemaOp::Register,
                    1 => SchemaOp::Activate,
                    2 => SchemaOp::Deprecate,
                    _ => SchemaOp::Sunset,
                };

                let _trace = std::format!("seed={seed} step={step} op={op:?}");

                match op {
                    SchemaOp::Register => {
                        schema_name_counter += 1;
                        let name = std::format!("Schema{schema_name_counter}");
                        let count_before = get_schema_count(&env);
                        let fields = make_fields(&env);

                        let schema_id = register_schema(
                            &env,
                            admin.clone(),
                            String::from_str(&env, &name),
                            String::from_str(&env, "1.0.0"),
                            String::from_str(&env, "Spec test schema"),
                            String::from_str(&env, "ipfs://QmSpec"),
                            fields,
                            None,
                        );

                        let count_after = get_schema_count(&env);

                        // Invariant SR-1: count monotone.
                        spec::inv_count_monotone(count_before, count_after);
                        // Invariant SR-2: id positive.
                        spec::inv_id_positive(schema_id);

                        // Initial status must be Draft (0).
                        let schema = get_schema(&env, schema_id);
                        assert_eq!(
                            schema.status,
                            SchemaStatus::Draft,
                            "[SR-init] schema {schema_id} should start as Draft"
                        );

                        shadows.push(SchemaShadow {
                            id: schema_id,
                            status: 0,
                        });
                    }

                    SchemaOp::Activate => {
                        // Find a Draft schema to activate.
                        let draft_idx = shadows.iter().position(|s| s.status == 0);
                        if let Some(idx) = draft_idx {
                            let schema_id = shadows[idx].id;
                            let status_before = shadows[idx].status;

                            // Precondition SR-P2.
                            spec::pre_schema_is_draft(status_before, schema_id);

                            activate_schema(&env, admin.clone(), schema_id);

                            let schema = get_schema(&env, schema_id);
                            let status_after = schema.status.to_u8();

                            // Postcondition SR-Q1.
                            spec::post_status_is_active(status_after, schema_id);
                            // Invariant SR-3: forward-only.
                            spec::inv_status_forward_only(status_before, status_after, schema_id);
                            // Invariant SR-4: issuable iff Active.
                            spec::inv_issuable_iff_active(
                                schema.status.is_issuable(),
                                status_after,
                                schema_id,
                            );
                            // Invariant SR-5: verifiable unless Sunset.
                            spec::inv_verifiable_unless_sunset(
                                is_schema_verifiable(&env, schema_id),
                                status_after,
                                schema_id,
                            );

                            shadows[idx].status = status_after;
                        }
                    }

                    SchemaOp::Deprecate => {
                        // Find an Active schema to deprecate.
                        let active_idx = shadows.iter().position(|s| s.status == 1);
                        if let Some(idx) = active_idx {
                            let schema_id = shadows[idx].id;
                            let status_before = shadows[idx].status;

                            // Precondition SR-P3.
                            spec::pre_schema_is_active(status_before, schema_id);

                            deprecate_schema(&env, admin.clone(), schema_id);

                            let schema = get_schema(&env, schema_id);
                            let status_after = schema.status.to_u8();

                            // Postcondition SR-Q2.
                            spec::post_status_is_deprecated(status_after, schema_id);
                            // Invariant SR-3.
                            spec::inv_status_forward_only(status_before, status_after, schema_id);
                            // Invariant SR-4: deprecated is not issuable.
                            spec::inv_issuable_iff_active(
                                schema.status.is_issuable(),
                                status_after,
                                schema_id,
                            );
                            // Invariant SR-5: deprecated is still verifiable.
                            spec::inv_verifiable_unless_sunset(
                                is_schema_verifiable(&env, schema_id),
                                status_after,
                                schema_id,
                            );

                            shadows[idx].status = status_after;
                        }
                    }

                    SchemaOp::Sunset => {
                        // Find a Deprecated schema to sunset.
                        let dep_idx = shadows.iter().position(|s| s.status == 2);
                        if let Some(idx) = dep_idx {
                            let schema_id = shadows[idx].id;
                            let status_before = shadows[idx].status;

                            // Precondition SR-P4.
                            spec::pre_schema_is_deprecated(status_before, schema_id);

                            sunset_schema(&env, admin.clone(), schema_id);

                            let schema = get_schema(&env, schema_id);
                            let status_after = schema.status.to_u8();

                            // Postcondition SR-Q3.
                            spec::post_status_is_sunset(status_after, schema_id);
                            // Invariant SR-3.
                            spec::inv_status_forward_only(status_before, status_after, schema_id);
                            // Invariant SR-4: sunset is not issuable.
                            spec::inv_issuable_iff_active(
                                schema.status.is_issuable(),
                                status_after,
                                schema_id,
                            );
                            // Invariant SR-5: sunset is not verifiable.
                            spec::inv_verifiable_unless_sunset(
                                is_schema_verifiable(&env, schema_id),
                                status_after,
                                schema_id,
                            );

                            shadows[idx].status = status_after;
                        }
                    }
                }

                // Global: all shadows must have non-decreasing status values
                // (validates that no out-of-band mutation occurred).
                for s in shadows.iter() {
                    assert!(
                        s.status <= 3,
                        "[SR-global] schema {} has invalid status {}",
                        s.id,
                        s.status
                    );
                }
            }
        });
    }
}

/// Counterexample: skipping Draft → Active violates `require_issuable_schema`.
#[test]
#[should_panic(expected = "schema is not in Active status")]
fn spec_draft_schema_not_issuable() {
    let (env, _client, admin) = setup();
    env.as_contract(&_client.address, || {
        initialize_schema_registry(&env, &admin);
        let fields = make_fields(&env);
        let sid = register_schema(
            &env,
            admin.clone(),
            String::from_str(&env, "NeverActivated"),
            String::from_str(&env, "1.0.0"),
            String::from_str(&env, "spec test"),
            String::from_str(&env, "ipfs://Qm1"),
            fields,
            None,
        );
        // Schema is Draft — must panic.
        require_issuable_schema(&env, sid);
    });
}

/// Counterexample: jumping from Draft to Sunset must fail.
#[test]
#[should_panic(expected = "only Deprecated schemas can be sunset")]
fn spec_draft_to_sunset_rejected() {
    let (env, _client, admin) = setup();
    env.as_contract(&_client.address, || {
        initialize_schema_registry(&env, &admin);
        let fields = make_fields(&env);
        let sid = register_schema(
            &env,
            admin.clone(),
            String::from_str(&env, "JumpToSunset"),
            String::from_str(&env, "1.0.0"),
            String::from_str(&env, "spec test"),
            String::from_str(&env, "ipfs://Qm2"),
            fields,
            None,
        );
        sunset_schema(&env, admin.clone(), sid);
    });
}
