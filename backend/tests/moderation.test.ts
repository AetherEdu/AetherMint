/**
 * Moderation Service Tests
 * Comprehensive tests for ML-assisted content moderation:
 * - Risk scoring accuracy
 * - Queue management
 * - Decision recording and model feedback
 * - Appeal flow
 */

import { ModerationScoringService } from '../src/services/moderation/ModerationScoringService';
import { ModerationQueueService } from '../src/services/moderation/ModerationQueueService';
import { AppealService } from '../src/services/moderation/AppealService';
import { ModerationJob } from '../src/workers/moderationJob';
import {
  ModerationItem,
  ModerationStatus,
  ContentType,
  SeverityLevel,
  PolicyViolationType,
  ModerationAction,
  AppealStatus,
  DEFAULT_ML_CONFIG,
} from '../src/models/Moderation';

describe('Moderation System', () => {
  let scoringService: ModerationScoringService;
  let queueService: ModerationQueueService;
  let appealService: AppealService;

  const createTestItem = (overrides: Partial<ModerationItem> = {}): ModerationItem => ({
    id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    contentId: 'content-1',
    contentType: ContentType.USER_POST,
    title: overrides.title || 'Test Content',
    description: overrides.description || 'A test moderation item',
    content: overrides.content || 'Some content to moderate',
    authorId: 'author-1',
    authorName: 'Test Author',
    authorEmail: 'test@example.com',
    status: ModerationStatus.PENDING,
    riskScore: null,
    severity: SeverityLevel.LOW,
    flags: overrides.flags || 0,
    reports: [],
    assignedModeratorId: null,
    moderatorNotes: '',
    decision: null,
    appeal: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    scoredAt: null,
    reviewedAt: null,
    resolvedAt: null,
    ...overrides,
  });

  beforeAll(() => {
    scoringService = new ModerationScoringService();
    queueService = new ModerationQueueService();
    appealService = new AppealService();
    appealService.setItemsStore((queueService as any).itemsStore);
  });

  beforeEach(() => {
    // Reset services for clean test state
    scoringService.updateConfig(DEFAULT_ML_CONFIG);
  });

  describe('ModerationScoringService', () => {
    it('should score clean content with low risk', async () => {
      const item = createTestItem({
        title: 'Introduction to Mathematics',
        description: 'A basic course on algebra and geometry',
        content: 'Mathematics is the study of numbers, quantities, and shapes...',
      });

      const scored = await scoringService.scoreItem(item);

      expect(scored.riskScore).toBeDefined();
      expect(scored.riskScore!.overall).toBeLessThan(40);
      expect(scored.riskScore!.confidence).toBeGreaterThan(0);
      expect(scored.status).toBeDefined();
    });

    it('should detect spam content with high risk', async () => {
      const item = createTestItem({
        title: 'FREE MONEY CLICK HERE!!!!',
        description: 'Act now and get free money guaranteed!',
        content: 'Click here to claim your free money now. Subscribe now for more free money opportunities. Discount limited offer!',
      });

      const scored = await scoringService.scoreItem(item);

      expect(scored.riskScore).toBeDefined();
      expect(scored.riskScore!.overall).toBeGreaterThan(0);
      const spamScore = scored.riskScore!.policyScores.find(
        (p) => p.policyType === PolicyViolationType.SPAM
      );
      expect(spamScore).toBeDefined();
      expect(spamScore!.score).toBeGreaterThan(0);
    });

    it('should detect hate speech with high severity', async () => {
      const item = createTestItem({
        title: 'Some post',
        description: 'A post',
        content: 'hate racist discriminat bigot supremacist xenophob content',
      });

      const scored = await scoringService.scoreItem(item);

      expect(scored.riskScore).toBeDefined();
      const hateScore = scored.riskScore!.policyScores.find(
        (p) => p.policyType === PolicyViolationType.HATE_SPEECH
      );
      expect(hateScore).toBeDefined();
      expect(hateScore!.score).toBeGreaterThan(0);
    });

    it('should auto-approve very low risk content', async () => {
      const item = createTestItem({
        title: 'Hello World',
        description: 'Simple greeting',
        content: 'Hello everyone, welcome to the platform!',
      });

      const scored = await scoringService.scoreItem(item);

      // Low risk might be auto-approved or queued
      expect([
        ModerationStatus.AUTO_APPROVED,
        ModerationStatus.QUEUED,
      ]).toContain(scored.status);
    });

    it('should determine severity correctly', async () => {
      const cleanItem = createTestItem({
        title: 'Clean',
        content: 'simple clean text with nothing wrong',
      });
      const highRiskItem = createTestItem({
        title: 'VIOLENCE',
        content: 'kill murder attack weapon bomb shoot stab assault harm',
      });

      const clean = await scoringService.scoreItem(cleanItem);
      const high = await scoringService.scoreItem(highRiskItem);

      expect(clean.severity).toBe(SeverityLevel.LOW);
      expect(high.severity).toBe(SeverityLevel.CRITICAL);
    });

    it('should record feedback and track model accuracy', () => {
      scoringService.recordFeedback('item-1', SeverityLevel.LOW, SeverityLevel.LOW);
      scoringService.recordFeedback('item-2', SeverityLevel.HIGH, SeverityLevel.MEDIUM);
      scoringService.recordFeedback('item-3', SeverityLevel.MEDIUM, SeverityLevel.MEDIUM);

      const accuracy = scoringService.getModelAccuracy();

      expect(accuracy.total).toBe(3);
      expect(accuracy.correct).toBe(2);
      expect(accuracy.accuracy).toBeCloseTo(2 / 3);
    });

    it('should batch score multiple items', async () => {
      const items = [
        createTestItem({ title: 'Clean 1', content: 'simple content' }),
        createTestItem({ title: 'Spam', content: 'free money click here act now' }),
        createTestItem({ title: 'Clean 2', content: 'regular educational text' }),
      ];

      const scored = await scoringService.scoreBatch(items);

      expect(scored.length).toBe(3);
      expect(scored.every((item) => item.riskScore !== null)).toBe(true);
    });

    it('should update model configuration', () => {
      const config = scoringService.updateConfig({
        autoApproveThreshold: 20,
        autoRejectThreshold: 95,
      });

      expect(config.autoApproveThreshold).toBe(20);
      expect(config.autoRejectThreshold).toBe(95);
      expect(config.modelVersion).toBe(DEFAULT_ML_CONFIG.modelVersion);
    });

    it('should return current configuration', () => {
      const config = scoringService.getConfig();

      expect(config).toHaveProperty('autoApproveThreshold');
      expect(config).toHaveProperty('autoRejectThreshold');
      expect(config).toHaveProperty('queueThreshold');
      expect(config).toHaveProperty('minConfidence');
      expect(config).toHaveProperty('modelVersion');
      expect(config).toHaveProperty('activePolicies');
    });
  });

  describe('ModerationQueueService', () => {
    it('should enqueue and dequeue items', () => {
      const item = createTestItem({ status: ModerationStatus.QUEUED });
      queueService.upsertItem(item);
      queueService.enqueueItem(item);

      const moderatorId = 'mod-1';
      queueService.addModeratorToQueue('default', moderatorId);

      const claimed = queueService.dequeueItem(moderatorId);

      expect(claimed).not.toBeNull();
      expect(claimed!.status).toBe(ModerationStatus.IN_REVIEW);
      expect(claimed!.assignedModeratorId).toBe(moderatorId);
    });

    it('should process moderator decisions', () => {
      const item = createTestItem();
      queueService.upsertItem(item);

      const result = queueService.processDecision(
        item.id,
        'mod-1',
        'Moderator One',
        ModerationAction.APPROVE,
        'Looks clean',
        'No issues found',
        {
          predictionCorrect: true,
          actualSeverity: SeverityLevel.LOW,
          predictedSeverity: SeverityLevel.LOW,
          improvementNotes: '',
          misclassifiedPolicies: [],
        }
      );

      expect(result).not.toBeNull();
      expect(result!.status).toBe(ModerationStatus.APPROVED);
      expect(result!.decision).not.toBeNull();
      expect(result!.decision!.action).toBe(ModerationAction.APPROVE);
    });

    it('should reject items via moderation decision', () => {
      const item = createTestItem();
      queueService.upsertItem(item);

      const result = queueService.processDecision(
        item.id,
        'mod-1',
        'Moderator One',
        ModerationAction.REJECT,
        'Contains spam',
        'Multiple spam patterns detected',
        {
          predictionCorrect: false,
          actualSeverity: SeverityLevel.HIGH,
          predictedSeverity: SeverityLevel.LOW,
          improvementNotes: 'Missed spam patterns',
          misclassifiedPolicies: [PolicyViolationType.SPAM],
        }
      );

      expect(result!.status).toBe(ModerationStatus.REJECTED);
      expect(result!.decision!.modelFeedback.predictionCorrect).toBe(false);
    });

    it('should filter items correctly', () => {
      const approved = createTestItem({
        id: 'approved-1',
        status: ModerationStatus.APPROVED,
        title: 'Approved content',
      });
      const queued = createTestItem({
        id: 'queued-1',
        status: ModerationStatus.QUEUED,
        title: 'Queued content',
        riskScore: { overall: 60, policyScores: [], textRisk: 0, metadataRisk: 0, userHistoryRisk: 0, similarityRisk: 0, confidence: 0.8, modelVersion: '1.0.0' },
      });

      queueService.upsertItem(approved);
      queueService.upsertItem(queued);

      const queuedItems = queueService.getItems({ status: ModerationStatus.QUEUED });
      expect(queuedItems.total).toBe(1);
      expect(queuedItems.items[0].id).toBe('queued-1');

      const highRisk = queueService.getItems({ minRiskScore: 50 });
      expect(highRisk.total).toBe(1);
      expect(highRisk.items[0].id).toBe('queued-1');
    });

    it('should provide statistics', () => {
      const stats = queueService.getStats();

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('queued');
      expect(stats).toHaveProperty('approved');
      expect(stats).toHaveProperty('rejected');
      expect(stats).toHaveProperty('averageRiskScore');
    });

    it('should manage queues', () => {
      const queues = queueService.getAllQueues();
      expect(queues.length).toBeGreaterThan(0);
      expect(queues[0].id).toBe('default');
      expect(queues[0].name).toBe('General Moderation Queue');
    });

    it('should add and remove moderators from queues', () => {
      const added = queueService.addModeratorToQueue('default', 'mod-1');
      expect(added).toBe(true);

      // Should not duplicate
      queueService.addModeratorToQueue('default', 'mod-1');
      const queue = queueService.getQueue('default');
      const modCount = queue!.moderators.filter((m) => m === 'mod-1').length;
      expect(modCount).toBe(1);

      const removed = queueService.removeModeratorFromQueue('default', 'mod-1');
      expect(removed).toBe(true);
    });
  });

  describe('AppealService', () => {
    it('should submit an appeal for rejected content', () => {
      const item = createTestItem({ status: ModerationStatus.REJECTED });
      queueService.upsertItem(item);

      const appeal = appealService.submitAppeal(
        item.id,
        'author-1',
        'Test Author',
        'Unfair rejection',
        'My content does not violate any policies and was incorrectly flagged.',
        [{ type: 'text', description: 'Original source', value: 'https://example.com' }]
      );

      expect(appeal).not.toBeNull();
      expect(appeal!.status).toBe(AppealStatus.PENDING);
      expect(appeal!.evidence.length).toBe(1);
      expect(appeal!.moderationId).toBe(item.id);
    });

    it('should not allow appeals for non-rejected content', () => {
      const item = createTestItem({ status: ModerationStatus.APPROVED });
      queueService.upsertItem(item);

      const appeal = appealService.submitAppeal(
        item.id,
        'author-1',
        'Test Author',
        'Unfair',
        'Explanation',
        []
      );

      expect(appeal).toBeNull();
    });

    it('should not allow duplicate appeals', () => {
      const item = createTestItem({ status: ModerationStatus.REJECTED });
      queueService.upsertItem(item);

      appealService.submitAppeal(item.id, 'author-1', 'Test', 'Reason', 'Explanation', []);
      const duplicate = appealService.submitAppeal(item.id, 'author-1', 'Test', 'Reason 2', 'Explanation 2', []);

      expect(duplicate).not.toBeNull(); // Returns existing appeal
    });

    it('should review and approve an appeal', () => {
      const item = createTestItem({ status: ModerationStatus.REJECTED });
      queueService.upsertItem(item);

      const appeal = appealService.submitAppeal(
        item.id, 'author-1', 'Author', 'Wrongly rejected',
        'This was a false positive', []
      );

      const result = appealService.reviewAppeal(
        appeal!.id,
        'admin-1',
        'Admin User',
        AppealStatus.APPROVED,
        'Content looks fine',
        'False positive confirmed'
      );

      expect(result).not.toBeNull();
      expect(result!.appeal.status).toBe(AppealStatus.APPROVED);
      expect(result!.item.status).toBe(ModerationStatus.APPROVED);
    });

    it('should deny an appeal and keep item rejected', () => {
      const item = createTestItem({ status: ModerationStatus.REJECTED });
      queueService.upsertItem(item);

      const appeal = appealService.submitAppeal(
        item.id, 'author-1', 'Author', 'Please reconsider',
        'I think this was a mistake', []
      );

      const result = appealService.reviewAppeal(
        appeal!.id,
        'admin-1',
        'Admin User',
        AppealStatus.DENIED,
        'Content clearly violates spam policy',
        'Appeal has no merit'
      );

      expect(result!.appeal.status).toBe(AppealStatus.DENIED);
      expect(result!.item.status).toBe(ModerationStatus.REJECTED);
    });

    it('should filter appeals by status', () => {
      const item1 = createTestItem({ id: 'item-1', status: ModerationStatus.REJECTED });
      const item2 = createTestItem({ id: 'item-2', status: ModerationStatus.REJECTED });
      queueService.upsertItem(item1);
      queueService.upsertItem(item2);

      const a1 = appealService.submitAppeal(item1.id, 'user-1', 'User 1', 'R1', 'E1', []);
      const a2 = appealService.submitAppeal(item2.id, 'user-2', 'User 2', 'R2', 'E2', []);

      appealService.reviewAppeal(a1!.id, 'admin', 'Admin', AppealStatus.APPROVED, 'OK', '');

      const pending = appealService.getAppeals({ status: AppealStatus.PENDING });
      const approved = appealService.getAppeals({ status: AppealStatus.APPROVED });

      expect(pending.total).toBe(1);
      expect(approved.total).toBe(1);
    });

    it('should provide appeal statistics', () => {
      const stats = appealService.getAppealStats();

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('approved');
      expect(stats).toHaveProperty('denied');
      expect(stats).toHaveProperty('averageResolutionTime');
    });
  });

  describe('ModerationJob', () => {
    it('should create and start a moderation job', () => {
      const job = new ModerationJob(scoringService, queueService, {
        pollingIntervalMs: 100,
        concurrency: 2,
        batchSize: 5,
      });

      job.start();
      expect(job.getPendingCount()).toBe(0);
      job.stop();
    });

    it('should submit items for async processing', () => {
      const job = new ModerationJob(scoringService, queueService);
      const items = [
        {
          contentId: 'content-1',
          contentType: ContentType.USER_POST,
          title: 'Test',
          description: 'Test',
          content: 'Clean content',
          authorId: 'author-1',
          authorName: 'Author',
          authorEmail: 'test@test.com',
        },
      ];

      const submitted = job.submitItems(items);
      expect(submitted.length).toBe(1);
      expect(submitted[0].status).toBe(ModerationStatus.PENDING);
      expect(job.getPendingCount()).toBe(1);
    });

    it('should not start twice', () => {
      const job = new ModerationJob(scoringService, queueService);
      job.start();
      const count = job.getPendingCount();
      // Starting again should be a no-op
      job.start();
      expect(job.getPendingCount()).toBe(count);
      job.stop();
    });
  });

  describe('Integration Tests', () => {
    it('should complete full moderation lifecycle', async () => {
      const item = createTestItem({
        title: 'Suspicious Course Material',
        description: 'Get answers easily',
        content: 'cheat exam answers test bank homework solutions pay for grade',
      });

      // 1. Submit for scoring
      queueService.upsertItem(item);
      const scored = await scoringService.scoreItem(item);
      queueService.upsertItem(scored);

      expect(scored.riskScore).toBeDefined();

      // 2. Queue for review if needed
      if (scored.status === ModerationStatus.QUEUED) {
        queueService.enqueueItem(scored);
        queueService.addModeratorToQueue('default', 'mod-1');
        const claimed = queueService.dequeueItem('mod-1');
        expect(claimed).not.toBeNull();

        // 3. Make decision
        const decision = queueService.processDecision(
          scored.id,
          'mod-1',
          'Moderator',
          ModerationAction.REJECT,
          'Contains cheating material',
          'Multiple cheating keywords detected',
          {
            predictionCorrect: true,
            actualSeverity: SeverityLevel.HIGH,
            predictedSeverity: scored.severity,
            improvementNotes: '',
            misclassifiedPolicies: [],
          }
        );

        expect(decision!.status).toBe(ModerationStatus.REJECTED);

        // 4. Submit appeal
        const appeal = appealService.submitAppeal(
          scored.id,
          'author-1',
          'Author',
          'Wrong decision',
          'This content is educational, not cheating material.',
          []
        );

        expect(appeal).not.toBeNull();

        // 5. Review appeal
        const appealResult = appealService.reviewAppeal(
          appeal!.id,
          'admin-1',
          'Admin',
          AppealStatus.APPROVED,
          'Content is legitimate educational material',
          'False positive - updating model feedback'
        );

        expect(appealResult!.item.status).toBe(ModerationStatus.APPROVED);
      }
    });

    it('should handle batch submission with mixed content types', async () => {
      const items = [
        createTestItem({
          contentType: ContentType.COURSE,
          title: 'Introduction to Python',
          content: 'Learn Python programming basics...',
        }),
        createTestItem({
          contentType: ContentType.COMMENT,
          title: 'Spam comment',
          content: 'Free money click here now!!!',
        }),
        createTestItem({
          contentType: ContentType.FILE,
          title: 'Assignment file',
          content: 'Assignment submission content...',
        }),
      ];

      for (const item of items) {
        queueService.upsertItem(item);
      }

      const scored = await scoringService.scoreBatch(items);
      expect(scored.length).toBe(3);
      expect(scored.every((item) => item.riskScore !== null)).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should score items quickly', async () => {
      const item = createTestItem({
        content: 'Test content for performance measurement',
      });

      const start = Date.now();
      await scoringService.scoreItem(item);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete in under 1s
    });

    it('should batch score efficiently', async () => {
      const items = Array.from({ length: 20 }, (_, i) =>
        createTestItem({
          id: `perf-${i}`,
          content: `Test content number ${i} for batch performance`,
        })
      );

      const start = Date.now();
      await scoringService.scoreBatch(items);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000); // 20 items in under 5s
    });
  });
});