/**
 * AGI Tutor RAG Pipeline Types
 *
 * Types shared across the retrieval-augmented generation pipeline:
 * content chunking, vector retrieval, answer generation, citation
 * tracking and grounding/faithfulness metrics.
 */

export interface DocumentChunk {
  id: string;
  courseId: string;
  courseTitle: string;
  moduleId: string;
  moduleTitle: string;
  lessonId?: string;
  lessonTitle?: string;
  title: string;
  content: string;
  sourceUrl?: string;
  contentType: 'course' | 'module' | 'lesson' | 'resource';
  metadata?: Record<string, unknown>;
}

export interface RetrievedPassage {
  chunk: DocumentChunk;
  score: number;
  excerpt: string;
}

export interface Citation {
  index: number;
  sourceId: string;
  courseId: string;
  courseTitle: string;
  moduleTitle: string;
  lessonTitle?: string;
  title: string;
  excerpt: string;
  sourceUrl?: string;
}

export interface GroundingMetrics {
  /** Max similarity of the retrieved passages (how confident retrieval was). */
  retrievalConfidence: number;
  /** Fraction of answer content supported by the retrieved passages (0-1). */
  faithfulnessScore: number;
  /** Fraction of answer sentences carrying an inline citation marker (0-1). */
  citationCoverage: number;
  /** Average similarity of the retrieved passages (0-1). */
  contextRelevance: number;
  /** Overall confidence, a weighted blend of retrieval and faithfulness. */
  confidence: number;
  /** Whether the answer meets the grounding threshold. */
  grounded: boolean;
  /** The confidence threshold the answer was evaluated against. */
  threshold: number;
}

export interface RagAnswer {
  question: string;
  answer: string;
  citations: Citation[];
  metrics: GroundingMetrics;
  sources: RetrievedPassage[];
  grounded: boolean;
  fallback: boolean;
  fallbackMessage?: string;
  model: string;
  generatedAt: string;
}

export interface IndexingStatus {
  store: string;
  collection: string;
  chunkCount: number;
  isIndexing: boolean;
  lastIndexedAt: string | null;
  lastIndexDurationMs: number | null;
  lastError: string | null;
  totalIndexed: number;
}

export interface IndexingResult {
  indexed: number;
  skipped: number;
  durationMs: number;
  store: string;
  collection: string;
  chunkCount: number;
}
