import mongoose, { Document, Schema } from 'mongoose';

/**
 * Passkey credential stored per-user.
 *
 * The `credentialPublicKey` and `credentialId` are stored as Buffers for
 * efficient binary comparison and compact storage.  The WebAuthn spec refers
 * to these as `credential.response attestationObject` fields.
 */
export interface IPasskeyDocument extends Document {
  /** Reference to the owning user */
  userId: string;
  /** WebAuthn credential ID (base64url-encoded when sent to client) */
  credentialId: Buffer;
  /** COSE-encoded public key */
  credentialPublicKey: Buffer;
  /** Signature counter — used to detect cloned authenticators */
  counter: number;
  /** Human-readable device name (e.g. "iPhone 14 Pro", "YubiKey 5") */
  deviceName: string;
  /** transports supported by the authenticator */
  transports: string[];
  /** ISO-8601 creation timestamp */
  createdAt: Date;
  /** ISO-8601 last-used timestamp */
  lastUsedAt: Date;
  /** Whether this passkey is currently active (false = revoked) */
  active: boolean;
  /** Recovery codes for account recovery when passkeys are lost */
  recoveryCodes: string[];
}

const PasskeySchema = new Schema<IPasskeyDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    credentialId: {
      type: Buffer,
      required: true,
      unique: true,
    },
    credentialPublicKey: {
      type: Buffer,
      required: true,
    },
    counter: {
      type: Number,
      required: true,
      default: 0,
    },
    deviceName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    transports: {
      type: [String],
      default: [],
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
    active: {
      type: Boolean,
      default: true,
    },
    recoveryCodes: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Composite index for active passkeys per user
PasskeySchema.index({ userId: 1, active: 1 });

export const PasskeyModel = mongoose.model<IPasskeyDocument>('Passkey', PasskeySchema);
