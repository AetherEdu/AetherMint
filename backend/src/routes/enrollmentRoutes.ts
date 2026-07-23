/**
 * @openapi
 * tags:
 *   - name: Enrollments
 *     description: Course enrollment management
 */

import express, { Router } from "express";
// @ts-ignore - controller module not yet implemented
import { enrollmentController } from "../controllers/enrollmentController";
import { authenticateToken } from "../middleware/auth";
import { idempotencyMiddleware } from "../middleware/idempotency";

const router: Router = express.Router();

/**
 * @openapi
 * /api/enrollments/{userId}:
 *   get:
 *     tags: [Enrollments]
 *     summary: Get enrollment for user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Enrollment details retrieved
 */
router.get(
  "/:userId",
  authenticateToken,
  enrollmentController.getEnrollment,
);

/**
 * @openapi
 * /api/enrollments:
 *   post:
 *     tags: [Enrollments]
 *     summary: Enroll user in course
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: User enrolled (or replayed from idempotency cache)
 *       '409':
 *         description: A request with this Idempotency-Key is in progress
 */
router.post(
  "/",
  authenticateToken,
  idempotencyMiddleware(),
  enrollmentController.enroll,
);

/**
 * @openapi
 * /api/enrollments/{enrollmentId}:
 *   delete:
 *     tags: [Enrollments]
 *     summary: Unenroll user from course
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: enrollmentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: Idempotency-Key
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: User unenrolled (or replayed from idempotency cache)
 */
router.delete(
  "/:enrollmentId",
  authenticateToken,
  idempotencyMiddleware(),
  enrollmentController.unenroll,
);

/**
 * @openapi
 * /api/enrollments/{enrollmentId}/progress:
 *   put:
 *     tags: [Enrollments]
 *     summary: Update enrollment progress
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: enrollmentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: Idempotency-Key
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Progress updated (or replayed from idempotency cache)
 */
router.put(
  "/:enrollmentId/progress",
  authenticateToken,
  idempotencyMiddleware(),
  enrollmentController.updateProgress,
);

/**
 * @openapi
 * /api/enrollments/course/{courseId}:
 *   get:
 *     tags: [Enrollments]
 *     summary: Get all enrollments for a course
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Enrollments retrieved
 */
router.get(
  "/course/:courseId",
  authenticateToken,
  enrollmentController.getCourseEnrollments,
);

export default router;
