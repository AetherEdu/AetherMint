/**
 * Assignment Notification Service
 * Handles notifications for assignments, grades, and system events
 */

import { 
  Assignment, 
  AssignmentNotification, 
  Grade, 
  Submission 
} from '../models/Assignment';
import { v4 as uuidv4 } from 'uuid';

export interface NotificationData {
  type: 'assignment_created' | 'assignment_updated' | 'assignment_due_soon' | 'assignment_overdue' | 
        'submission_graded' | 'grade_updated' | 'grade_appeal_submitted' | 'grade_appeal_reviewed' |
        'plagiarism_flagged' | 'bulk_grading_completed';
  recipientId: string;
  title: string;
  message: string;
  data?: any;
  priority?: 'low' | 'medium' | 'high';
  channels?: ('email' | 'push' | 'sms' | 'in_app')[];
  scheduledAt?: Date;
}

export interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface PushNotification {
  token: string;
  title: string;
  body: string;
  data?: any;
  priority?: 'normal' | 'high';
}

export class AssignmentNotificationService {
  // Mock database - in real implementation, this would use actual database
  private notifications: Map<string, AssignmentNotification> = new Map();

  async notifyAssignmentCreated(assignment: Assignment): Promise<void> {
    // Get enrolled students (mock implementation)
    const enrolledStudents = await this.getEnrolledStudents(assignment.courseId);
    
    for (const studentId of enrolledStudents) {
      await this.createNotification({
        type: 'assignment_created',
        recipientId: studentId,
        title: `New Assignment: ${assignment.title}`,
        message: `A new assignment has been posted for your course. Due: ${assignment.dueDate.toLocaleDateString()}`,
        data: {
          assignmentId: assignment.id,
          courseId: assignment.courseId,
          dueDate: assignment.dueDate
        },
        priority: 'medium',
        channels: ['email', 'push', 'in_app']
      });
    }

    console.log(`Notified ${enrolledStudents.length} students about new assignment: ${assignment.title}`);
  }

  async notifyGradeCreated(grade: Grade): Promise<void> {
    await this.createNotification({
      type: 'submission_graded',
      recipientId: grade.studentId,
      title: `Assignment Graded: ${grade.percentage.toFixed(1)}%`,
      message: `Your assignment has been graded. You earned ${grade.earnedPoints}/${grade.totalPoints} points (${grade.percentage.toFixed(1)}%).`,
      data: {
        gradeId: grade.id,
        submissionId: grade.submissionId,
        assignmentId: grade.assignmentId,
        percentage: grade.percentage,
        letterGrade: grade.letterGrade
      },
      priority: 'high',
      channels: ['email', 'push', 'in_app']
    });

    console.log(`Notified student ${grade.studentId} about grade: ${grade.percentage}%`);
  }

  async createNotification(notificationData: NotificationData): Promise<AssignmentNotification> {
    const notification: AssignmentNotification = {
      id: uuidv4(),
      type: notificationData.type,
      assignmentId: notificationData.data?.assignmentId,
      recipientId: notificationData.recipientId,
      title: notificationData.title,
      message: notificationData.message,
      data: notificationData.data,
      read: false,
      createdAt: notificationData.scheduledAt || new Date()
    };

    this.notifications.set(notification.id, notification);

    // Send notifications through configured channels
    const channels = notificationData.channels || ['in_app'];
    
    for (const channel of channels) {
      await this.sendNotification(notification, channel);
    }

    return notification;
  }

  async getNotifications(
    userId: string,
    filters: {
      type?: string;
      read?: boolean;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    notifications: AssignmentNotification[];
    total: number;
    unreadCount: number;
  }> {
    let notifications = Array.from(this.notifications.values())
      .filter(n => n.recipientId === userId);

    // Apply filters
    if (filters.type) {
      notifications = notifications.filter(n => n.type === filters.type);
    }

    if (filters.read !== undefined) {
      notifications = notifications.filter(n => n.read === filters.read);
    }

    // Sort by creation date (newest first)
    notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedNotifications = notifications.slice(startIndex, endIndex);

    const unreadCount = notifications.filter(n => !n.read).length;

    return {
      notifications: paginatedNotifications,
      total: notifications.length,
      unreadCount
    };
  }

  private async sendNotification(
    notification: AssignmentNotification,
    channel: string
  ): Promise<void> {
    try {
      switch (channel) {
        case 'email':
          await this.sendEmailNotification(notification);
          break;
        case 'push':
          await this.sendPushNotification(notification);
          break;
        case 'in_app':
          // In-app notifications are stored in the database
          break;
      }
    } catch (error) {
      console.error(`Failed to send ${channel} notification:`, error);
    }
  }

  private async sendEmailNotification(notification: AssignmentNotification): Promise<void> {
    // In a real implementation, this would use an email service like SendGrid, AWS SES, etc.
    const emailTemplate = await this.generateEmailTemplate(notification);
    console.log(`Email notification sent to ${notification.recipientId}: ${notification.title}`);
  }

  private async sendPushNotification(notification: AssignmentNotification): Promise<void> {
    // In a real implementation, this would use Firebase Cloud Messaging, Apple Push Notification Service, etc.
    const pushNotification = await this.generatePushNotification(notification);
    console.log(`Push notification sent to ${notification.recipientId}: ${notification.title}`);
  }

  private async generateEmailTemplate(notification: AssignmentNotification): Promise<EmailTemplate> {
    // Generate HTML and text email templates
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${notification.title}</h2>
        <p style="color: #666; line-height: 1.6;">${notification.message}</p>
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
          <small style="color: #999;">This notification was sent from StarkEd Education Platform.</small>
        </div>
      </div>
    `;

    return {
      to: '', // Would get user's email
      subject: notification.title,
      html,
      text: notification.message
    };
  }

  private async generatePushNotification(notification: AssignmentNotification): Promise<PushNotification> {
    return {
      token: '', // Would get user's push token
      title: notification.title,
      body: notification.message,
      data: notification.data,
      priority: 'normal'
    };
  }

  // Mock helper methods - in real implementation, these would query the database
  private async getEnrolledStudents(courseId: string): Promise<string[]> {
    // Mock implementation
    return ['student1', 'student2', 'student3'];
  }
}

export default new AssignmentNotificationService();
