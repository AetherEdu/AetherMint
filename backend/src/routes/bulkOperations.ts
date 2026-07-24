/**
 * @openapi
 * tags:
 *   - name: Admin Bulk Operations
 *     description: Bulk admin operations for credentials, enrollments, and user import
 *
 * Issue: #262
 */

import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import {
  bulkCredentialIssuance,
  bulkCourseEnrollment,
  bulkUserImport,
  getOperationStatus,
  listOperations,
} from '../controllers/bulkOperationsController';

const router = Router();

// All bulk endpoints require admin authentication
router.use(authenticate, requireAdmin);

// Rate limiting specific to bulk endpoints (stricter than general endpoints)
const bulkRateLimiter = rateLimitMiddleware({
  max: 30,
  windowMs: 60 * 1000, // 30 requests per minute
  name: 'admin-bulk',
  scope: 'user',
});

router.use(bulkRateLimiter);

/**
 * @openapi
 * /api/admin/bulk/credentials:
 *   post:
 *     tags: [Admin Bulk Operations]
 *     summary: Initiate bulk credential issuance
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [credentials]
 *             properties:
 *               credentials:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [recipientId, credentialType, credentialHash]
 *                   properties:
 *                     recipientId:
 *                       type: string
 *                     credentialType:
 *                       type: string
 *                     credentialHash:
 *                       type: string
 *                     metadata:
 *                       type: object
 *                     releaseTime:
 *                       type: string
 *                       format: date-time
 *     responses:
 *       202:
 *         description: Bulk operation queued
 *       400:
 *         description: Validation error
 */
router.post('/credentials', bulkCredentialIssuance);

/**
 * @openapi
 * /api/admin/bulk/enrollments:
 *   post:
 *     tags: [Admin Bulk Operations]
 *     summary: Initiate bulk course enrollment
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [enrollments]
 *             properties:
 *               enrollments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [userId, courseId]
 *                   properties:
 *                     userId:
 *                       type: string
 *                     courseId:
 *                       type: string
 *                     paymentMethod:
 *                       type: string
 *                     metadata:
 *                       type: object
 *     responses:
 *       202:
 *         description: Bulk operation queued
 */
router.post('/enrollments', bulkCourseEnrollment);

/**
 * @openapi
 * /api/admin/bulk/users:
 *   post:
 *     tags: [Admin Bulk Operations]
 *     summary: Initiate bulk user import (JSON or CSV)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               users:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [email, username]
 *                   properties:
 *                     email:
 *                       type: string
 *                     username:
 *                       type: string
 *                     role:
 *                       type: string
 *                     address:
 *                       type: string
 *                     metadata:
 *                       type: object
 *               csvData:
 *                 type: string
 *                 description: CSV string with header row (email,username,role,address)
 *     responses:
 *       202:
 *         description: Bulk operation queued
 */
router.post('/users', bulkUserImport);

/**
 * @openapi
 * /api/admin/bulk/operations/{id}:
 *   get:
 *     tags: [Admin Bulk Operations]
 *     summary: Get status of a bulk operation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Operation status retrieved
 *       404:
 *         description: Operation not found
 */
router.get('/operations/:id', getOperationStatus);

/**
 * @openapi
 * /api/admin/bulk/operations:
 *   get:
 *     tags: [Admin Bulk Operations]
 *     summary: List all bulk operations
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bulk operations listed
 */
router.get('/operations', listOperations);

export default router;
