/**
 * Bulk Job Service
 *
 * In-memory tracker for async bulk operations issued under issue #262.
 * Each bulk request returns a `jobId` immediately; clients poll
 * `GET /api/admin/bulk-jobs/:jobId` for progress and per-item results.
 *
 * Storage is intentionally in-process. Production deployment can swap
 * in a Redis-backed tracker by mirroring this surface.
 */

import { v4 as uuidv4 } from 'uuid';

export type BulkJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface BulkJobItemResult {
  index: number;
  status: 'success' | 'error';
  id?: string;
  error?: string;
  data?: Record<string, unknown>;
}

export interface BulkJob<TInput = unknown> {
  id: string;
  type:
    | 'credentials'
    | 'enrollments'
    | 'users'
    | string;
  status: BulkJobStatus;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  /** When the job is completed/failed, the structured per-item results. */
  results: BulkJobItemResult[];
  /** Echo of the original input for audit purposes (capped). */
  inputPreview?: TInput[];
}

export interface BulkJobCreateInput {
  type: BulkJob['type'];
  ownerId: string;
  total: number;
  inputPreview?: unknown[];
}

/** Time after which completed jobs are pruned. 1 hour by default. */
const COMPLETED_TTL_MS = 60 * 60 * 1000;
/** Soft cap on per-job `results` array to bound memory. */
const RESULT_CAP = 5000;
/** Sweep interval for the cleanup timer. */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

class BulkJobService {
  private jobs = new Map<string, BulkJob>();
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startSweeper();
  }

  create(input: BulkJobCreateInput): BulkJob {
    const id = uuidv4();
    const now = new Date().toISOString();
    const job: BulkJob = {
      id,
      type: input.type,
      status: 'queued',
      total: input.total,
      processed: 0,
      succeeded: 0,
      failed: 0,
      ownerId: input.ownerId,
      createdAt: now,
      updatedAt: now,
      results: [],
      inputPreview: input.inputPreview?.slice(0, 50),
    };
    this.jobs.set(id, job);
    return job;
  }

  get(id: string): BulkJob | undefined {
    return this.jobs.get(id);
  }

  markRunning(id: string): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.status = 'running';
    job.updatedAt = new Date().toISOString();
  }

  appendResult(id: string, result: BulkJobItemResult): void {
    const job = this.jobs.get(id);
    if (!job) return;
    if (job.results.length < RESULT_CAP) {
      job.results.push(result);
    }
    job.processed = Math.min(job.processed + 1, job.total);
    if (result.status === 'success') job.succeeded += 1;
    else job.failed += 1;
    job.updatedAt = new Date().toISOString();
  }

  markCompleted(id: string): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.status = 'completed';
    job.updatedAt = new Date().toISOString();
  }

  markFailed(id: string, reason: string): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.status = 'failed';
    job.updatedAt = new Date().toISOString();
    job.results.push({
      index: -1,
      status: 'error',
      error: reason,
    });
  }

  /** Iterate jobs owned by a user, newest first. Used by the dashboard. */
  listForOwner(ownerId: string): BulkJob[] {
    return Array.from(this.jobs.values())
      .filter((j) => j.ownerId === ownerId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  /**
   * Run an async processor against a list of items. Updates the job as
   * each item finishes and emits the final status. The processor
   * receives `(item, index)` and must return either `{ ok: true, id? }`
   * or `{ ok: false, error }`. Errors thrown by the processor are
   * caught and recorded as item-level errors so one bad item does not
   * abort the whole batch.
   */
  async process<TInput>(
    jobId: string,
    items: TInput[],
    processor: (
      item: TInput,
      index: number
    ) => Promise<
      | { ok: true; id?: string; data?: Record<string, unknown> }
      | { ok: false; error: string }
    >
  ): Promise<void> {
    this.markRunning(jobId);
    for (let i = 0; i < items.length; i++) {
      try {
        const out = await processor(items[i], i);
        if (out.ok) {
          this.appendResult(jobId, {
            index: i,
            status: 'success',
            id: out.id,
            data: out.data,
          });
        } else {
          this.appendResult(jobId, {
            index: i,
            status: 'error',
            error: out.error,
          });
        }
      } catch (err) {
        this.appendResult(jobId, {
          index: i,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    this.markCompleted(jobId);
  }

  private startSweeper(): void {
    if (this.sweepTimer) return;
    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    // Node will keep the process alive because of setInterval; unref
    // it so this doesn't prevent graceful shutdown.
    if (typeof this.sweepTimer.unref === 'function') {
      this.sweepTimer.unref();
    }
  }

  private sweep(): void {
    const cutoff = Date.now() - COMPLETED_TTL_MS;
    for (const [id, job] of this.jobs) {
      const terminal =
        job.status === 'completed' ||
        job.status === 'failed' ||
        job.status === 'cancelled';
      const updated = Date.parse(job.updatedAt);
      if (terminal && Number.isFinite(updated) && updated < cutoff) {
        this.jobs.delete(id);
      }
    }
  }

  /** Test helper — never called in production. */
  __resetForTests(): void {
    this.jobs.clear();
  }

  stop(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }
}

export const bulkJobService = new BulkJobService();
