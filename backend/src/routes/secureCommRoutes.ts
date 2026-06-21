import express from 'express';
import secureCommController from '../controllers/secureCommController';
import { authenticateToken } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validation';
import { body, param } from 'express-validator';

const router: import('express').Router = express.Router();

/**
 * @route   POST /api/secure-comm/generate-keypair
 * @desc    Generate quantum-resistant key pair
 * @access  Private
 */
router.post(
  '/generate-keypair',
  authenticateToken,
  secureCommController.generateKeyPair
);

/**
 * @route   POST /api/secure-comm/establish-secret
 * @desc    Establish shared secret between users
 * @access  Private
 */
router.post(
  '/establish-secret',
  authenticateToken,
  [
    body('privateKey').notEmpty().withMessage('Private key is required'),
    body('peerPublicKey').notEmpty().withMessage('Peer public key is required'),
    body('userId').notEmpty().withMessage('User ID is required'),
    body('peerId').notEmpty().withMessage('Peer ID is required')
  ],
  handleValidationErrors,
  secureCommController.establishSharedSecret
);

/**
 * @route   POST /api/secure-comm/encrypt
 * @desc    Encrypt message
 * @access  Private
 */
router.post(
  '/encrypt',
  authenticateToken,
  [
    body('message').notEmpty().withMessage('Message is required'),
    body('sharedSecret').notEmpty().withMessage('Shared secret is required')
  ],
  handleValidationErrors,
  secureCommController.encryptMessage
);

/**
 * @route   POST /api/secure-comm/decrypt
 * @desc    Decrypt message
 * @access  Private
 */
router.post(
  '/decrypt',
  authenticateToken,
  [
    body('ciphertext').notEmpty().withMessage('Ciphertext is required'),
    body('nonce').notEmpty().withMessage('Nonce is required'),
    body('sharedSecret').notEmpty().withMessage('Shared secret is required')
  ],
  handleValidationErrors,
  secureCommController.decryptMessage
);

/**
 * @route   POST /api/secure-comm/sign
 * @desc    Sign message
 * @access  Private
 */
router.post(
  '/sign',
  authenticateToken,
  [
    body('message').notEmpty().withMessage('Message is required'),
    body('privateKey').notEmpty().withMessage('Private key is required')
  ],
  handleValidationErrors,
  secureCommController.signMessage
);

/**
 * @route   POST /api/secure-comm/verify
 * @desc    Verify message signature
 * @access  Private
 */
router.post(
  '/verify',
  authenticateToken,
  [
    body('message').notEmpty().withMessage('Message is required'),
    body('signature').notEmpty().withMessage('Signature is required'),
    body('publicKey').notEmpty().withMessage('Public key is required')
  ],
  handleValidationErrors,
  secureCommController.verifySignature
);

/**
 * @route   GET /api/secure-comm/stats/:userId
 * @desc    Get communication statistics
 * @access  Private
 */
router.get(
  '/stats/:userId',
  authenticateToken,
  [param('userId').notEmpty().withMessage('User ID is required')],
  handleValidationErrors,
  secureCommController.getStats
);

export default router;
