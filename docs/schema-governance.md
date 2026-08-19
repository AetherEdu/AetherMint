# Schema Governance

This document describes how versioned credential schemas are registered, evolved, and retired in AetherMint.

## Overview

Every credential type issued on AetherMint is governed by an on-chain **CredentialSchema**.  Schemas are managed by the `SchemaRegistry` module inside the Soroban contract (`contracts/src/schema_registry.rs`) and accessed via the backend tooling layer (`backend/src/services/schemas.ts`).

Versioning and governance are designed to satisfy two competing needs:

1. **Verifiers** need a stable, tamper-proof source of truth for the schema a credential was issued against — even years after it was issued.
2. **Authors** need to be able to evolve schemas over time as credential types change.

Explicit versioning + a well-defined lifecycle state machine satisfies both.

---

## Schema Lifecycle

Schemas progress through four states in strict order.  No backwards transitions are allowed.

```
Draft ──► Active ──► Deprecated ──► Sunset
```

| State | Issuable? | Verifiable? | Who can transition in? | Notes |
|-------|-----------|-------------|------------------------|-------|
| **Draft** | No | Yes | Any issuer (via `register_schema`) | Default state on registration. |
| **Active** | ✅ Yes | Yes | Schema author or registry admin (`activate_schema`) | Production-ready. |
| **Deprecated** | No | Yes | Registry admin only (`deprecate_schema`) | Credentials already issued remain valid. |
| **Sunset** | No | ❌ No | Registry admin only (`sunset_schema`) | Permanent. Verifiers **must** reject new credentials. |

### Why admin-only deprecation?

Authors are prevented from deprecating their own schemas to avoid a scenario where an issuer silently breaks their own relying parties.  Deprecation signals to the entire ecosystem that a schema should no longer be used; that decision requires elevated authority.

---

## Versioning

Schemas are identified by two complementary identifiers:

- **Numeric `schema_id`** — assigned monotonically by the registry.  Used in credential records for compact, stable references.
- **`(name, version)` pair** — human-readable.  The registry rejects duplicate `(name, version)` registrations.

### Semantic versioning conventions

