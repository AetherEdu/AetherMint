/**
 * DID Service tests — Issue #397.
 *
 * Exercises the off-chain DID lifecycle end to end with an in-memory store
 * and real ed25519 signatures (Node `crypto`), so every acceptance criterion
 * is verified without a network or database.
 */

import { createPrivateKey, createPublicKey, KeyObject, sign } from 'crypto';
import {
  DidService,
  IdentityStore,
  verifyEd25519,
} from '../src/services/did/didService';
import { Identity } from '../src/models/Identity';
import { ConflictError, NotFoundError, ValidationError } from '../src/utils/errors';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** PKCS8 DER prefix for an ed25519 private key. */
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

/** Deterministic keypair: seed byte N repeated 32 times. */
function makeKeypair(seed: number): { publicKey: string; privateKey: KeyObject } {
  const seedBuf = Buffer.alloc(32, seed);
  const der = Buffer.concat([ED25519_PKCS8_PREFIX, seedBuf]);
  const privateKey = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
  const pubDer = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }) as Buffer;
  const raw = pubDer.subarray(pubDer.length - 32);
  return { publicKey: raw.toString('hex'), privateKey };
}

function signMessage(privateKey: KeyObject, message: string): string {
  return sign(null, Buffer.from(message, 'utf-8'), privateKey).toString('hex');
}

// The service validates the wallet *format* (`G` + 55 base32 chars), not the
// strkey checksum, so literal well-formed addresses are sufficient for tests.
const WALLET_A = 'G' + 'A'.repeat(55);
const WALLET_B = 'G' + 'B'.repeat(55);
const WALLET_C = 'G' + 'C'.repeat(55);

class InMemoryIdentityStore implements IdentityStore {
  private readonly identities = new Map<string, Identity>();

  async create(identity: Identity): Promise<Identity> {
    this.identities.set(identity.did, { ...identity });
    return { ...this.identities.get(identity.did)! };
  }

  async findByDid(did: string): Promise<Identity | null> {
    const found = this.identities.get(did);
    return found ? { ...found } : null;
  }

  async findByController(controller: string): Promise<Identity | null> {
    for (const identity of this.identities.values()) {
      if (identity.controller === controller) {
        return { ...identity };
      }
    }
    return null;
  }

  async save(identity: Identity): Promise<Identity> {
    this.identities.set(identity.did, { ...identity });
    return { ...this.identities.get(identity.did)! };
  }
}

