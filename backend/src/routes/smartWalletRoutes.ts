/**
 * Smart Wallet Routes
 * API endpoints for smart contract wallet operations
 */

import { Router, RequestHandler } from 'express';
import * as smartWalletController from '../controllers/smartWalletController';
import { authenticate } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router: Router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * @route   POST /api/smart-wallet/create
 * @desc    Create a new smart contract wallet
 * @access  Private
 */
router.post(
  '/create',
  [
    body('ownerAddress').isEthereumAddress().withMessage('Invalid owner address'),
    body('guardians').optional().isArray().withMessage('Guardians must be an array'),
    body('guardians.*.address').optional().isEthereumAddress().withMessage('Invalid guardian address'),
    body('threshold').optional().isInt({ min: 1 }).withMessage('Threshold must be at least 1'),
    handleValidationErrors,
  ],
  smartWalletController.createSmartWallet
);

/**
 * @route   POST /api/smart-wallet/execute
 * @desc    Execute a transaction through smart wallet
 * @access  Private
 */
router.post(
  '/execute',
  [
    body('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    body('to').isEthereumAddress().withMessage('Invalid recipient address'),
    body('value').isString().withMessage('Value must be a string'),
    body('data').isString().withMessage('Data must be a string'),
    body('signature').isString().withMessage('Signature is required'),
    handleValidationErrors,
  ],
  smartWalletController.executeTransaction
);

/**
 * @route   POST /api/smart-wallet/execute-batch
 * @desc    Execute batch transactions
 * @access  Private
 */
router.post(
  '/execute-batch',
  [
    body('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    body('transactions').isArray({ min: 1 }).withMessage('Transactions array is required'),
    body('transactions.*.to').isEthereumAddress().withMessage('Invalid recipient address'),
    body('transactions.*.value').isString().withMessage('Value must be a string'),
    body('transactions.*.data').isString().withMessage('Data must be a string'),
    body('signature').isString().withMessage('Signature is required'),
    handleValidationErrors,
  ],
  smartWalletController.executeBatchTransactions
);

/**
 * @route   POST /api/smart-wallet/social-recovery/setup
 * @desc    Setup social recovery for wallet
 * @access  Private
 */
router.post(
  '/social-recovery/setup',
  [
    body('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    body('guardians').isArray({ min: 1 }).withMessage('At least one guardian is required'),
    body('guardians.*.address').isEthereumAddress().withMessage('Invalid guardian address'),
    body('threshold').isInt({ min: 1 }).withMessage('Threshold must be at least 1'),
    handleValidationErrors,
  ],
  smartWalletController.setupSocialRecovery
);

/**
 * @route   POST /api/smart-wallet/social-recovery/initiate
 * @desc    Initiate wallet recovery
 * @access  Private
 */
router.post(
  '/social-recovery/initiate',
  [
    body('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    body('newOwner').isEthereumAddress().withMessage('Invalid new owner address'),
    body('guardianAddress').isEthereumAddress().withMessage('Invalid guardian address'),
    body('guardianSignature').isString().withMessage('Guardian signature is required'),
    handleValidationErrors,
  ],
  smartWalletController.initiateRecovery
);

/**
 * @route   POST /api/smart-wallet/social-recovery/support
 * @desc    Support a recovery request
 * @access  Private
 */
router.post(
  '/social-recovery/support',
  [
    body('recoveryId').isString().withMessage('Recovery ID is required'),
    body('guardianAddress').isEthereumAddress().withMessage('Invalid guardian address'),
    body('guardianSignature').isString().withMessage('Guardian signature is required'),
    handleValidationErrors,
  ],
  smartWalletController.supportRecovery
);

/**
 * @route   GET /api/smart-wallet/social-recovery/:recoveryId
 * @desc    Get recovery request details
 * @access  Private
 */
router.get(
  '/social-recovery/:recoveryId',
  [
    param('recoveryId').isString().withMessage('Recovery ID is required'),
    handleValidationErrors,
  ],
  smartWalletController.getRecoveryRequest
);

/**
 * @route   POST /api/smart-wallet/multi-sig/setup
 * @desc    Setup multi-signature for wallet
 * @access  Private
 */
router.post(
  '/multi-sig/setup',
  [
    body('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    body('signers').isArray({ min: 1 }).withMessage('At least one signer is required'),
    body('signers.*').isEthereumAddress().withMessage('Invalid signer address'),
    body('threshold').isInt({ min: 1 }).withMessage('Threshold must be at least 1'),
    handleValidationErrors,
  ],
  smartWalletController.setupMultiSig
);

/**
 * @route   POST /api/smart-wallet/multi-sig/propose
 * @desc    Propose a multi-sig transaction
 * @access  Private
 */
router.post(
  '/multi-sig/propose',
  [
    body('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    body('to').isEthereumAddress().withMessage('Invalid recipient address'),
    body('value').isString().withMessage('Value must be a string'),
    body('data').isString().withMessage('Data must be a string'),
    body('proposer').isEthereumAddress().withMessage('Invalid proposer address'),
    handleValidationErrors,
  ],
  smartWalletController.proposeTransaction
);

/**
 * @route   GET /api/smart-wallet/multi-sig/:walletAddress/pending
 * @desc    Get pending multi-sig transactions
 * @access  Private
 */
router.get(
  '/multi-sig/:walletAddress/pending',
  [
    param('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    handleValidationErrors,
  ],
  smartWalletController.getPendingTransactions
);

/**
 * @route   POST /api/smart-wallet/session-key/create
 * @desc    Create a session key
 * @access  Private
 */
router.post(
  '/session-key/create',
  [
    body('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    body('permissions').isObject().withMessage('Permissions object is required'),
    body('permissions.allowedContracts').optional().isArray().withMessage('Allowed contracts must be an array'),
    body('permissions.allowedMethods').optional().isArray().withMessage('Allowed methods must be an array'),
    body('permissions.spendingLimit').isString().withMessage('Spending limit must be a string'),
    body('validUntil').isISO8601().withMessage('Valid until must be a valid date'),
    handleValidationErrors,
  ],
  smartWalletController.createSessionKey
);

/**
 * @route   GET /api/smart-wallet/session-key/:walletAddress
 * @desc    Get active session keys
 * @access  Private
 */
router.get(
  '/session-key/:walletAddress',
  [
    param('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    handleValidationErrors,
  ],
  smartWalletController.getActiveSessionKeys
);

/**
 * @route   GET /api/smart-wallet/activity/:walletAddress
 * @desc    Get wallet activity
 * @access  Private
 */
router.get(
  '/activity/:walletAddress',
  [
    param('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
    handleValidationErrors,
  ],
  smartWalletController.getWalletActivity
);

/**
 * @route   GET /api/smart-wallet/activity/:walletAddress/alerts
 * @desc    Get activity alerts
 * @access  Private
 */
router.get(
  '/activity/:walletAddress/alerts',
  [
    param('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    query('acknowledged').optional().isBoolean().withMessage('Acknowledged must be a boolean'),
    handleValidationErrors,
  ],
  smartWalletController.getActivityAlerts
);

/**
 * @route   GET /api/smart-wallet/credentials/renewal-stats
 * @desc    Get credential renewal statistics
 * @access  Private
 */
router.get(
  '/credentials/renewal-stats',
  smartWalletController.getCredentialRenewalStats
);

/**
 * @route   POST /api/smart-wallet/credentials/enable-auto-renewal
 * @desc    Enable auto-renewal for credential
 * @access  Private
 */
router.post(
  '/credentials/enable-auto-renewal',
  [
    body('credentialId').isString().withMessage('Credential ID is required'),
    body('renewalThreshold').isInt({ min: 1 }).withMessage('Renewal threshold must be at least 1'),
    handleValidationErrors,
  ],
  smartWalletController.enableAutoRenewal
);

export default router;
