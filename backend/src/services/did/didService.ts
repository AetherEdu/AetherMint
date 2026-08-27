/**
 * DID Service — Issue #397 (self-sovereign identity).
 *
 * Off-chain DID management for learners: registers a DID bound to a Stellar
 * wallet (`did:aethermint:<wallet>`), resolves DID documents containing the
 * current verification key, rotates keys with proof of possession, and
 * verifies ed25519 signatures against the document's current key.
 *
 * The on-chain DID registry contract (`contracts/src/did_registry.rs`) is the
 * authoritative registry; this service is the API-side manager that mirrors
 * registrations into MongoDB (via [`IdentityStore`]) so resolution, wallet
 * lookups, and credential linkage are fast and queryable. The on-chain bridge
 * lives in `./didRegistryClient` and is intentionally not required for the
 * off-chain API to function.
 *
 * Verification semantics mirror the contract's `verify_signature`:
 * resolve the DID document, reject deactivated DIDs, then check the signature
 * against the *current* verification key with ed25519.
 */

import { createPublicKey, verify } from 'crypto';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { Identity, IdentityModel, KeyRotationRecord } from '../../models/Identity';

// ── Constants (mirror `contracts/src/did_registry.rs`) ──────────────────────

/** DID method prefix. */
export const DID_METHOD = 'did:aethermint:';

/** Maximum length (bytes) of a signed message / rotation challenge. */
export const MAX_CHALLENGE_LENGTH = 512;

const WALLET_REGEX = /^G[A-Z2-7]{55}$/;
const DID_REGEX = /^did:aethermint:G[A-Z2-7]{55}$/;
const KEY_HEX_REGEX = /^[0-9a-fA-F]{64}$/;
const SIGNATURE_HEX_REGEX = /^[0-9a-fA-F]{128}$/;

/** SPKI DER prefix for a raw 32-byte ed25519 public key. */
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

// ── Persistence ──────────────────────────────────────────────────────────────

export interface IdentityStore {
  create(identity: Identity): Promise<Identity>;
  findByDid(did: string): Promise<Identity | null>;
  findByController(controller: string): Promise<Identity | null>;
  save(identity: Identity): Promise<Identity>;
}

/** MongoDB-backed store built on the `Identity` model. */
export class MongooseIdentityStore implements IdentityStore {
  async create(identity: Identity): Promise<Identity> {
    const doc = new IdentityModel(identity);
    return (await doc.save()).toObject() as unknown as Identity;
  }

  async findByDid(did: string): Promise<Identity | null> {
    const doc = await IdentityModel.findOne({ did }).lean();
    return doc ? (doc as unknown as Identity) : null;
  }

  async findByController(controller: string): Promise<Identity | null> {
    const doc = await IdentityModel.findOne({ controller }).lean();
    return doc ? (doc as unknown as Identity) : null;
  }

  async save(identity: Identity): Promise<Identity> {
    const doc = await IdentityModel.findOneAndUpdate(
      { did: identity.did },
      { $set: identity },
      { new: true },
    ).lean();
    if (!doc) {
      throw new NotFoundError(`Identity for DID ${identity.did} not found`);
    }
    return doc as unknown as Identity;
  }
}

// ── Inputs ───────────────────────────────────────────────────────────────────

export interface RegisterDidInput {
  /** Stellar wallet that will control the DID. */
  controller: string;
  /** ed25519 verification key (hex, 64 chars). */
  verificationKey: string;
  /** Optional link to the platform user. */
  userId?: string;
}

export interface RotateDidKeyInput {
  /** The DID whose key is being rotated. */
  did: string;
  /** New ed25519 verification key (hex, 64 chars). */
  newKey: string;
  /** Challenge the new key signs to prove possession (utf-8, ≤512 bytes). */
  challenge: string;
  /** Ed25519 signature over `challenge` made by `newKey` (hex, 128 chars). */
  signature: string;
}

export interface VerifySignatureInput {
  did: string;
  /** Message that was signed (utf-8, ≤512 bytes). */
  message: string;
  /** Ed25519 signature over `message` (hex, 128 chars). */
  signature: string;
}

// ── Validation ───────────────────────────────────────────────────────────────

function validateDid(did: string): void {
  if (!DID_REGEX.test(did)) {
    throw new ValidationError(`Invalid DID. Expected format: ${DID_METHOD}<G...wallet address>`);
  }
}

function validateWallet(controller: string): void {
  if (!WALLET_REGEX.test(controller)) {
    throw new ValidationError('controller must be a valid Stellar account address (starts with G)');
  }
}

function validateVerificationKey(verificationKey: string): void {
  if (!KEY_HEX_REGEX.test(verificationKey)) {
    throw new ValidationError('verificationKey must be 32 bytes encoded as 64 hex characters');
  }
  if (/^0+$/.test(verificationKey)) {
    throw new ValidationError('verificationKey must not be all zeros');
  }
}

function validateSignature(signature: string): void {
  if (!SIGNATURE_HEX_REGEX.test(signature)) {
    throw new ValidationError('signature must be 64 bytes encoded as 128 hex characters');
  }
}

function validateMessage(message: string): void {
  if (Buffer.byteLength(message, 'utf-8') > MAX_CHALLENGE_LENGTH) {
    throw new ValidationError(`message must not exceed ${MAX_CHALLENGE_LENGTH} bytes`);
  }
}

function validateNewKeyDiffers(currentKey: string, newKey: string): void {
  if (currentKey.toLowerCase() === newKey.toLowerCase()) {
    throw new ValidationError('new verification key must differ from the current one');
  }
}

// ── Crypto ───────────────────────────────────────────────────────────────────

