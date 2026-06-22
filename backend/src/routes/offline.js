/**
 * @openapi
 * tags:
 *   - name: Offline
 *     description: Offline access and content download management
 */

const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const offlineController = require("../controllers/offlineController");

router.use(authenticate);

/**
 * @openapi
 * /api/offline/content:
 *   post:
 *     tags: [Offline]
 *     summary: Download content for offline access
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Content downloaded
 */
router.post("/content", offlineController.downloadContent);

/**
 * @openapi
 * /api/offline/content/{contentId}:
 *   delete:
 *     tags: [Offline]
 *     summary: Remove downloaded content
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Content removed
 */
router.delete("/content/:contentId", offlineController.removeContent);

/**
 * @openapi
 * /api/offline/{userId}:
 *   get:
 *     tags: [Offline]
 *     summary: Get offline content list
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
 *         description: Content list retrieved
 */
router.get("/:userId", offlineController.getOfflineContent);

/**
 * @openapi
 * /api/offline/{userId}/sync:
 *   post:
 *     tags: [Offline]
 *     summary: Sync offline changes
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
 *         description: Offline changes synced
 */
router.post("/:userId/sync", offlineController.syncOfflineChanges);

module.exports = router;
