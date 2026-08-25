/**
 * Moderation Scoring Service
 * ML-assisted pre-screening for policy violations.
 * Scores content for risk, categorizes violations, and provides
 * confidence-aware recommendations for auto-approval, auto-rejection,
 * or human review queue routing.
 */

import { randomUUID } from 'crypto';
import {
  ModerationItem,
  ContentType,
  ModerationStatus,
  SeverityLevel,
  PolicyViolationType,
  RiskScoreBreakdown,
  PolicyScore,
  MLModelConfig,
  DEFAULT_ML_CONFIG,
  PolicyScore as PolicyScoreType,
} from '../../models/Moderation';
import logger from '../../utils/logger';

export class ModerationScoringService {
  private config: MLModelConfig;
  private decisionHistory: Array<{
    predicted: SeverityLevel;
    actual: SeverityLevel;
    itemId: string;
  }> = [];

  constructor(config?: Partial<MLModelConfig>) {
    this.config = { ...DEFAULT_ML_CONFIG, ...config };
  }

  /**
   * Score a moderation item for policy violations.
   * Returns a risk score breakdown and routes the item.
   */
  async scoreItem(item: ModerationItem): Promise<ModerationItem> {
    const startTime = Date.now();
    logger.info(`Scoring moderation item ${item.id} (${item.contentType})`);

    try {
      item.status = ModerationStatus.SCORING;
      item.scoredAt = new Date();

      const riskScore = await this.computeRiskScore(item);

      item.riskScore = riskScore;
      item.severity = this.determineSeverity(riskScore.overall);

      // Route based on risk score
      item.status = this.routeItem(riskScore);

      logger.info(
        `Scored item ${item.id}: risk=${riskScore.overall.toFixed(1)}, ` +
        `severity=${item.severity}, status=${item.status}, ` +
        `time=${(Date.now() - startTime)}ms`
      );

      return item;
    } catch (error) {
      logger.error(`Error scoring item ${item.id}:`, error);
      item.status = ModerationStatus.PENDING;
      return item;
    }
  }

