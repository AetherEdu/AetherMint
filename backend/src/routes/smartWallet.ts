/**
 * Smart Wallet Routes
 * API endpoints for smart contract wallet operations
 */

import express, { Request, Response } from 'express';
import * as smartWalletController from '../controllers/smartWalletController';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router: import('express').Router = express.Router();
const wrap = (fn: any) => (req: Request, res: Response) => fn(req, res);

// Apply authentication middleware to all routes
router.use(authenticate as any);

router.post('/create', validateRequest as any, wrap(smartWalletController.createSmartWallet) as any);
router.post('/execute', validateRequest as any, wrap(smartWalletController.executeTransaction) as any);
router.post('/execute-batch', validateRequest as any, wrap(smartWalletController.executeBatchTransactions) as any);
router.post('/recovery/setup', validateRequest as any, wrap(smartWalletController.setupSocialRecovery) as any);
router.post('/recovery/initiate', validateRequest as any, wrap(smartWalletController.initiateRecovery) as any);
router.post('/recovery/support', validateRequest as any, wrap(smartWalletController.supportRecovery) as any);
router.get('/recovery/:recoveryId', wrap(smartWalletController.getRecoveryRequest) as any);
router.post('/multisig/setup', validateRequest as any, wrap(smartWalletController.setupMultiSig) as any);
router.post('/multisig/propose', validateRequest as any, wrap(smartWalletController.proposeTransaction) as any);
router.get('/multisig/pending/:walletAddress', wrap(smartWalletController.getPendingTransactions) as any);
router.post('/session-key/create', validateRequest as any, wrap(smartWalletController.createSessionKey) as any);
router.get('/session-key/active/:walletAddress', wrap(smartWalletController.getActiveSessionKeys) as any);
router.get('/activity/:walletAddress', wrap(smartWalletController.getWalletActivity) as any);
router.get('/alerts/:walletAddress', wrap(smartWalletController.getActivityAlerts) as any);
router.get('/credentials/stats', wrap(smartWalletController.getCredentialRenewalStats) as any);
router.post('/credentials/auto-renewal', validateRequest as any, wrap(smartWalletController.enableAutoRenewal) as any);

export default router;
