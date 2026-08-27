/**
 * WebAuthn Passkey Service
 *
 * Handles passkey registration and authentication ceremonies using the
 * SimpleWebAuthn library.  Exposes helpers for the full FIDO2 lifecycle:
 *
 *  - generateRegistrationOptions
 *  - verifyRegistrationResponse
 *  - generateAuthenticationOptions
 *  - verifyAuthenticationResponse
 *  - listUserPasskeys / revokePasskey
 *  - generateRecoveryCodes / verifyRecoveryCode
 */

// @ts-ignore - types not yet installed
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
// @ts-ignore
import type { Passkey } from '@simplewebauthn/server/helpers';
import crypto from 'crypto';
import { PasskeyModel, IPasskeyDocument } from '../../models/Passkey';

// ── Configuration ──────────────────────────────────────────────────────────

const RP_NAME = process.env.RP_NAME || 'AetherMint';
const RP_ID = process.env.RP_ID || 'localhost';
const ORIGIN = process.env.ORIGIN || `https://${RP_ID}`;

/** Number of recovery codes generated per user */
const RECOVERY_CODE_COUNT = 10;

// ── Helpers ────────────────────────────────────────────────────────────────

function bufferToBase64url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlToBuffer(base64url: string): Buffer {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64');
}

function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const bytes = crypto.randomBytes(4);
    // Format: XXXX-XXXX-XXXX
    const code = bytes
      .toString('hex')
      .toUpperCase()
      .match(/.{1,4}/g)!
      .join('-');
    codes.push(code);
  }
  return codes;
}

function hashRecoveryCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

// ── Registration ───────────────────────────────────────────────────────────

/**
 * Generate registration options for a new passkey.
 *
 * @param userId   - The user's database ID
 * @param username - The user's email or username (used as account name)
 * @param excludeCredentials - IDs of existing passkeys to prevent re-registration
 */
export async function createRegistrationOptions(
  userId: string,
  username: string,
  excludeCredentialIds: string[] = []
) {
  const excludeCredentials = excludeCredentialIds.map((id) => ({
    id: base64urlToBuffer(id),
    type: 'public-key' as const,
    transports: [] as AuthenticatorTransportFuture[],
  }));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: Buffer.from(userId, 'utf-8'),
    userName: username,
    userDisplayName: username,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  return options;
}

/**
 * Verify a registration response and persist the new credential.
 *
 * @param userId          - The user's database ID
 * @param deviceName      - Human-readable name for this device
 * @param expectedChallenge - The challenge that was originally generated
 * @param response        - The raw registration response from the browser
 */
export async function verifyRegistration(
  userId: string,
  deviceName: string,
  expectedChallenge: string,
  response: RegistrationResponseJSON
) {
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return { verified: false };
  }

  const { credential, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo;

  // Persist the new credential
  const passkey = new PasskeyModel({
    userId,
    credentialId: Buffer.from(credential.id, 'base64url'),
    credentialPublicKey: Buffer.from(credential.publicKey),
    counter: credential.counter,
    deviceName,
    transports: response.response?.transports || [],
    active: true,
    recoveryCodes: [],
  });

  await passkey.save();

  // Generate recovery codes for this credential
  const rawCodes = generateRecoveryCodes();
  const hashedCodes = rawCodes.map(hashRecoveryCode);
  passkey.recoveryCodes = hashedCodes;
  await passkey.save();

  return {
    verified: true,
    credentialId: bufferToBase64url(passkey.credentialId),
    deviceName: passkey.deviceName,
    credentialDeviceType,
    credentialBackedUp,
    recoveryCodes: rawCodes, // Return plain-text codes once, then they're hashed
  };
}

// ── Authentication ─────────────────────────────────────────────────────────

/**
 * Generate authentication options for passkey login.
 *
 * @param credentialIds - IDs of the user's registered passkeys (Buffer)
 */
export async function createAuthenticationOptions(
  credentialIds: Buffer[] = []
) {
  const allowCredentials = credentialIds.map((id) => ({
    id,
    type: 'public-key' as const,
    transports: [] as AuthenticatorTransportFuture[],
  }));

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials,
    userVerification: 'preferred',
  });

  return options;
}

