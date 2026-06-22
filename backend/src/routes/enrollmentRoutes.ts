/**
 * @openapi
 * tags:
 *   - name: Enrollments
 *     description: Course enrollment management
 */

import express, { Router } from "express";
import { enrollmentController } from "../controllers/enrollmentController";

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
router.get("/:userId", enrollmentController.getEnrollment);

/**
 * @openapi
 * /api/enrollments:
 *   post:
 *     tags: [Enrollments]
 *     summary: Enroll user in course
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: User enrolled
 */
router.post("/", enrollmentController.enroll);

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
 *     responses:
 *       '200':
 *         description: User unenrolled
 */
router.delete("/:enrollmentId", enrollmentController.unenroll);

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
 *     responses:
 *       '200':
 *         description: Progress updated
 */
router.put("/:enrollmentId/progress", enrollmentController.updateProgress);

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
router.get("/course/:courseId", enrollmentController.getCourseEnrollments);

export default router;