/**
 * Verify an ed25519 signature over `message` against a raw 32-byte public key.
 * Returns `false` (rather than throwing) on any verification failure so the
 * API can respond `{ valid: false }` for bad signatures.
 */
export function verifyEd25519(message: Buffer, signature: Buffer, publicKey: Buffer): boolean {
  try {
    const keyObject = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, publicKey]),
      format: 'der',
      type: 'spki',
    });
    return verify(null, message, keyObject, signature);
  } catch {
    return false;
  }
}

// ── Service ──────────────────────────────────────────────────────────────────

export class DidService {
  constructor(private readonly store: IdentityStore) {}

  /**
   * Register a new DID bound to the caller's wallet. One DID per wallet.
   *
   * @returns the stored identity document.
   */
  async registerDid(input: RegisterDidInput): Promise<Identity> {
    const { controller, verificationKey, userId } = input;
    validateWallet(controller);
    validateVerificationKey(verificationKey);

    const existing = await this.store.findByController(controller);
    if (existing) {
      throw new ConflictError(`A DID is already registered for wallet ${controller}`);
    }

    const identity: Identity = {
      did: `${DID_METHOD}${controller}`,
      controller,
      userId,
      verificationKey: verificationKey.toLowerCase(),
      keyVersion: 1,
      active: true,
      credentialIds: [],
      keyHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.store.create(identity);
  }

  /** Resolve a DID to its current document. */
  async resolveDid(did: string): Promise<Identity> {
    validateDid(did);
    const identity = await this.store.findByDid(did);
    if (!identity) {
      throw new NotFoundError(`DID not found: ${did}`);
    }
    return identity;
  }

  /** Reverse lookup: the DID bound to a wallet, if any. */
  async getDidForController(controller: string): Promise<string | null> {
    validateWallet(controller);
    const identity = await this.store.findByController(controller);
    return identity ? identity.did : null;
  }

  /**
   * Rotate the verification key of a DID.
   *
   * The new key must prove possession by signing `challenge` — the same
   * proof-of-possession the on-chain `rotate_did_key` requires. Old keys are
   * preserved in `keyHistory` so previously issued credentials remain
   * attributable after rotation.
   *
   * @returns the stored identity document with the updated `keyVersion`.
   */
  async rotateDidKey(input: RotateDidKeyInput): Promise<Identity> {
    const { did, newKey, challenge, signature } = input;
    validateDid(did);
    validateVerificationKey(newKey);
    validateSignature(signature);
    validateMessage(challenge);

    const identity = await this.resolveDid(did);
    if (!identity.active) {
      throw new ConflictError('DID is deactivated and cannot rotate keys');
    }
    validateNewKeyDiffers(identity.verificationKey, newKey);

    // Proof of possession: the new key must have signed the challenge.
    const possessed = verifyEd25519(
      Buffer.from(challenge, 'utf-8'),
      Buffer.from(signature, 'hex'),
      Buffer.from(newKey, 'hex'),
    );
    if (!possessed) {
      throw new ValidationError('signature does not prove possession of the new verification key');
    }

    const rotatedAt = Math.floor(Date.now() / 1000);
    const record: KeyRotationRecord = {
      oldKey: identity.verificationKey,
      newKey: newKey.toLowerCase(),
      rotatedAt,
      rotatedBy: identity.controller,
    };

    return this.store.save({
      ...identity,
      verificationKey: newKey.toLowerCase(),
      keyVersion: identity.keyVersion + 1,
      keyHistory: [...identity.keyHistory, record],
      updatedAt: new Date(),
    });
  }

  /** Deactivate a DID. Deactivation does not delete history. */
  async deactivateDid(did: string): Promise<Identity> {
    const identity = await this.resolveDid(did);
    if (!identity.active) {
      throw new ConflictError('DID is already deactivated');
    }
    return this.store.save({ ...identity, active: false, updatedAt: new Date() });
  }

  /**
   * Verify a signature over `message` against the DID's *current* verification
   * key. Resolves the DID document first, per the acceptance criteria.
   * Returns `false` for deactivated DIDs or mismatched signatures.
   */
  async verifySignature(input: VerifySignatureInput): Promise<boolean> {
    const { did, message, signature } = input;
    validateDid(did);
    validateSignature(signature);
    validateMessage(message);

    const identity = await this.resolveDid(did);
    if (!identity.active) {
      return false;
    }

    return verifyEd25519(
      Buffer.from(message, 'utf-8'),
      Buffer.from(signature, 'hex'),
      Buffer.from(identity.verificationKey, 'hex'),
    );
  }

  /** Credentials issued to the holder of a DID. */
  async getCredentialsForDid(did: string): Promise<number[]> {
    const identity = await this.resolveDid(did);
    return identity.credentialIds;
  }

  /** Full rotation history for a DID. */
  async getKeyHistory(did: string): Promise<KeyRotationRecord[]> {
    const identity = await this.resolveDid(did);
    return identity.keyHistory;
  }

  /**
   * Record that a credential issued to the DID's holder references the DID.
   * Callers (credential issuance flows) invoke this after minting a
   * credential so the holder↔credential linkage is resolvable through the DID.
   * Idempotent per credential id.
   */
  async linkCredential(did: string, credentialId: number): Promise<Identity> {
    const identity = await this.resolveDid(did);
    if (identity.credentialIds.includes(credentialId)) {
      return identity;
    }
    return this.store.save({
      ...identity,
      credentialIds: [...identity.credentialIds, credentialId],
      updatedAt: new Date(),
    });
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

/** Create the production-wired service (MongoDB-backed store). */
export function createDidService(): DidService {
  return new DidService(new MongooseIdentityStore());
}

export default DidService;
