/**
 * @openapi
 * tags:
 *   - name: Quizzes
 *     description: Quizzes endpoint
 */

import { Router } from "express";
import quizController from "../controllers/quizController";
import { requirePermission } from "../middleware/rbac";
import { PERMISSIONS } from "../utils/roles";
import { validate } from "../middleware/validate";
import {
  createQuizSchema,
  updateQuizSchema,
  quizIdParamSchema,
  submitQuizSchema,
  getQuizzesQuerySchema,
  submissionIdParamSchema,
  submissionQuerySchema,
  resultsQuerySchema,
} from "../middleware/schemas/quizSchemas";

const router: Router = Router();

// Quiz CRUD endpoints
/**
 * @openapi
 * /api/quizzes:
 *   post:
 *     tags: [Quizzes]
 *     summary: Create a new quiz
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               questions:
 *                 type: array
 *               timeLimit:
 *                 type: integer
 *     responses:
 *       '201':
 *         description: Quiz created
 *       '400':
 *         description: Validation error
 *         $ref: '#/components/schemas/Error'
 */
router.post(
  "/",
  requirePermission(PERMISSIONS.QUIZ_CREATE),
  validate(createQuizSchema),
  quizController.createQuiz,
);
/**
 * @openapi
 * /api/quizzes:
 *   get:
 *     tags: [Quizzes]
 *     summary: Get all quizzes
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Quizzes retrieved
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.QUIZ_READ),
  validate(getQuizzesQuerySchema),
  quizController.getQuizzes,
);
/**
 * @openapi
 * /api/quizzes/{id}:
 *   get:
 *     tags: [Quizzes]
 *     summary: Get quiz by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Quiz retrieved
 *       '404':
 *         description: Quiz not found
 */
router.get(
  "/:id",
  requirePermission(PERMISSIONS.QUIZ_READ),
  validate(quizIdParamSchema),
  quizController.getQuizById,
);
/**
 * @openapi
 * /api/quizzes/{id}:
 *   put:
 *     tags: [Quizzes]
 *     summary: Update quiz
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Quiz updated
 */
router.put(
  "/:id",
  requirePermission(PERMISSIONS.QUIZ_UPDATE),
  validate(updateQuizSchema),
  quizController.updateQuiz,
);
/**
 * @openapi
 * /api/quizzes/{id}:
 *   delete:
 *     tags: [Quizzes]
 *     summary: Delete quiz
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Quiz deleted
 */
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.QUIZ_DELETE),
  validate(quizIdParamSchema),
  quizController.deleteQuiz,
);

/**
 * @openapi
 * /api/quizzes/{id}/publish:
 *   post:
 *     tags: [Quizzes]
 *     summary: Toggle quiz publish status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Publish status toggled
 */
router.post(
  "/:id/publish",
  requirePermission(PERMISSIONS.QUIZ_UPDATE),
  validate(quizIdParamSchema),
  quizController.toggleQuizPublish,
);

/**
 * @openapi
 * /api/quizzes/{id}/submit:
 *   post:
 *     tags: [Quizzes]
 *     summary: Submit quiz answers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               answers:
 *                 type: array
 *     responses:
 *       '200':
 *         description: Submission received
 */
router.post(
  "/:id/submit",
  requirePermission(PERMISSIONS.PROGRESS_TRACK),
  validate(submitQuizSchema),
  quizController.submitQuiz,
);
/**
 * @openapi
 * /api/quizzes/{id}/submission:
 *   get:
 *     tags: [Quizzes]
 *     summary: Get user submission for quiz
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: User submission retrieved
 */
router.get(
  "/:id/submission",
  requirePermission(PERMISSIONS.PROGRESS_TRACK),
  validate(submissionQuerySchema),
  quizController.getUserSubmission,
);
/**
 * @openapi
 * /api/quizzes/{id}/results:
 *   get:
 *     tags: [Quizzes]
 *     summary: Get quiz results
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Results retrieved
 */
router.get(
  "/:id/results",
  requirePermission(PERMISSIONS.PROGRESS_TRACK),
  validate(resultsQuerySchema),
  quizController.getQuizResults,
);
/**
 * @openapi
 * /api/quizzes/{id}/statistics:
 *   get:
 *     tags: [Quizzes]
 *     summary: Get quiz statistics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Statistics retrieved
 */
router.get(
  "/:id/statistics",
  requirePermission(PERMISSIONS.ANALYTICS_READ),
  validate(quizIdParamSchema),
  quizController.getQuizStatistics,
);
/**
 * @openapi
 * /api/quizzes/{id}/grading-statistics:
 *   get:
 *     tags: [Quizzes]
 *     summary: Get grading statistics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Grading statistics retrieved
 */
router.get(
  "/:id/grading-statistics",
  requirePermission(PERMISSIONS.COURSE_GRADE),
  validate(quizIdParamSchema),
  quizController.getGradingStatistics,
);

// Submission management
router.get(
  "/submissions/:submissionId",
  requirePermission(PERMISSIONS.COURSE_GRADE),
  validate(submissionIdParamSchema),
  quizController.getSubmissionById,
);
router.post(
  "/submissions/:submissionId/regrade",
  requirePermission(PERMISSIONS.COURSE_GRADE),
  validate(submissionIdParamSchema),
  quizController.regradeSubmission,
);

// Health check
router.get("/health", validate({}), quizController.healthCheck);

export default router;
