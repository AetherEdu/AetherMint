import express, { Router, Request, Response, NextFunction } from "express";
import { notificationController } from "../controllers/notificationController";
import { notificationService } from "../services/NotificationService";
import logger from '../utils/logger';

const router: Router = express.Router();

// Admin trigger notification
router.post("/trigger", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, title, message, category, priority, deliveryMethods } = req.body;
    // In a real app we'd verify admin role here
    const result = await notificationService.send({
      userId,
      title,
      message,
      category: category || "system",
      priority: priority || "medium",
      deliveryMethods: deliveryMethods || ["in-app"],
      isRead: false,
      isDelivered: false
    });
    res.status(200).json(result);
  } catch (e) {
    logger.error('Error triggering notification', e);
    next(e);
  }
});

router.get("/:userId", notificationController.getNotifications);
router.delete("/:notificationId", notificationController.deleteNotification);
router.patch("/:notificationId/read", notificationController.markAsRead);
router.patch("/read-all", notificationController.markAllAsRead);
router.get("/:userId/preferences", notificationController.getPreferences);
router.put("/:userId/preferences", notificationController.updatePreferences);

export default router;
