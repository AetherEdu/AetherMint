/**
 * Answer Generators for the AGI Tutor RAG pipeline.
 *
 * A generator turns retrieved passages into a grounded answer with inline
 * citation markers. Two implementations exist:
 *  - ExtractiveAnswerGenerator: deterministic, offline, keyless. It
 *    assembles the most relevant sentences from the retrieved passages and
 *    tags each with its citation. Used by default and as a fallback.
 *  - OpenAiAnswerGenerator: used when OPENAI_API_KEY is configured. The
 *    model is instructed to answer strictly from the provided context and
 *    to mark sources inline as [1], [2], ...
 */

import axios from 'axios';
import { Citation, RetrievedPassage } from './types';

export interface GeneratedAnswer {
  answer: string;
  citations: Citation[];
  model: string;
}

export interface AnswerGenerator {
  readonly name: string;
  generate(question: string, passages: RetrievedPassage[]): Promise<GeneratedAnswer>;
}

const SIGNIFICANT_WORD_MIN_LENGTH = 3;
const SIGNIFICANT_WORD_BLACKLIST = new Set([
  'the', 'and', 'for', 'are', 'was', 'with', 'from', 'that', 'this',
  'what', 'how', 'why', 'does', 'can', 'you', 'your', 'about', 'which',
]);

export class ExtractiveAnswerGenerator implements AnswerGenerator {
  readonly name = 'extractive';

  async generate(
    question: string,
    passages: RetrievedPassage[]
  ): Promise<GeneratedAnswer> {
    if (passages.length === 0) {
      return { answer: '', citations: [], model: this.name };
    }

    const keywords = this.significantWords(question);
    const selected: { passage: RetrievedPassage; sentences: string[] }[] = [];

    for (const passage of passages.slice(0, 3)) {
      const sentences = this.splitSentences(passage.chunk.content);
      const relevant = sentences.filter((sentence) =>
        this.containsAny(sentence, keywords)
      );
      if (relevant.length === 0) {
        continue;
      }
      selected.push({ passage, sentences: relevant.slice(0, 2) });
      if (selected.length >= 2) {
        break;
      }
    }

    // No retrieved passage answers the question — signal the pipeline to
    // fall back to the safe "I don't know" response rather than quoting
    // unrelated content.
    if (selected.length === 0) {
      return { answer: '', citations: [], model: this.name };
    }

    const citations: Citation[] = [];
    const parts: string[] = [];

    selected.forEach(({ passage, sentences }, passageIndex) => {
      const index = passageIndex + 1;
      citations.push({
        index,
        sourceId: passage.chunk.id,
        courseId: passage.chunk.courseId,
        courseTitle: passage.chunk.courseTitle,
        moduleTitle: passage.chunk.moduleTitle,
        lessonTitle: passage.chunk.lessonTitle,
        title: passage.chunk.title,
        excerpt: passage.excerpt,
        sourceUrl: passage.chunk.sourceUrl,
      });
      for (const sentence of sentences) {
        parts.push(`${sentence} [${index}]`);
      }
    });

    const answer = `Based on the course material, here is what the retrieved lessons say:\n\n${parts.join(' ')}`;
    return { answer, citations, model: this.name };
  }

  private splitSentences(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0);
  }

  private significantWords(question: string): string[] {
    return question
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(
        (word) =>
          word.length >= SIGNIFICANT_WORD_MIN_LENGTH &&
          !SIGNIFICANT_WORD_BLACKLIST.has(word)
      );
  }

  private containsAny(sentence: string, words: string[]): boolean {
    const normalized = sentence.toLowerCase();
    return words.some((word) => normalized.includes(word));
  }
}

export class OpenAiAnswerGenerator implements AnswerGenerator {
  readonly name = 'openai';
  private readonly apiKey: string;
  private readonly model: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY ?? '';
    this.model = process.env.RAG_LLM_MODEL ?? 'gpt-4o-mini';
  }

  get available(): boolean {
    return this.apiKey.length > 0;
  }

  async generate(
    question: string,
    passages: RetrievedPassage[]
  ): Promise<GeneratedAnswer> {
    if (!this.available) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const context = passages
      .map((passage, i) => `[${i + 1}] ${passage.chunk.content}`)
      .join('\n\n');

    const { data } = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: this.model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You are a tutor that answers strictly from the provided course material. ' +
              'Answer only using the context passages. Cite the source of each claim inline ' +
              'with a bracket number such as [1] or [2]. If the context does not contain ' +
              'enough information to answer, reply exactly with: I don\'t know.',
          },
          {
            role: 'user',
            content: `Question: ${question}\n\nContext:\n${context}`,
          },
        ],
      },
      {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        timeout: 30000,
      }
    );

    const content: string = data?.choices?.[0]?.message?.content ?? '';
    return {
      answer: content,
      citations: this.extractCitations(content, passages),
      model: this.model,
    };
  }

  private extractCitations(
    answer: string,
    passages: RetrievedPassage[]
  ): Citation[] {
    const used = new Set<number>();
    const pattern = /\[(\d+)\]/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(answer)) !== null) {
      const index = parseInt(match[1], 10);
      if (index >= 1 && index <= passages.length) {
        used.add(index);
      }
    }

    return Array.from(used)
      .sort((a, b) => a - b)
      .map((index) => {
        const passage = passages[index - 1];
        return {
          index,
          sourceId: passage.chunk.id,
          courseId: passage.chunk.courseId,
          courseTitle: passage.chunk.courseTitle,
          moduleTitle: passage.chunk.moduleTitle,
          lessonTitle: passage.chunk.lessonTitle,
          title: passage.chunk.title,
          excerpt: passage.excerpt,
          sourceUrl: passage.chunk.sourceUrl,
        };
      });
  }
}
