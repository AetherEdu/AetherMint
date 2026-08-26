/**
 * Vector Store for the AGI Tutor RAG pipeline.
 *
 * Two implementations back the same interface:
 *  - QdrantVectorStore: the production store (see the `qdrant` service in
 *    docker-compose.yml), accessed through Qdrant's REST API.
 *  - MemoryVectorStore: an in-memory brute-force store used in tests and as
 *    a failsafe when Qdrant is unreachable, so the pipeline degrades
 *    gracefully instead of erroring.
 */

import axios from 'axios';
import { createHash } from 'crypto';
import logger from '../../utils/logger';
import { DocumentChunk, RetrievedPassage } from './types';
import { cosineSimilarity } from './embeddings';

export const DEFAULT_COLLECTION = 'aethermint_course_content';

export interface VectorStore {
  readonly name: string;
  readonly collection: string;
  ensureCollection(): Promise<void>;
  upsert(chunks: DocumentChunk[], vectors: number[][]): Promise<void>;
  search(vector: number[], topK: number): Promise<RetrievedPassage[]>;
  count(): Promise<number>;
  clear(): Promise<void>;
  health(): Promise<{ ok: boolean; detail?: string }>;
}

export interface VectorStoreOptions {
  url?: string;
  collection?: string;
}

export class QdrantVectorStore implements VectorStore {
  readonly name = 'qdrant';
  readonly collection: string;
  private readonly baseUrl: string;
  private readonly dimension: number;

  constructor(options: VectorStoreOptions = {}) {
    this.collection =
      options.collection ?? process.env.QDRANT_COLLECTION ?? DEFAULT_COLLECTION;
    this.baseUrl = (
      options.url ?? process.env.QDRANT_URL ?? 'http://localhost:6333'
    ).replace(/\/+$/, '');
    this.dimension = parseInt(
      process.env.RAG_EMBEDDING_DIM ?? '768',
      10
    );
  }

  async ensureCollection(): Promise<void> {
    const url = `${this.baseUrl}/collections/${this.collection}`;
    try {
      await axios.get(url, { timeout: 5000 });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        await axios.put(
          url,
          {
            vectors: { size: this.dimension, distance: 'Cosine' },
          },
          { timeout: 10000 }
        );
        logger.info(`Created Qdrant collection '${this.collection}'`);
      } else {
        throw err;
      }
    }
  }

  async upsert(chunks: DocumentChunk[], vectors: number[][]): Promise<void> {
    if (chunks.length === 0) {
      return;
    }
    await this.ensureCollection();

    const points = chunks.map((chunk, i) => ({
      id: this.pointId(chunk.id),
      vector: vectors[i],
      payload: { ...chunk },
    }));

    // Upsert in batches to stay well under Qdrant's per-request limits.
    const batchSize = 64;
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      await axios.put(
        `${this.baseUrl}/collections/${this.collection}/points?wait=true`,
        { points: batch },
        { timeout: 30000 }
      );
    }
  }

  async search(vector: number[], topK: number): Promise<RetrievedPassage[]> {
    if (topK <= 0) {
      return [];
    }
    await this.ensureCollection();
    const { data } = await axios.post(
      `${this.baseUrl}/collections/${this.collection}/points/search`,
      { vector, limit: topK, with_payload: true },
      { timeout: 10000 }
    );
    return (data?.result ?? []).map((hit: Record<string, unknown>) =>
      this.toPassage(hit)
    );
  }

  async count(): Promise<number> {
    try {
      const { data } = await axios.get(
        `${this.baseUrl}/collections/${this.collection}`,
        { timeout: 5000 }
      );
      const pointsCount = data?.result?.points_count as number | null;
      return typeof pointsCount === 'number' ? pointsCount : 0;
    } catch {
      return 0;
    }
  }

  async clear(): Promise<void> {
    await axios.post(
      `${this.baseUrl}/collections/${this.collection}/points/delete`,
      { filter: { must: [] } },
      { timeout: 30000 }
    );
  }

  async health(): Promise<{ ok: boolean; detail?: string }> {
    try {
      const { data } = await axios.get(`${this.baseUrl}/healthz`, {
        timeout: 2000,
      });
      return { ok: data?.status === 'ok', detail: 'qdrant reachable' };
    } catch (err) {
      return {
        ok: false,
        detail: err instanceof Error ? err.message : 'qdrant unreachable',
      };
    }
  }

  /** Stable 64-bit (safe-integer) point id derived from a chunk id. */
  private pointId(chunkId: string): number {
    const hex = createHash('sha1').update(chunkId).digest('hex').slice(0, 16);
    const big = BigInt(`0x${hex}`);
    return Number(big % BigInt(Number.MAX_SAFE_INTEGER));
  }

  private toPassage(hit: Record<string, unknown>): RetrievedPassage {
    const payload = (hit.payload ?? {}) as DocumentChunk;
    const content = payload.content ?? '';
    return {
      chunk: payload,
      score: typeof hit.score === 'number' ? hit.score : 0,
      excerpt: content.slice(0, 500),
    };
  }
}

export class MemoryVectorStore implements VectorStore {
  readonly name = 'memory';
  readonly collection: string;
  private items: { chunk: DocumentChunk; vector: number[] }[] = [];

  constructor(options: VectorStoreOptions = {}) {
    this.collection =
      options.collection ?? process.env.QDRANT_COLLECTION ?? DEFAULT_COLLECTION;
  }

  async ensureCollection(): Promise<void> {
    // In-memory store has no collection lifecycle.
  }

  async upsert(chunks: DocumentChunk[], vectors: number[][]): Promise<void> {
    for (let i = 0; i < chunks.length; i++) {
      const existing = this.items.findIndex(
        (item) => item.chunk.id === chunks[i].id
      );
      const entry = { chunk: chunks[i], vector: vectors[i] };
      if (existing >= 0) {
        this.items[existing] = entry;
      } else {
        this.items.push(entry);
      }
    }
  }

  async search(vector: number[], topK: number): Promise<RetrievedPassage[]> {
    if (topK <= 0) {
      return [];
    }
    return this.items
      .map((item) => ({
        chunk: item.chunk,
        score: cosineSimilarity(vector, item.vector),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((item) => ({
        chunk: item.chunk,
        score: item.score,
        excerpt: item.chunk.content.slice(0, 500),
      }));
  }

  async count(): Promise<number> {
    return this.items.length;
  }

  async clear(): Promise<void> {
    this.items = [];
  }

  async health(): Promise<{ ok: boolean; detail?: string }> {
    return { ok: true, detail: 'in-memory store' };
  }
}

let cachedStore: VectorStore | null = null;

/**
 * Resolve the configured vector store. Defaults to Qdrant; set
 * RAG_VECTOR_STORE=memory (or NODE_ENV=test) for an in-memory store.
 */
export function getVectorStore(options?: VectorStoreOptions): VectorStore {
  if (cachedStore) {
    return cachedStore;
  }
  const mode =
    process.env.NODE_ENV === 'test'
      ? 'memory'
      : (process.env.RAG_VECTOR_STORE ?? 'qdrant').toLowerCase();
  cachedStore =
    mode === 'memory'
      ? new MemoryVectorStore(options)
      : new QdrantVectorStore(options);
  return cachedStore;
}

/** Reset the cached store (useful in tests). */
export function resetVectorStore(): void {
  cachedStore = null;
}
