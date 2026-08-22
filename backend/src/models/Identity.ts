import mongoose, { Document, Schema } from 'mongoose';

/**
 * A single verification method bound to a DID.
 *
 * `retiredAt` is set when the key is rotated out — retired keys remain valid
 * for verifying signatures produced while they were active, so key rotation
 * does not invalidate previously issued credentials. `revoked` is set by an
 * explicit revocation and makes the key invalid for verification.
 */
export interface IVerificationMethod {
  keyId: string;
  keyType: string;
  publicKey: string;
  addedAt: Date;
  retiredAt?: Date | null;
  revoked: boolean;
}

/** A credential reference recorded against a DID (issued credentials anchor
 *  back to the holder's DID). */
export interface ICredentialRef {
  credentialId: string;
  issuedAt: Date;
}

export interface IIdentity extends Document {
  /** Decentralized identifier, e.g. `did:aethermint:{uuid}`. */
  did: string;
  /** Stellar wallet address the DID is bound to. */
  walletAddress: string;
  /** Address that controls the DID (currently the wallet address). */
  controller: string;
  status: 'active' | 'deactivated';
  verificationMethods: IVerificationMethod[];
  credentials: ICredentialRef[];
  createdAt: Date;
  updatedAt: Date;
}

const VerificationMethodSchema = new Schema<IVerificationMethod>(
  {
    keyId: { type: String, required: true },
    keyType: { type: String, required: true, default: 'Ed25519VerificationKey2020' },
    publicKey: { type: String, required: true },
    addedAt: { type: Date, default: Date.now },
    retiredAt: { type: Date, default: null },
    revoked: { type: Boolean, default: false },
  },
  { _id: false }
);

const CredentialRefSchema = new Schema<ICredentialRef>(
  {
    credentialId: { type: String, required: true },
    issuedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const IdentitySchema = new Schema<IIdentity>(
  {
    did: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    controller: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'deactivated'],
      default: 'active',
      index: true,
    },
    verificationMethods: {
      type: [VerificationMethodSchema],
      default: [],
    },
    credentials: {
      type: [CredentialRefSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Wallet-scoped lookups
IdentitySchema.index({ walletAddress: 1, status: 1 });
IdentitySchema.index({ did: 1, status: 1 });

export const Identity = mongoose.model<IIdentity>('Identity', IdentitySchema);

export default Identity;
