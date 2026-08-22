/**
 * @openapi
 * tags:
 *   - name: Optimization
 *     description: System optimization and resource management
 */

const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const optimizationController = require("../controllers/optimizationController");

router.use(authenticate, authorize("admin"));

/**
 * @openapi
 * /api/optimization/cache:
 *   get:
 *     tags: [Optimization]
 *     summary: Get cache optimization status
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Cache status retrieved
 *   post:
 *     tags: [Optimization]
 *     summary: Optimize cache
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Cache optimized
 */
router.get("/cache", optimizationController.getCacheStatus);
router.post("/cache", optimizationController.optimizeCache);

/**
 * @openapi
 * /api/optimization/compression:
 *   post:
 *     tags: [Optimization]
 *     summary: Compress data for optimization
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Data compressed
 */
router.post("/compression", optimizationController.optimizeCompression);

/**
 * @openapi
 * /api/optimization/performance:
 *   get:
 *     tags: [Optimization]
 *     summary: Get performance optimization report
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Performance report retrieved
 */
router.get("/performance", optimizationController.getPerformanceReport);

/**
 * @openapi
 * /api/optimization/scheduler:
 *   post:
 *     tags: [Optimization]
 *     summary: Schedule optimization task
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Task scheduled
 */
router.post("/scheduler", optimizationController.scheduleOptimization);

/**
 * @openapi
 * /api/optimization/recommendations:
 *   get:
 *     tags: [Optimization]
 *     summary: Get optimization recommendations
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Recommendations retrieved
 */
router.get("/recommendations", optimizationController.getOptimizationRecommendations);

module.exports = router;
