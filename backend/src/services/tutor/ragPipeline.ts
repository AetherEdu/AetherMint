/**
 * AGI Tutor RAG Pipeline
 *
 * Orchestrates the retrieval-augmented generation flow over course content:
 *  1. Course material is chunked and embedded into a vector store
 *     (see contentProvider.ts and vectorStore.ts).
 *  2. For each question, relevant passages are retrieved by embedding the
 *     question and searching the store.
 *  3. An answer generator composes a response grounded in those passages
 *     with inline citations.
 *  4. Grounding/faithfulness metrics decide whether the answer is safe to
 *     surface; below the confidence threshold the pipeline falls back to a
 *     safe "I don't know" response.
 */

import { createHash } from 'crypto';
import logger from '../../utils/logger';
import { Embedder, getEmbedder } from './embeddings';
import { VectorStore, getVectorStore } from './vectorStore';
import {
  CourseContentProvider,
  getCourseContentProvider,
} from './contentProvider';
import {
  AnswerGenerator,
  ExtractiveAnswerGenerator,
  OpenAiAnswerGenerator,
} from './generators';
import { computeGroundingMetrics } from './groundingMetrics';
import {
  IndexingResult,
  IndexingStatus,
  RagAnswer,
  RetrievedPassage,
} from './types';

export interface RagPipelineOptions {
  store?: VectorStore;
  embedder?: Embedder;
  provider?: CourseContentProvider;
  generator?: AnswerGenerator;
  topK?: number;
  threshold?: number;
}

const FALLBACK_MESSAGE =
  "I don't know — the course material doesn't contain enough information to answer this question confidently.";

export class RagPipeline {
  private readonly store: VectorStore;
  private readonly embedder: Embedder;
  private readonly provider: CourseContentProvider;
  private readonly generator: AnswerGenerator;
  private readonly topK: number;
  private readonly threshold: number;

  private isIndexing = false;
  private lastContentHash: string | null = null;
  private status: IndexingStatus = {
    store: 'unknown',
    collection: 'unknown',
    chunkCount: 0,
    isIndexing: false,
    lastIndexedAt: null,
    lastIndexDurationMs: null,
    lastError: null,
    totalIndexed: 0,
  };

  constructor(options: RagPipelineOptions = {}) {
    this.store =
      options.store ??
      getVectorStore({ collection: process.env.QDRANT_COLLECTION });
    this.embedder = options.embedder ?? getEmbedder();
    this.provider = options.provider ?? getCourseContentProvider();
    this.generator =
      options.generator ?? this.resolveDefaultGenerator();
    this.topK =
      options.topK ?? parseInt(process.env.RAG_TOP_K ?? '5', 10);
    this.threshold =
      options.threshold ??
      parseFloat(process.env.RAG_CONFIDENCE_THRESHOLD ?? '0.55');

    this.status.store = this.store.name;
    this.status.collection = this.store.collection;
  }

  /**
   * Answer a question against the indexed course material. Returns a
   * grounded answer with citations and metrics, or a safe fallback when
   * confidence is low.
   */
  async answer(
    question: string,
    options: { topK?: number } = {}
  ): Promise<RagAnswer> {
    const vector = this.embedder.embed(question);
    const topK = options.topK ?? this.topK;

    let passages: RetrievedPassage[];
    try {
      passages = await this.store.search(vector, topK);
    } catch (err) {
      logger.warn(
        'RAG vector store search failed; answering with empty context',
        err
      );
      passages = [];
    }

    let generated;
    try {
      generated = await this.generator.generate(question, passages);
    } catch (err) {
      logger.warn(
        `RAG generator '${this.generator.name}' failed; using extractive fallback`,
        err
      );
      generated = await new ExtractiveAnswerGenerator().generate(
        question,
        passages
      );
    }

    const metrics = computeGroundingMetrics(question, generated.answer, passages, {
      threshold: this.threshold,
    });

    const safeToSurface = metrics.grounded && passages.length > 0;
    const fallback = !safeToSurface;

    return {
      question,
      answer: safeToSurface ? generated.answer : FALLBACK_MESSAGE,
      citations: safeToSurface ? generated.citations : [],
      metrics,
      sources: safeToSurface ? passages : [],
      grounded: metrics.grounded,
      fallback,
      fallbackMessage: fallback ? FALLBACK_MESSAGE : undefined,
      model: safeToSurface ? generated.model : 'none',
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Index (or re-index) course content into the vector store. Skips the
   * work when the content corpus is unchanged since the last successful run.
   */
  async indexContent(): Promise<IndexingResult> {
    if (this.isIndexing) {
      return {
        indexed: 0,
        skipped: 0,
        durationMs: 0,
        store: this.store.name,
        collection: this.store.collection,
        chunkCount: this.status.chunkCount,
      };
    }

    this.isIndexing = true;
    this.status.isIndexing = true;
    const startedAt = Date.now();

    try {
      const chunks = await this.provider.getCourseContent();
      const contentHash = this.hashChunks(chunks);

      if (this.lastContentHash === contentHash && this.status.chunkCount > 0) {
        const durationMs = Date.now() - startedAt;
        logger.info(
          `Course content unchanged; skipping re-index (${chunks.length} chunks)`
        );
        return {
          indexed: 0,
          skipped: chunks.length,
          durationMs,
          store: this.store.name,
          collection: this.store.collection,
          chunkCount: this.status.chunkCount,
        };
      }

      const vectors = chunks.map((chunk) => this.embedder.embed(chunk.content));
      await this.store.ensureCollection();
      await this.store.upsert(chunks, vectors);

      const chunkCount = await this.store.count();
      const durationMs = Date.now() - startedAt;

      this.lastContentHash = contentHash;
      this.status = {
        store: this.store.name,
        collection: this.store.collection,
        chunkCount,
        isIndexing: false,
        lastIndexedAt: new Date().toISOString(),
        lastIndexDurationMs: durationMs,
        lastError: null,
        totalIndexed: this.status.totalIndexed + chunks.length,
      };

      logger.info(
        `Indexed ${chunks.length} course chunks into ${this.store.name} in ${durationMs}ms`
      );
      return {
        indexed: chunks.length,
        skipped: 0,
        durationMs,
        store: this.store.name,
        collection: this.store.collection,
        chunkCount,
      };
    } catch (err) {
      this.status.lastError =
        err instanceof Error ? err.message : 'Unknown indexing error';
      this.status.lastIndexedAt = null;
      logger.error('Failed to index course content', err);
      throw err;
    } finally {
      this.isIndexing = false;
      this.status.isIndexing = false;
    }
  }

  async getStatus(): Promise<IndexingStatus> {
    try {
      this.status.chunkCount = await this.store.count();
    } catch {
      // Keep the cached count if the store is unreachable.
    }
    return { ...this.status };
  }

  async health(): Promise<{ ok: boolean; detail?: string }> {
    return this.store.health();
  }

  private resolveDefaultGenerator(): AnswerGenerator {
    const openAi = new OpenAiAnswerGenerator();
    return openAi.available ? openAi : new ExtractiveAnswerGenerator();
  }

  private hashChunks(chunks: { id: string; content: string }[]): string {
    const hash = createHash('sha256');
    for (const chunk of chunks) {
      hash.update(chunk.id);
      hash.update('\x00');
      hash.update(chunk.content);
      hash.update('\x00');
    }
    return hash.digest('hex');
  }
}

export const ragPipeline = new RagPipeline();
