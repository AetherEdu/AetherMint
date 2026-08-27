/**
 * General-Purpose Background Job Queue — Issue #258
 *
 * Redis-backed job queue with:
 *  - Persistent job storage
 *  - Retry with exponential backoff
 *  - Dead-letter queue for jobs exceeding max retries
 *  - Job progress tracking and status API
 *
 * Built on top of the existing Redis infrastructure (ioredis / config/redis.ts).
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Redis } from 'ioredis';
import logger from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'dead_lettered';

export type JobType =
  | 'email'
  | 'credential_minting'
  | 'analytics_aggregation'
  | 'notification'
  | 'report_generation'
  | 'data_export'
  | 'content_processing'
  | 'question_generation'
  | 'general';

export interface JobData {
  type: JobType;
  payload: Record<string, unknown>;
  /** Optional metadata for tracking */
  metadata?: Record<string, unknown>;
}

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  progress: number; // 0–100
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  createdAt: string; // ISO-8601
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  nextRetryAt: string | null;
  backoffMs: number;
}

export interface JobStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  dead_lettered: number;
  total: number;
}

export interface JobHandler {
  (job: Job): Promise<void>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REDIS_PREFIX = 'aethermint:jobs:';
const QUEUE_KEY = `${REDIS_PREFIX}queue`;
const DEAD_LETTER_KEY = `${REDIS_PREFIX}dead_letter`;
const JOB_KEY_PREFIX = `${REDIS_PREFIX}job:`;

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_INITIAL_BACKOFF_MS = 1_000; // 1 second
const MAX_BACKOFF_MS = 300_000; // 5 minutes
const BACKOFF_MULTIPLIER = 2;

// ─── JobQueue Class ───────────────────────────────────────────────────────────

export class JobQueue extends EventEmitter {
  private redis: Redis;
  private handlers: Map<JobType, JobHandler> = new Map();
  private isProcessing = false;
  private processingInterval: ReturnType<typeof setInterval> | null = null;
  private pollIntervalMs = 2_000;
  private concurrency = 5;
  private activeJobs = new Set<string>();

  constructor(redisClient: Redis, options?: { pollIntervalMs?: number; concurrency?: number }) {
    super();
    this.redis = redisClient;
    if (options?.pollIntervalMs) this.pollIntervalMs = options.pollIntervalMs;
    if (options?.concurrency) this.concurrency = options.concurrency;
  }

  // ── Handler Registration ──────────────────────────────────────────────────

  /**
   * Register a handler for a specific job type.
   * The handler is called when a matching job is dequeued.
   */
  registerHandler(type: JobType, handler: JobHandler): void {
    if (this.handlers.has(type)) {
      logger.warn(`JobQueue: overwriting existing handler for type "${type}"`);
    }
    this.handlers.set(type, handler);
    logger.info(`JobQueue: registered handler for type "${type}"`);
  }

  // ── Enqueue ────────────────────────────────────────────────────────────────

  /**
   * Enqueue a new job for background processing.
   *
   * @returns The created job's ID.
   */
  async enqueue(data: JobData, options?: { maxAttempts?: number }): Promise<string> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const job: Job = {
      id,
      type: data.type,
      status: 'pending',
      payload: data.payload,
      metadata: data.metadata,
      progress: 0,
      attempts: 0,
      maxAttempts: options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      lastError: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      nextRetryAt: null,
      backoffMs: DEFAULT_INITIAL_BACKOFF_MS,
    };

    const pipeline = this.redis.pipeline();
    // Store job data
    pipeline.set(`${JOB_KEY_PREFIX}${id}`, JSON.stringify(job));
    // Push to pending queue
    pipeline.lpush(QUEUE_KEY, id);
    await pipeline.exec();

    logger.info(`JobQueue: enqueued job ${id} (type: ${data.type})`);
    this.emit('jobEnqueued', { jobId: id, type: data.type });

    return id;
  }

  // ── Dequeue & Process ──────────────────────────────────────────────────────

  /**
   * Start polling the queue for pending jobs.
   * Call once during server startup.
   */
  startProcessing(): void {
    if (this.isProcessing) {
      logger.warn('JobQueue: processing already started');
      return;
    }

    this.isProcessing = true;
    logger.info('JobQueue: started processing');

    this.processingInterval = setInterval(async () => {
      await this.processPendingJobs();
    }, this.pollIntervalMs);

    // Process immediately on start
    this.processPendingJobs().catch((err) =>
      logger.error('JobQueue: initial processing error', err),
    );
  }

