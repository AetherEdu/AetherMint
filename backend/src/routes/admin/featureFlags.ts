/**
 * Admin Feature Flag Routes
 *
 * REST endpoints for managing feature flags. All routes require admin
 * authentication and share the existing `admin-bulk` rate-limit tier.
 *
 * Closes Issue #267 (admin API half).
 */

import { Router } from 'express';
import { authenticate, optionalAuth, requireAdmin } from '../../middleware/auth';
import { rateLimitMiddleware } from '../../middleware/rateLimit';
import { evaluateForUser } from '../../controllers/featureFlagController';
import {
  createFlag,
  deleteFlag,
  getFlag,
  listFlags,
  toggleFlag,
  updateFlag,
} from '../../controllers/featureFlagController';

const router = Router();

router.use(authenticate, requireAdmin);

// Light rate limit per admin (less aggressive than the bulk tier; flag
// management is interactive).
router.use(
  rateLimitMiddleware({
    max: 120,
    windowMs: 60 * 1000,
    name: 'admin-feature-flags',
    scope: 'user',
  })
);

/**
 * @openapi
 * /api/admin/feature-flags:
 *   get:
 *     summary: List all feature flags
 *     tags: [Admin Feature Flags]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Flags listed }
 */
router.get('/', listFlags);

/**
 * @openapi
 * /api/admin/feature-flags/{name}:
 *   get:
 *     summary: Get a single feature flag
 *     tags: [Admin Feature Flags]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:name', getFlag);

/**
 * @openapi
 * /api/admin/feature-flags:
 *   post:
 *     summary: Create a feature flag
 *     tags: [Admin Feature Flags]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, enabled, rolloutPercent]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               enabled: { type: boolean }
 *               rolloutPercent: { type: integer, minimum: 0, maximum: 100 }
 *               variants: { type: object }
 *               allowedUserIds: { type: array, items: { type: string } }
 *               blockedUserIds: { type: array, items: { type: string } }
 */
router.post('/', createFlag);

/**
 * @openapi
 * /api/admin/feature-flags/{name}:
 *   put:
 *     summary: Replace (or create) a feature flag
 *     tags: [Admin Feature Flags]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:name', updateFlag);

/**
 * @openapi
 * /api/admin/feature-flags/{name}/toggle:
 *   patch:
 *     summary: Toggle the kill switch on a feature flag
 *     tags: [Admin Feature Flags]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [enabled]
 *             properties:
 *               enabled: { type: boolean }
 */
router.patch('/:name/toggle', toggleFlag);

/**
 * @openapi
 * /api/admin/feature-flags/{name}:
 *   delete:
 *     summary: Delete a feature flag
 *     tags: [Admin Feature Flags]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:name', deleteFlag);

// ── Public-facing evaluation endpoint for the SPA / mobile clients ───────
// Mounted on a separate router so admins and end users share one file but
// each gets its own auth and rate-limit guard. Imported by `index.ts`.
const publicRouter = Router();
publicRouter.use(rateLimitMiddleware({
  max: 600,
  windowMs: 60_000,
  name: 'feature-flag-evaluate',
  scope: 'ip',
}));
publicRouter.get('/:name/evaluate', optionalAuth, evaluateForUser);

export { publicRouter };
export default router;
