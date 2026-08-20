import { v4 as uuidv4 } from 'uuid';
import quizService from '../quizService';
import { Question, QuestionOption, Quiz } from '../../models/Quiz';

export type QuestionSourceType = 'lesson' | 'transcript';
export type GenerationJobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type QuestionReviewStatus = 'pending' | 'approved' | 'rejected';
export type GeneratedQuestionType = 'multiple-choice' | 'true-false';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface QuestionGenerationSource {
  id?: string;
  type: QuestionSourceType;
  title?: string;
  text: string;
}

export interface QuestionGenerationRequest {
  courseId: string;
  title: string;
  description?: string;
  sourceText?: string;
  sources?: QuestionGenerationSource[];
  questionCount?: number;
  questionTypes?: GeneratedQuestionType[];
}

export interface GeneratedQuestion extends Question {
  type: GeneratedQuestionType;
  difficulty: QuestionDifficulty;
  qualityScore: number;
  qualityFlags: string[];
  reviewStatus: QuestionReviewStatus;
  sourceId?: string;
  sourceExcerpt: string;
}

export interface QuestionGenerationJob {
  id: string;
  courseId: string;
  instructorId: string;
  title: string;
  description: string;
  sources: QuestionGenerationSource[];
  requestedQuestionCount: number;
  requestedQuestionTypes: GeneratedQuestionType[];
  status: GenerationJobStatus;
  progress: number;
  questions: GeneratedQuestion[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  error?: string;
  importedQuizId?: string;
  importedAt?: Date;
}

export interface QuestionReviewUpdate {
  status?: QuestionReviewStatus;
  question?: string;
  options?: QuestionOption[];
  correctAnswer?: string | string[];
  explanation?: string;
  difficulty?: QuestionDifficulty;
}

export interface QuestionGenerationQueue {
  enqueue: (jobId: string) => Promise<string | void>;
}

export interface QuestionGenerationExport {
  version: 1;
  exportedAt: string;
  jobId: string;
  courseId: string;
  title: string;
  description: string;
  questions: GeneratedQuestion[];
}

const MAX_SOURCE_LENGTH = 100_000;
const MAX_QUESTION_COUNT = 20;
const DEFAULT_QUESTION_COUNT = 5;
const DEFAULT_TYPES: GeneratedQuestionType[] = ['multiple-choice', 'true-false'];

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'because', 'before', 'being', 'between',
  'could', 'does', 'from', 'have', 'into', 'more', 'most', 'other', 'over',
  'should', 'some', 'such', 'than', 'that', 'their', 'them', 'there', 'these',
  'they', 'this', 'those', 'through', 'under', 'were', 'which', 'while', 'with',
  'would', 'your', 'what', 'when', 'where', 'will', 'whose', 'source', 'material',
]);

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncate(value: string, maximum: number): string {
  if (value.length <= maximum) return value;
  return `${value.slice(0, maximum - 1).trim()}…`;
}

function normaliseSources(request: QuestionGenerationRequest): QuestionGenerationSource[] {
  const sources = [...(request.sources || [])];
  if (request.sourceText?.trim()) {
    sources.unshift({ type: 'lesson', text: request.sourceText });
  }

  return sources
    .map((source, index) => ({
      ...source,
      id: source.id || `source-${index + 1}`,
      title: source.title?.trim() || `${source.type === 'transcript' ? 'Transcript' : 'Lesson'} ${index + 1}`,
      text: cleanText(source.text || ''),
    }))
    .filter(source => source.text.length > 0);
}

function splitSentences(source: QuestionGenerationSource): Array<{
  source: QuestionGenerationSource;
  text: string;
}> {
  return source.text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(text => cleanText(text))
    .filter(text => text.length >= 20)
    .map(text => ({ source, text }));
}

