import express, { Router } from "express";
import { notificationController } from "../controllers/notificationController";

const router: Router = express.Router();

// Get notification history
router.get("/:userId", notificationController.getNotifications);

// Mark as read
router.patch("/:notificationId/read", notificationController.markAsRead);

// Mark all as read
router.patch("/read-all", notificationController.markAllAsRead);

// Preferences
router.get("/:userId/preferences", notificationController.getPreferences);
router.put("/:userId/preferences", notificationController.updatePreferences);

// Delete
router.delete("/:notificationId", notificationController.deleteNotification);

export default router;
