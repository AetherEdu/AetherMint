/**
 * Admin Bulk Routes (#262)
 *
 * Rate-limited, admin-only endpoints for bulk credential issuance,
 * bulk enrollment, bulk user import (CSV/JSON), and bulk-job status.
 */

import express, { Router } from 'express';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { authenticateToken, requireRole } from '../middleware/auth';
import { AdminBulkController } from '../controllers/AdminBulkController';

const router: Router = express.Router();

// Stricter rate limit for bulk operations: 10 calls per 15 minutes
// per admin user, lower than the global limiter so a single admin
// cannot queue hundreds of large jobs in a minute. We key off the
// authenticated user id (when present) so admins behind the same
// office IP don't throttle each other.
const bulkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = (req as any).user?.id;
    if (typeof userId === 'string' && userId.length > 0) {
      return `bulk:${userId}`;
    }
    return `bulk:ip:${req.ip ?? 'unknown'}`;
  },
  message: {
    success: false,
    message: 'Too many bulk requests, please try again later.',
  },
});

// Stricter rate limit for GETs: 60 calls per minute, also per user.
const bulkReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = (req as any).user?.id;
    if (typeof userId === 'string' && userId.length > 0) {
      return `bulk-read:${userId}`;
    }
    return `bulk-read:ip:${req.ip ?? 'unknown'}`;
  },
});

// Memory-only multer upload. Cap at 5 MB and CSV mime types only.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.csv');
    if (!ok) {
      cb(new Error('Only CSV files are accepted'));
      return;
    }
    cb(null, true);
  },
});

const adminOnly = [
  authenticateToken,
  requireRole(['admin']),
] as const;

/**
 * POST /api/admin/credentials/bulk
 */
router.post(
  '/credentials/bulk',
  ...adminOnly,
  bulkLimiter,
  AdminBulkController.bulkIssueCredentials
);

/**
 * POST /api/admin/enrollments/bulk
 */
router.post(
  '/enrollments/bulk',
  ...adminOnly,
  bulkLimiter,
  AdminBulkController.bulkEnroll
);

/**
 * POST /api/admin/users/import
 * Accepts:
 *   application/json: { users: [...] } or { csv: "..." }
 *   multipart/form-data: file=<csv>
 */
router.post(
  '/users/import',
  ...adminOnly,
  bulkLimiter,
  upload.single('file'),
  AdminBulkController.importUsers
);

/**
 * GET /api/admin/bulk-jobs/:jobId
 */
router.get(
  '/bulk-jobs/:jobId',
  ...adminOnly,
  bulkReadLimiter,
  AdminBulkController.getJobStatus
);

/**
 * GET /api/admin/bulk-jobs
 */
router.get(
  '/bulk-jobs',
  ...adminOnly,
  bulkReadLimiter,
  AdminBulkController.listJobs
);

export default router;
