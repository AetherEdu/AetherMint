/**
 * Job Routes — Issue #258
 *
 * REST endpoints for the background job system:
 *  - Job statistics (dashboard)
 *  - Job listing with filtering
 *  - Job detail with progress tracking
 *  - Retry dead-lettered jobs
 *  - Enqueue new jobs
 */

import { Router } from 'express';
import { jobController } from '../controllers/jobController';

const router: Router = Router();

// ── Admin Dashboard ───────────────────────────────────────────────────────────

/** GET /api/jobs/stats  — Aggregate job statistics */
router.get('/stats', jobController.getStats);

/** GET /api/jobs/dead-letter  — Dead-lettered jobs */
router.get('/dead-letter', jobController.listDeadLetter);

// ── Job Collection ────────────────────────────────────────────────────────────

/** GET  /api/jobs      — List jobs (filterable, paginated) */
router.get('/', jobController.listJobs);

/** POST /api/jobs      — Enqueue a new background job */
router.post('/', jobController.enqueueJob);

// ── Individual Job ────────────────────────────────────────────────────────────

/** GET    /api/jobs/:jobId           — Get job details */
router.get('/:jobId', jobController.getJob);

/** GET    /api/jobs/:jobId/progress  — Get job progress */
router.get('/:jobId/progress', jobController.getJobProgress);

/** POST   /api/jobs/:jobId/retry    — Retry dead-lettered job */
router.post('/:jobId/retry', jobController.retryJob);

/** DELETE /api/jobs/:jobId           — Remove a job */
router.delete('/:jobId', jobController.removeJob);

export default router;
