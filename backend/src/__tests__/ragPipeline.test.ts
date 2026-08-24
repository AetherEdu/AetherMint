/**
 * Tests for the AGI tutor RAG pipeline (Issue #406).
 *
 * All tests run against the in-memory vector store so they are
 * deterministic and require no external services.
 */

import {
  LocalHashEmbedder,
  cosineSimilarity,
  MemoryVectorStore,
  SeedCourseContentProvider,
  RagPipeline,
  faithfulnessScore,
  citationCoverage,
  computeGroundingMetrics,
  OpenAiAnswerGenerator,
} from '../services/tutor';

describe('LocalHashEmbedder', () => {
  const embedder = new LocalHashEmbedder(256);

  it('produces fixed-dimension, unit-norm vectors', () => {
    const vector = embedder.embed('smart contracts run on a blockchain');
    expect(vector).toHaveLength(256);
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it('is deterministic for the same input', () => {
    expect(embedder.embed('what is a smart contract?')).toEqual(
      embedder.embed('what is a smart contract?')
    );
  });

  it('ranks related text above unrelated text', () => {
    const query = embedder.embed('what is a smart contract?');
    const related = embedder.embed(
      'A smart contract is a program that runs on a blockchain.'
    );
    const unrelated = embedder.embed('the quick brown fox jumps over the lazy dog');

    expect(cosineSimilarity(query, related)).toBeGreaterThan(
      cosineSimilarity(query, unrelated)
    );
  });
});

describe('MemoryVectorStore', () => {
  const store = new MemoryVectorStore({ collection: 'test' });
  const embedder = new LocalHashEmbedder(256);

  beforeEach(async () => {
    await store.clear();
  });

  it('upserts, counts, and searches by similarity', async () => {
    const chunks = [
      {
        id: 'c1',
        courseId: 'course_a',
        courseTitle: 'Course A',
        moduleId: 'm1',
        moduleTitle: 'Module 1',
        lessonId: 'l1',
        lessonTitle: 'Smart Contracts',
        title: 'Smart Contracts',
        content: 'A smart contract is a program that runs on a blockchain.',
        contentType: 'lesson' as const,
      },
      {
        id: 'c2',
        courseId: 'course_a',
        courseTitle: 'Course A',
        moduleId: 'm2',
        moduleTitle: 'Module 2',
        lessonId: 'l2',
        lessonTitle: 'Graph Theory',
        title: 'Graph Theory',
        content: 'A graph is a collection of vertices connected by edges.',
        contentType: 'lesson' as const,
      },
    ];
    const vectors = chunks.map((c) => embedder.embed(c.content));

    await store.upsert(chunks, vectors);
    expect(await store.count()).toBe(2);

    const results = await store.search(embedder.embed('smart contracts'), 1);
    expect(results).toHaveLength(1);
    expect(results[0].chunk.id).toBe('c1');
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].excerpt.length).toBeGreaterThan(0);
  });

  it('replaces existing chunks on re-upsert', async () => {
    const chunk = {
      id: 'c1',
      courseId: 'course_a',
      courseTitle: 'Course A',
      moduleId: 'm1',
      moduleTitle: 'Module 1',
      title: 'Lesson',
      content: 'version one',
      contentType: 'lesson' as const,
    };
    await store.upsert([chunk], [embedder.embed(chunk.content)]);
    await store.upsert([{ ...chunk, content: 'version two' }], [embedder.embed('version two')]);
    expect(await store.count()).toBe(1);
  });
});

