/**
 * @openapi
 * tags:
 *   - name: Bridge Monitor
 *     description: Cross-chain bridge relayer monitoring and fraud proofs
 */

import express, { Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { bridgeMonitorService } from '../services/bridgeMonitor';
import { bridgeMonitorJob } from '../workers/bridgeMonitorJob';
import { authenticateToken } from '../middleware/auth';
import logger from '../utils/logger';

const router: import('express').Router = express.Router();

const validateRequest = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

/**
 * @openapi
 * /api/bridge-monitor/relayers:
 *   get:
 *     tags: [Bridge Monitor]
 *     summary: List monitored relayers
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Relayers listed
 */
router.get('/relayers', authenticateToken, (req: Request, res: Response) => {
  res.json({ success: true, data: { relayers: bridgeMonitorService.getRelayers() } });
});

/**
 * @openapi
 * /api/bridge-monitor/relayers:
 *   post:
 *     tags: [Bridge Monitor]
 *     summary: Register a staked relayer
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '201':
 *         description: Relayer registered
 */
router.post(
  '/relayers',
  authenticateToken,
  [
    body('address').notEmpty().withMessage('address is required'),
    body('stake').isNumeric().withMessage('stake must be a number'),
  ],
  validateRequest,
  (req: Request, res: Response) => {
    const { address, stake } = req.body;
    const relayer = bridgeMonitorService.registerRelayer(address, Number(stake));
    res.status(201).json({ success: true, data: relayer, message: 'Relayer registered' });
  },
);

/**
 * @openapi
 * /api/bridge-monitor/relayers/{address}/heartbeat:
 *   post:
 *     tags: [Bridge Monitor]
 *     summary: Record a relayer heartbeat
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Heartbeat recorded
 */
router.post(
  '/relayers/:address/heartbeat',
  authenticateToken,
  [param('address').notEmpty()],
  validateRequest,
  (req: Request, res: Response) => {
    const relayer = bridgeMonitorService.heartbeat(req.params.address);
    res.json({ success: true, data: relayer, message: 'Heartbeat recorded' });
  },
);

/**
 * @openapi
 * /api/bridge-monitor/attestations:
 *   get:
 *     tags: [Bridge Monitor]
 *     summary: List tracked attestations
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Attestations listed
 */
router.get('/attestations', authenticateToken, (req: Request, res: Response) => {
  res.json({ success: true, data: { attestations: bridgeMonitorService.getAttestations() } });
});

/**
 * @openapi
 * /api/bridge-monitor/attestations:
 *   post:
 *     tags: [Bridge Monitor]
 *     summary: Record an optimistic attestation
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '201':
 *         description: Attestation recorded
 */
router.post(
  '/attestations',
  authenticateToken,
  [
    body('relayer').notEmpty().withMessage('relayer is required'),
    body('messageId').notEmpty().withMessage('messageId is required'),
    body('sourceChain').isNumeric().withMessage('sourceChain must be a number'),
    body('destinationChain').isNumeric().withMessage('destinationChain must be a number'),
    body('stateRoot').notEmpty().withMessage('stateRoot is required'),
  ],
  validateRequest,
  (req: Request, res: Response) => {
    const { relayer, messageId, sourceChain, destinationChain, stateRoot } = req.body;
    const id = bridgeMonitorService.recordAttestation(
      relayer,
      messageId,
      Number(sourceChain),
      Number(destinationChain),
      stateRoot,
    );
    res.status(201).json({ success: true, data: { id }, message: 'Attestation recorded' });
  },
);

/**
 * @openapi
 * /api/bridge-monitor/attestations/{id}/fraud-proof:
 *   post:
 *     tags: [Bridge Monitor]
 *     summary: Submit a fraud proof against a pending attestation
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Fraud proof submitted
 */
router.post(
  '/attestations/:id/fraud-proof',
  authenticateToken,
  [body('evidence').notEmpty().withMessage('evidence is required')],
  validateRequest,
  (req: Request, res: Response) => {
    const ok = bridgeMonitorService.submitFraudProof(req.params.id, req.body.evidence);
    res.json({ success: true, data: { slashed: ok }, message: 'Fraud proof submitted' });
  },
);

/**
 * @openapi
 * /api/bridge-monitor/sweep:
 *   post:
 *     tags: [Bridge Monitor]
 *     summary: Run a monitoring sweep (liveness check + finalization)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Sweep completed
 */
router.post('/sweep', authenticateToken, async (req: Request, res: Response) => {
  const result = await bridgeMonitorJob.runOnce();
  res.json({ success: true, data: result, message: 'Sweep completed' });
});

/**
 * @openapi
 * /api/bridge-monitor/alerts:
 *   get:
 *     tags: [Bridge Monitor]
 *     summary: List bridge monitoring alerts
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Alerts listed
 */
router.get('/alerts', authenticateToken, (req: Request, res: Response) => {
  res.json({ success: true, data: { alerts: bridgeMonitorService.getAlerts() } });
});

/**
 * @openapi
 * /api/bridge-monitor/alerts/{id}/acknowledge:
 *   post:
 *     tags: [Bridge Monitor]
 *     summary: Acknowledge an alert
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Alert acknowledged
 */
router.post('/alerts/:id/acknowledge', authenticateToken, (req: Request, res: Response) => {
  const acknowledged = bridgeMonitorService.acknowledgeAlert(req.params.id);
  res.json({ success: acknowledged, message: acknowledged ? 'Alert acknowledged' : 'Alert not found' });
});

/**
 * @openapi
 * /api/bridge-monitor/stats:
 *   get:
 *     tags: [Bridge Monitor]
 *     summary: Bridge monitoring statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Statistics returned
 */
router.get('/stats', authenticateToken, (req: Request, res: Response) => {
  res.json({ success: true, data: bridgeMonitorJob.getStats() });
});

export default router;
