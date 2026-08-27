/**
 * Moderation Queue Service
 * Manages the human review queue for content moderation.
 * Handles priority-based routing, moderator assignment,
 * and auto-assignment of items to available moderators.
 */

import { randomUUID } from 'crypto';
import {
  ModerationItem,
  ModerationStatus,
  ModerationFilter,
  ModerationQueue,
  ModerationStats,
  SeverityLevel,
  ModerationDecision,
  ModerationAction,
  ModelFeedback,
} from '../../models/Moderation';
import logger from '../../utils/logger';

export class ModerationQueueService {
  private queues: Map<string, ModerationQueue> = new Map();
  private itemsStore: Map<string, ModerationItem> = new Map();
  private moderatorLoads: Map<string, number> = new Map();

  constructor() {
    // Initialize default queue
    const defaultQueue: ModerationQueue = {
      id: 'default',
      name: 'General Moderation Queue',
      description: 'Default queue for all moderation items',
      items: [],
      filter: { status: ModerationStatus.QUEUED },
      moderators: [],
      maxItemsPerModerator: 20,
      autoAssign: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.queues.set('default', defaultQueue);
  }

  /**
   * Add an item to the moderation queue
   */
  enqueueItem(item: ModerationItem, priority: 'normal' | 'high' = 'normal'): void {
    this.itemsStore.set(item.id, item);

    for (const queue of this.queues.values()) {
      if (this.matchesFilter(item, queue.filter)) {
        if (priority === 'high') {
          queue.items.unshift(item.id); // High priority at front
        } else {
          queue.items.push(item.id); // Normal priority at back
        }
        queue.updatedAt = new Date();
        logger.info(`Enqueued item ${item.id} to queue "${queue.name}" with ${priority} priority`);
      }
    }
  }

  /**
   * Dequeue the next item for a moderator to review
   */
  dequeueItem(moderatorId: string): ModerationItem | null {
    // Find a queue this moderator belongs to
    for (const queue of this.queues.values()) {
      if (queue.moderators.includes(moderatorId) && queue.items.length > 0) {
        // Check moderator load
        const currentLoad = this.moderatorLoads.get(moderatorId) || 0;
        if (currentLoad >= queue.maxItemsPerModerator) {
          continue;
        }

        const itemId = queue.items.shift();
        if (itemId) {
          const item = this.itemsStore.get(itemId);
          if (item && item.status === ModerationStatus.QUEUED) {
            item.status = ModerationStatus.IN_REVIEW;
            item.assignedModeratorId = moderatorId;
            item.reviewedAt = new Date();
            this.moderatorLoads.set(moderatorId, currentLoad + 1);

            queue.updatedAt = new Date();
            logger.info(
              `Dequeued item ${item.id} to moderator ${moderatorId}`
            );
            return item;
          }
        }
      }
    }
    return null;
  }

  /**
   * Get all items in all queues for a moderator
   */
  getModeratorQueue(moderatorId: string): ModerationItem[] {
    const items: ModerationItem[] = [];

    for (const queue of this.queues.values()) {
      if (queue.moderators.includes(moderatorId) || queue.moderators.length === 0) {
        for (const itemId of queue.items) {
          const item = this.itemsStore.get(itemId);
          if (item) items.push(item);
        }
      }
    }

    return items;
  }

  /**
   * Get items assigned to a specific moderator
   */
  getAssignedItems(moderatorId: string): ModerationItem[] {
    const items: ModerationItem[] = [];
    for (const item of this.itemsStore.values()) {
      if (
        item.assignedModeratorId === moderatorId &&
        item.status === ModerationStatus.IN_REVIEW
      ) {
        items.push(item);
      }
    }
    return items;
  }

  /**
   * Process a moderator's decision on an item
   */
  processDecision(
    itemId: string,
    moderatorId: string,
    moderatorName: string,
    action: ModerationAction,
    reason: string,
    notes: string,
    modelFeedback: ModelFeedback
  ): ModerationItem | null {
    const item = this.itemsStore.get(itemId);
    if (!item) return null;

    const decision: ModerationDecision = {
      id: randomUUID(),
      moderatorId,
      moderatorName,
      action,
      reason,
      notes,
      createdAt: new Date(),
      modelFeedback,
    };

    item.decision = decision;
    item.moderatorNotes = notes;
    item.resolvedAt = new Date();

    // Map action to status
    switch (action) {
      case ModerationAction.APPROVE:
        item.status = ModerationStatus.APPROVED;
        break;
      case ModerationAction.REJECT:
      case ModerationAction.REMOVE:
        item.status = ModerationStatus.REJECTED;
        break;
      case ModerationAction.FLAG_FOR_REVIEW:
        item.status = ModerationStatus.FLAGGED;
        break;
      case ModerationAction.ESCALATE:
        item.status = ModerationStatus.FLAGGED;
        break;
      default:
        item.status = ModerationStatus.APPROVED;
    }

    // Decrease moderator load
    const currentLoad = this.moderatorLoads.get(moderatorId) || 0;
    this.moderatorLoads.set(moderatorId, Math.max(0, currentLoad - 1));

    logger.info(
      `Decision processed for item ${itemId}: ${action} by ${moderatorName}`
    );

    return item;
  }

  /**
   * Create or update a moderation queue
   */
  upsertQueue(queue: ModerationQueue): ModerationQueue {
    this.queues.set(queue.id, queue);
    return queue;
  }

  /**
   * Get a specific queue
   */
  getQueue(queueId: string): ModerationQueue | null {
    return this.queues.get(queueId) || null;
  }

  /**
   * Get all queues
   */
  getAllQueues(): ModerationQueue[] {
    return Array.from(this.queues.values());
  }

  /**
   * Delete a queue
   */
  deleteQueue(queueId: string): boolean {
    return this.queues.delete(queueId);
  }

  /**
   * Add a moderator to a queue
   */
  addModeratorToQueue(queueId: string, moderatorId: string): boolean {
    const queue = this.queues.get(queueId);
    if (!queue) return false;

    if (!queue.moderators.includes(moderatorId)) {
      queue.moderators.push(moderatorId);
      queue.updatedAt = new Date();
    }
    return true;
  }

  /**
   * Remove a moderator from a queue
   */
  removeModeratorFromQueue(queueId: string, moderatorId: string): boolean {
    const queue = this.queues.get(queueId);
    if (!queue) return false;

    queue.moderators = queue.moderators.filter((m) => m !== moderatorId);
    queue.updatedAt = new Date();
    return true;
  }

  /**
   * Get moderation statistics
   */
  getStats(): ModerationStats {
    const items = Array.from(this.itemsStore.values());
    const reviewedItems = items.filter(
      (i) =>
        i.status === ModerationStatus.APPROVED ||
        i.status === ModerationStatus.REJECTED ||
        i.status === ModerationStatus.AUTO_APPROVED ||
        i.status === ModerationStatus.AUTO_REJECTED
    );

    const reviewTimes = items
      .filter((i) => i.reviewedAt && i.scoredAt)
      .map(
        (i) =>
          (new Date(i.reviewedAt!).getTime() -
            new Date(i.scoredAt!).getTime()) /
          (1000 * 60)
      );

    const withRiskScores = items.filter((i) => i.riskScore);

    return {
      total: items.length,
      pending: items.filter((i) => i.status === ModerationStatus.PENDING).length,
      queued: items.filter((i) => i.status === ModerationStatus.QUEUED).length,
      inReview: items.filter(
        (i) => i.status === ModerationStatus.IN_REVIEW
      ).length,
      approved: items.filter(
        (i) => i.status === ModerationStatus.APPROVED
      ).length,
      rejected: items.filter(
        (i) => i.status === ModerationStatus.REJECTED
      ).length,
      flagged: items.filter(
        (i) => i.status === ModerationStatus.FLAGGED
      ).length,
      autoApproved: items.filter(
        (i) => i.status === ModerationStatus.AUTO_APPROVED
      ).length,
      autoRejected: items.filter(
        (i) => i.status === ModerationStatus.AUTO_REJECTED
      ).length,
      averageRiskScore: withRiskScores.length
        ? withRiskScores.reduce((s, i) => s + (i.riskScore?.overall || 0), 0) /
          withRiskScores.length
        : 0,
      averageReviewTime: reviewTimes.length
        ? reviewTimes.reduce((s, t) => s + t, 0) / reviewTimes.length
        : 0,
      modelAccuracy: 0, // Updated externally by scoring service
      appealsPending: items.filter(
        (i) => i.appeal?.status === 'pending' || i.appeal?.status === 'under_review'
      ).length,
    };
  }

  /**
   * Get items with optional filtering
   */
  getItems(filter?: ModerationFilter): {
    items: ModerationItem[];
    total: number;
    page: number;
    limit: number;
  } {
    let items = Array.from(this.itemsStore.values());

    if (filter) {
      if (filter.status) {
        items = items.filter((i) => i.status === filter.status);
      }
      if (filter.contentType) {
        items = items.filter((i) => i.contentType === filter.contentType);
      }
      if (filter.severity) {
        items = items.filter((i) => i.severity === filter.severity);
      }
      if (filter.assignedModeratorId) {
        items = items.filter(
          (i) => i.assignedModeratorId === filter.assignedModeratorId
        );
      }
      if (filter.authorId) {
        items = items.filter((i) => i.authorId === filter.authorId);
      }
      if (filter.minRiskScore !== undefined) {
        items = items.filter(
          (i) => (i.riskScore?.overall || 0) >= filter.minRiskScore!
        );
      }
      if (filter.maxRiskScore !== undefined) {
        items = items.filter(
          (i) => (i.riskScore?.overall || 0) <= filter.maxRiskScore!
        );
      }
      if (filter.search) {
        const search = filter.search.toLowerCase();
        items = items.filter(
          (i) =>
            i.title.toLowerCase().includes(search) ||
            i.description.toLowerCase().includes(search) ||
            i.content.toLowerCase().includes(search)
        );
      }
      if (filter.startDate) {
        items = items.filter((i) => i.createdAt >= filter.startDate!);
      }
      if (filter.endDate) {
        items = items.filter((i) => i.createdAt <= filter.endDate!);
      }
    }

    // Sort
    const sortBy = filter?.sortBy || 'createdAt';
    const sortOrder = filter?.sortOrder || 'desc';
    items.sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortBy) {
        case 'riskScore':
          aVal = a.riskScore?.overall || 0;
          bVal = b.riskScore?.overall || 0;
          break;
        case 'severity':
          const severityOrder = {
            [SeverityLevel.CRITICAL]: 4,
            [SeverityLevel.HIGH]: 3,
            [SeverityLevel.MEDIUM]: 2,
            [SeverityLevel.LOW]: 1,
          };
          aVal = severityOrder[a.severity];
          bVal = severityOrder[b.severity];
          break;
        case 'flags':
          aVal = a.flags;
          bVal = b.flags;
          break;
        case 'updatedAt':
          aVal = a.updatedAt.getTime();
          bVal = b.updatedAt.getTime();
          break;
        default:
          aVal = a.createdAt.getTime();
          bVal = b.createdAt.getTime();
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    const total = items.length;
    const page = filter?.page || 1;
    const limit = filter?.limit || 20;
    const start = (page - 1) * limit;

    return {
      items: items.slice(start, start + limit),
      total,
      page,
      limit,
    };
  }

  /**
   * Get a single item by ID
   */
  getItem(itemId: string): ModerationItem | null {
    return this.itemsStore.get(itemId) || null;
  }

  /**
   * Store an item
   */
  upsertItem(item: ModerationItem): void {
    this.itemsStore.set(item.id, item);
  }

  /**
   * Check if an item matches a filter
   */
  private matchesFilter(item: ModerationItem, filter: ModerationFilter): boolean {
    if (filter.status && item.status !== filter.status) return false;
    if (filter.contentType && item.contentType !== filter.contentType) return false;
    if (filter.severity && item.severity !== filter.severity) return false;
    if (
      filter.minRiskScore !== undefined &&
      (item.riskScore?.overall || 0) < filter.minRiskScore
    )
      return false;
    if (
      filter.maxRiskScore !== undefined &&
      (item.riskScore?.overall || 0) > filter.maxRiskScore
    )
      return false;
    return true;
  }
}