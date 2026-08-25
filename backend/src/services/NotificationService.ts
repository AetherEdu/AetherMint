import { Notification, NotificationPreference } from '../models/Notification';
import logger from '../utils/logger';

export class NotificationService {
  async send(notification: any) {
    try {
      const newNotification = new Notification(notification);
      await newNotification.save();
      // In a real app we would push via WebSocket or Email service here
      return { success: true, data: newNotification };
    } catch (e) {
      logger.error('Error sending notification', e);
      return { success: false };
    }
  }

  async sendRefundNotification(userId: string, refund: any) { return {}; }
  async sendEnrollmentCancellationNotification(userId: string, enrollment: any) { return {}; }
  async sendCertificateIssuanceNotification(userId: string, certificate: any) { return {}; }

  async getNotifications(options: any) {
    const query: any = { userId: options.userId };
    if (options.category) query.category = options.category;
    if (options.isRead !== undefined) query.isRead = options.isRead;
    if (options.priority) query.priority = options.priority;

    const data = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(options.skip || 0)
      .limit(options.limit || 20);

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ userId: options.userId, isRead: false });

    return { data, total, unreadCount };
  }

  async markAsRead(notificationId: string, userId: string) {
    const result = await Notification.updateOne(
      { _id: notificationId, userId },
      { $set: { isRead: true } }
    );
    return result.modifiedCount > 0;
  }

  async markAllAsRead(userId: string) {
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true } }
    );
    return result.modifiedCount;
  }

  async getUserPreferences(userId: string) {
    let prefs = await NotificationPreference.findOne({ userId });
    if (!prefs) {
      prefs = new NotificationPreference({ userId, enabledCategories: ["course", "message", "system", "achievement"], deliveryMethods: ["email", "push", "websocket"], digest: "none" });
      await prefs.save();
    }
    return prefs;
  }

  async setNotificationPreferences(userId: string, preferences: any) {
    const result = await NotificationPreference.findOneAndUpdate(
      { userId },
      { $set: preferences },
      { upsert: true, new: true }
    );
    return result;
  }

  async deleteNotification(notificationId: string, userId: string) {
    const result = await Notification.deleteOne({ _id: notificationId, userId });
    return result.deletedCount > 0;
  }
}

export const notificationService = new NotificationService();
