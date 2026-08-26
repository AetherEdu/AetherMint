/**
 * DID Registry on-chain client — Issue #397.
 *
 * Bridges the backend to the DID registry contract
 * (`contracts/src/did_registry.rs`) over Soroban RPC. The contract is the
 * authoritative DID document registry; this client exposes every registry
 * entry-point to off-chain callers (verifiers, indexers, wallet flows).
 *
 * Read-only operations (`resolveDid`, `didExists`, `getDidForController`,
 * `verifySignature`, `getKeyHistory`, `getCredentialsForDid`) are executed
 * with `rpc.Server.simulateTransaction` from a configured read source and do
 * not require a signing key.
 *
 * Write operations (`registerDid`, `rotateDidKey`, `deactivateDid`) submit a
 * signed Soroban transaction. The contract authorizes these calls with
 * `require_auth` on the DID controller, so `signer` MUST be the controlling
 * wallet's `Keypair` — the same flow the on-chain `register_did` wrapper
 * expects.
 *
 * ScVal encoding/decoding for the registry's types is implemented explicitly
 * in [`scval`] so it can be unit-tested without a live network (see
 * `backend/tests/didRegistryClient.test.ts`).
 */

import {
  Account,
  Keypair,
  Networks,
  Operation,
  StrKey,
  Transaction,
  TransactionBuilder,
  BASE_FEE,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';

// ── Types ────────────────────────────────────────────────────────────────────

/** Mirrors `DidDocument` in `contracts/src/did_registry.rs`. */
export interface DidDocument {
  /** e.g. `did:aethermint:GABCDE...` */
  did: string;
  /** Stellar wallet that controls the DID. Stable across rotations. */
  controller: string;
  /** Current ed25519 verification key (hex, 64 chars). */
  verificationKey: string;
  /** Monotonic key version; bumped on every rotation. */
  keyVersion: number;
  /** Whether the DID is active and may be used for verification. */
  active: boolean;
  /** Ledger timestamp of registration. */
  createdAt: bigint;
  /** Ledger timestamp of the last mutation (rotation / deactivation). */
  updatedAt: bigint;
}

/** Mirrors `KeyRotationRecord` in `contracts/src/did_registry.rs`. */
export interface KeyRotationRecord {
  /** Previous verification key (hex, 64 chars). */
  oldKey: string;
  /** New verification key (hex, 64 chars). */
  newKey: string;
  /** Ledger timestamp of the rotation. */
  rotatedAt: bigint;
  /** Wallet address that performed the rotation (the DID controller). */
  rotatedBy: string;
}

export interface DIDRegistryClient {
  /**
   * Register a DID for `controller`. The on-chain contract binds the DID to
   * `controller` (`did:aethermint:<controller>`) and requires the controller
   * to authorize the transaction.
   *
   * @returns the assigned DID string.
   */
  registerDid(controller: string, verificationKey: Buffer, signer: Keypair): Promise<string>;

  /** Resolve a DID to its current document. Throws if unknown or malformed. */
  resolveDid(did: string): Promise<DidDocument>;

  /** Reverse lookup: the DID bound to a wallet, if any. */
  getDidForController(controller: string): Promise<string | null>;

  /** Whether a DID exists. */
  didExists(did: string): Promise<boolean>;

  /**
   * Rotate the verification key of `did`. `signature` must prove possession
   * of `newKey` by signing `challenge`.
   *
   * @returns the new `keyVersion`.
   */
  rotateDidKey(
    did: string,
    newKey: Buffer,
    challenge: Buffer,
    signature: Buffer,
    signer: Keypair,
  ): Promise<number>;

  /** Deactivate a DID. Only the controller may deactivate. */
  deactivateDid(did: string, signer: Keypair): Promise<boolean>;

  /** Verify a signature against the DID's *current* key. */
  verifySignature(did: string, message: Buffer, signature: Buffer): Promise<boolean>;

  /** Full rotation history for a DID. */
  getKeyHistory(did: string): Promise<KeyRotationRecord[]>;

  /** Credential IDs issued to the holder of a DID. */
  getCredentialsForDid(did: string): Promise<bigint[]>;
}

export interface SorobanDIDRegistryClientDeps {
  /** Soroban RPC URL (e.g. https://soroban-testnet.stellar.org). */
  rpcUrl: string;
  /** Deployed contract ID of the AetherMint contract (`C...`). */
  contractId: string;
  /** Network passphrase (Networks.TESTNET / Networks.PUBLIC). */
  networkPassphrase: string;
  /**
   * Account used as the source of read-only simulations. The account does
   * not need to hold funds for reads.
   */
  readSource: string;
}

// ── ScVal encoding / decoding ────────────────────────────────────────────────
//
// Kept as pure functions over `xdr.ScVal` so the mapping between the Rust
// contract types and wire values is explicit and unit-testable.

/** Encode a Stellar account strkey (`G...`) as an `scvAddress`. */
export function encodeAddress(account: string): xdr.ScVal {
  const raw = StrKey.decodeEd25519PublicKey(account);
  return xdr.ScVal.scvAddress(
    xdr.ScAddress.scAddressTypeAccount(xdr.PublicKey.publicKeyTypeEd25519(raw)),
  );
}

/** Encode raw bytes (verification keys, challenges, signatures) as `scvBytes`. */
export function encodeBytes(bytes: Buffer): xdr.ScVal {
  return xdr.ScVal.scvBytes(bytes);
}

/** Encode a string (DIDs, messages) as `scvString`. */
export function encodeString(value: string): xdr.ScVal {
  return xdr.ScVal.scvString(value);
}

/** Encode a `u32` (key version) as `scvU32`. */
export function encodeU32(value: number): xdr.ScVal {
  return xdr.ScVal.scvU32(value);
}

/** Encode a `u64` (timestamps) as `scvU64`. */
export function encodeU64(value: bigint | number): xdr.ScVal {
  return xdr.ScVal.scvU64(xdr.Uint64.fromString(String(value)));
}

/** Convert a hex string to raw bytes. */
export function hexToBytes(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

/** Convert raw bytes to a lowercase hex string. */
export function bytesToHex(bytes: Buffer): string {
  return bytes.toString('hex');
}

/**
 * Decode a `DidDocument` returned by the contract. Contract structs serialize
 * as an `scvVec` of fields in declaration order:
 * `[did, controller, verification_key, key_version, active, created_at, updated_at]`.
 */
export function decodeDidDocument(scv: xdr.ScVal): DidDocument {
  const native = scvalToNative(scv);
  if (!Array.isArray(native) || native.length !== 7) {
    throw new Error(`Unexpected DidDocument shape from contract: ${JSON.stringify(native)}`);
  }
  const [did, controller, verificationKey, keyVersion, active, createdAt, updatedAt] = native;
  return {
    did: String(did),
    controller: String(controller),
    verificationKey: bytesToHex(verificationKey as Buffer),
    keyVersion: Number(keyVersion),
    active: Boolean(active),
    createdAt: BigInt(String(createdAt)),
    updatedAt: BigInt(String(updatedAt)),
  };
}

/**
 * Decode the rotation history returned by the contract. Each record is an
 * `scvVec` of `[old_key, new_key, rotated_at, rotated_by]`.
 */
export function decodeKeyHistory(scv: xdr.ScVal): KeyRotationRecord[] {
  const native = scvalToNative(scv);
  if (!Array.isArray(native)) {
    throw new Error(`Unexpected key history shape from contract: ${JSON.stringify(native)}`);
  }
  return native.map((record) => {
    if (!Array.isArray(record) || record.length !== 4) {
      throw new Error(`Unexpected rotation record shape from contract: ${JSON.stringify(record)}`);
    }
    const [oldKey, newKey, rotatedAt, rotatedBy] = record;
    return {
      oldKey: bytesToHex(oldKey as Buffer),
      newKey: bytesToHex(newKey as Buffer),
      rotatedAt: BigInt(String(rotatedAt)),
      rotatedBy: String(rotatedBy),
    };
  });
}

/** Decode the credential-id list returned by the contract (`Vec<u64>`). */
export function decodeCredentialIds(scv: xdr.ScVal): bigint[] {
  const native = scvalToNative(scv);
  if (!Array.isArray(native)) {
    throw new Error(`Unexpected credential id list shape from contract: ${JSON.stringify(native)}`);
  }
  return native.map((id) => BigInt(String(id)));
}

/**
 * Thin wrapper over the SDK's `scValToNative` so decoding is centralized.
 * Handles `scvVoid -> null`, `scvU64 -> bigint`, `scvVec -> array`,
 * `scvAddress -> strkey string`, `scvBytes -> Buffer`, etc.
 */
export function scvalToNative(scv: xdr.ScVal): unknown {
  return scValToNative(scv);
}

// ── Client ───────────────────────────────────────────────────────────────────

export class SorobanDIDRegistryClient implements DIDRegistryClient {
  private readonly server: rpc.Server;

  constructor(private readonly deps: SorobanDIDRegistryClientDeps) {
    this.server = new rpc.Server(deps.rpcUrl, {
      allowHttp: deps.rpcUrl.startsWith('http://'),
    });
  }

  // ── Reads (simulateTransaction — no signing) ─────────────────────────────

  async resolveDid(did: string): Promise<DidDocument> {
    const scv = await this.simulate('resolve_did', [encodeString(did)]);
    return decodeDidDocument(scv);
  }

  async getDidForController(controller: string): Promise<string | null> {
    const scv = await this.simulate('get_did_for_controller', [encodeAddress(controller)]);
    const native = scvalToNative(scv);
    // Option<String> is `scvVoid` (None) or `scvString` (Some).
    return native === null || native === undefined ? null : String(native);
  }

  async didExists(did: string): Promise<boolean> {
    const scv = await this.simulate('did_exists', [encodeString(did)]);
    return Boolean(scvalToNative(scv));
  }

  async verifySignature(did: string, message: Buffer, signature: Buffer): Promise<boolean> {
    const scv = await this.simulate('verify_did_signature', [
      encodeString(did),
      encodeBytes(message),
      encodeBytes(signature),
    ]);
    return Boolean(scvalToNative(scv));
  }

  async getKeyHistory(did: string): Promise<KeyRotationRecord[]> {
    const scv = await this.simulate('get_did_key_history', [encodeString(did)]);
    return decodeKeyHistory(scv);
  }

  async getCredentialsForDid(did: string): Promise<bigint[]> {
    const scv = await this.simulate('get_credentials_for_did', [encodeString(did)]);
    return decodeCredentialIds(scv);
  }

  // ── Writes (prepare → sign → submit) ─────────────────────────────────────

  async registerDid(controller: string, verificationKey: Buffer, signer: Keypair): Promise<string> {
    const scv = await this.submit(
      'register_did',
      [encodeAddress(controller), encodeBytes(verificationKey)],
      signer,
    );
    return String(scvalToNative(scv));
  }

  async rotateDidKey(
    did: string,
    newKey: Buffer,
    challenge: Buffer,
    signature: Buffer,
    signer: Keypair,
  ): Promise<number> {
    const scv = await this.submit(
      'rotate_did_key',
      [encodeString(did), encodeBytes(newKey), encodeBytes(challenge), encodeBytes(signature)],
      signer,
    );
    return Number(scvalToNative(scv));
  }

  async deactivateDid(did: string, signer: Keypair): Promise<boolean> {
    const scv = await this.submit('deactivate_did', [encodeString(did)], signer);
    return Boolean(scvalToNative(scv));
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /** Simulate a read-only invocation and return the contract's return value. */
  private async simulate(functionName: string, args: xdr.ScVal[]): Promise<xdr.ScVal> {
    const transaction = this.buildInvocationTransaction(functionName, args);
    const sim = await this.server.simulateTransaction(transaction);
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`${functionName} simulation failed: ${sim.error}`);
    }
    const success = sim as rpc.Api.SimulateTransactionSuccessResponse;
    const returnValue = success.result?.retval;
    if (!returnValue) {
      throw new Error(`${functionName} returned no value`);
    }
    return returnValue;
  }

  /** Build, prepare, sign, submit, and confirm a write invocation. */
  private async submit(
    functionName: string,
    args: xdr.ScVal[],
    signer: Keypair,
  ): Promise<xdr.ScVal> {
    const account = await this.server.getAccount(signer.publicKey());
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.deps.networkPassphrase,
    })
      .addOperation(this.buildInvocationOperation(functionName, args))
      .setTimeout(30)
      .build();

    // Simulation derives the Soroban authorization entries (e.g. the
    // controller's require_auth) that must accompany the invocation.
    const prepared = await this.server.prepareTransaction(transaction);
    prepared.sign(signer);
    const response = await this.server.sendTransaction(prepared);

    if (response.status === 'ERROR') {
      throw new Error(`${functionName} transaction failed: ${JSON.stringify(response)}`);
    }

    return this.pollForResult(response.hash);
  }

  private buildInvocationTransaction(functionName: string, args: xdr.ScVal[]): Transaction {
    const source = this.deps.readSource;
    // Read-only simulation still needs a source account; use a zero-sequence
    // account object derived from the read source. Sequence is irrelevant for
    // simulation of a single read-only invocation.
    const account = new Account(source, '0');
    return new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.deps.networkPassphrase,
    })
      .addOperation(this.buildInvocationOperation(functionName, args))
      .setTimeout(30)
      .build();
  }

  private buildInvocationOperation(functionName: string, args: xdr.ScVal[]): xdr.Operation {
    return Operation.invokeContractFunction({
      contract: this.deps.contractId,
      function: functionName,
      args,
    });
  }

  /** Poll `getTransaction` until the invocation is confirmed and return its value. */
  private async pollForResult(hash: string): Promise<xdr.ScVal> {
    const MAX_POLLS = 30;
    const POLL_INTERVAL_MS = 1_000;

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      const result = await this.server.getTransaction(hash);
      if (result.status === 'SUCCESS') {
        const returnValue = result.returnValue;
        if (!returnValue) {
          throw new Error(`Transaction ${hash} succeeded but returned no value`);
        }
        return returnValue;
      }
      if (result.status === 'FAILED') {
        throw new Error(`Transaction ${hash} failed: ${JSON.stringify(result)}`);
      }
    }
    throw new Error(`Transaction ${hash} timed out after ${MAX_POLLS} polls`);
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a production-wired `DIDRegistryClient` from environment variables.
 *
 * Required env vars:
 *   SOROBAN_RPC_URL           — Soroban RPC endpoint
 *   DID_REGISTRY_CONTRACT_ID  — Deployed AetherMint contract id (`C...`)
 *   STELLAR_NETWORK           — "testnet" | "mainnet" (default: testnet)
 *   ADMIN_PUBLIC_KEY          — account used as the read-simulation source
 *
 * Throws when the contract is not configured, so consumers fail fast instead
 * of silently simulating against nothing.
 */
export function createDIDRegistryClient(): DIDRegistryClient {
  const rpcUrl = process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';
  const contractId = process.env.DID_REGISTRY_CONTRACT_ID ?? '';
  const readSource = process.env.ADMIN_PUBLIC_KEY ?? '';
  const network = (process.env.STELLAR_NETWORK ?? 'testnet').toLowerCase();

  if (!contractId) {
    throw new Error('DID_REGISTRY_CONTRACT_ID environment variable is not set.');
  }
  if (!readSource) {
    throw new Error('ADMIN_PUBLIC_KEY environment variable is not set (needed for DID registry reads).');
  }

  const networkPassphrase = network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

  return new SorobanDIDRegistryClient({ rpcUrl, contractId, networkPassphrase, readSource });
}