describe('Grounding metrics', () => {
  const passage = (content: string) => ({
    chunk: {
      id: 'p1',
      courseId: 'course_a',
      courseTitle: 'Course A',
      moduleId: 'm1',
      moduleTitle: 'Module 1',
      title: 'Lesson',
      content,
      contentType: 'lesson' as const,
    },
    score: 0.8,
    excerpt: content.slice(0, 100),
  });

  it('scores grounded answers as faithful', () => {
    const source =
      'Consensus is the process by which participants in a blockchain network agree on the state of the ledger. Proof of Work requires miners to solve a computationally expensive puzzle.';
    const answer =
      'Consensus is the process by which participants agree on the state of the ledger [1]. Proof of Work requires solving a computationally expensive puzzle [1].';
    const metrics = computeGroundingMetrics('what is consensus?', answer, [
      passage(source),
    ]);
    expect(metrics.faithfulnessScore).toBeGreaterThan(0.9);
    expect(metrics.citationCoverage).toBe(1);
    expect(metrics.grounded).toBe(true);
  });

  it('scores answers unrelated to the context as unfaithful', () => {
    const source =
      'Consensus is the process by which participants in a blockchain network agree on the state of the ledger.';
    const answer = 'The capital of France is Paris, a city famous for its art.';
    const metrics = computeGroundingMetrics('what is the capital?', answer, [
      passage(source),
    ]);
    expect(metrics.faithfulnessScore).toBeLessThan(0.5);
    expect(metrics.grounded).toBe(false);
  });

  it('citation coverage reflects inline markers', () => {
    expect(citationCoverage('First claim [1]. Second claim [2].')).toBe(1);
    expect(citationCoverage('First claim. Second claim.')).toBe(0);
  });

  it('faithfulness handles empty inputs', () => {
    expect(faithfulnessScore('', [passage('some content')])).toBe(0);
  });
});

describe('RagPipeline (in-memory)', () => {
  const buildPipeline = () =>
    new RagPipeline({
      store: new MemoryVectorStore({ collection: 'test' }),
      provider: new SeedCourseContentProvider(),
      embedder: new LocalHashEmbedder(768),
    });

  it('indexes seed course content into the store', async () => {
    const pipeline = buildPipeline();
    const result = await pipeline.indexContent();

    expect(result.indexed).toBeGreaterThan(0);
    expect(result.chunkCount).toBe(result.indexed);

    const status = await pipeline.getStatus();
    expect(status.chunkCount).toBe(result.indexed);
    expect(status.lastIndexedAt).not.toBeNull();
  });

  it('skips re-indexing when content is unchanged', async () => {
    const pipeline = buildPipeline();
    await pipeline.indexContent();
    const second = await pipeline.indexContent();

    expect(second.indexed).toBe(0);
    expect(second.skipped).toBeGreaterThan(0);
  });

  it('answers a question grounded in course material with citations', async () => {
    const pipeline = buildPipeline();
    await pipeline.indexContent();

    const answer = await pipeline.answer('what is a smart contract?');

    expect(answer.fallback).toBe(false);
    expect(answer.grounded).toBe(true);
    expect(answer.answer).not.toContain("don't know");
    expect(answer.citations.length).toBeGreaterThan(0);
    expect(answer.citations[0]).toMatchObject({
      courseId: 'course_blockchain_fundamentals',
    });
    expect(answer.sources.length).toBeGreaterThan(0);
    expect(answer.metrics.confidence).toBeGreaterThanOrEqual(answer.metrics.threshold);
    expect(answer.metrics.faithfulnessScore).toBeGreaterThan(0.5);
    expect(answer.metrics.citationCoverage).toBeGreaterThan(0);
  });

  it('falls back to a safe "I don\'t know" when confidence is low', async () => {
    const pipeline = buildPipeline();
    await pipeline.indexContent();

    const answer = await pipeline.answer(
      'what is the population of the city of Atlantis?'
    );

    expect(answer.fallback).toBe(true);
    expect(answer.grounded).toBe(false);
    expect(answer.answer).toContain("don't know");
    expect(answer.citations).toHaveLength(0);
    expect(answer.sources).toHaveLength(0);
  });

  it('answers without indexing (empty store) via fallback', async () => {
    const pipeline = buildPipeline();
    const answer = await pipeline.answer('what is a smart contract?');

    expect(answer.fallback).toBe(true);
    expect(answer.answer).toContain("don't know");
  });
});

describe('OpenAiAnswerGenerator', () => {
  it('is unavailable when no API key is configured', () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const generator = new OpenAiAnswerGenerator();
    expect(generator.available).toBe(false);
    if (previous !== undefined) {
      process.env.OPENAI_API_KEY = previous;
    }
  });

  it('throws when asked to generate without an API key', async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const generator = new OpenAiAnswerGenerator();
    await expect(generator.generate('question', [])).rejects.toThrow(
      'OPENAI_API_KEY'
    );
    if (previous !== undefined) {
      process.env.OPENAI_API_KEY = previous;
    }
  });
});
