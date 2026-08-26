// This module emits events via the legacy `env.events().publish` API
// (deprecated in soroban-sdk 26). Scoped here rather than crate-wide until it
// is migrated to the `#[contractevent]` macro.
#![allow(deprecated)]

//! Verifiable Credential Schema Registry
//!
//! Closes Issue #421.
//!
//! This module implements an on-chain registry of versioned credential
//! schemas. Each schema has a canonical definition, a version number, a
//! governance-controlled status, and a deprecation/sunset mechanism so
//! that old schema versions can be retired while giving verifiers a
//! stable resolution path for historical credentials.
//!
//! ## Design
//!
//! - Schemas are identified by a `schema_id` (monotonically incrementing
//!   u64) **and** by a human-readable `schema_name` + `version` pair.
//! - The registry admin (set during `initialize`) controls who may
//!   register new schemas, evolve existing ones, and deprecate versions.
//! - An `Issuer` role may also register schemas to support self-service
//!   credential types — this maps onto the RBAC model in `access_control`.
//! - `SchemaStatus` follows an explicit state-machine:
//!   `Draft → Active → Deprecated → Sunset`
//! - Credentials reference a `schema_id` so verifiers can resolve the
//!   exact schema version the credential was issued against.

use crate::access_control;
use crate::utils::validation::{
    validate_non_zero_address, validate_string_length, MAX_DESCRIPTION_LENGTH,
    MAX_SHORT_TEXT_LENGTH, MAX_TITLE_LENGTH,
};
use soroban_sdk::{contracttype, symbol_short, Address, Env, String, Symbol, Vec};

// ── Constants ──────────────────────────────────────────────────────────────

/// Maximum length for a schema field definition entry (JSON-like string).
pub const MAX_FIELD_DEF_LENGTH: u32 = 512;
/// Maximum number of fields a schema may declare.
pub const MAX_FIELD_COUNT: u32 = 64;

// ── Types ──────────────────────────────────────────────────────────────────

/// Lifecycle status of a credential schema.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SchemaStatus {
    /// Registered but not yet published for production use.
    Draft = 0,
    /// Published and usable for credential issuance.
    Active = 1,
    /// No new credentials should reference this version; existing
    /// credentials remain valid.
    Deprecated = 2,
    /// Schema is permanently retired. Verifiers MUST reject new
    /// credentials referencing this version.
    Sunset = 3,
}

impl SchemaStatus {
    pub fn to_u8(&self) -> u8 {
        match self {
            SchemaStatus::Draft => 0,
            SchemaStatus::Active => 1,
            SchemaStatus::Deprecated => 2,
            SchemaStatus::Sunset => 3,
        }
    }

    pub fn from_u8(v: u8) -> Self {
        match v {
            0 => SchemaStatus::Draft,
            1 => SchemaStatus::Active,
            2 => SchemaStatus::Deprecated,
            3 => SchemaStatus::Sunset,
            _ => SchemaStatus::Draft,
        }
    }

    /// Returns `true` when credentials may still be issued against
    /// this schema.
    pub fn is_issuable(&self) -> bool {
        matches!(self, SchemaStatus::Active)
    }

    /// Returns `true` when verifiers should accept credentials that
    /// were previously issued against this schema.
    pub fn is_verifiable(&self) -> bool {
        !matches!(self, SchemaStatus::Sunset)
    }
}

/// A single field definition inside a schema.
#[contracttype]
#[derive(Clone, Debug)]
pub struct SchemaField {
    /// Identifier for the field (e.g. `"recipientName"`).
    pub name: String,
    /// Primitive type hint — one of: `"string"`, `"number"`,
    /// `"boolean"`, `"date"`, `"address"`.
    pub field_type: String,
    /// Whether verifiers must treat this field as mandatory.
    pub required: bool,
    /// Human-readable description of the field's purpose.
    pub description: String,
}

