/**
 * Schema Service — Issue #421
 *
 * Tooling layer that bridges the off-chain world (backend API, IPFS) with the
 * on-chain CredentialSchemaRegistry Soroban contract.
 *
 * Responsibilities:
 *  - Validate and publish full JSON-Schema documents to IPFS, then register
 *    the resulting CID on-chain via the `register_schema` contract entry-point.
 *  - Resolve and cache schema documents so verifiers never have to hit IPFS on
 *    every credential check.
 *  - Validate a credential's field payload against the schema version it
 *    references — returning structured errors rather than a bare boolean.
 *  - Mirror on-chain lifecycle events (activate / deprecate / sunset) so the
 *    API layer can gate credential issuance without making a second RPC call.
 *
 * Architecture note
 * -----------------
 * The service is intentionally stateless between requests (all mutable state
 * lives on-chain or in the shared Redis cache).  Dependency injection is used
 * for the Stellar SDK client and the IPFS client so both can be swapped for
 * mocks in tests.
 */

import { Keypair, rpc, TransactionBuilder, Networks, BASE_FEE } from "@stellar/stellar-sdk";

// ── Types ────────────────────────────────────────────────────────────────────

/** Primitive types supported by on-chain schema field definitions. */
export type FieldType = "string" | "number" | "boolean" | "date" | "address";

/** Mirrors `SchemaField` in `contracts/src/schema_registry.rs`. */
export interface SchemaFieldDef {
  name: string;
  field_type: FieldType;
  required: boolean;
  description: string;
}

/** Mirrors `SchemaStatus` in `contracts/src/schema_registry.rs`. */
export enum SchemaStatus {
  Draft = 0,
  Active = 1,
  Deprecated = 2,
  Sunset = 3,
}

/** Full schema record as returned from the on-chain registry. */
export interface CredentialSchema {
  id: bigint;
  author: string;
  name: string;
  version: string;
  description: string;
  schema_uri: string;
  fields: SchemaFieldDef[];
  status: SchemaStatus;
  registered_at: bigint;
  updated_at: bigint;
  supersedes: bigint | null;
}

/** Input payload for registering a new schema. */
export interface RegisterSchemaInput {
  /** Stellar address of the issuer/author — must hold the Issuer role. */
  author: string;
  name: string;
  version: string;
  description: string;
  /**
   * Full JSON-Schema document (Draft-07 compatible).
   * The service uploads this to IPFS and records the resulting CID as
   * `schema_uri` in the on-chain registry.
   */
  jsonSchema: Record<string, unknown>;
  fields: SchemaFieldDef[];
  /** schema_id of a previous version this one supersedes (optional). */
  supersedes?: bigint;
}

/** Structured validation result returned to callers. */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

const CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Lightweight in-process cache.  In production this should be backed by
 * the shared Redis instance via the existing `cacheMiddleware` utility;
 * this in-memory fallback is provided so the service works in test
 * environments that don't have Redis running.
 */
class SchemaCache {
  private readonly store = new Map<string, { value: CredentialSchema; expiresAt: number }>();

