//! Tests for the Credential Schema Registry (Issue #421)

#![cfg(test)]
extern crate std;

use crate::schema_registry::{
    activate_schema, deprecate_schema, get_schema, get_schema_by_name_version,
    get_schema_count, get_schemas_by_author, initialize_schema_registry, is_schema_verifiable,
    register_schema, require_issuable_schema, sunset_schema, SchemaField, SchemaStatus,
};
use crate::{AetherMintContract, AetherMintContractClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, String, Vec,
};

// ── Helpers ────────────────────────────────────────────────────────────────

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
        description: String::from_str(env, "Full legal name of the recipient"),
    });
    fields.push_back(SchemaField {
        name: String::from_str(env, "completionDate"),
        field_type: String::from_str(env, "date"),
        required: true,
        description: String::from_str(env, "ISO 8601 completion date"),
    });
    fields
}

// ── Registration tests ─────────────────────────────────────────────────────

#[test]
fn test_register_schema_happy_path() {
    let (env, _client, admin) = setup();
    env.as_contract(&_client.address, || {
        initialize_schema_registry(&env, &admin);
        let fields = make_fields(&env);
        let schema_id = register_schema(
            &env,
            admin.clone(),
            String::from_str(&env, "CourseCompletion"),
            String::from_str(&env, "1.0.0"),
            String::from_str(&env, "Schema for course completion credentials"),
            String::from_str(&env, "ipfs://QmSchemaHash"),
            fields,
            None,
        );
        assert_eq!(schema_id, 1);
        assert_eq!(get_schema_count(&env), 1);

        let schema = get_schema(&env, schema_id);
        assert_eq!(schema.status, SchemaStatus::Draft);
        assert_eq!(schema.id, 1);
        assert_eq!(schema.supersedes, None);
        assert_eq!(schema.fields.len(), 2);
    });
}

#[test]
fn test_schema_count_increments() {
    let (env, _client, admin) = setup();
    env.as_contract(&_client.address, || {
        initialize_schema_registry(&env, &admin);
        let fields = make_fields(&env);

        register_schema(
            &env,
            admin.clone(),
            String::from_str(&env, "SchemaA"),
            String::from_str(&env, "1.0.0"),
            String::from_str(&env, "desc"),
            String::from_str(&env, "ipfs://Qa"),
            fields.clone(),
            None,
        );
        register_schema(
            &env,
            admin.clone(),
            String::from_str(&env, "SchemaB"),
            String::from_str(&env, "1.0.0"),
            String::from_str(&env, "desc"),
            String::from_str(&env, "ipfs://Qb"),
            fields,
            None,
        );
        assert_eq!(get_schema_count(&env), 2);
    });
}

#[test]
#[should_panic(expected = "schema name+version already exists")]
fn test_duplicate_name_version_rejected() {
    let (env, _client, admin) = setup();
    env.as_contract(&_client.address, || {
        initialize_schema_registry(&env, &admin);
        let fields = make_fields(&env);
        register_schema(
            &env,
            admin.clone(),
            String::from_str(&env, "CourseCompletion"),
            String::from_str(&env, "1.0.0"),
            String::from_str(&env, "desc"),
            String::from_str(&env, "ipfs://Q1"),
            fields.clone(),
            None,
        );
        // Same name+version — must panic.
        register_schema(
            &env,
            admin.clone(),
            String::from_str(&env, "CourseCompletion"),
            String::from_str(&env, "1.0.0"),
            String::from_str(&env, "desc2"),
            String::from_str(&env, "ipfs://Q2"),
            fields,
            None,
        );
    });
}

// ── Lookup tests ───────────────────────────────────────────────────────────

#[test]
fn test_lookup_by_name_version() {
    let (env, _client, admin) = setup();
    env.as_contract(&_client.address, || {
        initialize_schema_registry(&env, &admin);
        let fields = make_fields(&env);
        register_schema(
            &env,
            admin.clone(),
            String::from_str(&env, "Achievement"),
            String::from_str(&env, "2.1.0"),
            String::from_str(&env, "Achievement schema"),
            String::from_str(&env, "ipfs://Qachievo"),
            fields,
            None,
        );

        let schema = get_schema_by_name_version(
            &env,
            String::from_str(&env, "Achievement"),
            String::from_str(&env, "2.1.0"),
        );
        assert_eq!(schema.id, 1);
    });
}

#[test]
fn test_get_schemas_by_author() {
    let (env, _client, admin) = setup();
    env.as_contract(&_client.address, || {
        initialize_schema_registry(&env, &admin);
        let fields = make_fields(&env);

        register_schema(
            &env,
            admin.clone(),
            String::from_str(&env, "S1"),
            String::from_str(&env, "1.0.0"),
            String::from_str(&env, "d"),
            String::from_str(&env, "ipfs://S1"),
            fields.clone(),
            None,
        );
        register_schema(
            &env,
            admin.clone(),
            String::from_str(&env, "S2"),
            String::from_str(&env, "1.0.0"),
            String::from_str(&env, "d"),
            String::from_str(&env, "ipfs://S2"),
            fields,
            None,
        );

        let list = get_schemas_by_author(&env, admin.clone());
        assert_eq!(list.len(), 2);
    });
}

// ── Status lifecycle tests ─────────────────────────────────────────────────

