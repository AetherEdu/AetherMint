import express, { Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { vrfService } from '../services/vrfService';
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
 * @route   POST /api/vrf/request
 * @desc    Request verifiable random number
 * @access  Private
 */
router.post(
  '/request',
  authenticateToken,
  [
    body('seed').notEmpty().withMessage('Seed is required'),
    body('purpose').notEmpty().withMessage('Purpose is required'),
    body('context').optional(),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { seed, purpose, context } = req.body;
      const requester = (req.user as any)?.address;

      if (!requester) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized' 
        });
      }

      const requestId = await vrfService.requestRandomness(
        requester,
        seed,
        purpose,
        context || ''
      );

      res.status(201).json({
        success: true,
        data: { requestId },
        message: 'VRF request created successfully',
      });
    } catch (error: any) {
      logger.error('Error requesting randomness:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to request randomness',
      });
    }
  }
);

/**
 * @route   POST /api/vrf/generate
 * @desc    Generate random number for specific purpose
 * @access  Private
 */
router.post(
  '/generate',
  authenticateToken,
  [
    body('purpose').notEmpty().withMessage('Purpose is required'),
    body('seed').notEmpty().withMessage('Seed is required'),
    body('min').isInt({ min: 0 }).withMessage('Minimum must be a positive integer'),
    body('max').isInt({ min: 0 }).withMessage('Maximum must be a positive integer'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { purpose, seed, min, max } = req.body;
      const requester = (req.user as any)?.address;

      if (!requester) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized' 
        });
      }

      const randomValue = await vrfService.generateRandomForPurpose(
        requester,
        purpose,
        seed,
        parseInt(min),
        parseInt(max)
      );

      res.json({
        success: true,
        data: {
          purpose,
          randomValue,
          range: { min, max },
        },
        message: 'Random value generated successfully',
      });
    } catch (error: any) {
      logger.error('Error generating random value:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to generate random value',
      });
    }
  }
);

/**
 * @route   GET /api/vrf/request/:requestId
 * @desc    Get VRF request details
 * @access  Private
 */
router.get(
  '/request/:requestId',
  authenticateToken,
  [
    param('requestId').notEmpty().withMessage('Request ID is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { requestId } = req.params;

      const request = await vrfService.getRequest(requestId);

      if (!request) {
        return res.status(404).json({
          success: false,
          message: 'Request not found',
        });
      }

      res.json({
        success: true,
        data: request,
      });
    } catch (error: any) {
      logger.error('Error getting request:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get request',
      });
    }
  }
);

/**
 * @route   GET /api/vrf/user/:user/requests
 * @desc    Get all VRF requests by user
 * @access  Private
 */
router.get(
  '/user/:user/requests',
  authenticateToken,
  [
    param('user').notEmpty().withMessage('User address is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { user } = req.params;

      const requests = await vrfService.getRequestsByUser(user);

      res.json({
        success: true,
        data: requests,
        count: requests.length,
      });
    } catch (error: any) {
      logger.error('Error getting requests:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get requests',
      });
    }
  }
);

/**
 * @route   GET /api/vrf/beacon/latest
 * @desc    Get latest randomness beacon
 * @access  Private
 */
router.get(
  '/beacon/latest',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const beacon = await vrfService.getLatestBeacon();

      if (!beacon) {
        return res.status(404).json({
          success: false,
          message: 'No beacon available',
        });
      }

      res.json({
        success: true,
        data: beacon,
      });
    } catch (error: any) {
      logger.error('Error getting beacon:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get beacon',
      });
    }
  }
);

/**
 * @route   GET /api/vrf/stats
 * @desc    Get VRF system statistics
 * @access  Private
 */
router.get(
  '/stats',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const stats = await vrfService.getStats();

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

/**
 * @route   POST /api/vrf/commit
 * @desc    Commit to a value (commit-reveal scheme)
 * @access  Private
 */
router.post(
  '/commit',
  authenticateToken,
  [
    body('commitmentHash').notEmpty().withMessage('Commitment hash is required'),
    body('validUntil').isISO8601().withMessage('Valid until date is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { commitmentHash, validUntil } = req.body;
      const committer = (req.user as any)?.address;

      if (!committer) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized' 
        });
      }

      await vrfService.commit(
        committer,
        commitmentHash,
        new Date(validUntil)
      );

      res.json({
        success: true,
        message: 'Commitment recorded successfully',
      });
    } catch (error: any) {
      logger.error('Error creating commitment:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create commitment',
      });
    }
  }
);

/**
 * @route   POST /api/vrf/reveal
 * @desc    Reveal committed value
 * @access  Private
 */
router.post(
  '/reveal',
  authenticateToken,
  [
    body('revealedValue').notEmpty().withMessage('Revealed value is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { revealedValue } = req.body;
      const committer = (req.user as any)?.address;

      if (!committer) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized' 
        });
      }

      const isValid = await vrfService.reveal(committer, revealedValue);

      res.json({
        success: true,
        data: {
          isValid,
          revealedValue,
        },
        message: 'Value revealed successfully',
      });
    } catch (error: any) {
      logger.error('Error revealing value:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to reveal value',
      });
    }
  }
);

export default router;
