/**
 * Moderation Controller
 * Handles HTTP requests for ML-assisted content moderation,
 * queue management, decisions, and appeals.
 */

import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ModerationScoringService } from '../services/moderation/ModerationScoringService';
import { ModerationQueueService } from '../services/moderation/ModerationQueueService';
import { AppealService } from '../services/moderation/AppealService';
import { ModerationJob } from '../workers/moderationJob';
import {
  ModerationStatus,
  ModerationAction,
  AppealStatus,
  ContentType,
  ModerationFilter,
  ModerationBatchRequest,
  ModelFeedback,
  SeverityLevel,
  ModerationItem,
} from '../models/Moderation';
import logger from '../utils/logger';

export class ModerationController {
  private scoringService: ModerationScoringService;
  private queueService: ModerationQueueService;
  private appealService: AppealService;
  private job: ModerationJob | null = null;

  constructor(
    scoringService: ModerationScoringService,
    queueService: ModerationQueueService,
    appealService: AppealService
  ) {
    this.scoringService = scoringService;
    this.queueService = queueService;
    this.appealService = appealService;
    this.appealService.setItemsStore(
      (queueService as any).itemsStore
    );
  }

  setJob(job: ModerationJob): void {
    this.job = job;
  }

  /**
   * POST /api/moderation/submit
   * Submit content for moderation
   */
  submitContent = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        contentId,
        contentType,
        title,
        description,
        content,
        authorId,
        authorName,
        authorEmail,
        metadata,
      } = req.body;

      if (!contentId || !contentType || !title || !content) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: contentId, contentType, title, content',
        });
        return;
      }

      const item: ModerationItem = {
        id: randomUUID(),
        contentId,
        contentType: contentType as ContentType,
        title,
        description: description || '',
        content,
        authorId: authorId || 'anonymous',
        authorName: authorName || 'Anonymous',
        authorEmail: authorEmail || '',
        status: ModerationStatus.PENDING,
        riskScore: null,
        severity: SeverityLevel.LOW,
        flags: 0,
        reports: [],
        assignedModeratorId: null,
        moderatorNotes: '',
        decision: null,
        appeal: null,
        metadata: metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
        scoredAt: null,
        reviewedAt: null,
        resolvedAt: null,
      };

      this.queueService.upsertItem(item);

      // Submit to async scoring if job is available
      if (this.job) {
        this.job.submitItems([
          {
            contentId,
            contentType: contentType as ContentType,
            title,
            description: description || '',
            content,
            authorId: authorId || 'anonymous',
            authorName: authorName || 'Anonymous',
            authorEmail: authorEmail || '',
            metadata,
          },
        ]);
      }

      // Score synchronously for immediate feedback
      const scored = await this.scoringService.scoreItem(item);
      this.queueService.upsertItem(scored);

      res.status(201).json({
        success: true,
        data: scored,
        message: 'Content submitted for moderation',
      });
    } catch (error) {
      logger.error('Error submitting content:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * POST /api/moderation/submit/batch
   * Batch submit content for moderation
   */
  submitBatch = async (req: Request, res: Response): Promise<void> => {
    try {
      const batchRequest: ModerationBatchRequest = req.body;

      if (!batchRequest.items || !Array.isArray(batchRequest.items)) {
        res.status(400).json({
          success: false,
          error: 'items array is required',
        });
        return;
      }

      if (batchRequest.items.length > 100) {
        res.status(400).json({
          success: false,
          error: 'Maximum 100 items per batch',
        });
        return;
      }

      const results: ModerationItem[] = [];
      const items = batchRequest.items.map((item) => ({
        contentId: item.contentId,
        contentType: item.contentType as ContentType,
        title: item.title,
        description: item.description || '',
        content: item.content,
        authorId: item.authorId || 'anonymous',
        authorName: item.authorName || 'Anonymous',
        authorEmail: item.authorEmail || '',
        metadata: item.metadata,
      }));

      if (this.job) {
        const submitted = this.job.submitItems(items);
        results.push(...submitted);
      }

      res.status(201).json({
        success: true,
        data: {
          items: results,
          summary: {
            total: results.length,
            pending: results.filter(
              (i) => i.status === ModerationStatus.PENDING
            ).length,
          },
        },
        message: `Submitted ${results.length} items for moderation`,
      });
    } catch (error) {
      logger.error('Error in batch submission:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * GET /api/moderation/items
   * List moderation items with filtering
   */
  listItems = async (req: Request, res: Response): Promise<void> => {
    try {
      const filter: ModerationFilter = {
        status: req.query.status as ModerationStatus | undefined,
        contentType: req.query.contentType as ContentType | undefined,
        severity: req.query.severity as SeverityLevel | undefined,
        assignedModeratorId: req.query.assignedModeratorId as string | undefined,
        authorId: req.query.authorId as string | undefined,
        minRiskScore: req.query.minRiskScore
          ? parseFloat(req.query.minRiskScore as string)
          : undefined,
        maxRiskScore: req.query.maxRiskScore
          ? parseFloat(req.query.maxRiskScore as string)
          : undefined,
        search: req.query.search as string | undefined,
        sortBy: (req.query.sortBy as any) || 'createdAt',
        sortOrder: (req.query.sortOrder as any) || 'desc',
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        startDate: req.query.startDate
          ? new Date(req.query.startDate as string)
          : undefined,
        endDate: req.query.endDate
          ? new Date(req.query.endDate as string)
          : undefined,
      };

      const result = this.queueService.getItems(filter);

      res.json({
        success: true,
        data: result.items,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          pages: Math.ceil(result.total / result.limit),
        },
      });
    } catch (error) {
      logger.error('Error listing items:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * GET /api/moderation/items/:id
   * Get a specific moderation item
   */
  getItem = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const item = this.queueService.getItem(id);

      if (!item) {
        res.status(404).json({
          success: false,
          error: 'Moderation item not found',
        });
        return;
      }

      res.json({
        success: true,
        data: item,
      });
    } catch (error) {
      logger.error('Error getting item:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * POST /api/moderation/items/:id/score
   * Re-score a moderation item
   */
  scoreItem = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const item = this.queueService.getItem(id);

      if (!item) {
        res.status(404).json({
          success: false,
          error: 'Moderation item not found',
        });
        return;
      }

      const scored = await this.scoringService.scoreItem(item);
      this.queueService.upsertItem(scored);

      res.json({
        success: true,
        data: scored,
        message: 'Item re-scored',
      });
    } catch (error) {
      logger.error('Error scoring item:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * POST /api/moderation/items/:id/decision
   * Record a moderator's decision on an item
   */
  makeDecision = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const {
        action,
        reason,
        notes,
        predictionCorrect,
        actualSeverity,
        predictedSeverity,
        improvementNotes,
        misclassifiedPolicies,
      } = req.body;

      if (!action || !reason) {
        res.status(400).json({
          success: false,
          error: 'action and reason are required',
        });
        return;
      }

      const userId = (req as any).user?.id || 'unknown';
      const userName =
        (req as any).user?.username || (req as any).user?.email || 'Unknown';

      const modelFeedback: ModelFeedback = {
        predictionCorrect: predictionCorrect ?? true,
        actualSeverity: (actualSeverity as SeverityLevel) || SeverityLevel.LOW,
        predictedSeverity:
          (predictedSeverity as SeverityLevel) || SeverityLevel.LOW,
        improvementNotes: improvementNotes || '',
        misclassifiedPolicies: misclassifiedPolicies || [],
      };

      const item = this.queueService.processDecision(
        id,
        userId,
        userName,
        action as ModerationAction,
        reason,
        notes || '',
        modelFeedback
      );

      if (!item) {
        res.status(404).json({
          success: false,
          error: 'Moderation item not found',
        });
        return;
      }

      // Record feedback for model training
      if (item.riskScore) {
        const predictedSev = item.severity;
        const actualSev = this.mapActionToSeverity(action as ModerationAction);
        this.scoringService.recordFeedback(id, predictedSev, actualSev);
      }

      res.json({
        success: true,
        data: item,
        message: `Decision recorded: ${action}`,
      });
    } catch (error) {
      logger.error('Error making decision:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * GET /api/moderation/queue
   * Get queued items for the current moderator
   */
  getQueue = async (req: Request, res: Response): Promise<void> => {
    try {
      const moderatorId =
        (req.query.moderatorId as string) ||
        (req as any).user?.id ||
        'unknown';

      const queueItems = this.queueService.getModeratorQueue(moderatorId);
      const assignedItems = this.queueService.getAssignedItems(moderatorId);

      res.json({
        success: true,
        data: {
          queued: queueItems,
          assigned: assignedItems,
          queuedCount: queueItems.length,
          assignedCount: assignedItems.length,
        },
      });
    } catch (error) {
      logger.error('Error getting queue:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * POST /api/moderation/queue/claim
   * Claim the next item from the queue for review
   */
  claimNext = async (req: Request, res: Response): Promise<void> => {
    try {
      const moderatorId =
        (req as any).user?.id ||
        req.body.moderatorId ||
        'unknown';

      const item = this.queueService.dequeueItem(moderatorId);

      if (!item) {
        res.json({
          success: true,
          data: null,
          message: 'No items available in queue',
        });
        return;
      }

      res.json({
        success: true,
        data: item,
        message: 'Item claimed for review',
      });
    } catch (error) {
      logger.error('Error claiming item:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * POST /api/moderation/appeals
   * Submit an appeal for rejected content
   */
  submitAppeal = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        moderationId,
        reason,
        explanation,
        evidence,
      } = req.body;

      if (!moderationId || !reason || !explanation) {
        res.status(400).json({
          success: false,
          error: 'moderationId, reason, and explanation are required',
        });
        return;
      }

      const userId = (req as any).user?.id || 'anonymous';
      const userName =
        (req as any).user?.username || (req as any).user?.email || 'Anonymous';

      const appeal = this.appealService.submitAppeal(
        moderationId,
        userId,
        userName,
        reason,
        explanation,
        evidence || []
      );

      if (!appeal) {
        res.status(400).json({
          success: false,
          error:
            'Appeal could not be submitted. Ensure the item is rejected and has no existing appeal.',
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: appeal,
        message: 'Appeal submitted successfully',
      });
    } catch (error) {
      logger.error('Error submitting appeal:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * GET /api/moderation/appeals
   * List appeals with optional filtering
   */
  listAppeals = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = this.appealService.getAppeals({
        status: req.query.status as AppealStatus | undefined,
        submitterId: req.query.submitterId as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      });

      res.json({
        success: true,
        data: result.appeals,
        pagination: {
          page: req.query.page ? parseInt(req.query.page as string) : 1,
          limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
          total: result.total,
          pages: Math.ceil(
            result.total /
              (req.query.limit ? parseInt(req.query.limit as string) : 20)
          ),
        },
      });
    } catch (error) {
      logger.error('Error listing appeals:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * GET /api/moderation/appeals/:id
   * Get a specific appeal
   */
  getAppeal = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const appeal = this.appealService.getAppeal(id);

      if (!appeal) {
        res.status(404).json({
          success: false,
          error: 'Appeal not found',
        });
        return;
      }

      res.json({
        success: true,
        data: appeal,
      });
    } catch (error) {
      logger.error('Error getting appeal:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * POST /api/moderation/appeals/:id/review
   * Review and decide on an appeal
   */
  reviewAppeal = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { decision, reason, notes } = req.body;

      if (!decision || !reason) {
        res.status(400).json({
          success: false,
          error: 'decision and reason are required',
        });
        return;
      }

      const reviewerId = (req as any).user?.id || 'unknown';
      const reviewerName =
        (req as any).user?.username || (req as any).user?.email || 'Unknown';

      const result = this.appealService.reviewAppeal(
        id,
        reviewerId,
        reviewerName,
        decision as AppealStatus,
        reason,
        notes || ''
      );

      if (!result) {
        res.status(404).json({
          success: false,
          error: 'Appeal not found',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          appeal: result.appeal,
          item: result.item,
        },
        message: `Appeal ${decision}`,
      });
    } catch (error) {
      logger.error('Error reviewing appeal:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * GET /api/moderation/stats
   * Get moderation statistics
   */
  getStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = this.queueService.getStats();
      const modelAccuracy = this.scoringService.getModelAccuracy();
      const appealStats = this.appealService.getAppealStats();

      res.json({
        success: true,
        data: {
          ...stats,
          modelAccuracy: modelAccuracy.accuracy,
          modelTotal: modelAccuracy.total,
          modelCorrect: modelAccuracy.correct,
          appeals: appealStats,
        },
      });
    } catch (error) {
      logger.error('Error getting stats:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * GET /api/moderation/config
   * Get ML model configuration
   */
  getConfig = async (_req: Request, res: Response): Promise<void> => {
    try {
      const config = this.scoringService.getConfig();
      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      logger.error('Error getting config:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * PUT /api/moderation/config
   * Update ML model configuration
   */
  updateConfig = async (req: Request, res: Response): Promise<void> => {
    try {
      const updates = req.body;
      const config = this.scoringService.updateConfig(updates);

      res.json({
        success: true,
        data: config,
        message: 'ML model configuration updated',
      });
    } catch (error) {
      logger.error('Error updating config:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * GET /api/moderation/health
   * Health check for moderation service
   */
  healthCheck = async (_req: Request, res: Response): Promise<void> => {
    try {
      const stats = this.queueService.getStats();
      const modelAccuracy = this.scoringService.getModelAccuracy();

      res.json({
        success: true,
        status: 'healthy',
        service: 'moderation',
        timestamp: new Date().toISOString(),
        pendingJobs: this.job?.getPendingCount() || 0,
        modelVersion: this.scoringService.getConfig().modelVersion,
        modelAccuracy: modelAccuracy.accuracy,
        queueSize: stats.queued,
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Map a moderation action to a severity level
   */
  private mapActionToSeverity(action: ModerationAction): SeverityLevel {
    switch (action) {
      case ModerationAction.BAN_USER:
        return SeverityLevel.CRITICAL;
      case ModerationAction.REJECT:
      case ModerationAction.REMOVE:
        return SeverityLevel.HIGH;
      case ModerationAction.ESCALATE:
      case ModerationAction.FLAG_FOR_REVIEW:
        return SeverityLevel.MEDIUM;
      case ModerationAction.WARN_USER:
      case ModerationAction.REQUEST_EDIT:
        return SeverityLevel.LOW;
      default:
        return SeverityLevel.LOW;
    }
  }
}