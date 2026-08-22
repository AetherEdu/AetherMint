/**
 * @openapi
 * tags:
 *   - name: Analytics
 *     description: Platform analytics and reporting
 */

const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const analyticsController = require("../controllers/analyticsController");

router.use(authenticate, authorize("admin"));

/**
 * @openapi
 * /api/analytics/overview:
 *   get:
 *     tags: [Analytics]
 *     summary: Get analytics overview
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Overview retrieved
 */
router.get("/overview", analyticsController.getOverview);

/**
 * @openapi
 * /api/analytics/users:
 *   get:
 *     tags: [Analytics]
 *     summary: Get user analytics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: User analytics retrieved
 */
router.get("/users", analyticsController.getUserAnalytics);

/**
 * @openapi
 * /api/analytics/courses:
 *   get:
 *     tags: [Analytics]
 *     summary: Get course analytics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Course analytics retrieved
 */
router.get("/courses", analyticsController.getCourseAnalytics);

/**
 * @openapi
 * /api/analytics/engagement:
 *   get:
 *     tags: [Analytics]
 *     summary: Get engagement metrics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Engagement metrics retrieved
 */
router.get("/engagement", analyticsController.getEngagementMetrics);

/**
 * @openapi
 * /api/analytics/revenue:
 *   get:
 *     tags: [Analytics]
 *     summary: Get revenue analytics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Revenue analytics retrieved
 */
router.get("/revenue", analyticsController.getRevenueAnalytics);

/**
 * @openapi
 * /api/analytics/performance:
 *   get:
 *     tags: [Analytics]
 *     summary: Get system performance metrics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Performance metrics retrieved
 */
router.get("/performance", analyticsController.getPerformanceMetrics);

/**
 * @openapi
 * /api/analytics/platform:
 *   get:
 *     tags: [Analytics]
 *     summary: Get platform analytics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Platform analytics retrieved
 */
router.get("/platform", analyticsController.getPlatformAnalytics);

/**
 * @openapi
 * /api/analytics/time/{userId}:
 *   get:
 *     tags: [Analytics]
 *     summary: Get time analysis for user
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *     responses:
 *       '200':
 *         description: Time analysis retrieved
 */
router.get("/time/:userId", analyticsController.getTimeAnalysis);

/**
 * @openapi
 * /api/analytics/completion/{userId}:
 *   get:
 *     tags: [Analytics]
 *     summary: Get completion stats for user
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *     responses:
 *       '200':
 *         description: Completion stats retrieved
 */
router.get("/completion/:userId", analyticsController.getCompletionStats);

/**
 * @openapi
 * /api/analytics/achievements/{userId}:
 *   get:
 *     tags: [Analytics]
 *     summary: Get achievements for user
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *     responses:
 *       '200':
 *         description: Achievements retrieved
 */
router.get("/achievements/:userId", analyticsController.getAchievements);

/**
 * @openapi
 * /api/analytics/progress/{userId}:
 *   get:
 *     tags: [Analytics]
 *     summary: Get progress data for user
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *     responses:
 *       '200':
 *         description: Progress data retrieved
 */
router.get("/progress/:userId", analyticsController.getProgressData);

module.exports = router;
