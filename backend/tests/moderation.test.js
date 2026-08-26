/**
 * Moderation Service Tests
 * Tests for ML-assisted content moderation system
 */

const { ModerationScoringService } = require('../src/services/moderation/ModerationScoringService');
const { ModerationQueueService } = require('../src/services/moderation/ModerationQueueService');
const { AppealService } = require('../src/services/moderation/AppealService');
const { ModerationJob } = require('../src/workers/moderationJob');
const {
  ModerationStatus,
  ContentType,
  SeverityLevel,
  PolicyViolationType,
  ModerationAction,
  AppealStatus,
  DEFAULT_ML_CONFIG,
} = require('../src/models/Moderation');

describe('Moderation System', () => {
  let scoringService;
  let queueService;
  let appealService;

  const createTestItem = (overrides = {}) => ({
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
    appealService.setItemsStore(queueService.itemsStore);
  });

  beforeEach(() => {
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
      expect(scored.riskScore.overall).toBeLessThan(40);
      expect(scored.riskScore.confidence).toBeGreaterThan(0);
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
      expect(scored.riskScore.overall).toBeGreaterThan(0);
      const spamScore = scored.riskScore.policyScores.find(
        (p) => p.policyType === PolicyViolationType.SPAM
      );
      expect(spamScore).toBeDefined();
      expect(spamScore.score).toBeGreaterThan(0);
    });

    it('should detect hate speech', async () => {
      const item = createTestItem({
        title: 'Some post',
        description: 'A post',
        content: 'hate racist discriminat bigot supremacist xenophob content',
      });

      const scored = await scoringService.scoreItem(item);

      expect(scored.riskScore).toBeDefined();
      const hateScore = scored.riskScore.policyScores.find(
        (p) => p.policyType === PolicyViolationType.HATE_SPEECH
      );
      expect(hateScore).toBeDefined();
      expect(hateScore.score).toBeGreaterThan(0);
    });

    it('should determine severity correctly', async () => {
      const cleanItem = createTestItem({
        title: 'Clean',
        content: 'simple clean text with nothing wrong',
      });
      const highRiskItem = createTestItem({
        title: 'I WILL KILL YOU',
        content: 'kill murder attack weapon bomb terror shoot stab assault harm kill murder attack weapon bomb terror shoot stab assault harm kill murder attack kill murder attack weapon bomb',
      });

      const clean = await scoringService.scoreItem(cleanItem);
      const high = await scoringService.scoreItem(highRiskItem);

      expect(clean.severity).toBe(SeverityLevel.LOW);
      // High-risk violence content should at minimum be MEDIUM or higher
      expect(['medium', 'high', 'critical']).toContain(high.severity);
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
        createTestItem({ id: 'batch-1', title: 'Clean 1', content: 'simple content' }),
        createTestItem({ id: 'batch-2', title: 'Spam', content: 'free money click here act now' }),
        createTestItem({ id: 'batch-3', title: 'Clean 2', content: 'regular educational text' }),
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
      const item = createTestItem({ id: 'q-item-1', status: ModerationStatus.QUEUED });
      queueService.upsertItem(item);
      queueService.enqueueItem(item);

      const moderatorId = 'mod-1';
      queueService.addModeratorToQueue('default', moderatorId);

      const claimed = queueService.dequeueItem(moderatorId);

      expect(claimed).not.toBeNull();
      expect(claimed.status).toBe(ModerationStatus.IN_REVIEW);
      expect(claimed.assignedModeratorId).toBe(moderatorId);
    });

    it('should process moderator decisions', () => {
      const item = createTestItem({ id: 'dec-item-1' });
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
      expect(result.status).toBe(ModerationStatus.APPROVED);
      expect(result.decision).not.toBeNull();
      expect(result.decision.action).toBe(ModerationAction.APPROVE);
    });

    it('should reject items with model feedback', () => {
      const item = createTestItem({ id: 'rej-item-1' });
      queueService.upsertItem(item);

      const result = queueService.processDecision(
        item.id, 'mod-1', 'Moderator One',
        ModerationAction.REJECT, 'Contains spam', 'Multiple spam patterns detected',
        {
          predictionCorrect: false,
          actualSeverity: SeverityLevel.HIGH,
          predictedSeverity: SeverityLevel.LOW,
          improvementNotes: 'Missed spam patterns',
          misclassifiedPolicies: [PolicyViolationType.SPAM],
        }
      );

      expect(result.status).toBe(ModerationStatus.REJECTED);
      expect(result.decision.modelFeedback.predictionCorrect).toBe(false);
    });

    it('should filter items by status', () => {
      const approved = createTestItem({ id: 'approved-99', status: ModerationStatus.APPROVED, title: 'Approved content' });
      const queued = createTestItem({
        id: 'queued-99', status: ModerationStatus.QUEUED, title: 'Queued content',
        riskScore: { overall: 60, policyScores: [], textRisk: 0, metadataRisk: 0, userHistoryRisk: 0, similarityRisk: 0, confidence: 0.8, modelVersion: '1.0.0' },
      });

      queueService.upsertItem(approved);
      queueService.upsertItem(queued);

      const queuedItems = queueService.getItems({ status: ModerationStatus.QUEUED });
      expect(queuedItems.total).toBeGreaterThanOrEqual(1);
    });

    it('should provide statistics', () => {
      const stats = queueService.getStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('queued');
      expect(stats).toHaveProperty('approved');
      expect(stats).toHaveProperty('rejected');
    });

    it('should manage moderator assignments', () => {
      queueService.addModeratorToQueue('default', 'mod-1');
      queueService.removeModeratorFromQueue('default', 'mod-1');
      const queues = queueService.getAllQueues();
      expect(queues.length).toBeGreaterThan(0);
    });
  });

  describe('AppealService', () => {
    it('should submit an appeal for rejected content', () => {
      const item = createTestItem({ id: 'app-item-1', status: ModerationStatus.REJECTED });
      queueService.upsertItem(item);

      const appeal = appealService.submitAppeal(
        item.id, 'author-1', 'Test Author',
        'Unfair rejection',
        'My content does not violate any policies and was incorrectly flagged.',
        [{ type: 'text', description: 'Original source', value: 'https://example.com' }]
      );

      expect(appeal).not.toBeNull();
      expect(appeal.status).toBe(AppealStatus.PENDING);
      expect(appeal.evidence.length).toBe(1);
      expect(appeal.moderationId).toBe(item.id);
    });

    it('should not allow appeals for non-rejected content', () => {
      const item = createTestItem({ id: 'no-app-item', status: ModerationStatus.APPROVED });
      queueService.upsertItem(item);

      const appeal = appealService.submitAppeal(
        item.id, 'author-1', 'Test Author',
        'Unfair', 'Explanation', []
      );

      expect(appeal).toBeNull();
    });

    it('should review and approve an appeal', () => {
      const item = createTestItem({ id: 'review-item-1', status: ModerationStatus.REJECTED });
      queueService.upsertItem(item);

      const appeal = appealService.submitAppeal(
        item.id, 'author-1', 'Author', 'Wrongly rejected',
        'This was a false positive', []
      );

      const result = appealService.reviewAppeal(
        appeal.id, 'admin-1', 'Admin User',
        AppealStatus.APPROVED, 'Content looks fine', 'False positive confirmed'
      );

      expect(result).not.toBeNull();
      expect(result.appeal.status).toBe(AppealStatus.APPROVED);
      expect(result.item.status).toBe(ModerationStatus.APPROVED);
    });

    it('should deny an appeal and keep item rejected', () => {
      const item = createTestItem({ id: 'deny-item-1', status: ModerationStatus.REJECTED });
      queueService.upsertItem(item);

      const appeal = appealService.submitAppeal(
        item.id, 'author-1', 'Author', 'Please reconsider',
        'I think this was a mistake', []
      );

      const result = appealService.reviewAppeal(
        appeal.id, 'admin-1', 'Admin User',
        AppealStatus.DENIED, 'Content clearly violates spam policy', 'Appeal has no merit'
      );

      expect(result.appeal.status).toBe(AppealStatus.DENIED);
      expect(result.item.status).toBe(ModerationStatus.REJECTED);
    });
  });

  describe('ModerationJob', () => {
    it('should create and start a moderation job', () => {
      const job = new ModerationJob(scoringService, queueService, {
        pollingIntervalMs: 1000,
        concurrency: 2,
        batchSize: 5,
      });

      job.start();
      expect(job.getPendingCount()).toBe(0);
      job.stop();
    });

    it('should submit items for async processing', () => {
      const job = new ModerationJob(scoringService, queueService);
      const items = [{
        contentId: 'content-1',
        contentType: ContentType.USER_POST,
        title: 'Test',
        description: 'Test',
        content: 'Clean content',
        authorId: 'author-1',
        authorName: 'Author',
        authorEmail: 'test@test.com',
      }];

      const submitted = job.submitItems(items);
      expect(submitted.length).toBe(1);
      expect(submitted[0].status).toBe(ModerationStatus.PENDING);
      expect(job.getPendingCount()).toBe(1);
    });
  });

  describe('Integration Tests', () => {
    it('should complete full moderation lifecycle', async () => {
      const item = createTestItem({
        id: 'lifecycle-1',
        title: 'Suspicious Course Material',
        description: 'Get answers easily',
        content: 'cheat exam answers test bank homework solutions pay for grade',
      });

      // 1. Score
      queueService.upsertItem(item);
      const scored = await scoringService.scoreItem(item);
      queueService.upsertItem(scored);
      expect(scored.riskScore).toBeDefined();

      // 2. Queue and review if needed
      if (scored.status === ModerationStatus.QUEUED) {
        queueService.enqueueItem(scored);
        queueService.addModeratorToQueue('default', 'mod-1');
        const claimed = queueService.dequeueItem('mod-1');
        expect(claimed).not.toBeNull();

        // 3. Decision
        const decision = queueService.processDecision(
          scored.id, 'mod-1', 'Moderator',
          ModerationAction.REJECT, 'Contains cheating material',
          'Multiple cheating keywords detected',
          { predictionCorrect: true, actualSeverity: SeverityLevel.HIGH,
            predictedSeverity: scored.severity, improvementNotes: '', misclassifiedPolicies: [] }
        );
        expect(decision.status).toBe(ModerationStatus.REJECTED);

        // 4. Appeal
        const appeal = appealService.submitAppeal(
          scored.id, 'author-1', 'Author', 'Wrong decision',
          'This content is educational, not cheating material.', []
        );
        expect(appeal).not.toBeNull();

        // 5. Review appeal
        const appealResult = appealService.reviewAppeal(
          appeal.id, 'admin-1', 'Admin',
          AppealStatus.APPROVED, 'Content is legitimate educational material', 'False positive'
        );
        expect(appealResult.item.status).toBe(ModerationStatus.APPROVED);
      }
    });
  });

  describe('Performance', () => {
    it('should score items quickly', async () => {
      const item = createTestItem({ content: 'Test content for performance measurement' });
      const start = Date.now();
      await scoringService.scoreItem(item);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);
    });

    it('should batch score efficiently', async () => {
      const items = Array.from({ length: 20 }, (_, i) =>
        createTestItem({ id: `perf-${i}`, content: `Test content number ${i} for batch performance` })
      );
      const start = Date.now();
      await scoringService.scoreBatch(items);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5000);
    });
  });
});