/**
 * Appeal Service
 * Handles the appeal flow for rejected content moderation decisions.
 * Submitters can appeal rejected content with evidence, and appeals
 * are reviewed by senior moderators or admins.
 */

import { randomUUID } from 'crypto';
import {
  Appeal,
  AppealStatus,
  AppealDecision,
  AppealEvidence,
  ModerationItem,
  ModerationStatus,
} from '../../models/Moderation';
import logger from '../../utils/logger';

export class AppealService {
  private appeals: Map<string, Appeal> = new Map();
  private itemsStore: Map<string, ModerationItem> = new Map();

  setItemsStore(store: Map<string, ModerationItem>): void {
    this.itemsStore = store;
  }

  /**
   * Submit an appeal for rejected content
   */
  submitAppeal(
    moderationId: string,
    submitterId: string,
    submitterName: string,
    reason: string,
    explanation: string,
    evidence: Omit<AppealEvidence, 'id' | 'uploadedAt'>[]
  ): Appeal | null {
    const item = this.itemsStore.get(moderationId);
    if (!item) return null;

    // Only rejected items can be appealed
    if (
      item.status !== ModerationStatus.REJECTED &&
      item.status !== ModerationStatus.AUTO_REJECTED
    ) {
      logger.warn(
        `Appeal denied: item ${moderationId} is not rejected (status: ${item.status})`
      );
      return null;
    }

    // Check if appeal already exists
    if (item.appeal) {
      logger.warn(`Appeal already exists for item ${moderationId}`);
      return item.appeal;
    }

    const appeal: Appeal = {
      id: randomUUID(),
      moderationId,
      submitterId,
      submitterName,
      reason,
      explanation,
      evidence: evidence.map((e) => ({
        ...e,
        id: randomUUID(),
        uploadedAt: new Date(),
      })),
      status: AppealStatus.PENDING,
      decision: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      resolvedAt: null,
    };

    this.appeals.set(appeal.id, appeal);
    item.appeal = appeal;

    logger.info(
      `Appeal submitted for item ${moderationId} by ${submitterName}`
    );
    return appeal;
  }

  /**
   * Review an appeal and make a decision
   */
  reviewAppeal(
    appealId: string,
    reviewerId: string,
    reviewerName: string,
    decision: AppealStatus,
    reason: string,
    notes: string
  ): { appeal: Appeal; item: ModerationItem } | null {
    const appeal = this.appeals.get(appealId);
    if (!appeal) return null;

    const item = this.itemsStore.get(appeal.moderationId);
    if (!item) return null;

    const appealDecision: AppealDecision = {
      id: randomUUID(),
      reviewerId,
      reviewerName,
      decision,
      reason,
      notes,
      createdAt: new Date(),
    };

    appeal.status = decision;
    appeal.decision = appealDecision;
    appeal.updatedAt = new Date();

    // Update the moderation item based on appeal decision
    if (decision === AppealStatus.APPROVED || decision === AppealStatus.REVERSED) {
      item.status = ModerationStatus.APPROVED;
      appeal.resolvedAt = new Date();
    } else if (decision === AppealStatus.DENIED || decision === AppealStatus.UPHELD) {
      appeal.resolvedAt = new Date();
      // Item remains rejected
    }

    this.appeals.set(appealId, appeal);
    this.itemsStore.set(item.id, item);

    logger.info(
      `Appeal ${appealId} ${decision} by ${reviewerName}: item ${item.id} status updated`
    );

    return { appeal, item };
  }

  /**
   * Get appeal by ID
   */
  getAppeal(appealId: string): Appeal | null {
    return this.appeals.get(appealId) || null;
  }

  /**
   * Get appeal for a moderation item
   */
  getAppealForModeration(moderationId: string): Appeal | null {
    for (const appeal of this.appeals.values()) {
      if (appeal.moderationId === moderationId) return appeal;
    }
    return null;
  }

  /**
   * Get all appeals with optional filtering
   */
  getAppeals(
    filter?: {
      status?: AppealStatus;
      submitterId?: string;
      page?: number;
      limit?: number;
    }
  ): { appeals: Appeal[]; total: number } {
    let appeals = Array.from(this.appeals.values());

    if (filter) {
      if (filter.status) {
        appeals = appeals.filter((a) => a.status === filter.status);
      }
      if (filter.submitterId) {
        appeals = appeals.filter((a) => a.submitterId === filter.submitterId);
      }
    }

    // Sort by most recent first
    appeals.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    const total = appeals.length;
    const page = filter?.page || 1;
    const limit = filter?.limit || 20;

    return {
      appeals: appeals.slice((page - 1) * limit, page * limit),
      total,
    };
  }

  /**
   * Add evidence to an existing appeal
   */
  addEvidence(
    appealId: string,
    evidence: Omit<AppealEvidence, 'id' | 'uploadedAt'>
  ): Appeal | null {
    const appeal = this.appeals.get(appealId);
    if (!appeal) return null;

    // Can only add evidence to pending appeals
    if (appeal.status !== AppealStatus.PENDING) {
      logger.warn(
        `Cannot add evidence to appeal ${appealId} with status ${appeal.status}`
      );
      return null;
    }

    const newEvidence: AppealEvidence = {
      ...evidence,
      id: randomUUID(),
      uploadedAt: new Date(),
    };

    appeal.evidence.push(newEvidence);
    appeal.updatedAt = new Date();

    logger.info(`Evidence added to appeal ${appealId}`);
    return appeal;
  }

  /**
   * Get appeal statistics
   */
  getAppealStats(): {
    total: number;
    pending: number;
    underReview: number;
    approved: number;
    denied: number;
    reversed: number;
    upheld: number;
    averageResolutionTime: number; // in hours
  } {
    const appeals = Array.from(this.appeals.values());
    const resolved = appeals.filter((a) => a.resolvedAt);

    const resolutionTimes = resolved
      .filter((a) => a.createdAt && a.resolvedAt)
      .map(
        (a) =>
          (new Date(a.resolvedAt!).getTime() -
            new Date(a.createdAt).getTime()) /
          (1000 * 60 * 60)
      );

    return {
      total: appeals.length,
      pending: appeals.filter((a) => a.status === AppealStatus.PENDING).length,
      underReview: appeals.filter(
        (a) => a.status === AppealStatus.UNDER_REVIEW
      ).length,
      approved: appeals.filter(
        (a) => a.status === AppealStatus.APPROVED
      ).length,
      denied: appeals.filter((a) => a.status === AppealStatus.DENIED).length,
      reversed: appeals.filter(
        (a) => a.status === AppealStatus.REVERSED
      ).length,
      upheld: appeals.filter((a) => a.status === AppealStatus.UPHELD).length,
      averageResolutionTime: resolutionTimes.length
        ? resolutionTimes.reduce((s, t) => s + t, 0) / resolutionTimes.length
        : 0,
    };
  }
}