/**
 * Verify an authentication response.
 *
 * @param expectedChallenge - The challenge that was originally generated
 * @param response          - The raw authentication response from the browser
 */
export async function verifyAuthentication(
  expectedChallenge: string,
  response: AuthenticationResponseJSON
) {
  // Look up the credential in our database
  const credentialIdBuffer = base64urlToBuffer(response.id);

  const passkey = await PasskeyModel.findOne({
    credentialId: credentialIdBuffer,
    active: true,
  });

  if (!passkey) {
    return { verified: false, error: 'Passkey not found or revoked' };
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    credential: {
      id: passkey.credentialId,
      publicKey: new Uint8Array(passkey.credentialPublicKey),
      counter: passkey.counter,
      transports: passkey.transports as AuthenticatorTransportFuture[],
    },
  });

  if (!verification.verified) {
    return { verified: false, error: 'Authentication failed' };
  }

  // Update counter and last used timestamp
  passkey.counter = verification.authenticationInfo.newCounter;
  passkey.lastUsedAt = new Date();
  await passkey.save();

  return {
    verified: true,
    userId: passkey.userId,
    credentialId: bufferToBase64url(passkey.credentialId),
    deviceName: passkey.deviceName,
  };
}

// ── Device Management ──────────────────────────────────────────────────────

/**
 * List all active passkeys for a user.
 */
export async function listUserPasskeys(userId: string) {
  const passkeys = await PasskeyModel.find({
    userId,
    active: true,
  }).select('-credentialPublicKey -recoveryCodes').lean();

  return passkeys.map((pk: any) => ({
    id: bufferToBase64url(pk.credentialId),
    deviceName: pk.deviceName,
    createdAt: pk.createdAt,
    lastUsedAt: pk.lastUsedAt,
    transports: pk.transports,
  }));
}

/**
 * Revoke (soft-delete) a passkey by its credential ID.
 */
export async function revokePasskey(userId: string, credentialId: string) {
  const credentialIdBuffer = base64urlToBuffer(credentialId);

  const passkey = await PasskeyModel.findOne({
    credentialId: credentialIdBuffer,
    userId,
    active: true,
  });

  if (!passkey) {
    return { success: false, error: 'Passkey not found' };
  }

  passkey.active = false;
  await passkey.save();

  return { success: true, deviceName: passkey.deviceName };
}

// ── Recovery Codes ─────────────────────────────────────────────────────────

/**
 * Verify a recovery code (used when all passkeys are lost).
 * Returns the user ID if the code is valid, and invalidates the code.
 */
export async function verifyRecoveryCode(
  userId: string,
  code: string
): Promise<{ verified: boolean; userId?: string }> {
  const hashed = hashRecoveryCode(code);

  const passkey = await PasskeyModel.findOne({
    userId,
    active: true,
    recoveryCodes: hashed,
  });

  if (!passkey) {
    return { verified: false };
  }    // Remove the used recovery code
    passkey.recoveryCodes = passkey.recoveryCodes.filter((c: string) => c !== hashed);
  await passkey.save();

  return { verified: true, userId: passkey.userId };
}

/**
 * Generate new recovery codes for a user (invalidates old ones).
 */
export async function regenerateRecoveryCodes(userId: string) {
  const passkeys = await PasskeyModel.find({ userId, active: true });

  if (passkeys.length === 0) {
    return { success: false, error: 'No active passkeys found' };
  }

  const rawCodes = generateRecoveryCodes();
  const hashedCodes = rawCodes.map(hashRecoveryCode);

  // Update all active passkeys with the new recovery codes
  await PasskeyModel.updateMany(
    { userId, active: true },
    { $set: { recoveryCodes: hashedCodes } }
  );

  return { success: true, recoveryCodes: rawCodes };
}

// ── Exports ────────────────────────────────────────────────────────────────

export {
  bufferToBase64url,
  base64urlToBuffer,
  generateRecoveryCodes,
  hashRecoveryCode,
  RECOVERY_CODE_COUNT,
};
