import express, { Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { timeLockCredentialService } from '../services/timeLockCredentialService';
import { authenticateToken } from '../middleware/auth';
import logger from '../utils/logger';

const router: import('express').Router = express.Router();

// Middleware to validate requests
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
 * @route   POST /api/time-lock/issue
 * @desc    Issue a new time-locked credential
 * @access  Private (Institutions only)
 */
router.post(
  '/issue',
  authenticateToken,
  [
    body('recipient').notEmpty().withMessage('Recipient address is required'),
    body('credentialHash').notEmpty().withMessage('Credential hash is required'),
    body('metadata').notEmpty().withMessage('Metadata is required'),
    body('releaseTime').isISO8601().withMessage('Valid release time is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { recipient, credentialHash, metadata, releaseTime } = req.body;
      const issuer = (req.user as any)?.address; // From auth middleware

      if (!issuer) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized' 
        });
      }

      const credential = await timeLockCredentialService.issueCredential({
        issuer,
        recipient,
        credentialHash,
        metadata,
        releaseTime: new Date(releaseTime),
      });

      res.status(201).json({
        success: true,
        data: credential,
        message: 'Time-locked credential issued successfully',
      });
    } catch (error: any) {
      logger.error('Error issuing credential:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to issue credential',
      });
    }
  }
);

/**
 * @route   POST /api/time-lock/release/:credentialId
 * @desc    Release a time-locked credential
 * @access  Private
 */
router.post(
  '/release/:credentialId',
  authenticateToken,
  [
    param('credentialId').notEmpty().withMessage('Credential ID is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { credentialId } = req.params;
      const caller = (req.user as any)?.address;

      if (!caller) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized' 
        });
      }

      const credential = await timeLockCredentialService.releaseCredential(
        credentialId,
        caller
      );

      res.json({
        success: true,
        data: credential,
        message: 'Credential released successfully',
      });
    } catch (error: any) {
      logger.error('Error releasing credential:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      
      if (error.message.includes('Time lock') || 
          error.message.includes('Already released') || 
          error.message.includes('Revoked')) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to release credential',
      });
    }
  }
);

/**
 * @route   POST /api/time-lock/batch-release
 * @desc    Batch release multiple credentials
 * @access  Private
 */
router.post(
  '/batch-release',
  authenticateToken,
  [
    body('credentialIds').isArray({ min: 1 }).withMessage('Credential IDs must be an array with at least one item'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { credentialIds } = req.body;
      const caller = (req.user as any)?.address;

      if (!caller) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized' 
        });
      }

      const results = await timeLockCredentialService.batchReleaseCredentials(
        credentialIds,
        caller
      );

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      res.json({
        success: true,
        data: {
          results,
          summary: {
            total: results.length,
            successful: successCount,
            failed: failCount,
          },
        },
        message: `Batch release completed: ${successCount}/${results.length} successful`,
      });
    } catch (error: any) {
      logger.error('Error in batch release:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process batch release',
      });
    }
  }
);

/**
 * @route   POST /api/time-lock/emergency-revoke/:credentialId
 * @desc    Emergency revoke a credential
 * @access  Private (Admin only)
 */
router.post(
  '/emergency-revoke/:credentialId',
  authenticateToken,
  [
    param('credentialId').notEmpty().withMessage('Credential ID is required'),
    body('reason').notEmpty().withMessage('Revoke reason is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { credentialId } = req.params;
      const { reason } = req.body;
      const admin = (req.user as any)?.address;

      if (!admin) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized' 
        });
      }

      // Check if user has emergency admin privileges
      const emergencyAdmin = process.env.EMERGENCY_ADMIN_ADDRESS;
      if (admin !== emergencyAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Emergency admin privileges required',
        });
      }

      const credential = await timeLockCredentialService.emergencyRevoke(
        credentialId,
        admin,
        reason
      );

      res.json({
        success: true,
        data: credential,
        message: 'Credential emergency revoked successfully',
      });
    } catch (error: any) {
      logger.error('Error in emergency revoke:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(400).json({
        success: false,
        message: error.message || 'Failed to emergency revoke credential',
      });
    }
  }
);

/**
 * @route   POST /api/time-lock/schedule
 * @desc    Create a release schedule for multiple credentials
 * @access  Private
 */
router.post(
  '/schedule',
  authenticateToken,
  [
    body('credentialIds').isArray({ min: 1 }).withMessage('Credential IDs must be an array'),
    body('releaseTimes').isArray({ min: 1 }).withMessage('Release times must be an array'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { credentialIds, releaseTimes } = req.body;
      const creator = (req.user as any)?.address;

      if (!creator) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized' 
        });
      }

      const scheduleId = await timeLockCredentialService.createReleaseSchedule({
        creator,
        credentialIds,
        releaseTimes: releaseTimes.map((t: string) => new Date(t)),
      });

      res.status(201).json({
        success: true,
        data: { scheduleId },
        message: 'Release schedule created successfully',
      });
    } catch (error: any) {
      logger.error('Error creating schedule:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create schedule',
      });
    }
  }
);

/**
 * @route   GET /api/time-lock/upcoming/:recipient
 * @desc    Get upcoming releases for notification
 * @access  Private
 */
router.get(
  '/upcoming/:recipient',
  authenticateToken,
  [
    param('recipient').notEmpty().withMessage('Recipient address is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { recipient } = req.params;
      const timeWindow = parseInt(req.query.timeWindow as string) || 86400000; // Default 24h

      const upcoming = await timeLockCredentialService.getUpcomingReleases(
        recipient,
        timeWindow
      );

      res.json({
        success: true,
        data: upcoming,
        count: upcoming.length,
      });
    } catch (error: any) {
      logger.error('Error getting upcoming releases:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get upcoming releases',
      });
    }
  }
);

/**
 * @route   GET /api/time-lock/recipient/:recipient
 * @desc    Get all credentials by recipient
 * @access  Private
 */
router.get(
  '/recipient/:recipient',
  authenticateToken,
  [
    param('recipient').notEmpty().withMessage('Recipient address is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { recipient } = req.params;

      const credentials = await timeLockCredentialService.getCredentialsByRecipient(
        recipient
      );

      res.json({
        success: true,
        data: credentials,
        count: credentials.length,
      });
    } catch (error: any) {
      logger.error('Error getting credentials:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get credentials',
      });
    }
  }
);

/**
 * @route   GET /api/time-lock/issuer/:issuer
 * @desc    Get all credentials by issuer
 * @access  Private
 */
router.get(
  '/issuer/:issuer',
  authenticateToken,
  [
    param('issuer').notEmpty().withMessage('Issuer address is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { issuer } = req.params;

      const credentials = await timeLockCredentialService.getCredentialsByIssuer(
        issuer
      );

      res.json({
        success: true,
        data: credentials,
        count: credentials.length,
      });
    } catch (error: any) {
      logger.error('Error getting credentials:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get credentials',
      });
    }
  }
);

/**
 * @route   GET /api/time-lock/audit/:credentialId
 * @desc    Get audit trail for a credential
 * @access  Private
 */
router.get(
  '/audit/:credentialId',
  authenticateToken,
  [
    param('credentialId').notEmpty().withMessage('Credential ID is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { credentialId } = req.params;

      const auditTrail = await timeLockCredentialService.getAuditTrail(credentialId);

      res.json({
        success: true,
        data: auditTrail,
      });
    } catch (error: any) {
      logger.error('Error getting audit trail:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to get audit trail',
      });
    }
  }
);

export default router;
