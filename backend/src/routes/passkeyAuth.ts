/**
 * Passkey (WebAuthn) Authentication Routes
 *
 * Provides endpoints for:
 *  - Passkey registration ceremony (options + verify)
 *  - Passkey login ceremony (options + verify)
 *  - Device management (list, revoke)
 *  - Recovery code flows
 *  - MFA second-factor verification
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
// @ts-ignore - CommonJS module without type declarations
import { authLimiter } from '../middleware/rateLimiter';
import {
  createRegistrationOptions,
  verifyRegistration,
  createAuthenticationOptions,
  verifyAuthentication,
  listUserPasskeys,
  revokePasskey,
  verifyRecoveryCode,
  regenerateRecoveryCodes,
} from '../services/auth/passkeys';
import { PasskeyModel } from '../models/Passkey';
import { AuthError, ValidationError, NotFoundError } from '../utils/errors';

const router = Router();

// ── Registration ───────────────────────────────────────────────────────────

/**
 * GET /api/auth/passkeys/register/options
 *
 * Generate registration options for a new passkey.
 * Must be called with a valid JWT — the passkey is linked to the authenticated user.
 */
router.get(
  '/register/options',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const userAny = req.user as any;
      const username = userAny.username || userAny.email || userId;

      // Get existing credential IDs to exclude
      const existingPasskeys = await PasskeyModel.find({
        userId,
        active: true,
      }).select('credentialId');

      const excludeCredentialIds = existingPasskeys.map((pk: any) =>
        pk.credentialId.toString('base64url')
      );

      const options = await createRegistrationOptions(
        userId,
        username,
        excludeCredentialIds
      );

      // Store the challenge in the session for verification
      // Using a simple in-memory store; in production use Redis
      (req as any).passkeyChallenge = options.challenge;

      res.json({ options });
    } catch (error) {
      console.error('Passkey registration options error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to generate registration options',
      });
    }
  }
);

/**
 * POST /api/auth/passkeys/register/verify
 *
 * Verify the registration response and persist the new credential.
 */
router.post(
  '/register/verify',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { deviceName, response, challenge } = req.body;

      if (!response) {
        throw new ValidationError('Registration response is required');
      }

      if (!deviceName) {
        throw new ValidationError('Device name is required');
      }

      const expectedChallenge =
        challenge || (req as any).passkeyChallenge;

      if (!expectedChallenge) {
        throw new ValidationError('Challenge not found. Please request new options.');
      }

      const result = await verifyRegistration(
        userId,
        deviceName,
        expectedChallenge,
        response
      );

      if (!result.verified) {
        return res.status(400).json({
          error: 'Registration failed',
          message: 'Passkey registration verification failed',
        });
      }

      res.json({
        message: 'Passkey registered successfully',
        credentialId: result.credentialId,
        deviceName: result.deviceName,
        credentialDeviceType: result.credentialDeviceType,
        credentialBackedUp: result.credentialBackedUp,
        recoveryCodes: result.recoveryCodes,
      });
    } catch (error) {
      console.error('Passkey registration verify error:', error);
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: error.message,
          message: error.message,
        });
      }
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to verify registration',
      });
    }
  }
);

// ── Authentication (Login) ────────────────────────────────────────────────

/**
 * POST /api/auth/passkeys/login/options
 *
 * Generate authentication options for passkey login.
 * This is called BEFORE the user authenticates — no JWT required.
 */
router.post(
  '/login/options',
  async (req: Request, res: Response) => {
    try {
      const { username } = req.body;

      // Find the user's active passkeys
      // Note: In production, look up user by username/email first,
      // then find their passkeys. For this implementation, we accept
      // the user identifier and find matching passkeys.
      let credentialIds: Buffer[] = [];

      if (username) {
        // Find passkeys for users matching the username
        // This is a simplified lookup — in production you'd first resolve
        // the username to a userId
        const passkeys = await PasskeyModel.find({ active: true })
          .select('credentialId');

        credentialIds = passkeys.map((pk: any) => pk.credentialId);
      }

      const options = await createAuthenticationOptions(credentialIds);

      // Store challenge for verification
      // In production, store in Redis with a TTL
      (req as any).passkeyChallenge = options.challenge;

      res.json({ options, challenge: options.challenge });
    } catch (error) {
      console.error('Passkey login options error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to generate authentication options',
      });
    }
  }
);

/**
 * POST /api/auth/passkeys/login/verify
 *
 * Verify the authentication response and issue a JWT.
 */
router.post(
  '/login/verify',
  async (req: Request, res: Response) => {
    try {
      const { response, challenge } = req.body;

      if (!response) {
        throw new ValidationError('Authentication response is required');
      }

      const expectedChallenge =
        challenge || (req as any).passkeyChallenge;

      if (!expectedChallenge) {
        throw new ValidationError('Challenge not found. Please request new options.');
      }

      const result = await verifyAuthentication(expectedChallenge, response);

      if (!result.verified) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: result.error || 'Passkey authentication failed',
        });
      }

      // Generate JWT for the authenticated user
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { id: result.userId },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Login successful',
        token,
        userId: result.userId,
        credentialId: result.credentialId,
        deviceName: result.deviceName,
      });
    } catch (error) {
      console.error('Passkey login verify error:', error);
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: error.message,
          message: error.message,
        });
      }
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to verify authentication',
      });
    }
  }
);

