import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../utils/roles';
import { validate, ValidationSchema } from '../middleware/validate';
import { AuthError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import questionGeneratorService, {
  QuestionReviewStatus,
} from '../services/questionGen/questionGenerator';

const router: Router = Router();
router.use(authenticateToken);

const questionTypes = Joi.array()
  .items(Joi.string().valid('multiple-choice', 'true-false'))
  .min(1)
  .max(2);

const createGenerationSchema: ValidationSchema = {
  body: Joi.object({
    courseId: Joi.string().uuid().required(),
    title: Joi.string().min(3).max(200).required(),
    description: Joi.string().max(2000).optional(),
    sourceText: Joi.string().max(100000).optional(),
    sources: Joi.array().items(Joi.object({
      id: Joi.string().max(100).optional(),
      type: Joi.string().valid('lesson', 'transcript').required(),
      title: Joi.string().max(200).optional(),
      text: Joi.string().min(20).max(100000).required(),
    })).min(1).max(20).optional(),
    questionCount: Joi.number().integer().min(1).max(20).default(5),
    questionTypes: questionTypes.default(['multiple-choice', 'true-false']),
  }).custom((value, helpers) => {
    if (!value.sourceText && !value.sources) {
      return helpers.error('any.custom', { message: 'sourceText or sources is required' });
    }
    return value;
  }),
};

const jobParamSchema: ValidationSchema = {
  params: Joi.object({ jobId: Joi.string().uuid().required() }),
};

const questionParamSchema: ValidationSchema = {
  params: Joi.object({
    jobId: Joi.string().uuid().required(),
    questionId: Joi.string().uuid().required(),
  }),
};

const reviewSchema: ValidationSchema = {
  ...jobParamSchema,
  body: Joi.object({
    questionIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
    status: Joi.string().valid('approved', 'rejected').required(),
  }),
};

const updateQuestionSchema: ValidationSchema = {
  ...questionParamSchema,
  body: Joi.object({
    status: Joi.string().valid('pending', 'approved', 'rejected').optional(),
    question: Joi.string().min(10).max(2000).optional(),
    options: Joi.array().items(Joi.object({
      id: Joi.string().uuid().required(),
      text: Joi.string().min(1).max(500).required(),
      isCorrect: Joi.boolean().required(),
      explanation: Joi.string().max(1000).optional(),
    })).min(2).max(6).optional(),
    correctAnswer: Joi.alternatives().try(
      Joi.string().uuid(),
      Joi.array().items(Joi.string().uuid()),
    ).optional(),
    explanation: Joi.string().max(1000).optional(),
    difficulty: Joi.string().valid('easy', 'medium', 'hard').optional(),
  }).min(1),
};

function instructorIdFrom(req: Request): string {
  const instructorId = req.user?.id;
  if (!instructorId) throw new AuthError('Authentication is required');
  return instructorId;
}

function ensureOwner(req: Request, jobId: string): void {
  const job = questionGeneratorService.getJob(jobId);
  if (!job) throw new NotFoundError('Question generation job not found');
  if (job.instructorId !== instructorIdFrom(req)) {
    throw new ForbiddenError('Only the educator who created this job can review it');
  }
}

function sendServiceError(error: unknown, next: NextFunction): void {
  if (error instanceof NotFoundError || error instanceof ForbiddenError) {
    next(error);
    return;
  }
  if (error instanceof Error && /not found/i.test(error.message)) {
    next(new NotFoundError(error.message));
    return;
  }
  next(error instanceof ValidationError ? error : new ValidationError(error instanceof Error ? error.message : 'Invalid request'));
}

/**
 * @openapi
 * /api/question-generation:
 *   post:
 *     tags: [Question Generation]
 *     summary: Generate quiz questions from lessons or transcripts
 *     description: Creates an asynchronous generation job. Generated questions remain unpublished until reviewed.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '202':
 *         description: Generation job queued
 */
router.post(
  '/',
  requirePermission(PERMISSIONS.QUIZ_CREATE),
  validate(createGenerationSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const job = await questionGeneratorService.createJob(req.body, instructorIdFrom(req));
      res.status(202).json({ success: true, data: job, message: 'Question generation queued for review' });
    } catch (error) {
      sendServiceError(error, next);
    }
  },
);

/** Get generation status and staged questions. */
router.get(
  '/:jobId',
  requirePermission(PERMISSIONS.QUIZ_READ),
  validate(jobParamSchema),
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      ensureOwner(req, req.params.jobId);
      const job = questionGeneratorService.getJob(req.params.jobId);
      res.json({ success: true, data: job });
    } catch (error) {
      next(error);
    }
  },
);

/** Edit or review one generated question. */
router.patch(
  '/:jobId/questions/:questionId',
  requirePermission(PERMISSIONS.QUIZ_UPDATE),
  validate(updateQuestionSchema),
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      ensureOwner(req, req.params.jobId);
      const question = questionGeneratorService.updateQuestion(
        req.params.jobId,
        req.params.questionId,
        req.body,
      );
      res.json({ success: true, data: question });
    } catch (error) {
      sendServiceError(error, next);
    }
  },
);

/** Approve or reject a batch of staged questions. */
router.post(
  '/:jobId/review',
  requirePermission(PERMISSIONS.QUIZ_UPDATE),
  validate(reviewSchema),
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      ensureOwner(req, req.params.jobId);
      const job = questionGeneratorService.reviewQuestions(
        req.params.jobId,
        req.body.questionIds,
        req.body.status as Exclude<QuestionReviewStatus, 'pending'>,
      );
      res.json({ success: true, data: job });
    } catch (error) {
      sendServiceError(error, next);
    }
  },
);

/** Import approved questions into the existing quiz system. */
router.post(
  '/:jobId/import',
  requirePermission(PERMISSIONS.QUIZ_CREATE),
  validate(jobParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      ensureOwner(req, req.params.jobId);
      const quiz = await questionGeneratorService.importApprovedQuiz(req.params.jobId, instructorIdFrom(req));
      res.status(201).json({ success: true, data: quiz, message: 'Approved questions imported into quiz system' });
    } catch (error) {
      sendServiceError(error, next);
    }
  },
);

/** Export approved questions in a versioned quiz-compatible JSON envelope. */
router.get(
  '/:jobId/export',
  requirePermission(PERMISSIONS.QUIZ_READ),
  validate(jobParamSchema),
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      ensureOwner(req, req.params.jobId);
      const exported = questionGeneratorService.exportApproved(req.params.jobId);
      res
        .setHeader('Content-Type', 'application/json')
        .setHeader('Content-Disposition', `attachment; filename="${exported.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'quiz'}-questions.json"`)
        .json({ success: true, data: exported });
    } catch (error) {
      sendServiceError(error, next);
    }
  },
);

export default router;
