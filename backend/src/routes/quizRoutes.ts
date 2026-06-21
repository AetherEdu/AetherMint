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
router.post(
  "/",
  requirePermission(PERMISSIONS.QUIZ_CREATE),
  validate(createQuizSchema),
  quizController.createQuiz,
);
router.get(
  "/",
  requirePermission(PERMISSIONS.QUIZ_READ),
  validate(getQuizzesQuerySchema),
  quizController.getQuizzes,
);
router.get(
  "/:id",
  requirePermission(PERMISSIONS.QUIZ_READ),
  validate(quizIdParamSchema),
  quizController.getQuizById,
);
router.put(
  "/:id",
  requirePermission(PERMISSIONS.QUIZ_UPDATE),
  validate(updateQuizSchema),
  quizController.updateQuiz,
);
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.QUIZ_DELETE),
  validate(quizIdParamSchema),
  quizController.deleteQuiz,
);

// Quiz publishing
router.post(
  "/:id/publish",
  requirePermission(PERMISSIONS.QUIZ_UPDATE),
  validate(quizIdParamSchema),
  quizController.toggleQuizPublish,
);

// Quiz submission and grading
router.post(
  "/:id/submit",
  requirePermission(PERMISSIONS.PROGRESS_TRACK),
  validate(submitQuizSchema),
  quizController.submitQuiz,
);
router.get(
  "/:id/submission",
  requirePermission(PERMISSIONS.PROGRESS_TRACK),
  validate(submissionQuerySchema),
  quizController.getUserSubmission,
);
router.get(
  "/:id/results",
  requirePermission(PERMISSIONS.PROGRESS_TRACK),
  validate(resultsQuerySchema),
  quizController.getQuizResults,
);
router.get(
  "/:id/statistics",
  requirePermission(PERMISSIONS.ANALYTICS_READ),
  validate(quizIdParamSchema),
  quizController.getQuizStatistics,
);
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
