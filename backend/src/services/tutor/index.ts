/**
 * AGI Tutor RAG pipeline — public surface.
 */

export { RagPipeline, ragPipeline } from './ragPipeline';
export type { RagPipelineOptions } from './ragPipeline';
export {
  LocalHashEmbedder,
  cosineSimilarity,
  getEmbedder,
} from './embeddings';
export type { Embedder } from './embeddings';
export {
  QdrantVectorStore,
  MemoryVectorStore,
  getVectorStore,
  resetVectorStore,
} from './vectorStore';
export type { VectorStore, VectorStoreOptions } from './vectorStore';
export {
  SeedCourseContentProvider,
  getCourseContentProvider,
} from './contentProvider';
export type { CourseContentProvider } from './contentProvider';
export {
  ExtractiveAnswerGenerator,
  OpenAiAnswerGenerator,
} from './generators';
export type { AnswerGenerator, GeneratedAnswer } from './generators';
export {
  computeGroundingMetrics,
  faithfulnessScore,
  citationCoverage,
} from './groundingMetrics';
export type { GroundingMetricsOptions } from './groundingMetrics';
export type {
  DocumentChunk,
  RetrievedPassage,
  Citation,
  GroundingMetrics,
  RagAnswer,
  IndexingStatus,
  IndexingResult,
} from './types';