/// A complete versioned credential schema stored on-chain.
#[contracttype]
#[derive(Clone, Debug)]
pub struct CredentialSchema {
    /// Monotonically increasing registry-assigned identifier.
    pub id: u64,
    /// Issuer/publisher who registered this schema.
    pub author: Address,
    /// Short human-readable name (e.g. `"CourseCompletion"`).
    pub name: String,
    /// Semantic version string (e.g. `"1.0.0"`).
    pub version: String,
    /// Human-readable description of the credential type.
    pub description: String,
    /// IPFS CID (or similar) pointing to a full off-chain JSON-Schema
    /// document. On-chain fields are a summary; off-chain document is
    /// canonical.
    pub schema_uri: String,
    /// Ordered list of field definitions.
    pub fields: Vec<SchemaField>,
    /// Current lifecycle status.
    pub status: SchemaStatus,
    /// Ledger timestamp when the schema was registered.
    pub registered_at: u64,
    /// Ledger timestamp of the most recent status change.
    pub updated_at: u64,
    /// If this schema supersedes a previous version, points to its id.
    pub supersedes: Option<u64>,
}

/// Storage keys for the schema registry.
#[contracttype]
pub enum SchemaRegistryKey {
    /// `schema_id → CredentialSchema`
    Schema(u64),
    /// Monotonic counter — returns the id of the most recently
    /// registered schema (0 when the registry is empty).
    SchemaCount,
    /// Registry-level admin override (separate from contract admin).
    RegistryAdmin,
    /// `(name, version) → schema_id` — reverse look-up index.
    NameVersionIndex(String, String),
    /// `author → Vec<schema_id>` — all schemas registered by a given
    /// author.
    AuthorSchemas(Address),
}

// ── Initialisation ─────────────────────────────────────────────────────────

/// Seed the schema registry. May be called only once.
/// In practice this is wired into the main contract's `initialize`.
pub fn initialize_schema_registry(env: &Env, admin: &Address) {
    if env
        .storage()
        .instance()
        .has(&SchemaRegistryKey::RegistryAdmin)
    {
        panic!("SchemaRegistry: already initialized");
    }
    env.storage()
        .instance()
        .set(&SchemaRegistryKey::RegistryAdmin, admin);
    env.storage()
        .instance()
        .set(&SchemaRegistryKey::SchemaCount, &0u64);
}

// ── Internal helpers ───────────────────────────────────────────────────────

fn require_registry_admin(env: &Env, caller: &Address) {
    let admin: Address = env
        .storage()
        .instance()
        .get(&SchemaRegistryKey::RegistryAdmin)
        .unwrap_or_else(|| panic!("SchemaRegistry: not initialized"));
    if caller != &admin {
        // Also accept the global contract admin (stored under "admin").
        let contract_admin: Option<Address> =
            env.storage().instance().get(&Symbol::new(env, "admin"));
        match contract_admin {
            Some(ref ca) if ca == caller => {}
            _ => panic!("SchemaRegistry: caller is not an admin"),
        }
    }
}

fn require_author_or_admin(env: &Env, caller: &Address, schema: &CredentialSchema) {
    if caller == &schema.author {
        return;
    }
    require_registry_admin(env, caller);
}

fn next_schema_id(env: &Env) -> u64 {
    let current: u64 = env
        .storage()
        .instance()
        .get(&SchemaRegistryKey::SchemaCount)
        .unwrap_or(0u64);
    let next = current + 1;
    env.storage()
        .instance()
        .set(&SchemaRegistryKey::SchemaCount, &next);
    next
}

fn validate_fields(env: &Env, fields: &Vec<SchemaField>) {
    if fields.len() > MAX_FIELD_COUNT {
        panic!("SchemaRegistry: too many fields");
    }
    for i in 0..fields.len() {
        let f = fields.get(i).unwrap();
        validate_string_length(env, &f.name, MAX_SHORT_TEXT_LENGTH);
        validate_string_length(env, &f.field_type, MAX_SHORT_TEXT_LENGTH);
        validate_string_length(env, &f.description, MAX_FIELD_DEF_LENGTH);
    }
}