#[test]
fn test_status_lifecycle_draft_active_deprecated_sunset() {
    let (env, _client, admin) = setup();
    env.as_contract(&_client.address, || {
        initialize_schema_registry(&env, &admin);
        let fields = make_fields(&env);
        let sid = register_schema(
            &env,
            admin.clone(),
            String::from_str(&env, "Lifecycle"),
            String::from_str(&env, "1.0.0"),
            String::from_str(&env, "Test lifecycle"),
            String::from_str(&env, "ipfs://Qlc"),
            fields,
            None,
        );

        // Draft → Active
        activate_schema(&env, admin.clone(), sid);
        assert_eq!(get_schema(&env, sid).status, SchemaStatus::Active);

        // Active → Deprecated
        deprecate_schema(&env, admin.clone(), sid);
        assert_eq!(get_schema(&env, sid).status, SchemaStatus::Deprecated);
        // After deprecation, schema is still verifiable.
        assert!(is_schema_verifiable(&env, sid));

        // Deprecated → Sunset
        sunset_schema(&env, admin.clone(), sid);
        assert_eq!(get_schema(&env, sid).status, SchemaStatus::Sunset);
        // After sunset, schema is no longer verifiable.
        assert!(!is_schema_verifiable(&env, sid));
    });
}

#[test]
#[should_panic(expected = "only Draft schemas can be activated")]
fn test_activate_non_draft_panics() {
    let (env, _client, admin) = setup();
    env.as_contract(&_client.address, || {
        initialize_schema_registry(&env, &admin);
        let fields = make_fields(&env);
        let sid = register_schema(
            &env,
            admin.clone(),
            String::from_str(&env, "AlreadyActive"),
            String::from_str(&env, "1.0.0"),
            String::from_str(&env, "d"),
            String::from_str(&env, "ipfs://Qa"),
            fields,
            None,
        );
        activate_schema(&env, admin.clone(), sid);
        // Second activate must panic.
        activate_schema(&env, admin.clone(), sid);
    });
}

#[test]
#[should_panic(expected = "only Active schemas can be deprecated")]
fn test_deprecate_draft_panics() {
    let (env, _client, admin) = setup();
    env.as_contract(&_client.address, || {
        initialize_schema_registry(&env, &admin);
        let fields = make_fields(&env);
        let sid = register_schema(
            &env,
            admin.clone(),
            String::from_str(&env, "NeverActivated"),
            String::from_str(&env, "1.0.0"),
            String::from_str(&env, "d"),
            String::from_str(&env, "ipfs://Qna"),
            fields,
            None,
        );
        // Skip activate — deprecating a Draft must panic.
        deprecate_schema(&env, admin.clone(), sid);
    });
}

// ── Issuability guard tests ────────────────────────────────────────────────

#[test]
fn test_require_issuable_passes_for_active() {
    let (env, _client, admin) = setup();
    env.as_contract(&_client.address, || {
        initialize_schema_registry(&env, &admin);
        let fields = make_fields(&env);
        let sid = register_schema(
            &env,
            admin.clone(),
            String::from_str(&env, "Issuable"),
            String::from_str(&env, "1.0.0"),
            String::from_str(&env, "d"),
            String::from_str(&env, "ipfs://Qi"),
            fields,
            None,
        );
        activate_schema(&env, admin.clone(), sid);
        // Should not panic.
        require_issuable_schema(&env, sid);
    });
}

#[test]
#[should_panic(expected = "schema is not in Active status")]
fn test_require_issuable_fails_for_deprecated() {
    let (env, _client, admin) = setup();
    env.as_contract(&_client.address, || {
        initialize_schema_registry(&env, &admin);
        let fields = make_fields(&env);
        let sid = register_schema(
            &env,
            admin.clone(),
            String::from_str(&env, "WillDeprecate"),
            String::from_str(&env, "1.0.0"),
            String::from_str(&env, "d"),
            String::from_str(&env, "ipfs://Qd"),
            fields,
            None,
        );
        activate_schema(&env, admin.clone(), sid);
        deprecate_schema(&env, admin.clone(), sid);
        require_issuable_schema(&env, sid);
    });
}

// ── Supersedes tests ───────────────────────────────────────────────────────

#[test]
fn test_schema_supersedes_previous_version() {
    let (env, _client, admin) = setup();
    env.as_contract(&_client.address, || {
        initialize_schema_registry(&env, &admin);
        let fields = make_fields(&env);

        let v1 = register_schema(
            &env,
            admin.clone(),
            String::from_str(&env, "CourseCompletion"),
            String::from_str(&env, "1.0.0"),
            String::from_str(&env, "v1 desc"),
            String::from_str(&env, "ipfs://Qv1"),
            fields.clone(),
            None,
        );

        let v2 = register_schema(
            &env,
            admin.clone(),
            String::from_str(&env, "CourseCompletion"),
            String::from_str(&env, "2.0.0"),
            String::from_str(&env, "v2 desc — adds grade field"),
            String::from_str(&env, "ipfs://Qv2"),
            fields,
            Some(v1),
        );

        let schema_v2 = get_schema(&env, v2);
        assert_eq!(schema_v2.supersedes, Some(v1));
    });
}

#[test]
#[should_panic(expected = "supersedes references non-existent schema")]
fn test_supersedes_nonexistent_panics() {
    let (env, _client, admin) = setup();
    env.as_contract(&_client.address, || {
        initialize_schema_registry(&env, &admin);
        let fields = make_fields(&env);
        register_schema(
            &env,
            admin.clone(),
            String::from_str(&env, "OrphanV2"),
            String::from_str(&env, "2.0.0"),
            String::from_str(&env, "desc"),
            String::from_str(&env, "ipfs://Qorphan"),
            fields,
            Some(999), // non-existent
        );
    });
}
