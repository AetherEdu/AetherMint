/**
 * Credentials Routes
 *
 * New CRUD endpoints for credentials that back the Idempotency-Key
 * middleware target in issue #264. Only the mutation endpoint
 * (`POST /`) is wired through idempotency middleware; GETs are
 * read-only and pass through.
 */

import express, { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { idempotencyMiddleware } from '../middleware/idempotency';
import { CredentialsController } from '../controllers/CredentialsController';
import { UserRole } from '../models/User';
import { rateLimit } from 'express-rate-limit';

const router: Router = express.Router();

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

const issueLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @route POST /api/credentials
 * @desc Issue a credential. Idempotent via Idempotency-Key header.
 * @access Private (Educator/Admin)
 */
router.post(
  '/',
  authenticateToken,
  issueLimiter,
  requireRole([UserRole.EDUCATOR, UserRole.ADMIN, 'INSTRUCTOR']),
  idempotencyMiddleware(),
  CredentialsController.issueCredential
);

/**
 * @route GET /api/credentials/:id
 * @desc Get a credential by id
 * @access Private (Recipient, Issuer, Admin)
 */
router.get(
  '/:id',
  authenticateToken,
  readLimiter,
  CredentialsController.getCredential
);

/**
 * @route GET /api/credentials/recipient/:recipientId
 * @desc List a recipient's credentials
 * @access Private (Self or Admin)
 */
router.get(
  '/recipient/:recipientId',
  authenticateToken,
  readLimiter,
  CredentialsController.listRecipientCredentials
);

export default router;
