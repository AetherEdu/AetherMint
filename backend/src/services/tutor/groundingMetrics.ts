/**
 * Grounding & Faithfulness Metrics for the AGI Tutor RAG pipeline.
 *
 * Computes, per answer:
 *  - retrievalConfidence: max similarity of the retrieved passages;
 *  - contextRelevance: average similarity of the retrieved passages;
 *  - faithfulnessScore: how much of the answer text is supported by the
 *    retrieved passages, estimated via character n-gram containment;
 *  - citationCoverage: share of answer sentences carrying a citation marker.
 *
 * The overall confidence is a weighted blend of retrieval confidence and
 * faithfulness, compared against a threshold to decide whether the answer
 * is safe to surface or should fall back to "I don't know".
 */

import { GroundingMetrics, RetrievedPassage } from './types';

export interface GroundingMetricsOptions {
  retrievalWeight?: number;
  faithfulnessWeight?: number;
  threshold?: number;
}

const NGRAM_SIZE = 3;
const MIN_SENTENCE_LENGTH = 8;

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function ngrams(text: string, size: number): Set<string> {
  const normalized = normalize(text).replace(/\s+/g, '');
  const grams = new Set<string>();
  for (let i = 0; i + size <= normalized.length; i++) {
    grams.add(normalized.slice(i, i + size));
  }
  return grams;
}

function stripCitationMarkers(text: string): string {
  return text.replace(/\[\d+\]/g, ' ').replace(/\s+/g, ' ').trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= MIN_SENTENCE_LENGTH);
}

/**
 * Faithfulness proxy: the mean, over answer sentences, of the fraction of
 * the sentence's character n-grams that appear in the retrieved context.
 */
export function faithfulnessScore(
  answer: string,
  passages: RetrievedPassage[]
): number {
  const cleaned = stripCitationMarkers(answer);
  const sentences = splitSentences(cleaned);
  if (sentences.length === 0) {
    return 0;
  }

  const sourceText = passages
    .map((passage) => passage.chunk.content)
    .join(' ');
  const sourceGrams = ngrams(sourceText, NGRAM_SIZE);
  if (sourceGrams.size === 0) {
    return 0;
  }

  let total = 0;
  let counted = 0;
  for (const sentence of sentences) {
    const sentenceGrams = ngrams(sentence, NGRAM_SIZE);
    if (sentenceGrams.size === 0) {
      continue;
    }
    let contained = 0;
    for (const gram of sentenceGrams) {
      if (sourceGrams.has(gram)) {
        contained++;
      }
    }
    total += contained / sentenceGrams.size;
    counted++;
  }

  return counted === 0 ? 0 : total / counted;
}

export function citationCoverage(answer: string): number {
  const sentences = splitSentences(answer);
  if (sentences.length === 0) {
    return 0;
  }
  let cited = 0;
  for (const sentence of sentences) {
    if (/\[\d+\]/.test(sentence)) {
      cited++;
    }
  }
  return cited / sentences.length;
}

export function computeGroundingMetrics(
  question: string,
  answer: string,
  passages: RetrievedPassage[],
  options: GroundingMetricsOptions = {}
): GroundingMetrics {
  const retrievalWeight = options.retrievalWeight ?? 0.6;
  const faithfulnessWeight = options.faithfulnessWeight ?? 0.4;
  const threshold =
    options.threshold ?? parseFloat(process.env.RAG_CONFIDENCE_THRESHOLD ?? '0.55');

  const retrievalConfidence =
    passages.length > 0 ? Math.max(...passages.map((p) => p.score)) : 0;
  const contextRelevance =
    passages.length > 0
      ? passages.reduce((sum, p) => sum + p.score, 0) / passages.length
      : 0;
  const faithfulness = faithfulnessScore(answer, passages);
  const coverage = citationCoverage(answer);

  const confidence =
    retrievalWeight * retrievalConfidence +
    faithfulnessWeight * faithfulness;

  return {
    retrievalConfidence,
    faithfulnessScore: faithfulness,
    citationCoverage: coverage,
    contextRelevance,
    confidence,
    grounded: confidence >= threshold,
    threshold,
  };
}
