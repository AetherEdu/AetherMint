/**
 * Plagiarism Administrative Service
 * Administrative tools for review, moderation, and management of plagiarism detection
 */

import { 
  PlagiarismReport, 
  PlagiarismAppeal, 
  PlagiarismSettings, 
  PlagiarismAnalytics,
  PlagiarismStatus,
  PlagiarismType,
  DetectionMethod
} from '../models/PlagiarismDetection';
import logger from '../utils/logger';

export interface ReviewQueue {
  pending: PlagiarismReport[];
  inProgress: PlagiarismReport[];
  completed: PlagiarismReport[];
  escalated: PlagiarismReport[];
}

export interface ReviewAction {
  type: 'approve' | 'reject' | 'flag' | 'escalate' | 'request_revision';
  reviewerId: string;
  notes?: string;
  timestamp: Date;
  evidence?: string[];
}

export interface ModerationSettings {
  autoApproveThreshold: number;
  autoRejectThreshold: number;
  requireDualReview: boolean;
  escalationThreshold: number;
  reviewTimeout: number; // in hours
  allowedReviewers: string[];
  notificationSettings: {
    email: boolean;
    sms: boolean;
    inApp: boolean;
  };
}

export interface ReviewStatistics {
  totalReviewed: number;
  averageReviewTime: number;
  approvalRate: number;
  rejectionRate: number;
  escalationRate: number;
  reviewerPerformance: Record<string, {
    reviewsCompleted: number;
    averageTime: number;
    accuracy: number;
  }>;
}

export class PlagiarismAdministrativeService {
  private reviewQueue: ReviewQueue;
  private moderationSettings: ModerationSettings;
  private reviewerAssignments: Map<string, string[]>;

  constructor() {
    this.reviewQueue = {
      pending: [],
      inProgress: [],
      completed: [],
      escalated: []
    };
    this.moderationSettings = this.getDefaultModerationSettings();
    this.reviewerAssignments = new Map();
  }

  /**
   * Get default moderation settings
   */
  private getDefaultModerationSettings(): ModerationSettings {
    return {
      autoApproveThreshold: 10, // Auto-approve if similarity < 10%
      autoRejectThreshold: 85,  // Auto-reject if similarity > 85%
      requireDualReview: true,
      escalationThreshold: 70,   // Escalate if similarity > 70%
      reviewTimeout: 48,         // 48 hours
      allowedReviewers: [],
      notificationSettings: {
        email: true,
        sms: false,
        inApp: true
      }
    };
  }

  /**
   * Add report to review queue
   */
  async addToReviewQueue(report: PlagiarismReport): Promise<void> {
    try {
      // Check for auto-processing
      if (report.overallSimilarity < this.moderationSettings.autoApproveThreshold) {
        await this.autoApproveReport(report);
        return;
      }

      if (report.overallSimilarity > this.moderationSettings.autoRejectThreshold) {
        await this.autoRejectReport(report);
        return;
      }

      // Add to pending queue
      this.reviewQueue.pending.push(report);
      
      // Auto-assign reviewer if enabled
      await this.autoAssignReviewer(report);

      logger.info(`Report ${report.id} added to review queue`);

    } catch (error) {
      logger.error('Error adding report to review queue:', error);
      throw error;
    }
  }

  /**
   * Get review queue
   */
  getReviewQueue(): ReviewQueue {
    return this.reviewQueue;
  }

  /**
   * Assign reviewer to report
   */
  async assignReviewer(reportId: string, reviewerId: string): Promise<void> {
    try {
      const report = this.findReportInQueue(reportId);
      if (!report) {
        throw new Error('Report not found in queue');
      }

      // Check if reviewer is allowed
      if (!this.moderationSettings.allowedReviewers.includes(reviewerId)) {
        throw new Error('Reviewer not authorized');
      }

      // Move to in-progress
      this.removeFromQueue(reportId);
      report.status = PlagiarismStatus.REVIEW_REQUIRED;
      this.reviewQueue.inProgress.push(report);

      // Track assignment
      if (!this.reviewerAssignments.has(reviewerId)) {
        this.reviewerAssignments.set(reviewerId, []);
      }
      this.reviewerAssignments.get(reviewerId)!.push(reportId);

      logger.info(`Report ${reportId} assigned to reviewer ${reviewerId}`);

    } catch (error) {
      logger.error('Error assigning reviewer:', error);
      throw error;
    }
  }

