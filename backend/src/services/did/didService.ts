import crypto from 'crypto';
import logger from '../../utils/logger';
import Identity, { ICredentialRef, IIdentity } from '../../models/Identity';

/**
 * Self-sovereign identity (DID) service — issue #397.
 *
 * Lets learners create and manage a DID bound to their Stellar wallet. The
 * service persists the identity (including its verification keys) and, when
 * an `onChainSync` callback is configured, mirrors mutations to the Soroban
 * DID registry contract (`contracts/src/did_registry.rs`).
 *
 * ## Key rotation without breaking credentials
 *
 * Rotating a key retires the previously active key(s) but keeps them on the
 * identity, so credentials signed under an older key remain verifiable. Only
 * an explicit revocation — or deactivating the whole DID — stops a key from
 * verifying.
 *
 * ## Verification
 *
 * `verifySignature` resolves the DID document and checks an Ed25519 signature
 * against the DID's verification keys (active or retired, never revoked).
 */

export interface DidCreateInput {
  walletAddress: string;
  publicKey: string;
  keyType?: string;
}

export interface DidKeyInput {
  publicKey: string;
  keyType?: string;
}

export interface SignatureVerificationInput {
  did: string;
  message: string;
  signature: string;
  keyId?: string;
}

export interface SignatureVerificationResult {
  valid: boolean;
  keyId?: string;
  reason?: string;
}

export interface KeyVerificationResult {
  valid: boolean;
  keyId?: string;
  reason?: string;
}

/** Minimal persistence surface used by the service; injectable for tests. */
export interface IdentityStore {
  findOne(filter: Record<string, unknown>): Promise<IIdentity | null>;
  create(doc: Record<string, unknown>): Promise<IIdentity>;
}

export interface DidServiceOptions {
  identityStore?: IdentityStore;
  /** Optional callback fired after each mutation so callers can mirror the
   *  operation to the on-chain DID registry. Failures are logged, not thrown. */
  onChainSync?: (operation: string, payload: Record<string, unknown>) => Promise<void> | void;
}

const DEFAULT_KEY_TYPE = 'Ed25519VerificationKey2020';
// Prefix that wraps a raw 32-byte Ed25519 public key into a DER SubjectPublicKeyInfo.
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const ED25519_SIGNATURE_BYTES = 64;

export class DidService {
  private readonly store: IdentityStore;
  private readonly onChainSync?: DidServiceOptions['onChainSync'];

  constructor(options: DidServiceOptions = {}) {
    this.store = options.identityStore ?? (Identity as unknown as IdentityStore);
    this.onChainSync = options.onChainSync;
  }

  /**
   * Create a DID bound to the learner's wallet with an initial verification key.
   */
  async createDid(input: DidCreateInput): Promise<IIdentity> {
    const walletAddress = input.walletAddress?.trim();
    const publicKey = input.publicKey?.trim();
    if (!walletAddress) {
      throw new Error('walletAddress is required');
    }
    if (!DidService.isValidPublicKey(publicKey)) {
      throw new Error('publicKey must be a valid Ed25519 public key (hex or base64)');
    }

    const existing = await this.store.findOne({ walletAddress });
    if (existing) {
      throw new Error('A DID is already bound to this wallet');
    }

    const did = `did:aethermint:${crypto.randomUUID()}`;
    const identity = await this.store.create({
      did,
      walletAddress,
      controller: walletAddress,
      status: 'active',
      verificationMethods: [
        {
          keyId: `${did}#key-1`,
          keyType: input.keyType || DEFAULT_KEY_TYPE,
          publicKey,
          addedAt: new Date(),
          retiredAt: null,
          revoked: false,
        },
      ],
      credentials: [],
    });

    await this.sync('did_created', { did, walletAddress, controller: walletAddress });
    return identity;
  }

  /** Resolve a DID to its identity document. */
  async resolveDid(did: string): Promise<IIdentity | null> {
    return this.store.findOne({ did });
  }

  /** Look up the DID bound to a wallet address. */
  async getDidByWallet(walletAddress: string): Promise<IIdentity | null> {
    return this.store.findOne({ walletAddress });
  }

