/**
 * Moderation Model
 * Defines ML-assisted content moderation structures:
 * - Risk scoring for policy violations
 * - Human review queue with priority routing
 * - Moderator decisions for model feedback
 * - Appeal flow for rejected content
 */

export enum ContentType {
  COURSE = 'course',
  QUIZ = 'quiz',
  USER_POST = 'user_post',
  COMMENT = 'comment',
  FILE = 'file',
  IMAGE = 'image',
  VIDEO = 'video',
}

export enum ModerationStatus {
  PENDING = 'pending',
  SCORING = 'scoring',
  QUEUED = 'queued',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FLAGGED = 'flagged',
  AUTO_APPROVED = 'auto_approved',
  AUTO_REJECTED = 'auto_rejected',
}

export enum SeverityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum PolicyViolationType {
  HATE_SPEECH = 'hate_speech',
  HARASSMENT = 'harassment',
  SPAM = 'spam',
  NSFW = 'nsfw',
  VIOLENCE = 'violence',
  COPYRIGHT = 'copyright',
  MISINFORMATION = 'misinformation',
  PLAGIARISM = 'plagiarism',
  PERSONAL_INFO = 'personal_info',
  SELF_HARM = 'self_harm',
  ILLEGAL_CONTENT = 'illegal_content',
  COMMUNITY_GUIDELINES = 'community_guidelines',
  CHEATING = 'cheating',
  OTHER = 'other',
}

export interface RiskScoreBreakdown {
  /** Overall risk score (0-100) */
  overall: number;
  /** Per-policy violation scores */
  policyScores: PolicyScore[];
  /** Text-based risk factors */
  textRisk: number;
  /** Metadata-based risk factors */
  metadataRisk: number;
  /** User history risk factor */
  userHistoryRisk: number;
  /** Content similarity to known violations */
  similarityRisk: number;
  /** Confidence of the ML model (0-1) */
  confidence: number;
  /** Model version used for scoring */
  modelVersion: string;
}

export interface PolicyScore {
  policyType: PolicyViolationType;
  score: number; // 0-100
  confidence: number; // 0-1
  keywords: string[];
  matchedPatterns: string[];
}

export interface ModerationItem {
  id: string;
  contentId: string;
  contentType: ContentType;
  title: string;
  description: string;
  content: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  status: ModerationStatus;
  riskScore: RiskScoreBreakdown | null;
  severity: SeverityLevel;
  flags: number;
  reports: ModerationReport[];
  assignedModeratorId: string | null;
  moderatorNotes: string;
  decision: ModerationDecision | null;
  appeal: Appeal | null;
  metadata: ModerationMetadata;
  createdAt: Date;
  updatedAt: Date;
  scoredAt: Date | null;
  reviewedAt: Date | null;
  resolvedAt: Date | null;
}

export interface ModerationReport {
  id: string;
  reason: PolicyViolationType;
  description: string;
  reporterId: string;
  reporterName: string;
  createdAt: Date;
  status: 'pending' | 'acknowledged' | 'resolved';
}

export interface ModerationDecision {
  id: string;
  moderatorId: string;
  moderatorName: string;
  action: ModerationAction;
  reason: string;
  notes: string;
  createdAt: Date;
  /** Feedback for model retraining */
  modelFeedback: ModelFeedback;
}

export enum ModerationAction {
  APPROVE = 'approve',
  REJECT = 'reject',
  FLAG_FOR_REVIEW = 'flag_for_review',
  ESCALATE = 'escalate',
  REMOVE = 'remove',
  WARN_USER = 'warn_user',
  BAN_USER = 'ban_user',
  REQUEST_EDIT = 'request_edit',
}

export interface ModelFeedback {
  /** Was the ML prediction correct? */
  predictionCorrect: boolean;
  /** The actual decision vs predicted */
  actualSeverity: SeverityLevel;
  predictedSeverity: SeverityLevel;
  /** Notes for improving the model */
  improvementNotes: string;
  /** Specific policy areas where model was wrong */
  misclassifiedPolicies: PolicyViolationType[];
}

