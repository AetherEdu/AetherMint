/**
 * Moderation Job Worker
 * Async background job for ML-based content pre-screening.
 * Processes items in the moderation queue asynchronously,
 * applying risk scoring and routing to the appropriate queue.
 */

import { randomUUID } from 'crypto';
import {
  ModerationItem,
  ModerationStatus,
  ContentType,
  SeverityLevel,
  ModerationMetadata,
} from '../models/Moderation';
import { ModerationScoringService } from '../services/moderation/ModerationScoringService';
import { ModerationQueueService } from '../services/moderation/ModerationQueueService';
import logger from '../utils/logger';

interface ModerationJobConfig {
  /** Maximum concurrent scoring operations */
  concurrency: number;
  /** Polling interval in milliseconds */
  pollingIntervalMs: number;
  /** Maximum batch size for processing */
  batchSize: number;
}

const DEFAULT_JOB_CONFIG: ModerationJobConfig = {
  concurrency: 5,
  pollingIntervalMs: 5000,
  batchSize: 10,
};

export class ModerationJob {
  private config: ModerationJobConfig;
  private scoringService: ModerationScoringService;
  private queueService: ModerationQueueService;
  private pendingItems: ModerationItem[] = [];
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    scoringService: ModerationScoringService,
    queueService: ModerationQueueService,
    config?: Partial<ModerationJobConfig>
  ) {
    this.config = { ...DEFAULT_JOB_CONFIG, ...config };
    this.scoringService = scoringService;
    this.queueService = queueService;
  }

  /**
   * Start the background scoring worker
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('ModerationJob is already running');
      return;
    }

    this.isRunning = true;
    logger.info('ModerationJob started', { config: this.config });
    this.poll();
  }

  /**
   * Stop the background scoring worker
   */
  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.info('ModerationJob stopped');
  }

  /**
   * Submit items for async scoring
   */
  submitItems(
    items: Array<{
      contentId: string;
      contentType: ContentType;
      title: string;
      description: string;
      content: string;
      authorId: string;
      authorName: string;
      authorEmail: string;
      metadata?: ModerationMetadata;
    }>
  ): ModerationItem[] {
    const moderationItems: ModerationItem[] = items.map((item) => ({
      id: randomUUID(),
      contentId: item.contentId,
      contentType: item.contentType,
      title: item.title,
      description: item.description,
      content: item.content,
      authorId: item.authorId,
      authorName: item.authorName,
      authorEmail: item.authorEmail,
      status: ModerationStatus.PENDING,
      riskScore: null,
      severity: SeverityLevel.LOW,
      flags: 0,
      reports: [],
      assignedModeratorId: null,
      moderatorNotes: '',
      decision: null,
      appeal: null,
      metadata: item.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
      scoredAt: null,
      reviewedAt: null,
      resolvedAt: null,
    }));

    // Store in queue service first
    for (const item of moderationItems) {
      this.queueService.upsertItem(item);
    }

    this.pendingItems.push(...moderationItems);
    logger.info(`Submitted ${moderationItems.length} items for moderation`);

    return moderationItems;
  }

  /**
   * Get the current pending item count
   */
  getPendingCount(): number {
    return this.pendingItems.length;
  }

  /**
   * Main polling loop
   */
  private poll(): void {
    if (!this.isRunning) return;

    this.processBatch()
      .catch((error) => {
        logger.error('Error in moderation polling loop:', error);
      })
      .finally(() => {
        if (this.isRunning) {
          this.timer = setTimeout(
            () => this.poll(),
            this.config.pollingIntervalMs
          );
        }
      });
  }

  /**
   * Process a batch of pending items
   */
  private async processBatch(): Promise<void> {
    if (this.pendingItems.length === 0) return;

    const batch = this.pendingItems.splice(0, this.config.batchSize);
    logger.debug(
      `Processing moderation batch: ${batch.length} items, ${this.pendingItems.length} remaining`
    );

    // Score items concurrently with concurrency limit
    const scored = await this.scoreBatchWithConcurrency(batch);

    // Route scored items to queues
    for (const item of scored) {
      // Auto-approved or auto-rejected don't need queue
      if (
        item.status !== ModerationStatus.AUTO_APPROVED &&
        item.status !== ModerationStatus.AUTO_REJECTED
      ) {
        const priority =
          item.severity === SeverityLevel.CRITICAL ||
          item.severity === SeverityLevel.HIGH
            ? 'high'
            : 'normal';
        this.queueService.enqueueItem(item, priority);
      }
    }

    logger.info(
      `Moderation batch processed: ${scored.length} items scored, ` +
      `${scored.filter((i) => i.status === ModerationStatus.AUTO_APPROVED).length} auto-approved, ` +
      `${scored.filter((i) => i.status === ModerationStatus.AUTO_REJECTED).length} auto-rejected, ` +
      `${scored.filter((i) => i.status === ModerationStatus.QUEUED).length} queued`
    );
  }

  /**
   * Score items with concurrency control
   */
  private async scoreBatchWithConcurrency(
    items: ModerationItem[]
  ): Promise<ModerationItem[]> {
    const results: ModerationItem[] = [];
    const chunks: ModerationItem[][] = [];

    for (let i = 0; i < items.length; i += this.config.concurrency) {
      chunks.push(items.slice(i, i + this.config.concurrency));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map((item) => this.scoringService.scoreItem(item))
      );

      for (let i = 0; i < chunkResults.length; i++) {
        const result = chunkResults[i];
        if (result.status === 'fulfilled') {
          results.push(result.value);
          // Update the item in the queue service
          this.queueService.upsertItem(result.value);
        } else {
          logger.error(`Failed to score item ${chunk[i].id}:`, result.reason);
          results.push(chunk[i]);
        }
      }
    }

    return results;
  }
}