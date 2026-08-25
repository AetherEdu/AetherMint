/**
 * @openapi
 * tags:
 *   - name: DID Registry
 *     description: Self-sovereign identity (decentralized identifiers) for learners
 */

import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { authenticateToken } from '../middleware/auth';
import { validate, ValidationSchema } from '../middleware/validate';
import { createDidService, DidService } from '../services/did/didService';

const router: Router = Router();

const DID_REGEX = /^did:aethermint:G[A-Z2-7]{55}$/;
const WALLET_REGEX = /^G[A-Z2-7]{55}$/;
const KEY_HEX_REGEX = /^[0-9a-fA-F]{64}$/;
const SIGNATURE_HEX_REGEX = /^[0-9a-fA-F]{128}$/;

let service: DidService | null = null;
function getService(): DidService {
  if (!service) {
    service = createDidService();
  }
  return service;
}

const didParamSchema: ValidationSchema = {
  params: Joi.object({
    did: Joi.string().regex(DID_REGEX).required(),
  }),
};

const controllerParamSchema: ValidationSchema = {
  params: Joi.object({
    controller: Joi.string().regex(WALLET_REGEX).required(),
  }),
};

const registerSchema: ValidationSchema = {
  body: Joi.object({
    controller: Joi.string().regex(WALLET_REGEX).required(),
    verificationKey: Joi.string().regex(KEY_HEX_REGEX).required(),
    userId: Joi.string().optional(),
  }),
};

const rotateSchema: ValidationSchema = {
  body: Joi.object({
    did: Joi.string().regex(DID_REGEX).required(),
    newKey: Joi.string().regex(KEY_HEX_REGEX).required(),
    challenge: Joi.string().max(512).required(),
    signature: Joi.string().regex(SIGNATURE_HEX_REGEX).required(),
  }),
};

const deactivateSchema: ValidationSchema = {
  body: Joi.object({
    did: Joi.string().regex(DID_REGEX).required(),
  }),
};

const verifySchema: ValidationSchema = {
  body: Joi.object({
    did: Joi.string().regex(DID_REGEX).required(),
    message: Joi.string().max(512).required(),
    signature: Joi.string().regex(SIGNATURE_HEX_REGEX).required(),
  }),
};

const linkCredentialSchema: ValidationSchema = {
  params: Joi.object({
    did: Joi.string().regex(DID_REGEX).required(),
  }),
  body: Joi.object({
    credentialId: Joi.number().integer().positive().required(),
  }),
};

/**
 * @openapi
 * /api/did/register:
 *   post:
 *     tags: [DID Registry]
 *     summary: Register a DID bound to a wallet
 *     description: Creates a `did:aethermint:<wallet>` identity holding the given verification key. One DID per wallet.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '201':
 *         description: DID registered
 */
router.post(
  '/register',
  authenticateToken,
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const identity = await getService().registerDid(req.body);
      res.status(201).json({ success: true, data: identity });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /api/did/resolve/{did}:
 *   get:
 *     tags: [DID Registry]
 *     summary: Resolve a DID document
 *     responses:
 *       '200':
 *         description: DID document resolved
 */
router.get(
  '/resolve/:did',
  validate(didParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const identity = await getService().resolveDid(req.params.did);
      res.json({ success: true, data: identity });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /api/did/controller/{controller}:
 *   get:
 *     tags: [DID Registry]
 *     summary: Reverse lookup — the DID bound to a wallet
 *     responses:
 *       '200':
 *         description: DID found or null
 */
router.get(
  '/controller/:controller',
  validate(controllerParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const did = await getService().getDidForController(req.params.controller);
      res.json({ success: true, data: { did } });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /api/did/rotate:
 *   post:
 *     tags: [DID Registry]
 *     summary: Rotate a DID's verification key
 *     description: The new key must sign the challenge to prove possession. Old keys remain in the rotation history.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Key rotated
 */
router.post(
  '/rotate',
  authenticateToken,
  validate(rotateSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const identity = await getService().rotateDidKey(req.body);
      res.json({ success: true, data: identity });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /api/did/deactivate:
 *   post:
 *     tags: [DID Registry]
 *     summary: Deactivate a DID
 *     description: Stops signature verification without deleting the document or its history.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: DID deactivated
 */
router.post(
  '/deactivate',
  authenticateToken,
  validate(deactivateSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const identity = await getService().deactivateDid(req.body.did);
      res.json({ success: true, data: identity });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /api/did/verify:
 *   post:
 *     tags: [DID Registry]
 *     summary: Verify a signature against a DID's current key
 *     responses:
 *       '200':
 *         description: Verification result
 */
router.post(
  '/verify',
  validate(verifySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const valid = await getService().verifySignature(req.body);
      res.json({ success: true, data: { valid } });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /api/did/{did}/credentials:
 *   get:
 *     tags: [DID Registry]
 *     summary: Credentials issued to a DID's holder
 *     responses:
 *       '200':
 *         description: Credential id list
 */
router.get(
  '/:did/credentials',
  validate(didParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const credentialIds = await getService().getCredentialsForDid(req.params.did);
      res.json({ success: true, data: { credentialIds } });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /api/did/{did}/credentials:
 *   post:
 *     tags: [DID Registry]
 *     summary: Link an issued credential to a DID's holder
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Credential linked
 */
router.post(
  '/:did/credentials',
  authenticateToken,
  validate(linkCredentialSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const identity = await getService().linkCredential(req.params.did, req.body.credentialId);
      res.json({ success: true, data: identity });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /api/did/{did}/history:
 *   get:
 *     tags: [DID Registry]
 *     summary: Rotation history of a DID
 *     responses:
 *       '200':
 *         description: Rotation records
 */
router.get(
  '/:did/history',
  validate(didParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const keyHistory = await getService().getKeyHistory(req.params.did);
      res.json({ success: true, data: { keyHistory } });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