AetherMint follows [Semantic Versioning](https://semver.org/) for schema versions:

| Change type | Version bump | Example |
|-------------|-------------|---------|
| Add optional field | Patch | `1.0.0` → `1.0.1` |
| Add required field | Minor (breaking for old issuers) | `1.0.0` → `1.1.0` |
| Remove or rename field | Major | `1.0.0` → `2.0.0` |
| Change field type | Major | `1.0.0` → `2.0.0` |

### Supersedes

When a new schema version supersedes an older one, set the `supersedes` field to the numeric `schema_id` of the previous version.  This creates an explicit upgrade chain:

```
CourseCompletion v1.0.0 (id=1) ◄── CourseCompletion v2.0.0 (id=5, supersedes=1)
```

Verifiers can walk the chain to understand the schema's history.

---

## Governance Roles

| Role | Capabilities |
|------|-------------|
| **Issuer** | Register new schemas (Draft). Activate schemas they authored. |
| **Admin / Registry Admin** | All Issuer capabilities, plus: deprecate, sunset, activate any schema. |

Roles are managed by the `access_control` module (`contracts/src/access_control.rs`).  The `grant_role` / `revoke_role` contract entry-points require the caller to hold the `Admin` role.

---

## Off-chain JSON Schema

The on-chain record stores a compact summary (field names, types, required flags).  The canonical, authoritative schema document is a full [JSON Schema Draft-07](https://json-schema.org/draft-07/json-schema-validation.html) document stored on IPFS.

The `schema_uri` field in every `CredentialSchema` record points to this document as `ipfs://<CID>`.

### Upload workflow

The backend `SchemasService` handles the upload automatically when `registerSchema()` is called:

1. Caller provides the JSON Schema document as `input.jsonSchema`.
2. The service serialises it to UTF-8 JSON and uploads to IPFS via the existing `ipfsClient`.
3. The returned CID is prepended with `ipfs://` and stored in `schema_uri` on-chain.
4. Verifiers retrieve the document by resolving the CID via any IPFS gateway.

---

## Resolving a Schema (Verifier Flow)

To verify a credential against its schema:

1. Read `schema_id` from the credential record.
2. Call `get_schema(schema_id)` on the contract (or use the cached backend response from `SchemasService.getSchema()`).
3. Check `schema.status` — reject if `Sunset`.
4. Retrieve the JSON Schema document via `SchemasService.getJsonSchema()` (backed by IPFS).
5. Validate the credential's field payload against the JSON Schema.
6. Optionally walk the `supersedes` chain to understand the version history.

Step 5 is handled automatically by `SchemasService.validateCredentialFields()`.

---

## Schema Registration Guide (Issuers)

### 1. Design your JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CourseCompletion",
  "description": "Issued when a student completes a course on AetherMint.",
  "type": "object",
  "required": ["recipientName", "courseName", "completionDate"],
  "properties": {
    "recipientName": { "type": "string", "description": "Full legal name of the recipient." },
    "courseName":    { "type": "string", "description": "Title of the completed course." },
    "completionDate":{ "type": "string", "format": "date", "description": "ISO 8601 completion date." },
    "grade":         { "type": "number", "minimum": 0, "maximum": 100, "description": "Optional grade (0–100)." }
  }
}
```

### 2. Define on-chain fields

The `fields` array mirrors the JSON Schema `properties` in a compact on-chain form.  Include all fields that verifiers need to check without fetching the full IPFS document.

```typescript
const fields: SchemaFieldDef[] = [
  { name: "recipientName",  field_type: "string",  required: true,  description: "Full legal name." },
  { name: "courseName",     field_type: "string",  required: true,  description: "Title of the completed course." },
  { name: "completionDate", field_type: "date",    required: true,  description: "ISO 8601 completion date." },
  { name: "grade",          field_type: "number",  required: false, description: "Optional grade (0–100)." },
];
```

### 3. Register via the API

```typescript
const service = createSchemasService({ uploadToIpfs, getFromIpfs });
const schemaId = await service.registerSchema(
  {
    author: issuerAddress,
    name:   "CourseCompletion",
    version: "1.0.0",
    description: "Issued when a student completes a course on AetherMint.",
    jsonSchema: { /* full JSON Schema document */ },
    fields,
  },
  issuerKeypair
);
```

### 4. Activate the schema

Once reviewed, activate the schema to allow credential issuance:

```typescript
await service.activateSchema(schemaId, issuerKeypair);
```

### 5. Reference the schema in credentials

When issuing credentials, include the `schema_id` in the credential payload so verifiers can resolve the schema.

---

## Deprecation and Sunset Process

1. **Announce** the deprecation intent to issuers and relying parties in advance (recommend ≥ 90 days).
2. **Register the replacement** schema version and activate it.
3. **Deprecate** the old version — existing credentials remain valid; new issuance is blocked.
4. **Sunset** after the agreed wind-down period — verifiers will reject credentials issued against the sunset schema from this point forward.

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| *(planned)* `POST /api/schemas` | Register | Register and upload a new schema. |
| *(planned)* `GET /api/schemas/:id` | Retrieve | Fetch schema by numeric id. |
| *(planned)* `GET /api/schemas/:name/:version` | Retrieve | Fetch schema by name+version. |
| *(planned)* `POST /api/schemas/:id/activate` | Lifecycle | Activate a Draft schema. |
| *(planned)* `POST /api/schemas/:id/deprecate` | Lifecycle | Deprecate an Active schema. |
| *(planned)* `POST /api/schemas/:id/sunset` | Lifecycle | Sunset a Deprecated schema. |
| *(planned)* `POST /api/schemas/:id/validate` | Validation | Validate a credential payload against the schema. |

Routes will be wired under `backend/src/routes/schemas.ts` in a follow-up PR.

---

## Security Considerations

- **Admin key rotation**: Registry admin authority is tied to the on-chain admin address.  Rotate admin keys using `grant_role` / `revoke_role` without re-deploying the contract.
- **Immutable history**: Once a schema is registered, its on-chain record (including the IPFS CID) is immutable.  Deprecating or sunsetting does not remove the record.
- **IPFS pinning**: The backend pins all uploaded schema documents via `POST /api/content/:cid/pin` to ensure they remain available for historical credential verification.
- **Sunset irreversibility**: Sunset is intentionally irreversible.  Deploy a new schema version instead of attempting to un-sunset an old one.
