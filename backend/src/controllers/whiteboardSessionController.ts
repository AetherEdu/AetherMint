/**
 * WhiteboardSessionController
 *
 * HTTP entry points for whiteboard persistence. All methods delegate to
 * `WhiteboardSessionStore`. We intentionally do not require authentication on
 * this controller — the route layer applies the project's auth middleware
 * ahead of these handlers in production. During tests, `req.user` may be
 * undefined, in which case we fall back to the `X-User-Id` header (or
 * `'anonymous'`).
 */

import { Request, Response } from 'express';
import logger from '../utils/logger';
import { getWhiteboardSessionStore } from '../services/whiteboardSessionStore';
import type { WhiteboardConflictError } from '../models/WhiteboardSession';

function resolveOwner(req: Request): string {
  // Auth middleware would normally populate `req.user` with a numeric/UUID id.
  const fromAuth = (req as any).user?.id;
  if (typeof fromAuth === 'string' && fromAuth.length > 0) return fromAuth;
  const header = req.header('X-User-Id');
  if (typeof header === 'string' && header.length > 0) return header;
  return 'anonymous';
}

export class WhiteboardSessionController {
  /**
   * Create a new whiteboard session.
   * POST /api/collaboration/whiteboard/sessions
   */
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const ownerId = resolveOwner(req);
      const { title, width, height, ops, thumbnail, courseId, roomId } = req.body ?? {};
      if (typeof width !== 'number' || typeof height !== 'number') {
        res.status(400).json({ success: false, message: 'width and height are required numbers' });
        return;
      }
      if (!Array.isArray(ops)) {
        res.status(400).json({ success: false, message: 'ops must be an array' });
        return;
      }
      const store = getWhiteboardSessionStore();
      const session = await store.create(ownerId, {
        title,
        width,
        height,
        ops,
        thumbnail,
        courseId,
        roomId,
      });
      res.status(201).json({ success: true, data: { session, created: true } });
    } catch (error) {
      logger.error('[whiteboard] create failed', error);
      res.status(500).json({ success: false, message: 'Failed to create whiteboard session' });
    }
  }

  /**
   * Save (replace) ops for an existing session. Returns 409 on conflict.
   * PUT /api/collaboration/whiteboard/sessions/:id
   */
  static async saveOps(req: Request, res: Response): Promise<void> {
    try {
      const ownerId = resolveOwner(req);
      const { id } = req.params;
      const { title, width, height, ops, thumbnail, courseId, roomId, baseVersion } = req.body ?? {};
      if (typeof width !== 'number' || typeof height !== 'number') {
        res.status(400).json({ success: false, message: 'width and height are required numbers' });
        return;
      }
      if (!Array.isArray(ops)) {
        res.status(400).json({ success: false, message: 'ops must be an array' });
        return;
      }
      const store = getWhiteboardSessionStore();
      const result = await store.saveOps(id, ownerId, {
        title,
        width,
        height,
        ops,
        thumbnail,
        courseId,
        roomId,
        baseVersion: typeof baseVersion === 'number' ? baseVersion : 0,
      });
      if ((result as WhiteboardConflictError).code === 'conflict') {
        const conflict = result as WhiteboardConflictError;
        res.status(409).json({
          success: false,
          message: conflict.message,
          code: 'conflict',
          serverVersion: conflict.serverVersion,
          serverOps: conflict.serverOps,
        });
        return;
      }
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      logger.error('[whiteboard] save failed', error);
      res.status(500).json({ success: false, message: 'Failed to save whiteboard session' });
    }
  }

  /**
   * Fetch a single session by id.
   * GET /api/collaboration/whiteboard/sessions/:id
   */
  static async getOne(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const session = await getWhiteboardSessionStore().get(id);
      if (!session) {
        res.status(404).json({ success: false, message: 'Whiteboard session not found' });
        return;
      }
      res.status(200).json({ success: true, data: session });
    } catch (error) {
      logger.error('[whiteboard] get failed', error);
      res.status(500).json({ success: false, message: 'Failed to load whiteboard session' });
    }
  }

  /**
   * List sessions owned by the current user.
   * GET /api/collaboration/whiteboard/sessions
   */
  static async list(req: Request, res: Response): Promise<void> {
    try {
      const ownerId = resolveOwner(req);
      const summaries = await getWhiteboardSessionStore().listByOwner(ownerId);
      res.status(200).json({ success: true, data: summaries });
    } catch (error) {
      logger.error('[whiteboard] list failed', error);
      res.status(500).json({ success: false, message: 'Failed to list whiteboard sessions' });
    }
  }

  /**
   * Delete a session. Only the owner may delete.
   * DELETE /api/collaboration/whiteboard/sessions/:id
   */
  static async delete(req: Request, res: Response): Promise<void> {
    try {
      const ownerId = resolveOwner(req);
      const { id } = req.params;
      const ok = await getWhiteboardSessionStore().delete(id, ownerId);
      if (!ok) {
        res.status(404).json({ success: false, message: 'Whiteboard session not found' });
        return;
      }
      res.status(200).json({ success: true, data: { id } });
    } catch (error) {
      logger.error('[whiteboard] delete failed', error);
      res.status(500).json({ success: false, message: 'Failed to delete whiteboard session' });
    }
  }

  /**
   * Mint or look up a read-only share token for a session.
   * POST /api/collaboration/whiteboard/sessions/:id/share
   *
   * Response: `{ token, url }` where `url` is constructed using the request's
   * protocol + host + front-end base. Front-ends can override via
   * `FRONTEND_BASE_URL`.
   */
  static async createShare(req: Request, res: Response): Promise<void> {
    try {
      const ownerId = resolveOwner(req);
      const { id } = req.params;
      const store = getWhiteboardSessionStore();
      const session = await store.get(id);
      if (!session || session.ownerId !== ownerId) {
        res.status(404).json({ success: false, message: 'Whiteboard session not found' });
        return;
      }
      const token = await store.ensureShareToken(id);
      if (!token) {
        res.status(500).json({ success: false, message: 'Failed to mint share token' });
        return;
      }
      const base =
        process.env.FRONTEND_BASE_URL ||
        `${req.protocol}://${req.get('host')}`;
      const url = `${base.replace(/\/$/, '')}/whiteboard/shared?token=${encodeURIComponent(token)}`;
      res.status(200).json({ success: true, data: { token, url } });
    } catch (error) {
      logger.error('[whiteboard] share failed', error);
      res.status(500).json({ success: false, message: 'Failed to create share link' });
    }
  }

  /**
   * Revoke a previously issued share token.
   * DELETE /api/collaboration/whiteboard/sessions/:id/share
   */
  static async revokeShare(req: Request, res: Response): Promise<void> {
    try {
      const ownerId = resolveOwner(req);
      const { id } = req.params;
      const token = String(req.body?.token ?? '');
      if (!token) {
        res.status(400).json({ success: false, message: 'token is required' });
        return;
      }
      const session = await getWhiteboardSessionStore().get(id);
      if (!session || session.ownerId !== ownerId) {
        res.status(404).json({ success: false, message: 'Whiteboard session not found' });
        return;
      }
      const ok = await getWhiteboardSessionStore().revokeShareToken(id, token);
      res.status(200).json({ success: true, data: { revoked: ok } });
    } catch (error) {
      logger.error('[whiteboard] revoke share failed', error);
      res.status(500).json({ success: false, message: 'Failed to revoke share link' });
    }
  }

  /**
   * Fetch a session via a share token. Read-only — never required auth.
   * GET /api/collaboration/whiteboard/shared?token=...
   *
   * Anonymises the payload by omitting the owner id before responding so a
   * shared link never leaks the creator's user id.
   */
  static async getByShare(req: Request, res: Response): Promise<void> {
    try {
      const token = String(req.query.token ?? '');
      if (!token) {
        res.status(400).json({ success: false, message: 'token is required' });
        return;
      }
      const session = await getWhiteboardSessionStore().getByShareToken(token);
      if (!session) {
        res.status(404).json({ success: false, message: 'Share link is invalid or expired' });
        return;
      }
      const sanitised: Record<string, unknown> = { ...session };
      delete sanitised.ownerId;
      res.status(200).json({ success: true, data: sanitised });
    } catch (error) {
      logger.error('[whiteboard] share fetch failed', error);
      res.status(500).json({ success: false, message: 'Failed to fetch shared whiteboard' });
    }
  }
}

export default WhiteboardSessionController;