// ── MFA Second Factor ─────────────────────────────────────────────────────

/**
 * POST /api/auth/passkeys/mfa/options
 *
 * Generate authentication options for MFA verification.
 * Called after primary authentication (password) — requires JWT.
 */
router.post(
  '/mfa/options',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;

      const passkeys = await PasskeyModel.find({
        userId,
        active: true,
      }).select('credentialId');

      const credentialIds = passkeys.map((pk: any) => pk.credentialId);

      if (credentialIds.length === 0) {
        return res.status(400).json({
          error: 'No passkeys registered',
          message: 'Please register a passkey first to use as MFA',
        });
      }

      const options = await createAuthenticationOptions(credentialIds);

      (req as any).passkeyChallenge = options.challenge;

      res.json({ options, challenge: options.challenge });
    } catch (error) {
      console.error('MFA options error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to generate MFA options',
      });
    }
  }
);

/**
 * POST /api/auth/passkeys/mfa/verify
 *
 * Verify the MFA passkey response.
 */
router.post(
  '/mfa/verify',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { response, challenge } = req.body;

      if (!response) {
        throw new ValidationError('MFA response is required');
      }

      const expectedChallenge =
        challenge || (req as any).passkeyChallenge;

      if (!expectedChallenge) {
        throw new ValidationError('Challenge not found. Please request new options.');
      }

      const result = await verifyAuthentication(expectedChallenge, response);

      if (!result.verified) {
        return res.status(401).json({
          error: 'MFA verification failed',
          message: result.error || 'Passkey MFA verification failed',
        });
      }

      // Verify the passkey belongs to the authenticated user
      if (result.userId !== userId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Passkey does not belong to the authenticated user',
        });
      }

      res.json({
        message: 'MFA verification successful',
        verified: true,
        credentialId: result.credentialId,
        deviceName: result.deviceName,
      });
    } catch (error) {
      console.error('MFA verify error:', error);
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: error.message,
          message: error.message,
        });
      }
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to verify MFA',
      });
    }
  }
);

// ── Device Management ──────────────────────────────────────────────────────

/**
 * GET /api/auth/passkeys/devices
 *
 * List all active passkeys for the authenticated user.
 */
router.get(
  '/devices',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const devices = await listUserPasskeys(req.user!.id);
      res.json({ devices });
    } catch (error) {
      console.error('List devices error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to list devices',
      });
    }
  }
);

/**
 * DELETE /api/auth/passkeys/devices/:credentialId
 *
 * Revoke a specific passkey.
 */
router.delete(
  '/devices/:credentialId',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { credentialId } = req.params;
      const result = await revokePasskey(req.user!.id, credentialId);

      if (!result.success) {
        return res.status(404).json({
          error: 'Not found',
          message: result.error || 'Passkey not found',
        });
      }

      res.json({
        message: 'Passkey revoked successfully',
        deviceName: result.deviceName,
      });
    } catch (error) {
      console.error('Revoke device error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to revoke device',
      });
    }
  }
);

// ── Recovery ───────────────────────────────────────────────────────────────

/**
 * POST /api/auth/passkeys/recovery/verify
 *
 * Verify a recovery code when all passkeys are lost.
 */
router.post(
  '/recovery/verify',
  async (req: Request, res: Response) => {
    try {
      const { userId, code } = req.body;

      if (!userId || !code) {
        throw new ValidationError('User ID and recovery code are required');
      }

      const result = await verifyRecoveryCode(userId, code);

      if (!result.verified) {
        return res.status(401).json({
          error: 'Invalid recovery code',
          message: 'The recovery code is invalid or has already been used',
        });
      }

      // Generate a temporary token for recovery flow
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { id: result.userId, recovery: true },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '1h' }
      );

      res.json({
        message: 'Recovery code verified successfully',
        token,
        userId: result.userId,
      });
    } catch (error) {
      console.error('Recovery verify error:', error);
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: error.message,
          message: error.message,
        });
      }
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to verify recovery code',
      });
    }
  }
);

/**
 * POST /api/auth/passkeys/recovery/regenerate
 *
 * Generate new recovery codes for the authenticated user.
 */
router.post(
  '/recovery/regenerate',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const result = await regenerateRecoveryCodes(req.user!.id);

      if (!result.success) {
        return res.status(400).json({
          error: 'Failed to regenerate',
          message: result.error || 'Cannot regenerate recovery codes',
        });
      }

      res.json({
        message: 'Recovery codes regenerated successfully',
        recoveryCodes: result.recoveryCodes,
      });
    } catch (error) {
      console.error('Recovery regenerate error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to regenerate recovery codes',
      });
    }
  }
);

export default router;
