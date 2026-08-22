/**
 * Moderation Routes
 * API endpoints for ML-assisted content moderation:
 * - Content submission and scoring
 * - Queue management for human review
 * - Moderator decision recording
 * - Appeal flow for rejected content
 */

import { Router, RequestHandler } from 'express';
import { body, param, query } from 'express-validator';
import { ModerationController } from '../controllers/moderationController';
import { ModerationScoringService } from '../services/moderation/ModerationScoringService';
import { ModerationQueueService } from '../services/moderation/ModerationQueueService';
import { AppealService } from '../services/moderation/AppealService';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validation';

const router: Router = Router();

// Initialize services
const scoringService = new ModerationScoringService();
const queueService = new ModerationQueueService();
const appealService = new AppealService();
const moderationController = new ModerationController(
  scoringService,
  queueService,
  appealService
);

// Validation schemas
const submitContentValidation = [
  body('contentId')
    .notEmpty()
    .withMessage('Content ID is required'),
  body('contentType')
    .isIn(['course', 'quiz', 'user_post', 'comment', 'file', 'image', 'video'])
    .withMessage('Invalid content type'),
  body('title')
    .notEmpty()
    .isLength({ min: 1, max: 500 })
    .withMessage('Title is required and must be 1-500 characters'),
  body('description')
    .optional()
    .isLength({ max: 5000 })
    .withMessage('Description must be at most 5000 characters'),
  body('content')
    .notEmpty()
    .withMessage('Content is required'),
  body('authorId')
    .optional()
    .isString()
    .withMessage('Author ID must be a string'),
  body('authorName')
    .optional()
    .isString()
    .withMessage('Author name must be a string'),
  body('authorEmail')
    .optional()
    .isEmail()
    .withMessage('Author email must be valid'),
];

const submitBatchValidation = [
  body('items')
    .isArray({ min: 1, max: 100 })
    .withMessage('Items must be an array with 1-100 items'),
  body('items.*.contentId')
    .notEmpty()
    .withMessage('Content ID is required for each item'),
  body('items.*.contentType')
    .isIn(['course', 'quiz', 'user_post', 'comment', 'file', 'image', 'video'])
    .withMessage('Invalid content type'),
  body('items.*.title')
    .notEmpty()
    .withMessage('Title is required for each item'),
  body('items.*.content')
    .notEmpty()
    .withMessage('Content is required for each item'),
];

const makeDecisionValidation = [
  body('action')
    .isIn([
      'approve',
      'reject',
      'flag_for_review',
      'escalate',
      'remove',
      'warn_user',
      'ban_user',
      'request_edit',
    ])
    .withMessage('Invalid moderation action'),
  body('reason')
    .notEmpty()
    .isLength({ min: 5, max: 2000 })
    .withMessage('Reason is required and must be 5-2000 characters'),
  body('notes')
    .optional()
    .isLength({ max: 5000 })
    .withMessage('Notes must be at most 5000 characters'),
  body('predictionCorrect')
    .optional()
    .isBoolean()
    .withMessage('predictionCorrect must be a boolean'),
  body('actualSeverity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid severity level'),
  body('predictedSeverity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid severity level'),
];

const submitAppealValidation = [
  body('moderationId')
    .notEmpty()
    .withMessage('Moderation ID is required'),
  body('reason')
    .notEmpty()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Appeal reason is required and must be 10-1000 characters'),
  body('explanation')
    .notEmpty()
    .isLength({ min: 20, max: 5000 })
    .withMessage('Explanation is required and must be 20-5000 characters'),
  body('evidence')
    .optional()
    .isArray()
    .withMessage('Evidence must be an array'),
];

const reviewAppealValidation = [
  body('decision')
    .isIn(['approved', 'denied', 'reversed', 'upheld'])
    .withMessage('Invalid appeal decision'),
  body('reason')
    .notEmpty()
    .isLength({ min: 5, max: 2000 })
    .withMessage('Reason is required and must be 5-2000 characters'),
  body('notes')
    .optional()
    .isLength({ max: 5000 })
    .withMessage('Notes must be at most 5000 characters'),
];

const updateConfigValidation = [
  body('autoApproveThreshold')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('autoApproveThreshold must be between 0 and 100'),
  body('autoRejectThreshold')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('autoRejectThreshold must be between 0 and 100'),
  body('queueThreshold')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('queueThreshold must be between 0 and 100'),
  body('minConfidence')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('minConfidence must be between 0 and 1'),
  body('enableModelFeedback')
    .optional()
    .isBoolean()
    .withMessage('enableModelFeedback must be a boolean'),
];

/**
 * @route POST /api/moderation/submit
 * @desc Submit content for ML-assisted moderation
 * @access Private
 */
router.post(
  '/submit',
  authenticateToken,
  submitContentValidation,
  handleValidationErrors,
  moderationController.submitContent.bind(moderationController) as RequestHandler
);

/**
 * @route POST /api/moderation/submit/batch
 * @desc Batch submit content for moderation
 * @access Private (Admin/Moderator)
 */
router.post(
  '/submit/batch',
  authenticateToken,
  requireAdmin,
  submitBatchValidation,
  handleValidationErrors,
  moderationController.submitBatch.bind(moderationController) as RequestHandler
);

