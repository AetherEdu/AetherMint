/**
 * @openapi
 * tags:
 *   - name: CDN Optimization
 *     description: Content delivery network optimization
 */

import { Router } from "express";
import * as cdnController from "../controllers/cdnOptimizationController";

const router: Router = Router();

/**
 * @openapi
 * /api/cdn-optimization/optimize:
 *   post:
 *     tags: [CDN Optimization]
 *     summary: Optimize content delivery
 *     responses:
 *       '200':
 *         description: Content optimized
 */
router.post("/optimize", cdnController.optimizeContent);

/**
 * @openapi
 * /api/cdn-optimization/cache/purge:
 *   post:
 *     tags: [CDN Optimization]
 *     summary: Purge CDN cache
 *     responses:
 *       '200':
 *         description: Cache purged
 */
router.post("/cache/purge", cdnController.purgeCache);

/**
 * @openapi
 * /api/cdn-optimization/metrics/{region}:
 *   get:
 *     tags: [CDN Optimization]
 *     summary: Get CDN metrics for region
 *     parameters:
 *       - in: path
 *         name: region
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Metrics retrieved
 */
router.get("/metrics/:region", cdnController.getRegionalMetrics);

/**
 * @openapi
 * /api/cdn-optimization/edge/{edgeId}:
 *   get:
 *     tags: [CDN Optimization]
 *     summary: Get edge node status
 *     parameters:
 *       - in: path
 *         name: edgeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Edge status retrieved
 */
router.get("/edge/:edgeId", cdnController.getEdgeNodeStatus);

export default router;