  /**
   * Stop polling and wait for active jobs to finish.
   */
  async stopProcessing(): Promise<void> {
    if (!this.isProcessing) return;

    this.isProcessing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Wait for active jobs to drain
    while (this.activeJobs.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    logger.info('JobQueue: stopped processing');
  }

  // ── Internal Processing ────────────────────────────────────────────────────

  private async processPendingJobs(): Promise<void> {
    if (this.activeJobs.size >= this.concurrency) return;

    const available = this.concurrency - this.activeJobs.size;

    // Pop job IDs from the right (FIFO)
    const ids: string[] = [];
    for (let i = 0; i < available; i++) {
      const id = await this.redis.rpop(QUEUE_KEY);
      if (!id) break;
      ids.push(id);
    }

    if (ids.length === 0) return;

    // Process each job concurrently
    await Promise.allSettled(ids.map((id) => this.processJob(id)));
  }

  private async processJob(jobId: string): Promise<void> {
    this.activeJobs.add(jobId);

    try {
      const raw = await this.redis.get(`${JOB_KEY_PREFIX}${jobId}`);
      if (!raw) {
        logger.warn(`JobQueue: job ${jobId} not found in store`);
        return;
      }

      const job: Job = JSON.parse(raw);

      if (job.status === 'completed' || job.status === 'dead_lettered') {
        return; // already done
      }

      // Check if job is waiting for retry
      if (job.nextRetryAt && new Date(job.nextRetryAt) > new Date()) {
        // Re-queue for later
        await this.redis.lpush(QUEUE_KEY, jobId);
        return;
      }

      const handler = this.handlers.get(job.type);
      if (!handler) {
        logger.warn(`JobQueue: no handler registered for type "${job.type}". Sending to dead-letter.`);
        await this.moveToDeadLetter(job, `No handler registered for type "${job.type}"`);
        return;
      }

      // Mark as processing
      job.status = 'processing';
      job.startedAt = new Date().toISOString();
      job.updatedAt = new Date().toISOString();
      job.attempts += 1;
      await this.saveJob(job);

      this.emit('jobStarted', { jobId: job.id, type: job.type, attempt: job.attempts });
      logger.info(`JobQueue: processing job ${job.id} (attempt ${job.attempts}/${job.maxAttempts})`);

      try {
        await handler(job);

        // Mark completed
        job.status = 'completed';
        job.progress = 100;
        job.completedAt = new Date().toISOString();
        job.updatedAt = new Date().toISOString();
        await this.saveJob(job);

        this.emit('jobCompleted', { jobId: job.id, type: job.type });
        logger.info(`JobQueue: job ${job.id} completed successfully`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error(`JobQueue: job ${job.id} failed (attempt ${job.attempts}/${job.maxAttempts}): ${errorMsg}`);

        if (job.attempts >= job.maxAttempts) {
          await this.moveToDeadLetter(job, errorMsg);
        } else {
          // Retry with exponential backoff
          job.status = 'pending';
          job.lastError = errorMsg;
          job.nextRetryAt = new Date(Date.now() + job.backoffMs).toISOString();
          job.updatedAt = new Date().toISOString();

          // Exponential backoff capped at MAX_BACKOFF_MS
          job.backoffMs = Math.min(job.backoffMs * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);

          await this.saveJob(job);
          // Re-queue
          await this.redis.lpush(QUEUE_KEY, jobId);

          this.emit('jobRetrying', {
            jobId: job.id,
            type: job.type,
            attempt: job.attempts,
            nextRetryAt: job.nextRetryAt,
            error: errorMsg,
          });

          logger.info(
            `JobQueue: job ${job.id} will retry at ${job.nextRetryAt} (backoff: ${job.backoffMs}ms)`,
          );
        }
      }
    } catch (err) {
      logger.error(`JobQueue: unexpected error processing job ${jobId}`, err as Error);
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  // ── Dead-Letter Queue ──────────────────────────────────────────────────────

  private async moveToDeadLetter(job: Job, reason: string): Promise<void> {
    job.status = 'dead_lettered';
    job.lastError = reason;
    job.completedAt = new Date().toISOString();
    job.updatedAt = new Date().toISOString();
    await this.saveJob(job);

    // Add to dead-letter index
    await this.redis.lpush(DEAD_LETTER_KEY, job.id);

    this.emit('jobDeadLettered', { jobId: job.id, type: job.type, reason });
    logger.warn(`JobQueue: job ${job.id} moved to dead-letter: ${reason}`);
  }

  // ── Job Persistence ────────────────────────────────────────────────────────

  private async saveJob(job: Job): Promise<void> {
    await this.redis.set(`${JOB_KEY_PREFIX}${job.id}`, JSON.stringify(job));
  }

  // ── Status & Querying ──────────────────────────────────────────────────────

  /**
   * Get a single job by ID.
   */
  async getJob(jobId: string): Promise<Job | null> {
    const raw = await this.redis.get(`${JOB_KEY_PREFIX}${jobId}`);
    return raw ? JSON.parse(raw) : null;
  }

  /**
   * Get aggregate job statistics.
   */
  async getStats(): Promise<JobStats> {
    const stats: JobStats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      dead_lettered: 0,
      total: 0,
    };

    // Use scan to iterate over all job keys (non-blocking)
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        `${JOB_KEY_PREFIX}*`,
        'COUNT',
        100,
      );
      cursor = nextCursor;

      for (const key of keys) {
        const raw = await this.redis.get(key);
        if (!raw) continue;
        const job: Job = JSON.parse(raw);
        stats.total += 1;
        stats[job.status] = (stats[job.status] || 0) + 1;
      }
    } while (cursor !== '0');

    return stats;
  }

  /**
   * List jobs with optional filtering and cursor-based pagination.
   */
  async listJobs(options: {
    status?: JobStatus;
    type?: JobType;
    limit?: number;
    cursor?: string | null;
  }): Promise<{ jobs: Job[]; next_cursor: string | null; total: number; has_more: boolean }> {
    const { status, type, limit = 20, cursor } = options;

    // If status filter is specified, scan that specific list
    const scanPattern = status
      ? `${JOB_KEY_PREFIX}*`
      : `${JOB_KEY_PREFIX}*`;

    const allJobs: Job[] = [];
    let scanCursor = '0';

    do {
      const [nextCursor, keys] = await this.redis.scan(
        scanCursor,
        'MATCH',
        scanPattern,
        'COUNT',
        100,
      );
      scanCursor = nextCursor;

      for (const key of keys) {
        const raw = await this.redis.get(key);
        if (!raw) continue;
        const job: Job = JSON.parse(raw);

        // Apply filters
        if (status && job.status !== status) continue;
        if (type && job.type !== type) continue;

        allJobs.push(job);
      }
    } while (scanCursor !== '0');

    // Sort by updatedAt descending (newest first)
    allJobs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // Apply cursor pagination
    let startIndex = 0;
    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
        startIndex = parseInt(decoded, 10);
        if (Number.isNaN(startIndex)) startIndex = 0;
      } catch {
        startIndex = 0;
      }
    }

