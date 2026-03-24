/**
 * Plagiarism Detection Models
 * Defines the structure for plagiarism detection system
 */

export enum PlagiarismStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REVIEW_REQUIRED = 'review_required'
}

export enum PlagiarismType {
  TEXT = 'text',
  CODE = 'code',
  MIXED = 'mixed'
}

export enum DetectionMethod {
  TEXT_SIMILARITY = 'text_similarity',
  CODE_SIMILARITY = 'code_similarity',
  WEB_SCANNING = 'web_scanning',
  ACADEMIC_DATABASE = 'academic_database',
  PARAPHRASING = 'paraphrasing',
  TRANSLATION = 'translation',
  PATCHWRITING = 'patchwriting'
}

export enum SourceType {
  WEB = 'web',
  ACADEMIC_DATABASE = 'academic_database',
  INTERNAL_SUBMISSION = 'internal_submission',
  CODE_REPOSITORY = 'code_repository',
  PUBLICATION = 'publication'
}

export interface PlagiarismSource {
  id: string;
  type: SourceType;
  title: string;
  url?: string;
  author?: string;
  publicationDate?: Date;
  database?: string;
  confidence: number;
  matchedContent: string;
  similarityScore: number;
}

export interface PlagiarismMatch {
  id: string;
  source: PlagiarismSource;
  detectionMethod: DetectionMethod;
  similarityPercentage: number;
  matchedWords: number;
  totalWords: number;
  startPosition: number;
  endPosition: number;
  originalText: string;
  matchedText: string;
  isParaphrased: boolean;
  isTranslated: boolean;
}

export interface PlagiarismReport {
  id: string;
  submissionId: string;
  userId: string;
  contentType: PlagiarismType;
  status: PlagiarismStatus;
  overallSimilarity: number;
  originalityScore: number;
  matches: PlagiarismMatch[];
  sources: PlagiarismSource[];
  detectionMethods: DetectionMethod[];
  processingTime: number; // in seconds
  createdAt: Date;
  updatedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
  isFalsePositive?: boolean;
  appealStatus?: 'pending' | 'approved' | 'rejected';
}

export interface PlagiarismDetectionRequest {
  submissionId: string;
  content: string;
  contentType: PlagiarismType;
  language?: string;
  codeLanguage?: string;
  sensitivity?: 'low' | 'medium' | 'high';
  includeWebScanning?: boolean;
  includeAcademicDatabase?: boolean;
  includeInternalComparison?: boolean;
}

export interface PlagiarismDetectionResult {
  reportId: string;
  status: PlagiarismStatus;
  overallSimilarity: number;
  originalityScore: number;
  matches: PlagiarismMatch[];
  processingTime: number;
  needsReview: boolean;
}

export interface PlagiarismSettings {
  id: string;
  institutionId?: string;
  sensitivityLevel: 'low' | 'medium' | 'high';
  minimumSimilarityThreshold: number;
  enableWebScanning: boolean;
  enableAcademicDatabase: boolean;
  enableInternalComparison: boolean;
  enableParaphrasingDetection: boolean;
  enableTranslationDetection: boolean;
  excludedDomains: string[];
  trustedSources: string[];
  autoFlagThreshold: number;
  reviewRequiredThreshold: number;
  updatedAt: Date;
  updatedBy: string;
}

export interface PlagiarismAppeal {
  id: string;
  reportId: string;
  userId: string;
  reason: string;
  explanation: string;
  evidence?: string[];
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  createdAt: Date;
}

export interface PlagiarismAnalytics {
  id: string;
  institutionId?: string;
  date: Date;
  totalSubmissions: number;
  flaggedSubmissions: number;
  averageSimilarity: number;
  detectionMethods: Record<DetectionMethod, number>;
  contentTypeStats: Record<PlagiarismType, number>;
  falsePositiveRate: number;
  averageProcessingTime: number;
  appealStats: {
    total: number;
    approved: number;
    rejected: number;
  };
}

export interface PlagiarismBatchJob {
  id: string;
  name: string;
  submissionIds: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalSubmissions: number;
  processedSubmissions: number;
  results: PlagiarismReport[];
  errors: Array<{
    submissionId: string;
    error: string;
  }>;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdBy: string;
}

export interface PlagiarismDatabaseConfig {
  name: string;
  type: 'academic' | 'web' | 'code';
  apiKey?: string;
  endpoint: string;
  isEnabled: boolean;
  rateLimit?: number;
  lastSync?: Date;
  syncFrequency: 'hourly' | 'daily' | 'weekly';
}

export interface PlagiarismCacheEntry {
  key: string;
  contentHash: string;
  result: PlagiarismDetectionResult;
  expiresAt: Date;
  createdAt: Date;
}
