import express, { Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { crossProtocolBridgeService } from '../services/crossProtocolBridgeService';
import { authenticateToken } from '../middleware/auth';
import logger from '../utils/logger';

const router: import('express').Router = express.Router();

const validateRequest = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array() 
    });
  }
  next();
};

/**
 * @route   POST /api/bridge/send
 * @desc    Send a cross-chain message
 * @access  Private
 */
router.post(
  '/send',
  authenticateToken,
  [
    body('destinationChain').isInt({ min: 0 }).withMessage('Valid destination chain required'),
    body('payload').notEmpty().withMessage('Payload is required'),
    body('messageType').isIn(['CredentialVerification', 'DataSync', 'TokenTransfer', 'GovernanceVote', 'Custom']),
    body('gasLimit').isInt({ min: 1 }).withMessage('Gas limit must be positive'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { destinationChain, payload, messageType, gasLimit } = req.body;
      const sender = (req.user as any)?.address;

      if (!sender) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized' 
        });
      }

      const messageId = await crossProtocolBridgeService.sendMessage(
        sender,
        destinationChain,
        payload,
        messageType,
        parseInt(gasLimit)
      );

      res.status(201).json({
        success: true,
        data: { messageId },
        message: 'Cross-chain message sent successfully',
      });
    } catch (error: any) {
      logger.error('Error sending message:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to send message',
      });
    }
  }
);

/**
 * @route   GET /api/bridge/message/:messageId
 * @desc    Get cross-chain message details
 * @access  Private
 */
router.get(
  '/message/:messageId',
  authenticateToken,
  [
    param('messageId').notEmpty().withMessage('Message ID is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { messageId } = req.params;

      const message = await crossProtocolBridgeService.getMessage(messageId);

      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message not found',
        });
      }

      res.json({
        success: true,
        data: message,
      });
    } catch (error: any) {
      logger.error('Error getting message:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get message',
      });
    }
  }
);

/**
 * @route   GET /api/bridge/user/:user/messages
 * @desc    Get all messages by user
 * @access  Private
 */
router.get(
  '/user/:user/messages',
  authenticateToken,
  [
    param('user').notEmpty().withMessage('User address is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { user } = req.params;

      const messages = await crossProtocolBridgeService.getMessagesBySender(user);

      res.json({
        success: true,
        data: messages,
        count: messages.length,
      });
    } catch (error: any) {
      logger.error('Error getting messages:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get messages',
      });
    }
  }
);

/**
 * @route   POST /api/bridge/batch
 * @desc    Batch multiple messages for gas optimization
 * @access  Private
 */
router.post(
  '/batch',
  authenticateToken,
  [
    body('messageIds').isArray({ min: 1 }).withMessage('Message IDs must be an array'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { messageIds } = req.body;

      const batchId = await crossProtocolBridgeService.batchMessages(messageIds);

      res.status(201).json({
        success: true,
        data: { batchId },
        message: `Batched ${messageIds.length} messages successfully`,
      });
    } catch (error: any) {
      logger.error('Error batching messages:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to batch messages',
      });
    }
  }
);

/**
 * @route   POST /api/bridge/proof
 * @desc    Submit state proof for verification
 * @access  Private
 */
router.post(
  '/proof',
  authenticateToken,
  [
    body('blockNumber').isInt({ min: 0 }).withMessage('Valid block number required'),
    body('stateRoot').notEmpty().withMessage('State root is required'),
    body('proofData').notEmpty().withMessage('Proof data is required'),
    body('validatorSignatures').isArray({ min: 3 }).withMessage('Minimum 3 validator signatures required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { blockNumber, stateRoot, proofData, validatorSignatures } = req.body;

      const proofId = await crossProtocolBridgeService.submitStateProof(
        parseInt(blockNumber),
        stateRoot,
        proofData,
        validatorSignatures
      );

      res.status(201).json({
        success: true,
        data: { proofId },
        message: 'State proof submitted successfully',
      });
    } catch (error: any) {
      logger.error('Error submitting proof:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to submit proof',
      });
    }
  }
);

/**
 * @route   POST /api/bridge/proof/:proofId/verify
 * @desc    Verify state proof
 * @access  Private
 */
router.post(
  '/proof/:proofId/verify',
  authenticateToken,
  [
    param('proofId').notEmpty().withMessage('Proof ID is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { proofId } = req.params;

      const isValid = await crossProtocolBridgeService.verifyStateProof(proofId);

      res.json({
        success: true,
        data: { isValid },
        message: isValid ? 'Proof verified successfully' : 'Proof verification failed',
      });
    } catch (error: any) {
      logger.error('Error verifying proof:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to verify proof',
      });
    }
  }
);

/**
 * @route   GET /api/bridge/gas-cost/:destinationChain/:gasLimit
 * @desc    Calculate gas cost for cross-chain message
 * @access  Private
 */
router.get(
  '/gas-cost/:destinationChain/:gasLimit',
  authenticateToken,
  [
    param('destinationChain').isInt({ min: 0 }).withMessage('Valid chain ID required'),
    param('gasLimit').isInt({ min: 1 }).withMessage('Gas limit must be positive'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { destinationChain, gasLimit } = req.params;

      const gasCost = crossProtocolBridgeService.calculateGasCost(
        parseInt(destinationChain),
        parseInt(gasLimit)
      );

      res.json({
        success: true,
        data: {
          destinationChain: parseInt(destinationChain),
          gasLimit: parseInt(gasLimit),
          gasCost,
        },
      });
    } catch (error: any) {
      logger.error('Error calculating gas cost:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate gas cost',
      });
    }
  }
);

/**
 * @route   GET /api/bridge/stats
 * @desc    Get bridge statistics
 * @access  Private
 */
router.get(
  '/stats',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const stats = await crossProtocolBridgeService.getStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Error getting stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get statistics',
      });
    }
  }
);

export default router;