    const slice = allJobs.slice(startIndex, startIndex + limit);
    const has_more = startIndex + limit < allJobs.length;
    const next_cursor = has_more
      ? Buffer.from(String(startIndex + limit), 'utf-8').toString('base64url')
      : null;

    return { jobs: slice, next_cursor, total: allJobs.length, has_more };
  }

  /**
   * Retry a dead-lettered job by re-enqueueing it.
   */
  async retryDeadLetter(jobId: string): Promise<Job | null> {
    const job = await this.getJob(jobId);
    if (!job || job.status !== 'dead_lettered') return null;

    job.status = 'pending';
    job.attempts = 0;
    job.backoffMs = DEFAULT_INITIAL_BACKOFF_MS;
    job.lastError = null;
    job.nextRetryAt = null;
    job.updatedAt = new Date().toISOString();
    await this.saveJob(job);
    await this.redis.lpush(QUEUE_KEY, jobId);

    // Remove from dead-letter index
    await this.redis.lrem(DEAD_LETTER_KEY, 0, jobId);

    logger.info(`JobQueue: retrying dead-lettered job ${jobId}`);
    return job;
  }

  /**
   * Remove a job entirely.
   */
  async removeJob(jobId: string): Promise<boolean> {
    const exists = await this.redis.exists(`${JOB_KEY_PREFIX}${jobId}`);
    if (!exists) return false;

    await this.redis.del(`${JOB_KEY_PREFIX}${jobId}`);
    await this.redis.lrem(QUEUE_KEY, 0, jobId);
    await this.redis.lrem(DEAD_LETTER_KEY, 0, jobId);
    return true;
  }

  /**
   * Cleanup: stop processing and disconnect.
   */
  async destroy(): Promise<void> {
    await this.stopProcessing();
    this.removeAllListeners();
    this.handlers.clear();
    logger.info('JobQueue: destroyed');
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let jobQueueInstance: JobQueue | null = null;

export function getJobQueue(redisClient?: Redis, options?: { pollIntervalMs?: number; concurrency?: number }): JobQueue {
  if (!jobQueueInstance && redisClient) {
    jobQueueInstance = new JobQueue(redisClient, options);
  }
  if (!jobQueueInstance) {
    throw new Error('JobQueue not initialised. Call getJobQueue(redisClient) first.');
  }
  return jobQueueInstance;
}

export default JobQueue;