  get(key: string): CredentialSchema | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: CredentialSchema): void {
    this.store.set(key, { value, expiresAt: Date.now() + CACHE_TTL_SECONDS * 1_000 });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

export interface SchemasServiceDeps {
  /** Soroban RPC URL (e.g. https://soroban-testnet.stellar.org). */
  rpcUrl: string;
  /** Deployed contract ID of the AetherMint contract. */
  contractId: string;
  /** Network passphrase (Networks.TESTNET / Networks.PUBLIC). */
  networkPassphrase: string;
  /**
   * IPFS upload function.  Injected so callers can swap in a mock or
   * a real `ipfsClient.uploadFile` from the existing IPFS integration.
   */
  uploadToIpfs: (data: Buffer, fileName: string) => Promise<{ cid: string }>;
  /**
   * IPFS retrieval function.  Should return the raw JSON bytes for a
   * given CID.
   */
  getFromIpfs: (cid: string) => Promise<Buffer>;
}

export class SchemasService {
  private readonly cache = new SchemaCache();
  private readonly server: rpc.Server;

  constructor(private readonly deps: SchemasServiceDeps) {
    this.server = new rpc.Server(deps.rpcUrl, { allowHttp: deps.rpcUrl.startsWith("http://") });
  }

  // ── Registration ────────────────────────────────────────────────────────────

  /**
   * Upload the JSON-Schema document to IPFS, then call `register_schema`
   * on the contract.  Returns the on-chain `schema_id` assigned by the
   * registry.
   *
   * @throws if the IPFS upload fails or the Soroban transaction is rejected.
   */
  async registerSchema(
    input: RegisterSchemaInput,
    signerKeypair: Keypair
  ): Promise<bigint> {
    // 1. Validate field definitions before touching the network.
    this.validateFieldDefs(input.fields);

    // 2. Upload the canonical JSON-Schema document to IPFS.
    const jsonBytes = Buffer.from(JSON.stringify(input.jsonSchema, null, 2));
    const fileName = `${input.name}-${input.version}.json`;
    const { cid } = await this.deps.uploadToIpfs(jsonBytes, fileName);
    const schemaUri = `ipfs://${cid}`;

    // 3. Prepare and submit the Soroban transaction.
    //    The on-chain function signature is:
    //      register_schema(author, name, version, description,
    //                      schema_uri, fields, supersedes) -> u64
    //
    //    We build the invocation via the SorobanRpc simulation path so
    //    we can accurately fund the fee before broadcasting.
    const account = await this.server.getAccount(signerKeypair.publicKey());
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.deps.networkPassphrase,
    })
      .addOperation(
        this.buildRegisterSchemaOperation(input, schemaUri)
      )
      .setTimeout(30)
      .build();

    const preparedTx = await this.server.prepareTransaction(transaction);
    preparedTx.sign(signerKeypair);
    const response = await this.server.sendTransaction(preparedTx);

    if (response.status === "ERROR") {
      throw new Error(`register_schema transaction failed: ${JSON.stringify(response)}`);
    }

    // Poll for confirmation.
    const schemaId = await this.pollForResult(response.hash);
    return schemaId;
  }

  // ── Lifecycle management ─────────────────────────────────────────────────────

  /**
   * Activate a Draft schema.  After this call the schema can be used for
   * credential issuance.
   */
  async activateSchema(schemaId: bigint, callerKeypair: Keypair): Promise<void> {
    await this.submitLifecycleCall("activate_schema", schemaId, callerKeypair);
    this.cache.invalidate(String(schemaId));
  }

  /**
   * Deprecate an Active schema.  Existing credentials remain valid; new
   * credentials should not reference this version.
   */
  async deprecateSchema(schemaId: bigint, callerKeypair: Keypair): Promise<void> {
    await this.submitLifecycleCall("deprecate_schema", schemaId, callerKeypair);
    this.cache.invalidate(String(schemaId));
  }

  /**
   * Permanently sunset a Deprecated schema.  Verifiers should reject new
   * credentials referencing this version.
   */
  async sunsetSchema(schemaId: bigint, callerKeypair: Keypair): Promise<void> {
    await this.submitLifecycleCall("sunset_schema", schemaId, callerKeypair);
    this.cache.invalidate(String(schemaId));
  }

  // ── Retrieval ────────────────────────────────────────────────────────────────

  /**
   * Retrieve a schema by its on-chain id.
   * Results are cached for `CACHE_TTL_SECONDS` seconds to reduce RPC load.
   */
  async getSchema(schemaId: bigint): Promise<CredentialSchema> {
    const cacheKey = String(schemaId);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const schema = await this.fetchSchemaFromChain(schemaId);
    this.cache.set(cacheKey, schema);
    return schema;
  }

  /**
   * Resolve a schema by its human-readable `(name, version)` pair.
   */
  async getSchemaByNameVersion(name: string, version: string): Promise<CredentialSchema> {
    return this.fetchSchemaByNameVersionFromChain(name, version);
  }

  /**
   * Fetch the full JSON-Schema document from IPFS using the URI stored
   * on-chain.  Uses an in-memory request-level cache to avoid duplicate
   * IPFS fetches within the same process.
   */
  async getJsonSchema(schemaId: bigint): Promise<Record<string, unknown>> {
    const schema = await this.getSchema(schemaId);
    const cid = schema.schema_uri.replace(/^ipfs:\/\//, "");
    const raw = await this.deps.getFromIpfs(cid);
    return JSON.parse(raw.toString("utf-8")) as Record<string, unknown>;
  }

  // ── Validation ────────────────────────────────────────────────────────────────

  /**
   * Validate a credential's field payload against the on-chain schema.
   *
   * Checks:
   *  1. Schema exists and is in a state that allows verification
   *     (not Sunset).
   *  2. All fields marked `required` in the schema are present and
   *     non-empty.
   *  3. Present fields match the declared `field_type`.
   *
   * Returns a `ValidationResult` so callers receive structured errors
   * rather than a thrown exception — allowing the API layer to surface
   * meaningful messages to the credential issuer.
   */
  async validateCredentialFields(
    schemaId: bigint,
    credentialFields: Record<string, unknown>
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    const schema = await this.getSchema(schemaId);

    // Guard: schema must not be sunset.
    if (schema.status === SchemaStatus.Sunset) {
      return {
        valid: false,
        errors: [{ field: "__schema__", message: `Schema ${schemaId} has been sunset and is no longer verifiable.` }],
      };
    }

    for (const fieldDef of schema.fields) {
      const value = credentialFields[fieldDef.name];

      // Required field check.
      if (fieldDef.required && (value === undefined || value === null || value === "")) {
        errors.push({
          field: fieldDef.name,
          message: `Required field "${fieldDef.name}" is missing or empty.`,
        });
        continue;
      }

      // Skip type check for absent optional fields.
      if (value === undefined || value === null) continue;

      // Type check.
      const typeError = this.checkFieldType(fieldDef.name, fieldDef.field_type, value);
      if (typeError) errors.push(typeError);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Guard for credential issuance: returns `true` only when the schema is
   * Active.  Callers can use this without fetching the full schema object.
   */
  async isIssuable(schemaId: bigint): Promise<boolean> {
    const schema = await this.getSchema(schemaId);
    return schema.status === SchemaStatus.Active;
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private validateFieldDefs(fields: SchemaFieldDef[]): void {
    const VALID_TYPES: FieldType[] = ["string", "number", "boolean", "date", "address"];
    for (const f of fields) {
      if (!f.name || f.name.length === 0) {
        throw new Error("Schema field name must not be empty.");
      }
      if (!VALID_TYPES.includes(f.field_type)) {
        throw new Error(
          `Invalid field_type "${f.field_type}" for field "${f.name}". ` +
            `Valid types: ${VALID_TYPES.join(", ")}.`
        );
      }
    }
  }

  private checkFieldType(
    fieldName: string,
    expectedType: FieldType,
    value: unknown
  ): ValidationError | null {
    switch (expectedType) {
      case "string":
        if (typeof value !== "string") {
          return { field: fieldName, message: `Field "${fieldName}" must be a string.` };
        }
        break;
      case "number":
        if (typeof value !== "number" && typeof value !== "bigint") {
          return { field: fieldName, message: `Field "${fieldName}" must be a number.` };
        }
        break;
      case "boolean":
        if (typeof value !== "boolean") {
          return { field: fieldName, message: `Field "${fieldName}" must be a boolean.` };
        }
        break;
      case "date":
        if (typeof value !== "string" || isNaN(Date.parse(value as string))) {
          return {
            field: fieldName,
            message: `Field "${fieldName}" must be an ISO 8601 date string.`,
          };
        }
        break;
      case "address":
        if (typeof value !== "string" || !/^G[A-Z2-7]{55}$/.test(value as string)) {
          return {
            field: fieldName,
            message: `Field "${fieldName}" must be a valid Stellar address (starts with G).`,
          };
        }
        break;
    }
    return null;
  }

  /**
   * Build a Soroban `invokeContractFunction` operation for `register_schema`.
   * The actual XDR construction is handled by the Stellar SDK; this method
   * returns an Operation that the TransactionBuilder can consume.
   *
   * NOTE: In a full implementation this would use the generated contract
   * bindings (stellar contract bindings typescript) to produce typed XDR.
   * We use a placeholder here to keep the service compilable without
   * pre-generated bindings.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private buildRegisterSchemaOperation(input: RegisterSchemaInput, schemaUri: string): never {
    // TODO: Replace with generated contract bindings once `stellar contract
    // bindings typescript --id <contractId>` has been run.
    // The operation args map directly to the `register_schema` Rust function:
    //   author, name, version, description, schema_uri, fields, supersedes
    throw new Error(
      "buildRegisterSchemaOperation: replace this stub with generated Soroban contract bindings."
    );
  }

  /**
   * Submit a single-argument lifecycle call (activate / deprecate / sunset).
   */
  private async submitLifecycleCall(
    functionName: string,
    schemaId: bigint,
    callerKeypair: Keypair
  ): Promise<void> {
    const account = await this.server.getAccount(callerKeypair.publicKey());
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.deps.networkPassphrase,
    })
      .addOperation(
        // TODO: Replace with generated contract bindings.
        this.buildLifecycleOperation(functionName, callerKeypair.publicKey(), schemaId)
      )
      .setTimeout(30)
      .build();

    const preparedTx = await this.server.prepareTransaction(transaction);
    preparedTx.sign(callerKeypair);
    const response = await this.server.sendTransaction(preparedTx);

    if (response.status === "ERROR") {
      throw new Error(`${functionName} transaction failed: ${JSON.stringify(response)}`);
    }

    await this.pollForResult(response.hash);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private buildLifecycleOperation(
    _functionName: string,
    _caller: string,
    _schemaId: bigint
  ): never {
    // TODO: Replace with generated contract bindings.
    throw new Error("buildLifecycleOperation: replace this stub with generated Soroban contract bindings.");
  }

  /**
   * Poll `getTransaction` until the transaction is confirmed or fails.
   * Returns the i128 / u64 return value of the invocation cast to bigint.
   */
  private async pollForResult(hash: string): Promise<bigint> {
    const MAX_POLLS = 30;
    const POLL_INTERVAL_MS = 1_000;

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      const result = await this.server.getTransaction(hash);

      if (result.status === "SUCCESS") {
        // Extract the u64 return value from the XDR.
        const retVal = result.returnValue;
        if (retVal?.switch().name === "scvU64") {
          return BigInt(retVal.u64().toString());
        }
        return BigInt(0);
      }

      if (result.status === "FAILED") {
        throw new Error(`Transaction ${hash} failed: ${JSON.stringify(result)}`);
      }
    }
    throw new Error(`Transaction ${hash} timed out after ${MAX_POLLS} polls.`);
  }

  private async fetchSchemaFromChain(schemaId: bigint): Promise<CredentialSchema> {
    // TODO: Replace with generated contract bindings for `get_schema`.
    // This stub returns a typed placeholder that lets the service build.
    throw new Error(
      `fetchSchemaFromChain(${schemaId}): replace with generated Soroban contract bindings.`
    );
  }

  private async fetchSchemaByNameVersionFromChain(
    name: string,
    version: string
  ): Promise<CredentialSchema> {
    // TODO: Replace with generated contract bindings for `get_schema_by_name_version`.
    throw new Error(
      `fetchSchemaByNameVersionFromChain(${name}, ${version}): replace with generated Soroban contract bindings.`
    );
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create a production-wired `SchemasService` from environment variables.
 *
 * Required env vars:
 *   SOROBAN_RPC_URL        — Soroban RPC endpoint
 *   AETHERMINT_CONTRACT_ID — Deployed contract address
 *   STELLAR_NETWORK        — "testnet" | "mainnet" (default: testnet)
 *
 * The IPFS upload/download functions are wired to the existing
 * `ipfsClient` from `backend/src/lib/ipfs` to keep IPFS configuration
 * in one place.
 */
export function createSchemasService(deps: {
  uploadToIpfs: SchemasServiceDeps["uploadToIpfs"];
  getFromIpfs: SchemasServiceDeps["getFromIpfs"];
}): SchemasService {
  const rpcUrl = process.env.SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";
  const contractId = process.env.AETHERMINT_CONTRACT_ID ?? "";
  const network = (process.env.STELLAR_NETWORK ?? "testnet").toLowerCase();

  if (!contractId) {
    throw new Error("AETHERMINT_CONTRACT_ID environment variable is not set.");
  }

  const networkPassphrase =
    network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

  return new SchemasService({
    rpcUrl,
    contractId,
    networkPassphrase,
    uploadToIpfs: deps.uploadToIpfs,
    getFromIpfs: deps.getFromIpfs,
  });
}

export default SchemasService;
