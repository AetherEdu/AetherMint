import crypto from 'crypto';
import { DidService, IdentityStore, IIdentity } from '../services/did';

/** In-memory identity store used to exercise the service without MongoDB. */
class FakeStore implements IdentityStore {
  private records: IIdentity[] = [];

  async findOne(filter: Record<string, unknown>): Promise<IIdentity | null> {
    const entry = this.records.find((r) =>
      Object.entries(filter).every(([key, value]) => (r as any)[key] === value)
    );
    return entry ?? null;
  }

  async create(doc: Record<string, unknown>): Promise<IIdentity> {
    const record = {
      ...doc,
      save: async () => {
        (record as any).updatedAt = new Date();
      },
    } as unknown as IIdentity;
    this.records.push(record);
    return record;
  }

  seed(doc: Partial<IIdentity>): IIdentity {
    const record = { ...doc, save: async () => undefined } as unknown as IIdentity;
    this.records.push(record);
    return record;
  }
}

function makeService(): { service: DidService; store: FakeStore } {
  const store = new FakeStore();
  const service = new DidService({ identityStore: store });
  return { service, store };
}

function makeKeyPair(): { publicKeyHex: string; privateKey: crypto.KeyObject } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const spki = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
  const raw = spki.subarray(spki.length - 32);
  return { publicKeyHex: raw.toString('hex'), privateKey };
}

function sign(message: string, privateKey: crypto.KeyObject): string {
  return crypto.sign(null, Buffer.from(message, 'utf8'), privateKey).toString('hex');
}