  /**
   * Batch score multiple items
   */
  async scoreBatch(items: ModerationItem[]): Promise<ModerationItem[]> {
    const scored = await Promise.allSettled(
      items.map((item) => this.scoreItem(item))
    );

    return scored.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      logger.error(`Failed to score item ${items[index].id}:`, result.reason);
      return items[index];
    });
  }

  /**
   * Compute risk score breakdown for an item
   */
  private async computeRiskScore(item: ModerationItem): Promise<RiskScoreBreakdown> {
    const policyScores = await this.analyzePolicies(item);
    const textRisk = this.computeTextRisk(item);
    const metadataRisk = this.computeMetadataRisk(item);
    const userHistoryRisk = await this.computeUserHistoryRisk(item);
    const similarityRisk = await this.computeSimilarityRisk(item);

    // Weighted overall risk
    const overall =
      policyScores.reduce((sum, p) => sum + p.score, 0) / Math.max(1, policyScores.length) * 0.40 +
      textRisk * 0.20 +
      metadataRisk * 0.10 +
      userHistoryRisk * 0.15 +
      similarityRisk * 0.15;

    const confidence = this.computeConfidence(policyScores, item);

    return {
      overall: Math.min(100, Math.max(0, overall)),
      policyScores,
      textRisk,
      metadataRisk,
      userHistoryRisk,
      similarityRisk,
      confidence,
      modelVersion: this.config.modelVersion,
    };
  }

  /**
   * Analyze content against each active policy
   */
  private async analyzePolicies(item: ModerationItem): Promise<PolicyScore[]> {
    const scores: PolicyScore[] = [];
    const content = `${item.title} ${item.description} ${item.content}`.toLowerCase();

    for (const policy of this.config.activePolicies) {
      const result = this.scanForPolicy(content, policy);
      if (result.score > 0) {
        scores.push(result);
      }
    }

    if (scores.length === 0) {
      // Default clean score
      scores.push({
        policyType: PolicyViolationType.COMMUNITY_GUIDELINES,
        score: 0,
        confidence: 1.0,
        keywords: [],
        matchedPatterns: [],
      });
    }

    return scores;
  }

  /**
   * Scan content for a specific policy violation
   */
  private scanForPolicy(
    content: string,
    policy: PolicyViolationType
  ): PolicyScoreType {
    const patterns = this.getPolicyPatterns(policy);
    const matchedPatterns: string[] = [];
    const keywords: string[] = [];
    let matchCount = 0;

    for (const pattern of patterns) {
      const regex = new RegExp(`\\b${this.escapeRegex(pattern)}\\b`, 'gi');
      const matches = content.match(regex);
      if (matches) {
        matchedPatterns.push(pattern);
        keywords.push(...matches);
        matchCount += matches.length;
      }
    }

    // Score based on match density and severity of policy
    const baseScore = Math.min(matchCount * 8, 80);
    const policyWeight = this.getPolicyWeight(policy);
    const score = Math.min(100, baseScore * policyWeight);
    const confidence = Math.min(1, matchCount / 5 + 0.3);

    return {
      policyType: policy,
      score,
      confidence,
      keywords: [...new Set(keywords)].slice(0, 20),
      matchedPatterns,
    };
  }

  /**
   * Get detection patterns for each policy type
   */
  private getPolicyPatterns(policy: PolicyViolationType): string[] {
    const patterns: Record<PolicyViolationType, string[]> = {
      [PolicyViolationType.HATE_SPEECH]: [
        'hate', 'racist', 'bigot', 'supremacist', 'discriminat',
        'inferior race', 'ethnic cleansing', 'xenophob',
      ],
      [PolicyViolationType.HARASSMENT]: [
        'threat', 'stalk', 'intimidate', 'bully', 'cyberbully',
        'dox', 'swat', 'target', 'retaliat',
      ],
      [PolicyViolationType.SPAM]: [
        'click here', 'free money', 'act now', 'limited offer',
        'buy now', 'discount', 'guaranteed', 'winner',
        'subscribe', 'join now', 'hurry',
      ],
      [PolicyViolationType.NSFW]: [
        'explicit', 'adult content', 'porn', 'nude', 'sexual',
        'xxx', 'nsfw', 'obscene', 'lewd',
      ],
      [PolicyViolationType.VIOLENCE]: [
        'kill', 'murder', 'attack', 'weapon', 'bomb',
        'terror', 'shoot', 'stab', 'assault', 'harm',
      ],
      [PolicyViolationType.COPYRIGHT]: [
        'copyright', 'plagiarized', 'stolen', 'pirated',
        'unauthorized copy', 'DMCA', 'infringe',
      ],
      [PolicyViolationType.MISINFORMATION]: [
        'fake news', 'hoax', 'conspiracy', 'debunked',
        'misleading', 'propaganda', 'false claim',
      ],
      [PolicyViolationType.PLAGIARISM]: [
        'copy', 'plagiar', 'duplicate', 'identical',
        'reproduced without', 'sourced from',
      ],
      [PolicyViolationType.PERSONAL_INFO]: [
        'phone number', 'email address', 'social security',
        'credit card', 'address', 'passport', 'driver license',
        'bank account', 'SSN',
      ],
      [PolicyViolationType.SELF_HARM]: [
        'suicide', 'self-harm', 'cutting', 'end my life',
        'want to die', 'kill myself',
      ],
      [PolicyViolationType.ILLEGAL_CONTENT]: [
        'illegal', 'contraband', 'trafficking', 'smuggl',
        'black market', 'money launder',
      ],
      [PolicyViolationType.COMMUNITY_GUIDELINES]: [
        'offensive', 'inappropriate', 'disturbing', 'disruptive',
        'against rules', 'violation', 'abuse',
      ],
      [PolicyViolationType.CHEATING]: [
        'cheat', 'answer key', 'exam answers', 'test bank',
        'homework solutions', 'pay for grade',
      ],
      [PolicyViolationType.OTHER]: [
        'suspicious', 'concerning', 'unusual', 'anomalous',
      ],
    };

    return patterns[policy] || [];
  }

  /**
   * Get severity weight for policy type
   */
  private getPolicyWeight(policy: PolicyViolationType): number {
    const weights: Record<PolicyViolationType, number> = {
      [PolicyViolationType.ILLEGAL_CONTENT]: 2.0,
      [PolicyViolationType.SELF_HARM]: 2.0,
      [PolicyViolationType.HATE_SPEECH]: 1.8,
      [PolicyViolationType.HARASSMENT]: 1.6,
      [PolicyViolationType.VIOLENCE]: 1.6,
      [PolicyViolationType.PERSONAL_INFO]: 1.5,
      [PolicyViolationType.NSFW]: 1.4,
      [PolicyViolationType.COPYRIGHT]: 1.2,
      [PolicyViolationType.CHEATING]: 1.1,
      [PolicyViolationType.MISINFORMATION]: 1.0,
      [PolicyViolationType.SPAM]: 0.8,
      [PolicyViolationType.PLAGIARISM]: 1.0,
      [PolicyViolationType.COMMUNITY_GUIDELINES]: 0.9,
      [PolicyViolationType.OTHER]: 0.7,
    };

    return weights[policy] || 1.0;
  }

  /**
   * Compute text-based risk factors
   */
  private computeTextRisk(item: ModerationItem): number {
    const text = `${item.title} ${item.description} ${item.content}`;
    let risk = 0;

    // Length-based checks
    if (text.length < 10) risk += 5;
    if (text.length > 10000) risk += 10;

    // Character pattern checks
    const uppercaseRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (uppercaseRatio > 0.5) risk += 15;

    // Excessive punctuation
    const exclamationCount = (text.match(/!/g) || []).length;
    if (exclamationCount > 5) risk += 8;

    // URL count
    const urlCount = (text.match(/https?:\/\//gi) || []).length;
    if (urlCount > 3) risk += 12;

    // ALL CAPS sections
    const capsSections = text.match(/\b[A-Z]{4,}\b/g) || [];
    if (capsSections.length > 3) risk += 10;

    return Math.min(100, risk);
  }

  /**
   * Compute metadata-based risk factors
   */
  private computeMetadataRisk(item: ModerationItem): number {
    let risk = 0;

    // Missing metadata
    if (!item.metadata.category) risk += 5;
    if (!item.metadata.language) risk += 3;

    // Large file size
    if (item.metadata.fileSize && item.metadata.fileSize > 50 * 1024 * 1024) {
      risk += 10;
    }

    // Suspicious file types
    const riskyTypes = ['exe', 'bat', 'sh', 'dmg', 'app', 'msi'];
    if (item.metadata.fileType && riskyTypes.includes(item.metadata.fileType)) {
      risk += 20;
    }

    return Math.min(100, risk);
  }

  /**
   * Compute risk based on user history
   */
  private async computeUserHistoryRisk(item: ModerationItem): Promise<number> {
    let risk = 0;

    // New author (no history) gets moderate risk
    if (!item.authorId || item.authorId === 'unknown') {
      risk += 15;
    }

    // Check if author has previous violations (simulated - would query DB)
    const previousFlags = item.flags || 0;
    if (previousFlags > 0) {
      risk += Math.min(previousFlags * 10, 50);
    }

    return Math.min(100, risk);
  }

  /**
   * Compute similarity risk against known violations
   */
  private async computeSimilarityRisk(item: ModerationItem): Promise<number> {
    // Simulated: in production would use embeddings/vector DB
    const content = `${item.title} ${item.description}`.toLowerCase();

    let risk = 0;
    const suspiciousWords = [
      'free', 'guaranteed', '100%', 'act now', 'limited',
      'exclusive', 'secret', 'shocking', 'you won\'t believe',
    ];

    for (const word of suspiciousWords) {
      if (content.includes(word)) risk += 3;
    }

    return Math.min(100, risk);
  }

  /**
   * Determine severity level from overall risk score
   */
  private determineSeverity(score: number): SeverityLevel {
    if (score >= 75) return SeverityLevel.CRITICAL;
    if (score >= 60) return SeverityLevel.HIGH;
    if (score >= 35) return SeverityLevel.MEDIUM;
    return SeverityLevel.LOW;
  }

  /**
   * Route item based on risk score and confidence
   */
  private routeItem(riskScore: RiskScoreBreakdown): ModerationStatus {
    // Auto-approve very low risk with high confidence
    if (
      riskScore.overall < this.config.autoApproveThreshold &&
      riskScore.confidence >= this.config.minConfidence
    ) {
      return ModerationStatus.AUTO_APPROVED;
    }

    // Auto-reject very high risk with high confidence
    if (
      riskScore.overall >= this.config.autoRejectThreshold &&
      riskScore.confidence >= this.config.minConfidence
    ) {
      return ModerationStatus.AUTO_REJECTED;
    }

    // Check policy-specific thresholds
    for (const policyScore of riskScore.policyScores) {
      const threshold = this.config.policyThresholds[policyScore.policyType];
      if (threshold && policyScore.score >= threshold && policyScore.confidence >= this.config.minConfidence) {
        return ModerationStatus.QUEUED;
      }
    }

    // Queue for human review if above threshold
    if (riskScore.overall >= this.config.queueThreshold) {
      return ModerationStatus.QUEUED;
    }

    // Low risk items also go to queue
    return ModerationStatus.QUEUED;
  }

  /**
   * Compute overall model confidence
   */
  private computeConfidence(
    policyScores: PolicyScore[],
    _item: ModerationItem
  ): number {
    if (policyScores.length === 0) return 0.5;

    const avgConfidence =
      policyScores.reduce((sum, p) => sum + p.confidence, 0) /
      policyScores.length;

    // Higher confidence with more matched patterns
    const patternBonus = Math.min(
      0.2,
      policyScores.reduce((sum, p) => sum + p.matchedPatterns.length, 0) * 0.02
    );

    return Math.min(1, Math.max(0, avgConfidence + patternBonus));
  }

  /**
   * Record moderator feedback for model improvement
   */
  recordFeedback(
    itemId: string,
    predicted: SeverityLevel,
    actual: SeverityLevel
  ): void {
    this.decisionHistory.push({ predicted, actual, itemId });

    // Keep only last 1000 decisions
    if (this.decisionHistory.length > 1000) {
      this.decisionHistory = this.decisionHistory.slice(-1000);
    }

    logger.info(
      `Model feedback recorded for ${itemId}: ` +
      `predicted=${predicted}, actual=${actual}`
    );
  }

  /**
   * Get model accuracy statistics
   */
  getModelAccuracy(): { accuracy: number; total: number; correct: number } {
    if (this.decisionHistory.length === 0) {
      return { accuracy: 1, total: 0, correct: 0 };
    }

    const correct = this.decisionHistory.filter(
      (d) => d.predicted === d.actual
    ).length;

    return {
      accuracy: correct / this.decisionHistory.length,
      total: this.decisionHistory.length,
      correct,
    };
  }

  /**
   * Update model configuration
   */
  updateConfig(updates: Partial<MLModelConfig>): MLModelConfig {
    this.config = { ...this.config, ...updates };
    logger.info('Moderation ML model config updated', { updates });
    return this.config;
  }

  /**
   * Get current model configuration
   */
  getConfig(): MLModelConfig {
    return { ...this.config };
  }

  /**
   * Escape regex special characters in a string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}