  /**
   * Submit review decision
   */
  async submitReview(reportId: string, action: ReviewAction): Promise<void> {
    try {
      const report = this.findReportInQueue(reportId);
      if (!report) {
        throw new Error('Report not found in queue');
      }

      // Apply action
      switch (action.type) {
        case 'approve':
          await this.approveReport(report, action);
          break;
        case 'reject':
          await this.rejectReport(report, action);
          break;
        case 'flag':
          await this.flagReport(report, action);
          break;
        case 'escalate':
          await this.escalateReport(report, action);
          break;
        case 'request_revision':
          await this.requestRevision(report, action);
          break;
      }

      // Remove from in-progress
      this.removeFromQueue(reportId);

      logger.info(`Review submitted for report ${reportId}: ${action.type}`);

    } catch (error) {
      logger.error('Error submitting review:', error);
      throw error;
    }
  }

  /**
   * Handle plagiarism appeal
   */
  async handleAppeal(appeal: PlagiarismAppeal): Promise<void> {
    try {
      const report = await this.getReportById(appeal.reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      // Update appeal status
      appeal.status = 'under_review';

      // Add to escalated queue for senior review
      this.reviewQueue.escalated.push(report);

      // Notify senior reviewers
      await this.notifySeniorReviewers(appeal);

      logger.info(`Appeal submitted for report ${appeal.reportId}`);

    } catch (error) {
      logger.error('Error handling appeal:', error);
      throw error;
    }
  }

  /**
   * Get review statistics
   */
  getReviewStatistics(): ReviewStatistics {
    const stats: ReviewStatistics = {
      totalReviewed: this.reviewQueue.completed.length,
      averageReviewTime: this.calculateAverageReviewTime(),
      approvalRate: this.calculateApprovalRate(),
      rejectionRate: this.calculateRejectionRate(),
      escalationRate: this.calculateEscalationRate(),
      reviewerPerformance: this.calculateReviewerPerformance()
    };

    return stats;
  }

  /**
   * Update moderation settings
   */
  updateModerationSettings(settings: Partial<ModerationSettings>): void {
    this.moderationSettings = { ...this.moderationSettings, ...settings };
    logger.info('Moderation settings updated');
  }

  /**
   * Get moderation settings
   */
  getModerationSettings(): ModerationSettings {
    return this.moderationSettings;
  }

  /**
   * Auto-assign reviewer to report
   */
  private async autoAssignReviewer(report: PlagiarismReport): Promise<void> {
    if (this.moderationSettings.allowedReviewers.length === 0) {
      return;
    }

    // Find least busy reviewer
    const reviewerWorkloads = new Map<string, number>();
    
    this.moderationSettings.allowedReviewers.forEach(reviewerId => {
      const assignments = this.reviewerAssignments.get(reviewerId) || [];
      reviewerWorkloads.set(reviewerId, assignments.length);
    });

    const leastBusyReviewer = Array.from(reviewerWorkloads.entries())
      .sort((a, b) => a[1] - b[1])[0]?.[0];

    if (leastBusyReviewer) {
      await this.assignReviewer(report.id, leastBusyReviewer);
    }
  }

  /**
   * Auto-approve report
   */
  private async autoApproveReport(report: PlagiarismReport): Promise<void> {
    report.status = PlagiarismStatus.COMPLETED;
    report.reviewedAt = new Date();
    report.isFalsePositive = true;
    this.reviewQueue.completed.push(report);
    
    logger.info(`Report ${report.id} auto-approved`);
  }

  /**
   * Auto-reject report
   */
  private async autoRejectReport(report: PlagiarismReport): Promise<void> {
    report.status = PlagiarismStatus.COMPLETED;
    report.reviewedAt = new Date();
    report.isFalsePositive = false;
    this.reviewQueue.completed.push(report);
    
    logger.info(`Report ${report.id} auto-rejected`);
  }

  /**
   * Approve report
   */
  private async approveReport(report: PlagiarismReport, action: ReviewAction): Promise<void> {
    report.status = PlagiarismStatus.COMPLETED;
    report.reviewedAt = new Date();
    report.reviewedBy = action.reviewerId;
    report.reviewNotes = action.notes;
    report.isFalsePositive = true;
    this.reviewQueue.completed.push(report);
  }

  /**
   * Reject report
   */
  private async rejectReport(report: PlagiarismReport, action: ReviewAction): Promise<void> {
    report.status = PlagiarismStatus.COMPLETED;
    report.reviewedAt = new Date();
    report.reviewedBy = action.reviewerId;
    report.reviewNotes = action.notes;
    report.isFalsePositive = false;
    this.reviewQueue.completed.push(report);
  }

  /**
   * Flag report for further review
   */
  private async flagReport(report: PlagiarismReport, action: ReviewAction): Promise<void> {
    report.status = PlagiarismStatus.REVIEW_REQUIRED;
    this.reviewQueue.pending.push(report);
  }

  /**
   * Escalate report
   */
  private async escalateReport(report: PlagiarismReport, action: ReviewAction): Promise<void> {
    report.status = PlagiarismStatus.REVIEW_REQUIRED;
    report.reviewNotes = action.notes;
    this.reviewQueue.escalated.push(report);
  }

  /**
   * Request revision
   */
  private async requestRevision(report: PlagiarismReport, action: ReviewAction): Promise<void> {
    report.status = PlagiarismStatus.PENDING;
    this.reviewQueue.pending.push(report);
  }

  /**
   * Find report in queue
   */
  private findReportInQueue(reportId: string): PlagiarismReport | null {
    const allQueues = [
      ...this.reviewQueue.pending,
      ...this.reviewQueue.inProgress,
      ...this.reviewQueue.completed,
      ...this.reviewQueue.escalated
    ];

    return allQueues.find(report => report.id === reportId) || null;
  }

  /**
   * Remove report from queue
   */
  private removeFromQueue(reportId: string): void {
    const removeFromArray = (array: PlagiarismReport[]) => {
      const index = array.findIndex(report => report.id === reportId);
      if (index !== -1) {
        array.splice(index, 1);
      }
    };

    removeFromArray(this.reviewQueue.pending);
    removeFromArray(this.reviewQueue.inProgress);
    removeFromArray(this.reviewQueue.completed);
    removeFromArray(this.reviewQueue.escalated);
  }

  /**
   * Get report by ID (mock implementation)
   */
  private async getReportById(reportId: string): Promise<PlagiarismReport | null> {
    return this.findReportInQueue(reportId);
  }

  /**
   * Notify senior reviewers
   */
  private async notifySeniorReviewers(appeal: PlagiarismAppeal): Promise<void> {
    // Mock implementation - would send notifications
    logger.info(`Notifying senior reviewers about appeal ${appeal.id}`);
  }

  /**
   * Calculate average review time
   */
  private calculateAverageReviewTime(): number {
    if (this.reviewQueue.completed.length === 0) return 0;

    const totalTime = this.reviewQueue.completed.reduce((sum, report) => {
      if (report.createdAt && report.reviewedAt) {
        return sum + (report.reviewedAt.getTime() - report.createdAt.getTime());
      }
      return sum;
    }, 0);

    return totalTime / this.reviewQueue.completed.length / (1000 * 60 * 60); // in hours
  }

  /**
   * Calculate approval rate
   */
  private calculateApprovalRate(): number {
    if (this.reviewQueue.completed.length === 0) return 0;

    const approved = this.reviewQueue.completed.filter(report => report.isFalsePositive).length;
    return (approved / this.reviewQueue.completed.length) * 100;
  }

  /**
   * Calculate rejection rate
   */
  private calculateRejectionRate(): number {
    if (this.reviewQueue.completed.length === 0) return 0;

    const rejected = this.reviewQueue.completed.filter(report => !report.isFalsePositive).length;
    return (rejected / this.reviewQueue.completed.length) * 100;
  }

  /**
   * Calculate escalation rate
   */
  private calculateEscalationRate(): number {
    const totalReviews = this.reviewQueue.completed.length + this.reviewQueue.escalated.length;
    if (totalReviews === 0) return 0;

    return (this.reviewQueue.escalated.length / totalReviews) * 100;
  }

  /**
   * Calculate reviewer performance
   */
  private calculateReviewerPerformance(): Record<string, any> {
    const performance: Record<string, any> = {};

    this.moderationSettings.allowedReviewers.forEach(reviewerId => {
      const assignments = this.reviewerAssignments.get(reviewerId) || [];
      const completedReviews = this.reviewQueue.completed.filter(report => 
        report.reviewedBy === reviewerId
      );

      performance[reviewerId] = {
        reviewsCompleted: completedReviews.length,
        averageTime: this.calculateReviewerAverageTime(completedReviews),
        accuracy: this.calculateReviewerAccuracy(completedReviews)
      };
    });

    return performance;
  }

  /**
   * Calculate reviewer average time
   */
  private calculateReviewerAverageTime(reviews: PlagiarismReport[]): number {
    if (reviews.length === 0) return 0;

    const totalTime = reviews.reduce((sum, report) => {
      if (report.createdAt && report.reviewedAt) {
        return sum + (report.reviewedAt.getTime() - report.createdAt.getTime());
      }
      return sum;
    }, 0);

    return totalTime / reviews.length / (1000 * 60 * 60); // in hours
  }

  /**
   * Calculate reviewer accuracy
   */
  private calculateReviewerAccuracy(reviews: PlagiarismReport[]): number {
    if (reviews.length === 0) return 0;

    // Mock accuracy calculation - would be based on appeal outcomes
    return Math.random() * 20 + 80; // 80-100% accuracy
  }

  /**
   * Get false positive management data
   */
  getFalsePositiveManagement(): {
    totalReports: number;
    falsePositives: number;
    falsePositiveRate: number;
    commonFalsePositivePatterns: Array<{
      pattern: string;
      count: number;
      percentage: number;
    }>;
  } {
    const totalReports = this.reviewQueue.completed.length;
    const falsePositives = this.reviewQueue.completed.filter(report => report.isFalsePositive).length;
    const falsePositiveRate = totalReports > 0 ? (falsePositives / totalReports) * 100 : 0;

    // Mock pattern analysis
    const commonPatterns = [
      { pattern: 'Common phrases and idioms', count: 15, percentage: 25 },
      { pattern: 'Technical terminology', count: 12, percentage: 20 },
      { pattern: 'Citation formatting', count: 8, percentage: 13 }
    ];

    return {
      totalReports,
      falsePositives,
      falsePositiveRate,
      commonFalsePositivePatterns: commonPatterns
    };
  }

  /**
   * Bulk review operations
   */
  async bulkReview(reportIds: string[], action: ReviewAction): Promise<{
    successful: string[];
    failed: string[];
  }> {
    const results = {
      successful: [],
      failed: []
    };

    for (const reportId of reportIds) {
      try {
        await this.submitReview(reportId, action);
        results.successful.push(reportId);
      } catch (error) {
        results.failed.push(reportId);
        logger.error(`Failed to review report ${reportId}:`, error);
      }
    }

    return results;
  }

  /**
   * Export review data
   */
  exportReviewData(format: 'json' | 'csv'): string {
    const data = {
      queue: this.reviewQueue,
      statistics: this.getReviewStatistics(),
      settings: this.moderationSettings,
      falsePositiveManagement: this.getFalsePositiveManagement(),
      exportedAt: new Date()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else {
      // CSV format implementation
      return this.convertToCSV(data);
    }
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: any): string {
    // Mock CSV conversion
    return 'report_id,status,similarity,reviewed_by,reviewed_at\n' +
           'sample1,completed,25.5,reviewer1,2023-01-01\n' +
           'sample2,completed,78.2,reviewer2,2023-01-02\n';
  }
}
