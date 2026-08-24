/**
 * Prometheus Metrics Route
 *
 * Exposes GET /api/metrics in Prometheus text format.
 * Protected by an internal API key (X-Internal-Key header or INTERNAL_METRICS_KEY env var).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { register } from '../metrics/registry';

const router = Router();

/**
 * Internal-only middleware: requires X-Internal-Key header to match
 * INTERNAL_METRICS_KEY env var. If the env var is not set, the endpoint
 * is wide open (useful in development).
 */
const internalOnly = (req: Request, res: Response, next: NextFunction): void => {
  const expectedKey = process.env.INTERNAL_METRICS_KEY;

  if (!expectedKey) {
    // No key configured — allow open access (dev mode)
    next();
    return;
  }

  const providedKey = req.header('X-Internal-Key') || req.header('Authorization')?.replace('Bearer ', '');

  if (providedKey === expectedKey) {
    next();
    return;
  }

  res.status(401).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: 'Valid X-Internal-Key header is required to access metrics',
    },
  });
};

/**
 * GET /metrics
 *
 * Returns all collected metrics in Prometheus text exposition format.
 *
 * @openapi
 * /api/metrics:
 *   get:
 *     tags: [System]
 *     summary: Prometheus metrics endpoint
 *     description: >
 *       Exposes application metrics in Prometheus text format including HTTP
 *       request duration, request counts, active WebSocket connections, Redis
 *       cache hit/miss ratio, database query duration, credential issuance rate,
 *       and Node.js default metrics (event loop, memory, GC). Protected by
 *       X-Internal-Key header when INTERNAL_METRICS_KEY env var is set.
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Prometheus metrics in text/plain format
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       401:
 *         description: Missing or invalid internal key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', internalOnly, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = await register.metrics();
    res.setHeader('Content-Type', register.contentType);
    res.send(metrics);
  } catch (error) {
    next(error);
  }
});

export default router;