function extractKeyTerm(sentence: string): string | undefined {
  const terms = sentence.match(/[A-Za-z][A-Za-z'-]{3,}/g) || [];
  const candidates = terms.filter(term => !STOP_WORDS.has(term.toLowerCase()));
  if (candidates.length === 0) return undefined;

  return [...candidates].sort((left, right) => {
    const lengthDifference = right.length - left.length;
    return lengthDifference || left.localeCompare(right);
  })[0];
}

function difficultyFor(sentence: string, keyTerm?: string): QuestionDifficulty {
  const wordCount = sentence.split(/\s+/).length;
  const conceptCount = (sentence.match(/\b(is|are|means|because|therefore|using|called)\b/gi) || []).length;
  if (wordCount <= 14 && conceptCount <= 1) return 'easy';
  if (wordCount >= 28 || conceptCount >= 3 || (keyTerm?.length || 0) >= 14) return 'hard';
  return 'medium';
}

function qualityFor(
  answer: string,
  keyTerm: string | undefined,
  options: QuestionOption[],
): { score: number; flags: string[] } {
  let score = 0.35;
  const flags: string[] = [];

  if (answer.length >= 45) score += 0.2;
  else flags.push('short-answer-context');

  if (keyTerm) score += 0.15;
  else flags.push('no-distinctive-term');

  if (options.length >= 2) score += 0.2;
  else flags.push('insufficient-distractors');

  const uniqueOptions = new Set(options.map(option => option.text.toLowerCase()));
  if (uniqueOptions.size !== options.length) {
    score -= 0.15;
    flags.push('duplicate-options');
  } else {
    score += 0.1;
  }

  const finalScore = Math.round(clamp(score, 0, 1) * 100) / 100;
  if (finalScore < 0.65) flags.push('low-confidence');
  return { score: finalScore, flags };
}

export class QuestionGeneratorService {
  private readonly jobs = new Map<string, QuestionGenerationJob>();
  private queue?: QuestionGenerationQueue;
  private autoProcess: boolean;

  constructor(options: { autoProcess?: boolean } = {}) {
    this.autoProcess = options.autoProcess ?? true;
  }

  setQueue(queue: QuestionGenerationQueue): void {
    this.queue = queue;
  }

  async createJob(request: QuestionGenerationRequest, instructorId: string): Promise<QuestionGenerationJob> {
    const sources = normaliseSources(request);
    const totalLength = sources.reduce((total, source) => total + source.text.length, 0);

    if (!request.courseId?.trim()) throw new Error('courseId is required');
    if (!request.title?.trim()) throw new Error('title is required');
    if (sources.length === 0 || totalLength < 20) {
      throw new Error('At least 20 characters of lesson or transcript text are required');
    }
    if (totalLength > MAX_SOURCE_LENGTH) {
      throw new Error(`Source material must not exceed ${MAX_SOURCE_LENGTH} characters`);
    }

    const questionCount = request.questionCount ?? DEFAULT_QUESTION_COUNT;
    if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > MAX_QUESTION_COUNT) {
      throw new Error(`questionCount must be an integer between 1 and ${MAX_QUESTION_COUNT}`);
    }

    const questionTypes = request.questionTypes?.length ? request.questionTypes : DEFAULT_TYPES;
    const job: QuestionGenerationJob = {
      id: uuidv4(),
      courseId: request.courseId,
      instructorId,
      title: request.title.trim(),
      description: request.description?.trim() || `Questions generated from ${sources.length} course source(s).`,
      sources,
      requestedQuestionCount: questionCount,
      requestedQuestionTypes: [...new Set(questionTypes)],
      status: 'pending',
      progress: 0,
      questions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.jobs.set(job.id, job);

    if (this.queue) {
      await this.queue.enqueue(job.id);
    } else if (this.autoProcess) {
      setImmediate(() => {
        this.processJob(job.id).catch(() => undefined);
      });
    }

    return this.cloneJob(job);
  }

  getJob(jobId: string): QuestionGenerationJob | undefined {
    const job = this.jobs.get(jobId);
    return job ? this.cloneJob(job) : undefined;
  }

  async processJob(jobId: string): Promise<QuestionGenerationJob> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('Question generation job not found');
    if (job.status === 'completed') return this.cloneJob(job);

    job.status = 'processing';
    job.progress = 10;
    job.updatedAt = new Date();

    try {
      const sentences = job.sources.flatMap(source => splitSentences(source));
      if (sentences.length === 0) throw new Error('The source material does not contain enough complete statements');

      job.questions = this.generateQuestions(job, sentences);
      job.status = 'completed';
      job.progress = 100;
      job.completedAt = new Date();
      job.updatedAt = new Date();
      return this.cloneJob(job);
    } catch (error) {
      job.status = 'failed';
      job.progress = 100;
      job.error = error instanceof Error ? error.message : 'Question generation failed';
      job.updatedAt = new Date();
      throw error;
    }
  }

  updateQuestion(jobId: string, questionId: string, update: QuestionReviewUpdate): GeneratedQuestion {
    const job = this.requireJob(jobId);
    const question = job.questions.find(item => item.id === questionId);
    if (!question) throw new Error('Generated question not found');
    if (job.status !== 'completed') throw new Error('Questions are not ready for review');
    if (job.importedQuizId) throw new Error('Imported questions cannot be changed');

    if (update.question !== undefined) {
      if (update.question.trim().length < 10) throw new Error('Question text must be at least 10 characters');
      question.question = update.question.trim();
    }
    if (update.options !== undefined) {
      if (update.options.length < 2 || update.options.some(option => !option.text?.trim())) {
        throw new Error('A question must have at least two non-empty options');
      }
      question.options = update.options.map(option => ({ ...option, text: option.text.trim() }));
    }
    if (update.correctAnswer !== undefined) question.correctAnswer = update.correctAnswer;
    if (update.explanation !== undefined) question.explanation = update.explanation.trim();
    if (update.difficulty !== undefined) question.difficulty = update.difficulty;
    if (update.status !== undefined) question.reviewStatus = update.status;

    const quality = qualityFor(
      question.options?.find(option => option.isCorrect)?.text || question.question,
      extractKeyTerm(question.sourceExcerpt),
      question.options || [],
    );
    question.qualityScore = quality.score;
    question.qualityFlags = quality.flags;
    job.updatedAt = new Date();
    return { ...question, options: question.options?.map(option => ({ ...option })) };
  }

  reviewQuestions(jobId: string, questionIds: string[], status: Exclude<QuestionReviewStatus, 'pending'>): QuestionGenerationJob {
    const job = this.requireJob(jobId);
    if (job.status !== 'completed') throw new Error('Questions are not ready for review');
    if (job.importedQuizId) throw new Error('Imported questions cannot be reviewed');

    const selected = new Set(questionIds);
    const matched = job.questions.filter(question => selected.has(question.id));
    if (matched.length !== selected.size) throw new Error('One or more generated questions were not found');
    matched.forEach(question => { question.reviewStatus = status; });
    job.updatedAt = new Date();
    return this.cloneJob(job);
  }

  async importApprovedQuiz(jobId: string, instructorId: string): Promise<Quiz> {
    const job = this.requireJob(jobId);
    if (job.status !== 'completed') throw new Error('Questions are not ready for import');
    if (job.instructorId !== instructorId) throw new Error('Only the job owner can import the quiz');
    if (job.importedQuizId) {
      const existing = quizService.getQuizById(job.importedQuizId);
      const response = await existing;
      if (response.data) return response.data;
    }

    const approved = job.questions.filter(question => question.reviewStatus === 'approved');
    if (approved.length === 0) throw new Error('Approve at least one question before importing');

    const response = await quizService.createQuiz({
      title: job.title,
      description: job.description,
      courseId: job.courseId,
      questions: approved.map(question => ({
        type: question.type,
        question: question.question,
        options: question.options,
        correctAnswer: question.correctAnswer,
        points: question.points,
        explanation: question.explanation,
        order: question.order,
      })),
      settings: { attemptsAllowed: 1, showResults: true, allowReview: true },
      metadata: {
        difficulty: approved.some(question => question.difficulty === 'hard') ? 'hard' : 'medium',
        tags: ['generated', ...job.sources.map(source => source.type)],
        instructions: 'Review generated questions before assigning this quiz.',
      },
    }, instructorId);

    if (!response.data) throw new Error(response.message || 'Unable to import generated quiz');
    job.importedQuizId = response.data.id;
    job.importedAt = new Date();
    job.updatedAt = new Date();
    return response.data;
  }

  exportApproved(jobId: string): QuestionGenerationExport {
    const job = this.requireJob(jobId);
    if (job.status !== 'completed') throw new Error('Questions are not ready for export');
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      jobId: job.id,
      courseId: job.courseId,
      title: job.title,
      description: job.description,
      questions: job.questions
        .filter(question => question.reviewStatus === 'approved')
        .map(question => ({ ...question, options: question.options?.map(option => ({ ...option })) })),
    };
  }

  private generateQuestions(
    job: QuestionGenerationJob,
    sentences: Array<{ source: QuestionGenerationSource; text: string }>,
  ): GeneratedQuestion[] {
    const selected = sentences.slice(0, Math.min(job.requestedQuestionCount, sentences.length));
    const questions: GeneratedQuestion[] = [];

    selected.forEach((item, index) => {
      const keyTerm = extractKeyTerm(item.text);
      const type = job.requestedQuestionTypes[index % job.requestedQuestionTypes.length];
      const answerText = truncate(item.text, 220);
      const options = type === 'true-false'
        ? [
            { id: uuidv4(), text: answerText, isCorrect: true },
            { id: uuidv4(), text: 'The source material states the opposite of this statement.', isCorrect: false },
          ]
        : this.buildMultipleChoiceOptions(answerText, sentences, index);
      const quality = qualityFor(answerText, keyTerm, options);
      const difficulty = difficultyFor(item.text, keyTerm);

      questions.push({
        id: uuidv4(),
        type,
        question: type === 'true-false'
          ? `True or false: ${answerText}`
          : `What does the source material state about${keyTerm ? ` "${keyTerm}"` : ' this topic'}?`,
        options,
        correctAnswer: options.find(option => option.isCorrect)?.id,
        points: difficulty === 'hard' ? 2 : 1,
        explanation: `This answer is supported by the ${item.source.type} source${item.source.title ? ` "${item.source.title}"` : ''}.`,
        order: index,
        difficulty,
        qualityScore: quality.score,
        qualityFlags: quality.flags,
        reviewStatus: 'pending',
        sourceId: item.source.id,
        sourceExcerpt: item.text,
      });
    });

    return questions;
  }

  private buildMultipleChoiceOptions(
    answer: string,
    sentences: Array<{ source: QuestionGenerationSource; text: string }>,
    answerIndex: number,
  ): QuestionOption[] {
    const distractors = sentences
      .filter((_item, index) => index !== answerIndex)
      .slice(0, 3)
      .map(item => truncate(item.text, 220));

    while (distractors.length < 3) {
      distractors.push([
        'The source material does not connect this topic to the lesson.',
        'The lesson presents this topic only as a historical footnote.',
        'The transcript gives no definition or explanation for this topic.',
      ][distractors.length]);
    }

    const options = [
      { id: uuidv4(), text: answer, isCorrect: true },
      ...distractors.map(text => ({ id: uuidv4(), text, isCorrect: false })),
    ];

    return options.sort((left, right) => left.id.localeCompare(right.id));
  }

  private requireJob(jobId: string): QuestionGenerationJob {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('Question generation job not found');
    return job;
  }

  private cloneJob(job: QuestionGenerationJob): QuestionGenerationJob {
    return {
      ...job,
      sources: job.sources.map(source => ({ ...source })),
      questions: job.questions.map(question => ({
        ...question,
        options: question.options?.map(option => ({ ...option })),
        qualityFlags: [...question.qualityFlags],
      })),
    };
  }
}

export const questionGeneratorService = new QuestionGeneratorService();
export default questionGeneratorService;