/**
 * @route GET /api/moderation/items
 * @desc List moderation items with filtering
 * @access Private (Admin/Moderator)
 */
router.get(
  '/items',
  authenticateToken,
  query('status')
    .optional()
    .isIn([
      'pending', 'scoring', 'queued', 'in_review',
      'approved', 'rejected', 'flagged',
      'auto_approved', 'auto_rejected',
    ])
    .withMessage('Invalid status'),
  query('contentType')
    .optional()
    .isIn(['course', 'quiz', 'user_post', 'comment', 'file', 'image', 'video'])
    .withMessage('Invalid content type'),
  query('severity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid severity'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors,
  moderationController.listItems.bind(moderationController) as RequestHandler
);

/**
 * @route GET /api/moderation/items/:id
 * @desc Get a specific moderation item
 * @access Private (Admin/Moderator)
 */
router.get(
  '/items/:id',
  authenticateToken,
  param('id').isString().notEmpty().withMessage('ID is required'),
  handleValidationErrors,
  moderationController.getItem.bind(moderationController) as RequestHandler
);

/**
 * @route POST /api/moderation/items/:id/score
 * @desc Re-score a moderation item
 * @access Private (Admin/Moderator)
 */
router.post(
  '/items/:id/score',
  authenticateToken,
  requireAdmin,
  param('id').isString().notEmpty().withMessage('ID is required'),
  handleValidationErrors,
  moderationController.scoreItem.bind(moderationController) as RequestHandler
);

/**
 * @route POST /api/moderation/items/:id/decision
 * @desc Record a moderator's decision on an item
 * @access Private (Admin/Moderator)
 */
router.post(
  '/items/:id/decision',
  authenticateToken,
  param('id').isString().notEmpty().withMessage('ID is required'),
  makeDecisionValidation,
  handleValidationErrors,
  moderationController.makeDecision.bind(moderationController) as RequestHandler
);

/**
 * @route GET /api/moderation/queue
 * @desc Get queued items for the current moderator
 * @access Private (Admin/Moderator)
 */
router.get(
  '/queue',
  authenticateToken,
  moderationController.getQueue.bind(moderationController) as RequestHandler
);

/**
 * @route POST /api/moderation/queue/claim
 * @desc Claim the next item from the queue for review
 * @access Private (Admin/Moderator)
 */
router.post(
  '/queue/claim',
  authenticateToken,
  moderationController.claimNext.bind(moderationController) as RequestHandler
);

/**
 * @route POST /api/moderation/appeals
 * @desc Submit an appeal for rejected content
 * @access Private
 */
router.post(
  '/appeals',
  authenticateToken,
  submitAppealValidation,
  handleValidationErrors,
  moderationController.submitAppeal.bind(moderationController) as RequestHandler
);

/**
 * @route GET /api/moderation/appeals
 * @desc List appeals with optional filtering
 * @access Private (Admin/Moderator)
 */
router.get(
  '/appeals',
  authenticateToken,
  query('status')
    .optional()
    .isIn([
      'pending', 'under_review', 'approved',
      'denied', 'reversed', 'upheld',
    ])
    .withMessage('Invalid appeal status'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors,
  moderationController.listAppeals.bind(moderationController) as RequestHandler
);

/**
 * @route GET /api/moderation/appeals/:id
 * @desc Get a specific appeal
 * @access Private (Admin/Moderator)
 */
router.get(
  '/appeals/:id',
  authenticateToken,
  param('id').isString().notEmpty().withMessage('Appeal ID is required'),
  handleValidationErrors,
  moderationController.getAppeal.bind(moderationController) as RequestHandler
);

/**
 * @route POST /api/moderation/appeals/:id/review
 * @desc Review and decide on an appeal
 * @access Private (Admin only)
 */
router.post(
  '/appeals/:id/review',
  authenticateToken,
  requireAdmin,
  param('id').isString().notEmpty().withMessage('Appeal ID is required'),
  reviewAppealValidation,
  handleValidationErrors,
  moderationController.reviewAppeal.bind(moderationController) as RequestHandler
);

/**
 * @route GET /api/moderation/stats
 * @desc Get moderation statistics
 * @access Private (Admin/Moderator)
 */
router.get(
  '/stats',
  authenticateToken,
  moderationController.getStats.bind(moderationController) as RequestHandler
);

/**
 * @route GET /api/moderation/config
 * @desc Get ML model configuration
 * @access Private (Admin)
 */
router.get(
  '/config',
  authenticateToken,
  requireAdmin,
  moderationController.getConfig.bind(moderationController) as RequestHandler
);

/**
 * @route PUT /api/moderation/config
 * @desc Update ML model configuration
 * @access Private (Admin only)
 */
router.put(
  '/config',
  authenticateToken,
  requireAdmin,
  updateConfigValidation,
  handleValidationErrors,
  moderationController.updateConfig.bind(moderationController) as RequestHandler
);

/**
 * @route GET /api/moderation/health
 * @desc Health check for moderation service
 * @access Public
 */
router.get('/health', moderationController.healthCheck.bind(moderationController) as RequestHandler);

export default router;
export { scoringService, queueService, appealService, moderationController };