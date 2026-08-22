/**
 * @openapi
 * tags:
 *   - name: Notifications
 *     description: User notification management
 */

import express, { Router } from "express";
import { notificationController } from "../controllers/notificationController";

const router: Router = express.Router();

/**
 * @openapi
 * /api/notifications/{userId}:
 *   get:
 *     tags: [Notifications]
 *     summary: Get notification history for user
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Notifications retrieved
 *   delete:
 *     tags: [Notifications]
 *     summary: Delete notification
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Notification deleted
 */
router.get("/:userId", notificationController.getNotifications);
router.delete("/:notificationId", notificationController.deleteNotification);

/**
 * @openapi
 * /api/notifications/{notificationId}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark notification as read
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Marked as read
 */
router.patch("/:notificationId/read", notificationController.markAsRead);

/**
 * @openapi
 * /api/notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark all notifications as read
 *     responses:
 *       '200':
 *         description: All marked as read
 */
router.patch("/read-all", notificationController.markAllAsRead);

/**
 * @openapi
 * /api/notifications/{userId}/preferences:
 *   get:
 *     tags: [Notifications]
 *     summary: Get notification preferences
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Preferences retrieved
 *   put:
 *     tags: [Notifications]
 *     summary: Update notification preferences
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Preferences updated
 */
router.get("/:userId/preferences", notificationController.getPreferences);
router.put("/:userId/preferences", notificationController.updatePreferences);

export default router;