// ── Public API ─────────────────────────────────────────────────────────────

/// Register a new schema in `Draft` status.
///
/// Callers must hold either the `Issuer` or `Admin` role.
///
/// # Returns
/// The freshly assigned `schema_id`.
#[allow(clippy::too_many_arguments)] // Contract-facing signature; kept as-is.
pub fn register_schema(
    env: &Env,
    author: Address,
    name: String,
    version: String,
    description: String,
    schema_uri: String,
    fields: Vec<SchemaField>,
    supersedes: Option<u64>,
) -> u64 {
    author.require_auth();
    validate_non_zero_address(env, &author);
    validate_string_length(env, &name, MAX_TITLE_LENGTH);
    validate_string_length(env, &version, MAX_SHORT_TEXT_LENGTH);
    validate_string_length(env, &description, MAX_DESCRIPTION_LENGTH);
    validate_string_length(env, &schema_uri, crate::utils::validation::MAX_URI_LENGTH);
    validate_fields(env, &fields);

    // Require Issuer or Admin role.
    access_control::require_role(env, &author, access_control::Role::Issuer);

    // Prevent duplicate (name, version) pairs.
    let idx_key = SchemaRegistryKey::NameVersionIndex(name.clone(), version.clone());
    if env.storage().instance().has(&idx_key) {
        panic!("SchemaRegistry: schema name+version already exists");
    }

    // Validate supersedes reference.
    if let Some(sid) = supersedes {
        if !env
            .storage()
            .persistent()
            .has(&SchemaRegistryKey::Schema(sid))
        {
            panic!("SchemaRegistry: supersedes references non-existent schema");
        }
    }

    let schema_id = next_schema_id(env);
    let now = env.ledger().timestamp();

    let schema = CredentialSchema {
        id: schema_id,
        author: author.clone(),
        name: name.clone(),
        version: version.clone(),
        description,
        schema_uri,
        fields,
        status: SchemaStatus::Draft,
        registered_at: now,
        updated_at: now,
        supersedes,
    };

    env.storage()
        .persistent()
        .set(&SchemaRegistryKey::Schema(schema_id), &schema);

    // Update reverse look-up index.
    env.storage().instance().set(&idx_key, &schema_id);

    // Update author index.
    let author_key = SchemaRegistryKey::AuthorSchemas(author.clone());
    let mut author_schemas: Vec<u64> = env
        .storage()
        .persistent()
        .get(&author_key)
        .unwrap_or_else(|| Vec::new(env));
    author_schemas.push_back(schema_id);
    env.storage().persistent().set(&author_key, &author_schemas);

    env.events().publish(
        (symbol_short!("schema"), symbol_short!("reg")),
        (schema_id, author),
    );

    schema_id
}

/// Activate a `Draft` schema so it can be used for credential issuance.
///
/// Only the schema author or a registry admin may call this.
pub fn activate_schema(env: &Env, caller: Address, schema_id: u64) {
    caller.require_auth();
    let mut schema: CredentialSchema = env
        .storage()
        .persistent()
        .get(&SchemaRegistryKey::Schema(schema_id))
        .unwrap_or_else(|| panic!("SchemaRegistry: schema not found"));

    require_author_or_admin(env, &caller, &schema);

    if schema.status != SchemaStatus::Draft {
        panic!("SchemaRegistry: only Draft schemas can be activated");
    }

    schema.status = SchemaStatus::Active;
    schema.updated_at = env.ledger().timestamp();

    env.storage()
        .persistent()
        .set(&SchemaRegistryKey::Schema(schema_id), &schema);

    env.events().publish(
        (symbol_short!("schema"), symbol_short!("actv")),
        (schema_id, caller),
    );
}

