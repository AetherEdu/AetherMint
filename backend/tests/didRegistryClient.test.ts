/**
 * DID Registry client tests — Issue #397.
 *
 * Verifies the ScVal encoding/decoding layer of the on-chain client against
 * the real `@stellar/stellar-sdk` XDR types, without requiring a live Soroban
 * RPC. Each contract type is round-tripped through XDR so the mapping between
 * the Rust contract (`contracts/src/did_registry.rs`) and wire values is
 * covered.
 */

// The global test setup mocks @stellar/stellar-sdk with a minimal stub; the
// ScVal layer under test needs the real XDR types, so restore the real module
// for this file.
jest.unmock('@stellar/stellar-sdk');

import { Keypair, StrKey, xdr } from '@stellar/stellar-sdk';
import {
  bytesToHex,
  decodeCredentialIds,
  decodeDidDocument,
  decodeKeyHistory,
  encodeAddress,
  encodeBytes,
  encodeString,
  encodeU32,
  encodeU64,
  hexToBytes,
  scvalToNative,
} from '../src/services/did/didRegistryClient';

const WALLET = Keypair.random().publicKey();
const DID = `did:aethermint:${WALLET}`;
const KEY = Buffer.alloc(32, 0xab);
const KEY_HEX = KEY.toString('hex');
const SIG = Buffer.alloc(64, 0xcd);

describe('didRegistryClient ScVal encoding', () => {
  it('encodes a wallet address as scvAddress', () => {
    const scv = encodeAddress(WALLET);
    expect(scv.switch().name).toBe('scvAddress');

    // Round-trip through the SDK: address comes back as the same strkey.
    expect(scvalToNative(scv)).toBe(WALLET);

    // The underlying raw key is the wallet's 32-byte ed25519 key.
    const scAddress = scv.address();
    expect(scAddress.switch().name).toBe('scAddressTypeAccount');
    const raw = scAddress.accountId().ed25519();
    expect(Buffer.from(raw).equals(StrKey.decodeEd25519PublicKey(WALLET))).toBe(true);
  });

  it('encodes bytes as scvBytes', () => {
    const scv = encodeBytes(SIG);
    expect(scv.switch().name).toBe('scvBytes');
    expect(Buffer.from(scv.value() as Buffer).equals(SIG)).toBe(true);
    expect(scvalToNative(scv)).toEqual(SIG);
  });

  it('encodes strings as scvString', () => {
    const scv = encodeString(DID);
    expect(scv.switch().name).toBe('scvString');
    expect(scvalToNative(scv)).toBe(DID);
  });

  it('encodes u32 and u64 with the right ScVal arms', () => {
    const u32 = encodeU32(7);
    expect(u32.switch().name).toBe('scvU32');
    expect(scvalToNative(u32)).toBe(7);

    const u64 = encodeU64(12345678901234567890n);
    expect(u64.switch().name).toBe('scvU64');
    expect(scvalToNative(u64)).toBe(12345678901234567890n);
  });

  it('converts between hex and bytes', () => {
    expect(bytesToHex(KEY)).toBe(KEY_HEX);
    expect(hexToBytes(KEY_HEX)).toEqual(KEY);
    expect(hexToBytes('AB')).toEqual(Buffer.from([0xab]));
  });
});

describe('didRegistryClient ScVal decoding', () => {
  it('decodes a DidDocument struct (scvVec of 7 fields)', () => {
    // Mirrors the field order of `DidDocument` in contracts/src/did_registry.rs.
    const scv = xdr.ScVal.scvVec([
      xdr.ScVal.scvString(DID),
      encodeAddress(WALLET),
      xdr.ScVal.scvBytes(KEY),
      xdr.ScVal.scvU32(3),
      xdr.ScVal.scvBool(true),
      xdr.ScVal.scvU64(xdr.Uint64.fromString('1700000000')),
      xdr.ScVal.scvU64(xdr.Uint64.fromString('1700000360')),
    ]);

    const doc = decodeDidDocument(scv);
    expect(doc.did).toBe(DID);
    expect(doc.controller).toBe(WALLET);
    expect(doc.verificationKey).toBe(KEY_HEX);
    expect(doc.keyVersion).toBe(3);
    expect(doc.active).toBe(true);
    expect(doc.createdAt).toBe(1700000000n);
    expect(doc.updatedAt).toBe(1700000360n);
  });

  it('rejects a DidDocument with the wrong shape', () => {
    const scv = xdr.ScVal.scvVec([xdr.ScVal.scvString(DID)]);
    expect(() => decodeDidDocument(scv)).toThrow(/DidDocument shape/);
  });

  it('decodes a key history vector of rotation records', () => {
    const oldKey = Buffer.alloc(32, 0x01);
    const newKey = Buffer.alloc(32, 0x02);
    const scv = xdr.ScVal.scvVec([
      xdr.ScVal.scvVec([
        xdr.ScVal.scvBytes(oldKey),
        xdr.ScVal.scvBytes(newKey),
        xdr.ScVal.scvU64(xdr.Uint64.fromString('1700001000')),
        encodeAddress(WALLET),
      ]),
    ]);

    const history = decodeKeyHistory(scv);
    expect(history).toHaveLength(1);
    expect(history[0].oldKey).toBe(oldKey.toString('hex'));
    expect(history[0].newKey).toBe(newKey.toString('hex'));
    expect(history[0].rotatedAt).toBe(1700001000n);
    expect(history[0].rotatedBy).toBe(WALLET);
  });

  it('decodes a credential id list (Vec<u64>)', () => {
    const scv = xdr.ScVal.scvVec([
      xdr.ScVal.scvU64(xdr.Uint64.fromString('7')),
      xdr.ScVal.scvU64(xdr.Uint64.fromString('42')),
    ]);
    expect(decodeCredentialIds(scv)).toEqual([7n, 42n]);
  });

  it('decodes an empty credential id list', () => {
    expect(decodeCredentialIds(xdr.ScVal.scvVec([]))).toEqual([]);
  });
});
