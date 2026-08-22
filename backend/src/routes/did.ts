/**
 * @openapi
 * tags:
 *   - name: DID
 *     description: Self-sovereign identity (decentralized identifiers) bound to learner wallets
 */

import express, { NextFunction, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import didService from '../services/did';
import { authenticateToken } from '../middleware/auth';

const router: import('express').Router = express.Router();

const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg } });
  }
  next();
};

const handleError = (res: Response, error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  const status = /not found/i.test(message) ? 404 : /already/i.test(message) ? 409 : 400;
  res.status(status).json({ success: false, error: { code: 'DID_ERROR', message } });
};

/**
 * @openapi
 * /api/did:
 *   post:
 *     tags: [DID]
 *     summary: Create a DID bound to the caller's wallet
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [walletAddress, publicKey]
 *             properties:
 *               walletAddress:
 *                 type: string
 *               publicKey:
 *                 type: string
 *               keyType:
 *                 type: string
 *     responses:
 *       '201':
 *         description: DID created
 *       '400':
 *         description: Invalid input
 *       '409':
 *         description: Wallet already has a DID
 */
router.post(
  '/',
  authenticateToken,
  [
    body('walletAddress').notEmpty().withMessage('walletAddress is required'),
    body('publicKey').notEmpty().withMessage('publicKey is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const identity = await didService.createDid(req.body);
      res.status(201).json({ success: true, data: identity });
    } catch (error) {
      handleError(res, error);
    }
  },
);

/**
 * @openapi
 * /api/did/wallet/{walletAddress}:
 *   get:
 *     tags: [DID]
 *     summary: Look up the DID bound to a wallet address
 *     parameters:
 *       - in: path
 *         name: walletAddress
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: DID document found
 *       '404':
 *         description: No DID bound to this wallet
 */
router.get('/wallet/:walletAddress', async (req: Request, res: Response) => {
  try {
    const identity = await didService.getDidByWallet(req.params.walletAddress);
    if (!identity) {
      return res.status(404).json({ success: false, error: { code: 'DID_NOT_FOUND', message: 'No DID bound to this wallet' } });
    }
    res.json({ success: true, data: identity });
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * @openapi
 * /api/did/{did}:
 *   get:
 *     tags: [DID]
 *     summary: Resolve a DID document
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: DID document resolved
 *       '404':
 *         description: DID not found
 */
router.get('/:did', async (req: Request, res: Response) => {
  try {
    const identity = await didService.resolveDid(req.params.did);
    if (!identity) {
      return res.status(404).json({ success: false, error: { code: 'DID_NOT_FOUND', message: 'DID not found' } });
    }
    res.json({ success: true, data: identity });
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * @openapi
 * /api/did/{did}/keys:
 *   post:
 *     tags: [DID]
 *     summary: Add a verification method to a DID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [publicKey]
 *             properties:
 *               publicKey:
 *                 type: string
 *               keyType:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Verification method added
 */
router.post(
  '/:did/keys',
  authenticateToken,
  [body('publicKey').notEmpty().withMessage('publicKey is required')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const identity = await didService.addVerificationMethod(req.params.did, req.body);
      res.json({ success: true, data: identity });
    } catch (error) {
      handleError(res, error);
    }
  },
);

/**
 * @openapi
 * /api/did/{did}/rotate-key:
 *   post:
 *     tags: [DID]
 *     summary: Rotate a DID's verification keys (retired keys remain verifiable)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newPublicKey]
 *             properties:
 *               newPublicKey:
 *                 type: string
 *               keyType:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Keys rotated
 */
router.post(
  '/:did/rotate-key',
  authenticateToken,
  [body('newPublicKey').notEmpty().withMessage('newPublicKey is required')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const identity = await didService.rotateKey(req.params.did, {
        publicKey: req.body.newPublicKey,
        keyType: req.body.keyType,
      });
      res.json({ success: true, data: identity });
    } catch (error) {
      handleError(res, error);
    }
  },
);

/**
 * @openapi
 * /api/did/{did}/keys/{keyId}/revoke:
 *   post:
 *     tags: [DID]
 *     summary: Explicitly revoke a verification method
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: keyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Verification method revoked
 */
router.post(
  '/:did/keys/:keyId/revoke',
  authenticateToken,
  [param('keyId').notEmpty().withMessage('keyId is required')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const identity = await didService.revokeVerificationMethod(req.params.did, req.params.keyId);
      res.json({ success: true, data: identity });
    } catch (error) {
      handleError(res, error);
    }
  },
);

/**
 * @openapi
 * /api/did/{did}/deactivate:
 *   post:
 *     tags: [DID]
 *     summary: Deactivate a DID (all keys stop verifying)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: DID deactivated
 */
router.post(
  '/:did/deactivate',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const identity = await didService.deactivateDid(req.params.did);
      res.json({ success: true, data: identity });
    } catch (error) {
      handleError(res, error);
    }
  },
);

/**
 * @openapi
 * /api/did/{did}/verify:
 *   post:
 *     tags: [DID]
 *     summary: Verify an Ed25519 signature against a DID's verification keys
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message, signature]
 *             properties:
 *               message:
 *                 type: string
 *               signature:
 *                 type: string
 *               keyId:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Signature verification result
 */
router.post(
  '/:did/verify',
  [
    body('message').notEmpty().withMessage('message is required'),
    body('signature').notEmpty().withMessage('signature is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const result = await didService.verifySignature({
        did: req.params.did,
        message: req.body.message,
        signature: req.body.signature,
        keyId: req.body.keyId,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      handleError(res, error);
    }
  },
);

/**
 * @openapi
 * /api/did/{did}/verify-key/{keyId}:
 *   get:
 *     tags: [DID]
 *     summary: Check whether a verification method can currently verify for a DID
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: keyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Key validity result
 */
router.get('/:did/verify-key/:keyId', async (req: Request, res: Response) => {
  try {
    const result = await didService.verifyKey(req.params.did, req.params.keyId);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * @openapi
 * /api/did/{did}/credentials:
 *   post:
 *     tags: [DID]
 *     summary: Record an issued credential against the holder's DID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [credentialId]
 *             properties:
 *               credentialId:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Credential recorded
 */
router.post(
  '/:did/credentials',
  authenticateToken,
  [body('credentialId').notEmpty().withMessage('credentialId is required')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const identity = await didService.recordCredential(req.params.did, req.body.credentialId);
      res.json({ success: true, data: identity });
    } catch (error) {
      handleError(res, error);
    }
  },
);

/**
 * @openapi
 * /api/did/{did}/credentials:
 *   get:
 *     tags: [DID]
 *     summary: List credentials recorded against a DID
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Credential references listed
 */
router.get('/:did/credentials', async (req: Request, res: Response) => {
  try {
    const credentials = await didService.getCredentials(req.params.did);
    res.json({ success: true, data: { credentials } });
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
