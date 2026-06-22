/**
 * @openapi
 * tags:
 *   - name: Smart Wallet
 *     description: Smart contract wallet operations including multisig, recovery, session keys
 */

import express, { Request, Response } from 'express';
import * as smartWalletController from '../controllers/smartWalletController';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router: import('express').Router = express.Router();
const wrap = (fn: any) => (req: Request, res: Response) => fn(req, res);

router.use(authenticate as any);

/**
 * @openapi
 * /api/smart-wallet/create:
 *   post:
 *     tags: [Smart Wallet]
 *     summary: Create smart wallet
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Wallet created
 */
router.post('/create', validateRequest as any, wrap(smartWalletController.createSmartWallet) as any);

/**
 * @openapi
 * /api/smart-wallet/execute:
 *   post:
 *     tags: [Smart Wallet]
 *     summary: Execute wallet transaction
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Transaction executed
 */
router.post('/execute', validateRequest as any, wrap(smartWalletController.executeTransaction) as any);

/**
 * @openapi
 * /api/smart-wallet/execute-batch:
 *   post:
 *     tags: [Smart Wallet]
 *     summary: Execute batch transactions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Batch executed
 */
router.post('/execute-batch', validateRequest as any, wrap(smartWalletController.executeBatchTransactions) as any);

/**
 * @openapi
 * /api/smart-wallet/recovery/setup:
 *   post:
 *     tags: [Smart Wallet]
 *     summary: Setup social recovery
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Recovery setup
 */
router.post('/recovery/setup', validateRequest as any, wrap(smartWalletController.setupSocialRecovery) as any);

/**
 * @openapi
 * /api/smart-wallet/recovery/initiate:
 *   post:
 *     tags: [Smart Wallet]
 *     summary: Initiate wallet recovery
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Recovery initiated
 */
router.post('/recovery/initiate', validateRequest as any, wrap(smartWalletController.initiateRecovery) as any);

/**
 * @openapi
 * /api/smart-wallet/recovery/support:
 *   post:
 *     tags: [Smart Wallet]
 *     summary: Support recovery request
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Recovery supported
 */
router.post('/recovery/support', validateRequest as any, wrap(smartWalletController.supportRecovery) as any);

/**
 * @openapi
 * /api/smart-wallet/recovery/{recoveryId}:
 *   get:
 *     tags: [Smart Wallet]
 *     summary: Get recovery request details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: recoveryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Recovery request retrieved
 */
router.get('/recovery/:recoveryId', wrap(smartWalletController.getRecoveryRequest) as any);

/**
 * @openapi
 * /api/smart-wallet/multisig/setup:
 *   post:
 *     tags: [Smart Wallet]
 *     summary: Setup multi-signature wallet
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Multi-sig setup
 */
router.post('/multisig/setup', validateRequest as any, wrap(smartWalletController.setupMultiSig) as any);

/**
 * @openapi
 * /api/smart-wallet/multisig/propose:
 *   post:
 *     tags: [Smart Wallet]
 *     summary: Propose multi-sig transaction
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Transaction proposed
 */
router.post('/multisig/propose', validateRequest as any, wrap(smartWalletController.proposeTransaction) as any);

/**
 * @openapi
 * /api/smart-wallet/multisig/pending/{walletAddress}:
 *   get:
 *     tags: [Smart Wallet]
 *     summary: Get pending multi-sig transactions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: walletAddress
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Pending transactions retrieved
 */
router.get('/multisig/pending/:walletAddress', wrap(smartWalletController.getPendingTransactions) as any);

/**
 * @openapi
 * /api/smart-wallet/session-key/create:
 *   post:
 *     tags: [Smart Wallet]
 *     summary: Create session key
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Session key created
 */
router.post('/session-key/create', validateRequest as any, wrap(smartWalletController.createSessionKey) as any);

/**
 * @openapi
 * /api/smart-wallet/session-key/active/{walletAddress}:
 *   get:
 *     tags: [Smart Wallet]
 *     summary: Get active session keys
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: walletAddress
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Session keys retrieved
 */
router.get('/session-key/active/:walletAddress', wrap(smartWalletController.getActiveSessionKeys) as any);

/**
 * @openapi
 * /api/smart-wallet/activity/{walletAddress}:
 *   get:
 *     tags: [Smart Wallet]
 *     summary: Get wallet activity
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: walletAddress
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Activity retrieved
 */
router.get('/activity/:walletAddress', wrap(smartWalletController.getWalletActivity) as any);

/**
 * @openapi
 * /api/smart-wallet/alerts/{walletAddress}:
 *   get:
 *     tags: [Smart Wallet]
 *     summary: Get wallet activity alerts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: walletAddress
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Alerts retrieved
 */
router.get('/alerts/:walletAddress', wrap(smartWalletController.getActivityAlerts) as any);

/**
 * @openapi
 * /api/smart-wallet/credentials/stats:
 *   get:
 *     tags: [Smart Wallet]
 *     summary: Get credential renewal statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Statistics retrieved
 */
router.get('/credentials/stats', wrap(smartWalletController.getCredentialRenewalStats) as any);

/**
 * @openapi
 * /api/smart-wallet/credentials/auto-renewal:
 *   post:
 *     tags: [Smart Wallet]
 *     summary: Enable auto-renewal for credentials
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Auto-renewal enabled
 */
router.post('/credentials/auto-renewal', validateRequest as any, wrap(smartWalletController.enableAutoRenewal) as any);

export default router;