function setupService(): DidService {
  return new DidService(new InMemoryIdentityStore());
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DidService', () => {
  const key1 = makeKeypair(0x11);
  const key2 = makeKeypair(0x22);
  const wallet = WALLET_A;
  const did = `did:aethermint:${wallet}`;
  const message = 'AetherMint DID challenge v1';

  describe('registerDid (criterion 1: create a DID bound to a wallet)', () => {
    it('creates a DID bound to the wallet with the given verification key', async () => {
      const service = setupService();

      const identity = await service.registerDid({
        controller: wallet,
        verificationKey: key1.publicKey,
      });

      expect(identity.did).toBe(did);
      expect(identity.controller).toBe(wallet);
      expect(identity.verificationKey).toBe(key1.publicKey.toLowerCase());
      expect(identity.keyVersion).toBe(1);
      expect(identity.active).toBe(true);
      expect(identity.credentialIds).toEqual([]);
      expect(identity.keyHistory).toEqual([]);
    });

    it('rejects a second registration for the same wallet', async () => {
      const service = setupService();
      await service.registerDid({ controller: wallet, verificationKey: key1.publicKey });

      await expect(
        service.registerDid({ controller: wallet, verificationKey: key2.publicKey }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('rejects a malformed wallet', async () => {
      const service = setupService();
      await expect(
        service.registerDid({ controller: 'not-a-wallet', verificationKey: key1.publicKey }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects a malformed or all-zero verification key', async () => {
      const service = setupService();
      await expect(
        service.registerDid({ controller: wallet, verificationKey: 'zz'.repeat(32) }),
      ).rejects.toBeInstanceOf(ValidationError);
      await expect(
        service.registerDid({ controller: wallet, verificationKey: '00'.repeat(32) }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('resolveDid (criterion 2: documents resolvable with verification keys)', () => {
    it('resolves a registered DID document', async () => {
      const service = setupService();
      await service.registerDid({ controller: wallet, verificationKey: key1.publicKey });

      const identity = await service.resolveDid(did);
      expect(identity.verificationKey).toBe(key1.publicKey.toLowerCase());
      expect(identity.keyVersion).toBe(1);
      expect(identity.active).toBe(true);
    });

    it('rejects an unknown DID', async () => {
      const service = setupService();
      await expect(service.resolveDid(`did:aethermint:${WALLET_B}`)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('rejects a malformed DID', async () => {
      const service = setupService();
      await expect(service.resolveDid('did:example:alice')).rejects.toBeInstanceOf(
        ValidationError,
      );
    });

    it('supports reverse lookup by wallet', async () => {
      const service = setupService();
      expect(await service.getDidForController(wallet)).toBeNull();

      await service.registerDid({ controller: wallet, verificationKey: key1.publicKey });
      expect(await service.getDidForController(wallet)).toBe(did);
    });
  });

  describe('verifySignature (criterion 4: resolves the document and checks signatures)', () => {
    it('accepts a valid signature and rejects invalid ones', async () => {
      const service = setupService();
      await service.registerDid({ controller: wallet, verificationKey: key1.publicKey });

      const valid = await service.verifySignature({
        did,
        message,
        signature: signMessage(key1.privateKey, message),
      });
      expect(valid).toBe(true);

      const wrongKey = await service.verifySignature({
        did,
        message,
        signature: signMessage(key2.privateKey, message),
      });
      expect(wrongKey).toBe(false);

      const tampered = await service.verifySignature({
        did,
        message: message + ' tampered',
        signature: signMessage(key1.privateKey, message),
      });
      expect(tampered).toBe(false);
    });

    it('rejects verification for an unknown DID', async () => {
      const service = setupService();
      await expect(
        service.verifySignature({
          did: `did:aethermint:${WALLET_B}`,
          message,
          signature: signMessage(key1.privateKey, message),
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('rotateDidKey (criterion 5: key rotation without breaking credentials)', () => {
    it('rotates the key with proof of possession and preserves history', async () => {
      const service = setupService();
      const identity = await service.registerDid({
        controller: wallet,
        verificationKey: key1.publicKey,
      });
      // A credential issued before rotation stays linked to the DID.
      await service.linkCredential(identity.did, 42);

      const rotated = await service.rotateDidKey({
        did,
        newKey: key2.publicKey,
        challenge: message,
        signature: signMessage(key2.privateKey, message),
      });

      expect(rotated.verificationKey).toBe(key2.publicKey.toLowerCase());
      expect(rotated.keyVersion).toBe(2);
      expect(rotated.keyHistory).toHaveLength(1);
      expect(rotated.keyHistory[0].oldKey).toBe(key1.publicKey.toLowerCase());
      expect(rotated.keyHistory[0].newKey).toBe(key2.publicKey.toLowerCase());
      expect(rotated.keyHistory[0].rotatedBy).toBe(wallet);

      // The current key is now key2: key2 verifies, key1 no longer does.
      await expect(
        service.verifySignature({ did, message, signature: signMessage(key2.privateKey, message) }),
      ).resolves.toBe(true);
      await expect(
        service.verifySignature({ did, message, signature: signMessage(key1.privateKey, message) }),
      ).resolves.toBe(false);

      // Credentials issued under the old key remain linked (criterion 5).
      await expect(service.getCredentialsForDid(did)).resolves.toEqual([42]);
    });

    it('rejects rotation to the same key', async () => {
      const service = setupService();
      await service.registerDid({ controller: wallet, verificationKey: key1.publicKey });

      await expect(
        service.rotateDidKey({
          did,
          newKey: key1.publicKey,
          challenge: message,
          signature: signMessage(key1.privateKey, message),
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects rotation without proof of possession of the new key', async () => {
      const service = setupService();
      await service.registerDid({ controller: wallet, verificationKey: key1.publicKey });

      // Claims key2 as new, but signs the challenge with key1.
      await expect(
        service.rotateDidKey({
          did,
          newKey: key2.publicKey,
          challenge: message,
          signature: signMessage(key1.privateKey, message),
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects rotation for a deactivated DID', async () => {
      const service = setupService();
      await service.registerDid({ controller: wallet, verificationKey: key1.publicKey });
      await service.deactivateDid(did);

      await expect(
        service.rotateDidKey({
          did,
          newKey: key2.publicKey,
          challenge: message,
          signature: signMessage(key2.privateKey, message),
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('deactivateDid', () => {
    it('blocks verification but keeps the document resolvable', async () => {
      const service = setupService();
      await service.registerDid({ controller: wallet, verificationKey: key1.publicKey });
      const signature = signMessage(key1.privateKey, message);

      await expect(service.verifySignature({ did, message, signature })).resolves.toBe(true);

      const deactivated = await service.deactivateDid(did);
      expect(deactivated.active).toBe(false);

      // Document still resolves; verification stops succeeding.
      await expect(service.resolveDid(did)).resolves.toMatchObject({ active: false });
      await expect(service.verifySignature({ did, message, signature })).resolves.toBe(false);
    });

    it('rejects double deactivation', async () => {
      const service = setupService();
      await service.registerDid({ controller: wallet, verificationKey: key1.publicKey });
      await service.deactivateDid(did);
      await expect(service.deactivateDid(did)).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('credentials reference the holder DID (criterion 3)', () => {
    it('links credentials to the holder DID and lists them', async () => {
      const service = setupService();
      const identity = await service.registerDid({
        controller: wallet,
        verificationKey: key1.publicKey,
      });

      expect(await service.getCredentialsForDid(identity.did)).toEqual([]);

      await service.linkCredential(identity.did, 7);
      await service.linkCredential(identity.did, 8);
      // Idempotent: linking the same credential twice is a no-op.
      await service.linkCredential(identity.did, 7);

      await expect(service.getCredentialsForDid(identity.did)).resolves.toEqual([7, 8]);
    });

    it('rejects linking a credential to an unknown DID', async () => {
      const service = setupService();
      await expect(service.linkCredential(`did:aethermint:${WALLET_C}`, 1)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe('verifyEd25519 helper', () => {
    it('verifies raw ed25519 signatures against raw public keys', () => {
      const pub = Buffer.from(key1.publicKey, 'hex');
      const messageBuf = Buffer.from(message, 'utf-8');
      const sig = Buffer.from(signMessage(key1.privateKey, message), 'hex');

      expect(verifyEd25519(messageBuf, sig, pub)).toBe(true);
      expect(verifyEd25519(messageBuf, sig, Buffer.from(key2.publicKey, 'hex'))).toBe(false);
      expect(verifyEd25519(Buffer.from('different'), sig, pub)).toBe(false);
      expect(verifyEd25519(messageBuf, Buffer.alloc(64), pub)).toBe(false);
    });
  });
});