export interface Appeal {
  id: string;
  moderationId: string;
  submitterId: string;
  submitterName: string;
  reason: string;
  explanation: string;
  evidence: AppealEvidence[];
  status: AppealStatus;
  decision: AppealDecision | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}

export enum AppealStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  DENIED = 'denied',
  REVERSED = 'reversed',
  UPHELD = 'upheld',
}

export interface AppealDecision {
  id: string;
  reviewerId: string;
  reviewerName: string;
  decision: AppealStatus;
  reason: string;
  notes: string;
  createdAt: Date;
}

export interface AppealEvidence {
  id: string;
  type: 'text' | 'file' | 'url' | 'reference';
  description: string;
  value: string;
  mimeType?: string;
  uploadedAt: Date;
}

export interface ModerationMetadata {
  category?: string;
  difficulty?: string;
  duration?: string;
  fileSize?: number;
  fileType?: string;
  language?: string;
  courseId?: string;
  originalCreatedAt?: Date;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

export interface ModerationFilter {
  status?: ModerationStatus;
  contentType?: ContentType;
  severity?: SeverityLevel;
  assignedModeratorId?: string;
  authorId?: string;
  startDate?: Date;
  endDate?: Date;
  minRiskScore?: number;
  maxRiskScore?: number;
  search?: string;
  sortBy?: 'createdAt' | 'riskScore' | 'severity' | 'updatedAt' | 'flags';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ModerationQueue {
  id: string;
  name: string;
  description: string;
  items: string[]; // moderation item IDs ordered by priority
  filter: ModerationFilter;
  moderators: string[]; // moderator user IDs
  maxItemsPerModerator: number;
  autoAssign: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModerationStats {
  total: number;
  pending: number;
  queued: number;
  inReview: number;
  approved: number;
  rejected: number;
  flagged: number;
  autoApproved: number;
  autoRejected: number;
  averageRiskScore: number;
  averageReviewTime: number; // in minutes
  modelAccuracy: number; // percentage of correct ML predictions
  appealsPending: number;
}

export interface ModerationBatchRequest {
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
  }>;
  options?: {
    skipScoring?: boolean;
    autoApproveBelow?: number;
    autoRejectAbove?: number;
    priority?: 'normal' | 'high';
  };
}

// ML Model configuration
export interface MLModelConfig {
  /** Minimum risk score for auto-approval (default: 10) */
  autoApproveThreshold: number;
  /** Minimum risk score for auto-rejection (default: 90) */
  autoRejectThreshold: number;
  /** Minimum risk score for human review queue (default: 40) */
  queueThreshold: number;
  /** Minimum confidence for auto-decisions */
  minConfidence: number;
  /** Whether to enable model feedback loop */
  enableModelFeedback: boolean;
  /** Model version identifier */
  modelVersion: string;
  /** Active policy violation types */
  activePolicies: PolicyViolationType[];
  /** Policy-specific thresholds */
  policyThresholds: Record<PolicyViolationType, number>;
}

// Default ML model configuration
export const DEFAULT_ML_CONFIG: MLModelConfig = {
  autoApproveThreshold: 15,
  autoRejectThreshold: 85,
  queueThreshold: 35,
  minConfidence: 0.7,
  enableModelFeedback: true,
  modelVersion: '1.0.0',
  activePolicies: Object.values(PolicyViolationType),
  policyThresholds: {
    [PolicyViolationType.HATE_SPEECH]: 50,
    [PolicyViolationType.HARASSMENT]: 50,
    [PolicyViolationType.SPAM]: 40,
    [PolicyViolationType.NSFW]: 60,
    [PolicyViolationType.VIOLENCE]: 60,
    [PolicyViolationType.COPYRIGHT]: 50,
    [PolicyViolationType.MISINFORMATION]: 40,
    [PolicyViolationType.PLAGIARISM]: 50,
    [PolicyViolationType.PERSONAL_INFO]: 70,
    [PolicyViolationType.SELF_HARM]: 70,
    [PolicyViolationType.ILLEGAL_CONTENT]: 80,
    [PolicyViolationType.COMMUNITY_GUIDELINES]: 40,
    [PolicyViolationType.CHEATING]: 50,
    [PolicyViolationType.OTHER]: 50,
  },
};