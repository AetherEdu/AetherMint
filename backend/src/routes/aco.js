/**
 * @openapi
 * tags:
 *   - name: ACO
 *     description: Ant Colony Optimization for adaptive learning paths
 */

const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const acoController = require("../controllers/acoController");

router.use(authenticate);

/**
 * @openapi
 * /api/aco/optimize:
 *   post:
 *     tags: [ACO]
 *     summary: Optimize learning path using ant colony algorithm
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Learning path optimized
 */
router.post("/optimize", acoController.optimizePath);

/**
 * @openapi
 * /api/aco/pheromone/update:
 *   post:
 *     tags: [ACO]
 *     summary: Update pheromone levels based on user progress
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Pheromones updated
 */
router.post("/pheromone/update", acoController.updatePheromones);

/**
 * @openapi
 * /api/aco/path/{userId}:
 *   get:
 *     tags: [ACO]
 *     summary: Get optimized learning path for user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Learning path retrieved
 */
router.get("/path/:userId", acoController.getLearningPath);

module.exports = router;