  /** Add an additional verification method to a DID. */
  async addVerificationMethod(did: string, input: DidKeyInput): Promise<IIdentity> {
    const identity = await this.requireDid(did);
    this.requireActive(identity);

    const publicKey = input.publicKey?.trim();
    if (!DidService.isValidPublicKey(publicKey)) {
      throw new Error('publicKey must be a valid Ed25519 public key (hex or base64)');
    }

    const keyId = `${did}#key-${identity.verificationMethods.length + 1}`;
    identity.verificationMethods.push({
      keyId,
      keyType: input.keyType || DEFAULT_KEY_TYPE,
      publicKey,
      addedAt: new Date(),
      retiredAt: null,
      revoked: false,
    });
    identity.updatedAt = new Date();
    await identity.save();

    await this.sync('did_key_added', { did, keyId });
    return identity;
  }

  /**
   * Rotate a DID's verification keys: every currently active key is retired
   * (kept so existing credentials remain verifiable) and a fresh key becomes
   * the active one.
   */
  async rotateKey(did: string, input: DidKeyInput): Promise<IIdentity> {
    const identity = await this.requireDid(did);
    this.requireActive(identity);

    const newPublicKey = input.publicKey?.trim();
    if (!DidService.isValidPublicKey(newPublicKey)) {
      throw new Error('publicKey must be a valid Ed25519 public key (hex or base64)');
    }

    const now = new Date();
    identity.verificationMethods = identity.verificationMethods.map((method) =>
      method.revoked ? method : { ...method, retiredAt: now }
    );

    const keyId = `${did}#key-${identity.verificationMethods.length + 1}`;
    identity.verificationMethods.push({
      keyId,
      keyType: input.keyType || DEFAULT_KEY_TYPE,
      publicKey: newPublicKey,
      addedAt: now,
      retiredAt: null,
      revoked: false,
    });
    identity.updatedAt = now;
    await identity.save();

    await this.sync('did_key_rotated', { did, keyId });
    return identity;
  }

  /** Explicitly revoke a verification method (revoked keys stop verifying). */
  async revokeVerificationMethod(did: string, keyId: string): Promise<IIdentity> {
    const identity = await this.requireDid(did);
    this.requireActive(identity);

    const method = identity.verificationMethods.find((m) => m.keyId === keyId);
    if (!method) {
      throw new Error('Verification method not found');
    }
    if (method.revoked) {
      throw new Error('Verification method already revoked');
    }

    method.revoked = true;
    identity.updatedAt = new Date();
    await identity.save();

    await this.sync('did_key_revoked', { did, keyId });
    return identity;
  }

  /** Deactivate a DID; all keys stop verifying. */
  async deactivateDid(did: string): Promise<IIdentity> {
    const identity = await this.requireDid(did);
    if (identity.status === 'deactivated') {
      throw new Error('DID is already deactivated');
    }

    identity.status = 'deactivated';
    identity.updatedAt = new Date();
    await identity.save();

    await this.sync('did_deactivated', { did });
    return identity;
  }

  /** Whether a key id can currently verify signatures for a DID. */
  async verifyKey(did: string, keyId: string): Promise<KeyVerificationResult> {
    const identity = await this.store.findOne({ did });
    if (!identity) {
      return { valid: false, reason: 'DID not found' };
    }
    if (identity.status !== 'active') {
      return { valid: false, reason: 'DID is deactivated' };
    }

    const method = identity.verificationMethods.find((m) => m.keyId === keyId);
    if (!method) {
      return { valid: false, reason: 'Verification method not found' };
    }
    if (method.revoked) {
      return { valid: false, reason: 'Verification method revoked' };
    }
    return { valid: true, keyId };
  }