describe('DidService', () => {
  describe('creation and resolution', () => {
    it('creates a DID bound to the wallet with one verification key', async () => {
      const { service } = makeService();
      const key = makeKeyPair();

      const identity = await service.createDid({
        walletAddress: 'G-WALLET-1',
        publicKey: key.publicKeyHex,
      });

      expect(identity.did).toMatch(/^did:aethermint:/);
      expect(identity.walletAddress).toBe('G-WALLET-1');
      expect(identity.controller).toBe('G-WALLET-1');
      expect(identity.status).toBe('active');
      expect(identity.verificationMethods).toHaveLength(1);
      expect(identity.verificationMethods[0].keyId).toBe(`${identity.did}#key-1`);
      expect(identity.verificationMethods[0].publicKey).toBe(key.publicKeyHex);
      expect(identity.verificationMethods[0].revoked).toBe(false);
      expect(identity.verificationMethods[0].retiredAt).toBeNull();
    });

    it('rejects a second DID for the same wallet', async () => {
      const { service } = makeService();
      const key = makeKeyPair();

      await service.createDid({ walletAddress: 'G-WALLET-1', publicKey: key.publicKeyHex });
      await expect(
        service.createDid({ walletAddress: 'G-WALLET-1', publicKey: key.publicKeyHex })
      ).rejects.toThrow(/already bound/);
    });

    it('resolves a DID and looks it up by wallet', async () => {
      const { service } = makeService();
      const key = makeKeyPair();

      const created = await service.createDid({ walletAddress: 'G-WALLET-1', publicKey: key.publicKeyHex });

      const resolved = await service.resolveDid(created.did);
      expect(resolved?.did).toBe(created.did);

      const byWallet = await service.getDidByWallet('G-WALLET-1');
      expect(byWallet?.did).toBe(created.did);

      expect(await service.resolveDid('did:aethermint:nope')).toBeNull();
    });
  });

  describe('key rotation without breaking credentials', () => {
    it('retires the old key, adds a new one, and keeps both verifiable', async () => {
      const { service } = makeService();
      const oldKey = makeKeyPair();

      const created = await service.createDid({ walletAddress: 'G-WALLET-1', publicKey: oldKey.publicKeyHex });

      const newKey = makeKeyPair();
      const rotated = await service.rotateKey(created.did, { publicKey: newKey.publicKeyHex });

      expect(rotated.verificationMethods).toHaveLength(2);
      expect(rotated.verificationMethods[0].retiredAt).toBeInstanceOf(Date);
      expect(rotated.verificationMethods[0].revoked).toBe(false);
      expect(rotated.verificationMethods[1].publicKey).toBe(newKey.publicKeyHex);
      expect(rotated.verificationMethods[1].retiredAt).toBeNull();

      // A credential signed under the OLD key still verifies after rotation.
      const message = 'credential-1';
      const oldSignature = sign(message, oldKey.privateKey);
      const oldResult = await service.verifySignature({
        did: created.did,
        message,
        signature: oldSignature,
      });
      expect(oldResult.valid).toBe(true);
      expect(oldResult.keyId).toBe(`${created.did}#key-1`);

      // And the new key verifies too.
      const newSignature = sign(message, newKey.privateKey);
      const newResult = await service.verifySignature({
        did: created.did,
        message,
        signature: newSignature,
      });
      expect(newResult.valid).toBe(true);
      expect(newResult.keyId).toBe(`${created.did}#key-2`);
    });
  });

  describe('revocation and deactivation', () => {
    it('revokes a key so it stops verifying', async () => {
      const { service } = makeService();
      const key = makeKeyPair();
      const created = await service.createDid({ walletAddress: 'G-WALLET-1', publicKey: key.publicKeyHex });

      const keyId = created.verificationMethods[0].keyId;
      const revoked = await service.revokeVerificationMethod(created.did, keyId);
      expect(revoked.verificationMethods[0].revoked).toBe(true);

      expect((await service.verifyKey(created.did, keyId)).valid).toBe(false);

      const message = 'hello';
      const result = await service.verifySignature({
        did: created.did,
        message,
        signature: sign(message, key.privateKey),
      });
      expect(result.valid).toBe(false);
    });

    it('deactivates a DID so no key verifies', async () => {
      const { service } = makeService();
      const key = makeKeyPair();
      const created = await service.createDid({ walletAddress: 'G-WALLET-1', publicKey: key.publicKeyHex });

      const deactivated = await service.deactivateDid(created.did);
      expect(deactivated.status).toBe('deactivated');

      expect((await service.verifyKey(created.did, created.verificationMethods[0].keyId)).valid).toBe(false);

      const message = 'hello';
      const result = await service.verifySignature({
        did: created.did,
        message,
        signature: sign(message, key.privateKey),
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('DID is deactivated');

      await expect(service.deactivateDid(created.did)).rejects.toThrow(/already deactivated/);
    });
  });

  describe('signature verification', () => {
    it('accepts a valid signature and rejects a tampered one', async () => {
      const { service } = makeService();
      const key = makeKeyPair();
      const created = await service.createDid({ walletAddress: 'G-WALLET-1', publicKey: key.publicKeyHex });

      const message = 'verifiable-credential-payload';
      const signature = sign(message, key.privateKey);

      const ok = await service.verifySignature({ did: created.did, message, signature });
      expect(ok.valid).toBe(true);
      expect(ok.keyId).toBe(`${created.did}#key-1`);

      const bad = await service.verifySignature({ did: created.did, message: 'tampered', signature });
      expect(bad.valid).toBe(false);
    });

    it('rejects an unknown DID and a malformed signature', async () => {
      const { service } = makeService();
      const key = makeKeyPair();

      const unknown = await service.verifySignature({
        did: 'did:aethermint:missing',
        message: 'x',
        signature: sign('x', key.privateKey),
      });
      expect(unknown.valid).toBe(false);
      expect(unknown.reason).toBe('DID not found');

      const created = await service.createDid({ walletAddress: 'G-WALLET-1', publicKey: key.publicKeyHex });
      const malformed = await service.verifySignature({
        did: created.did,
        message: 'x',
        signature: 'not-a-signature',
      });
      expect(malformed.valid).toBe(false);
      expect(malformed.reason).toMatch(/hex-encoded/);
    });
  });

  describe('issued credentials reference the holder DID', () => {
    it('records and lists credential references', async () => {
      const { service } = makeService();
      const key = makeKeyPair();
      const created = await service.createDid({ walletAddress: 'G-WALLET-1', publicKey: key.publicKeyHex });

      const updated = await service.recordCredential(created.did, 'cred-001');
      expect(updated.credentials).toHaveLength(1);
      expect(updated.credentials[0].credentialId).toBe('cred-001');

      await expect(service.recordCredential(created.did, 'cred-001')).rejects.toThrow(/already recorded/);

      const refs = await service.getCredentials(created.did);
      expect(refs.map((c) => c.credentialId)).toEqual(['cred-001']);
    });
  });

  describe('key validity checks', () => {
    it('reports unknown and revoked keys as invalid', async () => {
      const { service } = makeService();
      const key = makeKeyPair();
      const created = await service.createDid({ walletAddress: 'G-WALLET-1', publicKey: key.publicKeyHex });

      const unknown = await service.verifyKey(created.did, 'did:x#nope');
      expect(unknown.valid).toBe(false);
      expect(unknown.reason).toBe('Verification method not found');
    });

    it('accepts base64-encoded public keys', async () => {
      const { service } = makeService();
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
      const spki = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
      const raw = spki.subarray(spki.length - 32).toString('base64');

      const created = await service.createDid({ walletAddress: 'G-WALLET-1', publicKey: raw });

      const message = 'base64-key';
      const signature = crypto.sign(null, Buffer.from(message, 'utf8'), privateKey).toString('hex');
      const result = await service.verifySignature({ did: created.did, message, signature });
      expect(result.valid).toBe(true);
    });
  });
});
