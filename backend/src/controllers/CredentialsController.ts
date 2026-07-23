/**
 * Credentials Controller
 *
 * Companion controller for the Idempotency-Key middleware that powers
 * issue #264. Exposes a single mutation endpoint (`POST /`) that issues
 * a credential; duplicate `Idempotency-Key` requests are deduped by
 * the middleware so retries are safe.
 */

import { Request, Response } from 'express';
import { credentialService } from '../services/credentialService';
import { CredentialType } from '../models/Credential';
import { UserRole } from '../models/User';

const ALLOWED_TYPES: CredentialType[] = [
  'course-completion',
  'skill',
  'achievement',
  'participation',
];

export class CredentialsController {
  /**
   * POST /api/credentials
   * Issue a new credential. Requires `educator` or `admin`.
   */
  static async issueCredential(req: Request, res: Response): Promise<void> {
    try {
      const issuerId = req.user?.id;
      const issuerRole = req.user?.role;
      if (!issuerId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      if (
        issuerRole !== UserRole.EDUCATOR &&
        issuerRole !== UserRole.ADMIN &&
        issuerRole !== 'INSTRUCTOR'
      ) {
        res
          .status(403)
          .json({ success: false, message: 'Insufficient permissions' });
        return;
      }

      const {
        recipientId,
        recipientAddress,
        type,
        title,
        description,
        courseId,
        expiresAt,
        metadata,
      } = req.body ?? {};

      if (!recipientId || typeof recipientId !== 'string') {
        res.status(400).json({
          success: false,
          message: 'recipientId is required',
        });
        return;
      }
      if (!title || typeof title !== 'string') {
        res
          .status(400)
          .json({ success: false, message: 'title is required' });
        return;
      }
      if (!type || !ALLOWED_TYPES.includes(type)) {
        res.status(400).json({
          success: false,
          message: `type must be one of: ${ALLOWED_TYPES.join(', ')}`,
        });
        return;
      }

      const credential = await credentialService.createCredential({
        issuerId,
        recipientId,
        recipientAddress,
        type,
        title,
        description,
        courseId,
        expiresAt,
        metadata,
      });

      res.status(201).json({ success: true, data: credential });
    } catch (error) {
      console.error('Error issuing credential:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to issue credential',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/credentials/:id
   */
  static async getCredential(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const credential = await credentialService.getCredential(id);
      if (!credential) {
        res
          .status(404)
          .json({ success: false, message: 'Credential not found' });
        return;
      }

      const isOwner = credential.recipientId === userId;
      const isIssuer = credential.issuerId === userId;
      const isAdmin =
        userRole === UserRole.ADMIN || userRole === 'admin';

      if (!isOwner && !isIssuer && !isAdmin) {
        res
          .status(403)
          .json({ success: false, message: 'Access denied' });
        return;
      }

      res.json({ success: true, data: credential });
    } catch (error) {
      console.error('Error fetching credential:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch credential',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/credentials/recipient/:recipientId
   */
  static async listRecipientCredentials(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { recipientId } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      const isSelf = userId === recipientId;
      const isAdmin =
        userRole === UserRole.ADMIN || userRole === 'admin';
      if (!isSelf && !isAdmin) {
        res
          .status(403)
          .json({ success: false, message: 'Access denied' });
        return;
      }

      const list = await credentialService.listCredentialsForRecipient(
        recipientId
      );
      res.json({ success: true, data: list, count: list.length });
    } catch (error) {
      console.error('Error listing credentials:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to list credentials',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
