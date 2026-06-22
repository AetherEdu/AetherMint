/**
 * @openapi
 * tags:
 *   - name: Recommendations
 *     description: Personalized content recommendations
 */

const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const recommendationController = require("../controllers/recommendationController");

router.use(authenticate);

/**
 * @openapi
 * /api/recommendations/{userId}:
 *   get:
 *     tags: [Recommendations]
 *     summary: Get personalized recommendations for user
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
 *         description: Recommendations retrieved
 */
router.get("/:userId", recommendationController.getRecommendations);

/**
 * @openapi
 * /api/recommendations/{userId}/similar:
 *   get:
 *     tags: [Recommendations]
 *     summary: Get similar content recommendations
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
 *         description: Similar content retrieved
 */
router.get("/:userId/similar", recommendationController.getSimilarContent);

/**
 * @openapi
 * /api/recommendations/{userId}/trending:
 *   get:
 *     tags: [Recommendations]
 *     summary: Get trending content for user
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
 *         description: Trending content retrieved
 */
router.get("/:userId/trending", recommendationController.getTrendingContent);

module.exports = router;
