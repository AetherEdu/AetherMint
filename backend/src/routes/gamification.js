/**
 * @openapi
 * tags:
 *   - name: Gamification
 *     description: Gamification features including achievements, badges, leaderboards
 */

const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const gamificationController = require("../controllers/gamificationController");

router.use(authenticate);

/**
 * @openapi
 * /api/gamification/{userId}/points:
 *   get:
 *     tags: [Gamification]
 *     summary: Get points for user
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
 *         description: User points retrieved
 */
router.get("/:userId/points", gamificationController.getPoints);

/**
 * @openapi
 * /api/gamification/{userId}/badges:
 *   get:
 *     tags: [Gamification]
 *     summary: Get badges for user
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
 *         description: User badges retrieved
 */
router.get("/:userId/badges", gamificationController.getBadges);

/**
 * @openapi
 * /api/gamification/{userId}/leaderboard:
 *   get:
 *     tags: [Gamification]
 *     summary: Get leaderboard position and rankings
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
 *         description: Leaderboard data retrieved
 */
router.get("/:userId/leaderboard", gamificationController.getLeaderboard);

/**
 * @openapi
 * /api/gamification/achievements:
 *   get:
 *     tags: [Gamification]
 *     summary: Get all achievements
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Achievements retrieved
 *   post:
 *     tags: [Gamification]
 *     summary: Create new achievement
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Achievement created
 */
router.get("/achievements", gamificationController.getAchievements);
router.post("/achievements", gamificationController.createAchievement);

/**
 * @openapi
 * /api/gamification/achievements/{achievementId}:
 *   put:
 *     tags: [Gamification]
 *     summary: Update achievement
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: achievementId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Achievement updated
 *   delete:
 *     tags: [Gamification]
 *     summary: Delete achievement
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: achievementId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Achievement deleted
 */
router.put("/achievements/:achievementId", gamificationController.updateAchievement);
router.delete("/achievements/:achievementId", gamificationController.deleteAchievement);

/**
 * @openapi
 * /api/gamification/{userId}/redeem-badge:
 *   post:
 *     tags: [Gamification]
 *     summary: Redeem badge for user
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
 *         description: Badge redeemed
 */
router.post("/:userId/redeem-badge", gamificationController.redeemBadge);

module.exports = router;
