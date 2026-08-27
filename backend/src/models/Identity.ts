import mongoose, { Document, Schema } from 'mongoose';

/**
 * Identity model — Issue #397 (self-sovereign identity / DID).
 *
 * Off-chain index that links a learner's Stellar wallet to their
 * decentralized identifier (`did:aethermint:<wallet>`), mirrors the current
 * verification key and rotation history, and records which on-chain
 * credentials have been issued to the DID's holder.
 *
 * The on-chain DID registry contract (`contracts/src/did_registry.rs`) is the
 * authoritative registry; this model is the API-side mirror that keeps
 * resolution, wallet lookups, and credential linkage fast and queryable.
 */

/** One entry in a DID's key-rotation history (mirrors `KeyRotationRecord`). */
export interface KeyRotationRecord {
  /** Verification key in use before the rotation (hex, 64 chars). */
  oldKey: string;
  /** Verification key in use after the rotation (hex, 64 chars). */
  newKey: string;
  /** Unix timestamp (seconds) of the rotation. */
  rotatedAt: number;
  /** Wallet address that performed the rotation (the DID controller). */
  rotatedBy: string;
}

export interface Identity {
  /** Decentralized identifier, e.g. `did:aethermint:GABCDE...`. */
  did: string;
  /** Stellar wallet that controls the DID. Stable across key rotations. */
  controller: string;
  /** Optional link to the platform user (`User._id`). */
  userId?: string;
  /** Current ed25519 verification key (hex, 64 chars). */
  verificationKey: string;
  /** Monotonic key version; bumped on every rotation. */
  keyVersion: number;
  /** Whether the DID is active and may be used for verification. */
  active: boolean;
  /** Credential IDs issued to the DID's holder (on-chain credential registry). */
  credentialIds: number[];
  /** Full rotation history (old key preserved for auditability). */
  keyHistory: KeyRotationRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IIdentityDocument extends Document, Identity {}

const KeyRotationRecordSchema = new Schema<KeyRotationRecord>(
  {
    oldKey: { type: String, required: true },
    newKey: { type: String, required: true },
    rotatedAt: { type: Number, required: true },
    rotatedBy: { type: String, required: true },
  },
  { _id: false }
);

const IdentitySchema = new Schema<IIdentityDocument>(
  {
    did: { type: String, required: true },
    controller: { type: String, required: true },
    userId: { type: String },
    verificationKey: { type: String, required: true },
    keyVersion: { type: Number, required: true, default: 1 },
    active: { type: Boolean, required: true, default: true },
    credentialIds: { type: [Number], default: [] },
    keyHistory: { type: [KeyRotationRecordSchema], default: [] },
  },
  { timestamps: true }
);

// One DID per wallet, and one wallet per DID.
IdentitySchema.index({ did: 1 }, { unique: true });
IdentitySchema.index({ controller: 1 }, { unique: true });
IdentitySchema.index({ userId: 1 }, { sparse: true });

export const IdentityModel = mongoose.model<IIdentityDocument>('Identity', IdentitySchema);