  /**
   * Resolve the DID document and check an Ed25519 signature against the
   * DID's verification keys (active or retired, never revoked).
   *
   * `message` is signed as UTF-8 bytes; `signature` is hex-encoded. When
   * `keyId` is supplied only that key is tried, otherwise every valid key.
   */
  async verifySignature(input: SignatureVerificationInput): Promise<SignatureVerificationResult> {
    const { did, message, signature, keyId } = input;

    const identity = await this.store.findOne({ did });
    if (!identity) {
      return { valid: false, reason: 'DID not found' };
    }
    if (identity.status !== 'active') {
      return { valid: false, reason: 'DID is deactivated' };
    }

    const signatureHex = signature?.trim() ?? '';
    if (!/^[0-9a-fA-F]{128}$/.test(signatureHex)) {
      return { valid: false, reason: 'signature must be a hex-encoded Ed25519 signature' };
    }
    const signatureBuf = Buffer.from(signatureHex, 'hex');
    const messageBuf = Buffer.from(message ?? '', 'utf8');

    const candidates = keyId
      ? identity.verificationMethods.filter((m) => m.keyId === keyId && !m.revoked)
      : identity.verificationMethods.filter((m) => !m.revoked);

    if (candidates.length === 0) {
      return {
        valid: false,
        reason: keyId ? 'Verification method not found or revoked' : 'No valid verification methods',
      };
    }

    for (const method of candidates) {
      const publicKey = DidService.decodePublicKey(method.publicKey);
      if (publicKey && DidService.verifyEd25519(publicKey, messageBuf, signatureBuf)) {
        return { valid: true, keyId: method.keyId };
      }
    }

    return { valid: false, reason: 'Signature does not match any valid key for this DID' };
  }

  /** Record a credential reference against the holder's DID. */
  async recordCredential(did: string, credentialId: string): Promise<IIdentity> {
    const identity = await this.requireDid(did);
    this.requireActive(identity);

    const normalized = credentialId?.trim();
    if (!normalized) {
      throw new Error('credentialId is required');
    }
    if (identity.credentials.some((c) => c.credentialId === normalized)) {
      throw new Error('Credential already recorded for this DID');
    }

    identity.credentials.push({ credentialId: normalized, issuedAt: new Date() });
    identity.updatedAt = new Date();
    await identity.save();

    await this.sync('did_credential_attached', { did, credentialId: normalized });
    return identity;
  }

  /** Credential references recorded against a DID. */
  async getCredentials(did: string): Promise<ICredentialRef[]> {
    const identity = await this.requireDid(did);
    return identity.credentials;
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async requireDid(did: string): Promise<IIdentity> {
    const identity = await this.store.findOne({ did });
    if (!identity) {
      throw new Error('DID not found');
    }
    return identity;
  }

  private requireActive(identity: IIdentity): void {
    if (identity.status !== 'active') {
      throw new Error('DID is deactivated');
    }
  }

  private async sync(operation: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.onChainSync) {
      logger.debug(`DID ${operation} recorded off-chain; no on-chain sync configured`);
      return;
    }
    try {
      await this.onChainSync(operation, payload);
    } catch (error) {
      logger.warn(`On-chain DID sync failed for ${operation}`, error as Error);
    }
  }

  private static isValidPublicKey(publicKey: string | undefined): publicKey is string {
    return typeof publicKey === 'string' && DidService.decodePublicKey(publicKey) !== null;
  }

  /** Accepts a raw Ed25519 public key as 64-char hex or 44-char base64. */
  private static decodePublicKey(encoded: string): Buffer | null {
    const trimmed = encoded.trim().replace(/^0x/i, '');
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      return Buffer.from(trimmed, 'hex');
    }
    if (/^[A-Za-z0-9+/]{43}=$/.test(trimmed) || /^[A-Za-z0-9+/]{44}$/.test(trimmed)) {
      const buf = Buffer.from(trimmed, 'base64');
      if (buf.length === 32) {
        return buf;
      }
    }
    return null;
  }

  /** Verify an Ed25519 signature with Node's crypto, given a raw public key. */
  private static verifyEd25519(publicKey: Buffer, message: Buffer, signature: Buffer): boolean {
    if (signature.length !== ED25519_SIGNATURE_BYTES) {
      return false;
    }
    try {
      const spki = Buffer.concat([ED25519_SPKI_PREFIX, publicKey]);
      const key = crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' });
      return crypto.verify(null, message, key, signature);
    } catch {
      return false;
    }
  }
}

export default DidService;