/// Deprecate an `Active` schema. Existing credentials remain valid;
/// new credentials should not reference this version.
///
/// Only an admin may deprecate schemas (prevents authors from silently
/// breaking their own issuers).
pub fn deprecate_schema(env: &Env, caller: Address, schema_id: u64) {
    caller.require_auth();
    require_registry_admin(env, &caller);

    let mut schema: CredentialSchema = env
        .storage()
        .persistent()
        .get(&SchemaRegistryKey::Schema(schema_id))
        .unwrap_or_else(|| panic!("SchemaRegistry: schema not found"));

    if schema.status != SchemaStatus::Active {
        panic!("SchemaRegistry: only Active schemas can be deprecated");
    }

    schema.status = SchemaStatus::Deprecated;
    schema.updated_at = env.ledger().timestamp();

    env.storage()
        .persistent()
        .set(&SchemaRegistryKey::Schema(schema_id), &schema);

    env.events().publish(
        (symbol_short!("schema"), symbol_short!("depr")),
        (schema_id, caller),
    );
}

/// Permanently sunset a `Deprecated` schema. After this point
/// verifiers MUST reject new credentials claiming this schema.
///
/// Admin-only — irreversible.
pub fn sunset_schema(env: &Env, caller: Address, schema_id: u64) {
    caller.require_auth();
    require_registry_admin(env, &caller);

    let mut schema: CredentialSchema = env
        .storage()
        .persistent()
        .get(&SchemaRegistryKey::Schema(schema_id))
        .unwrap_or_else(|| panic!("SchemaRegistry: schema not found"));

    if schema.status != SchemaStatus::Deprecated {
        panic!("SchemaRegistry: only Deprecated schemas can be sunset");
    }

    schema.status = SchemaStatus::Sunset;
    schema.updated_at = env.ledger().timestamp();

    env.storage()
        .persistent()
        .set(&SchemaRegistryKey::Schema(schema_id), &schema);

    env.events().publish(
        (symbol_short!("schema"), symbol_short!("sun")),
        (schema_id, caller),
    );
}

/// Retrieve a schema by its numeric id.
pub fn get_schema(env: &Env, schema_id: u64) -> CredentialSchema {
    env.storage()
        .persistent()
        .get(&SchemaRegistryKey::Schema(schema_id))
        .unwrap_or_else(|| panic!("SchemaRegistry: schema not found"))
}

/// Retrieve a schema by its `(name, version)` pair.
pub fn get_schema_by_name_version(env: &Env, name: String, version: String) -> CredentialSchema {
    let idx_key = SchemaRegistryKey::NameVersionIndex(name, version);
    let schema_id: u64 = env
        .storage()
        .instance()
        .get(&idx_key)
        .unwrap_or_else(|| panic!("SchemaRegistry: schema not found"));
    get_schema(env, schema_id)
}

/// Returns all schema ids registered by a given author.
pub fn get_schemas_by_author(env: &Env, author: Address) -> Vec<u64> {
    env.storage()
        .persistent()
        .get(&SchemaRegistryKey::AuthorSchemas(author))
        .unwrap_or_else(|| Vec::new(env))
}

/// Total number of schemas registered (including all statuses).
pub fn get_schema_count(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&SchemaRegistryKey::SchemaCount)
        .unwrap_or(0u64)
}

/// Verify that a credential may be issued against the given schema:
/// - Schema must exist.
/// - Schema status must be `Active`.
///
/// Panics with a descriptive message on failure.
pub fn require_issuable_schema(env: &Env, schema_id: u64) {
    let schema = get_schema(env, schema_id);
    if !schema.status.is_issuable() {
        panic!("SchemaRegistry: schema is not in Active status");
    }
}

/// Verify that a previously-issued credential is still verifiable:
/// - Schema must exist.
/// - Schema status must not be `Sunset`.
///
/// Returns `true` when valid, `false` when the schema has been sunset.
pub fn is_schema_verifiable(env: &Env, schema_id: u64) -> bool {
    match env
        .storage()
        .persistent()
        .get::<SchemaRegistryKey, CredentialSchema>(&SchemaRegistryKey::Schema(schema_id))
    {
        Some(schema) => schema.status.is_verifiable(),
        None => false,
    }
}
