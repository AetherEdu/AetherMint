/**
 * @openapi
 * tags:
 *   - name: Holographic
 *     description: Holographic storage and retrieval for content
 */

import express, { Router } from "express";
import * as holographicController from "../controllers/holographicController";

const router: Router = express.Router();

/**
 * @openapi
 * /api/holographic/encode:
 *   post:
 *     tags: [Holographic]
 *     summary: Encode content using holographic storage
 *     responses:
 *       '200':
 *         description: Content encoded
 */
router.post("/encode", holographicController.encodeContent);

/**
 * @openapi
 * /api/holographic/decode/{hash}:
 *   get:
 *     tags: [Holographic]
 *     summary: Decode holographic content
 *     parameters:
 *       - in: path
 *         name: hash
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Content decoded
 */
router.get("/decode/:hash", holographicController.decodeContent);

/**
 * @openapi
 * /api/holographic/access/parallel:
 *   post:
 *     tags: [Holographic]
 *     summary: Parallel access to holographic content
 *     responses:
 *       '200':
 *         description: Parallel access granted
 */
router.post("/access/parallel", holographicController.parallelAccess);

/**
 * @openapi
 * /api/holographic/metrics:
 *   get:
 *     tags: [Holographic]
 *     summary: Get holographic storage metrics
 *     responses:
 *       '200':
 *         description: Metrics retrieved
 */
router.get("/metrics", holographicController.getMetrics);

/**
 * @openapi
 * /api/holographic/optimize:
 *   post:
 *     tags: [Holographic]
 *     summary: Optimize holographic storage
 *     responses:
 *       '200':
 *         description: Storage optimized
 */
router.post("/optimize", holographicController.optimizeStorage);

export default router;
