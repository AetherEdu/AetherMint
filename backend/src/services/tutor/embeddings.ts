/**
 * Embedding Service for the AGI Tutor RAG pipeline.
 *
 * Produces deterministic, keyless embeddings using feature hashing:
 * character n-grams and word tokens are hashed into a fixed-dimension
 * vector with signed weights, then L2-normalised. Cosine similarity over
 * these vectors gives a stable, offline-computable notion of topical
 * closeness, which keeps the pipeline fully self-contained (no external
 * embedding API required) while remaining deterministic for tests.
 */

export interface Embedder {
  readonly dimension: number;
  embed(text: string): number[];
}

export class LocalHashEmbedder implements Embedder {
  readonly dimension: number;

  constructor(dimension: number = 768) {
    this.dimension = dimension;
  }

  embed(text: string): number[] {
    const vector = new Float64Array(this.dimension);
    const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
    if (normalized.length === 0) {
      return Array.from(vector);
    }

    for (const feature of this.extractFeatures(normalized)) {
      const hash = this.hashFeature(feature);
      const index = Math.abs(hash) % this.dimension;
      vector[index] += hash > 0 ? 1 : -1;
    }

    return this.normalize(vector);
  }

  private extractFeatures(text: string): string[] {
    const features: string[] = [];

    // Word unigrams (length > 1 to skip noise tokens).
    for (const token of text.split(/[^a-z0-9]+/).filter(Boolean)) {
      if (token.length > 1) {
        features.push(`w:${token}`);
      }
    }

    // Character n-grams (2-4) capture morphology and near-miss spellings.
    const compact = text.replace(/[^a-z0-9]/g, '');
    for (let n = 2; n <= 4; n++) {
      for (let i = 0; i + n <= compact.length; i++) {
        features.push(`c${n}:${compact.slice(i, i + n)}`);
      }
    }

    return features;
  }

  /** FNV-1a 32-bit hash returned as a signed 32-bit integer. */
  private hashFeature(feature: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < feature.length; i++) {
      hash ^= feature.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash | 0;
  }

  private normalize(vector: Float64Array): number[] {
    let norm = 0;
    for (let i = 0; i < vector.length; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);
    if (norm === 0) {
      return Array.from(vector);
    }
    return Array.from(vector, (v) => v / norm);
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function getEmbedder(dimension?: number): Embedder {
  const resolved =
    dimension ?? parseInt(process.env.RAG_EMBEDDING_DIM ?? '768', 10);
  return new LocalHashEmbedder(resolved);
}
