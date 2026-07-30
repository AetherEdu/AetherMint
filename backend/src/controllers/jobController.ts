/**
 * Job Controller — Issue #258
 *
 * HTTP endpoints for background job monitoring and administration.
 * Provides job status, statistics, dead-letter management, and retry
 * capabilities for the admin dashboard.
 */

import { Request, Response, NextFunction } from 'express';
import { getJobQueue, JobStatus } from '../services/jobQueue';
import logger from '../utils/logger';
import { ValidationError } from '../utils/errors';

export const jobController = {
  /**
   * GET /api/jobs/stats
   * Get aggregate job statistics for the admin dashboard.
   */
  getStats: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const queue = getJobQueue();
      const stats = await queue.getStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('JobController: getStats error', error as Error);
      next(error);
    }
  },

  /**
   * GET /api/jobs
   * List jobs with optional filtering and pagination.
   *
   * Query params: status, type, limit, cursor
   */
  listJobs: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, type, limit, cursor } = req.query;
      const queue = getJobQueue();

      const result = await queue.listJobs({
        status: status as JobStatus | undefined,
        type: type as any,
        limit: limit ? parseInt(limit as string, 10) : 20,
        cursor: (cursor as string) || null,
      });

      res.json({
        success: true,
        data: result.jobs,
        pagination: {
          next_cursor: result.next_cursor,
          total_count: result.total,
          has_more: result.has_more,
        },
      });
    } catch (error) {
      logger.error('JobController: listJobs error', error as Error);
      next(error);
    }
  },

  /**
   * GET /api/jobs/:jobId
   * Get details for a specific job.
   */
  getJob: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;
      const queue = getJobQueue();
      const job = await queue.getJob(jobId);

      if (!job) {
        return res.status(404).json({
          success: false,
          message: `Job ${jobId} not found`,
        });
      }

      res.json({
        success: true,
        data: job,
      });
    } catch (error) {
      logger.error('JobController: getJob error', error as Error);
      next(error);
    }
  },

  /**
   * GET /api/jobs/:jobId/progress
   * Get progress for a specific job.
   */
  getJobProgress: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;
      const queue = getJobQueue();
      const job = await queue.getJob(jobId);

      if (!job) {
        return res.status(404).json({
          success: false,
          message: `Job ${jobId} not found`,
        });
      }

      res.json({
        success: true,
        data: {
          jobId: job.id,
          status: job.status,
          progress: job.progress,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          lastError: job.lastError,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
        },
      });
    } catch (error) {
      logger.error('JobController: getJobProgress error', error as Error);
      next(error);
    }
  },

  /**
   * POST /api/jobs/:jobId/retry
   * Retry a dead-lettered job.
   */
  retryJob: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;
      const queue = getJobQueue();
      const job = await queue.retryDeadLetter(jobId);

      if (!job) {
        return res.status(400).json({
          success: false,
          message: `Job ${jobId} is not dead-lettered or does not exist`,
        });
      }

      res.json({
        success: true,
        message: `Job ${jobId} re-queued for retry`,
        data: job,
      });
    } catch (error) {
      logger.error('JobController: retryJob error', error as Error);
      next(error);
    }
  },

  /**
   * DELETE /api/jobs/:jobId
   * Remove a job entirely.
   */
  removeJob: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;
      const queue = getJobQueue();
      const removed = await queue.removeJob(jobId);

      if (!removed) {
        return res.status(404).json({
          success: false,
          message: `Job ${jobId} not found`,
        });
      }

      res.json({
        success: true,
        message: `Job ${jobId} removed`,
      });
    } catch (error) {
      logger.error('JobController: removeJob error', error as Error);
      next(error);
    }
  },

  /**
   * POST /api/jobs
   * Enqueue a new background job.
   */
  enqueueJob: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, payload, metadata, maxAttempts } = req.body;

      if (!type || !payload) {
        throw new ValidationError('Job type and payload are required');
      }

      const queue = getJobQueue();
      const jobId = await queue.enqueue(
        { type, payload, metadata },
        { maxAttempts },
      );

      res.status(201).json({
        success: true,
        message: 'Job enqueued',
        data: { jobId },
      });
    } catch (error) {
      logger.error('JobController: enqueueJob error', error as Error);
      next(error);
    }
  },

  /**
   * GET /api/jobs/dead-letter
   * List dead-lettered jobs for the admin dashboard.
   */
  listDeadLetter: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queue = getJobQueue();
      const result = await queue.listJobs({
        status: 'dead_lettered',
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
        cursor: (req.query.cursor as string) || null,
      });

      res.json({
        success: true,
        data: result.jobs,
        pagination: {
          next_cursor: result.next_cursor,
          total_count: result.total,
          has_more: result.has_more,
        },
      });
    } catch (error) {
      logger.error('JobController: listDeadLetter error', error as Error);
      next(error);
    }
  },
};
