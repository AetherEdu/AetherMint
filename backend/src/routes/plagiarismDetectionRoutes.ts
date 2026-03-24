/**
 * Plagiarism Detection Routes
 * Defines API endpoints for plagiarism detection operations
 */

import { Router } from 'express';
import { PlagiarismDetectionController } from '../controllers/plagiarismDetectionController';
import { authenticateToken, requireEducatorOrAdmin, requireAdmin } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();
const plagiarismController = new PlagiarismDetectionController();

// Validation schemas
const analyzeSubmissionValidation = [
  body('submissionId')
    .notEmpty()
    .withMessage('Submission ID is required')
    .isUUID()
    .withMessage('Submission ID must be a valid UUID'),
  body('content')
    .notEmpty()
    .withMessage('Content is required')
    .isLength({ min: 10, max: 100000 })
    .withMessage('Content must be between 10 and 100,000 characters'),
  body('contentType')
    .isIn(['text', 'code', 'mixed'])
    .withMessage('Content type must be text, code, or mixed'),
  body('language')
    .optional()
    .isISO31661Alpha2()
    .withMessage('Language must be a valid ISO 3166-1 alpha-2 code'),
  body('codeLanguage')
    .optional()
    .isIn(['javascript', 'python', 'java', 'cpp', 'csharp', 'php', 'ruby', 'go', 'rust', 'typescript'])
    .withMessage('Code language must be a supported programming language'),
  body('sensitivity')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Sensitivity must be low, medium, or high'),
  body('includeWebScanning')
    .optional()
    .isBoolean()
    .withMessage('includeWebScanning must be a boolean'),
  body('includeAcademicDatabase')
    .optional()
    .isBoolean()
    .withMessage('includeAcademicDatabase must be a boolean'),
  body('includeInternalComparison')
    .optional()
    .isBoolean()
    .withMessage('includeInternalComparison must be a boolean')
];

const batchAnalyzeValidation = [
  body('submissions')
    .isArray({ min: 1, max: 50 })
    .withMessage('Submissions must be an array with 1-50 items'),
  body('submissions.*.submissionId')
    .notEmpty()
    .withMessage('Submission ID is required for each submission'),
  body('submissions.*.content')
    .notEmpty()
    .withMessage('Content is required for each submission'),
  body('submissions.*.contentType')
    .isIn(['text', 'code', 'mixed'])
    .withMessage('Content type must be text, code, or mixed'),
  body('settings.sensitivityLevel')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Sensitivity level must be low, medium, or high'),
  body('settings.minimumSimilarityThreshold')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Minimum similarity threshold must be between 0 and 100')
];

const updateSettingsValidation = [
  body('sensitivityLevel')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Sensitivity level must be low, medium, or high'),
  body('minimumSimilarityThreshold')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Minimum similarity threshold must be between 0 and 100'),
  body('autoFlagThreshold')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Auto flag threshold must be between 0 and 100'),
  body('reviewRequiredThreshold')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Review required threshold must be between 0 and 100'),
  body('excludedDomains')
    .optional()
    .isArray()
    .withMessage('Excluded domains must be an array'),
  body('trustedSources')
    .optional()
    .isArray()
    .withMessage('Trusted sources must be an array')
];

const appealValidation = [
  body('reportId')
    .notEmpty()
    .withMessage('Report ID is required')
    .isUUID()
    .withMessage('Report ID must be a valid UUID'),
  body('reason')
    .notEmpty()
    .withMessage('Appeal reason is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Reason must be between 10 and 500 characters'),
  body('explanation')
    .notEmpty()
    .withMessage('Explanation is required')
    .isLength({ min: 20, max: 2000 })
    .withMessage('Explanation must be between 20 and 2000 characters'),
  body('evidence')
    .optional()
    .isArray()
    .withMessage('Evidence must be an array')
];

// Routes

/**
 * @route POST /api/plagiarism/analyze
 * @desc Analyze a single submission for plagiarism
 * @access Private
 */
router.post(
  '/analyze',
  authenticateToken,
  analyzeSubmissionValidation,
  handleValidationErrors,
  plagiarismController.analyzeSubmission.bind(plagiarismController)
);

/**
 * @route POST /api/plagiarism/batch-analyze
 * @desc Analyze multiple submissions for plagiarism
 * @access Private
 */
router.post(
  '/batch-analyze',
  authenticateToken,
  batchAnalyzeValidation,
  handleValidationErrors,
  plagiarismController.batchAnalyze.bind(plagiarismController)
);

/**
 * @route GET /api/plagiarism/reports/:reportId
 * @desc Get plagiarism report by ID
 * @access Private
 */
router.get(
  '/reports/:reportId',
  authenticateToken,
  param('reportId').isUUID().withMessage('Report ID must be a valid UUID'),
  handleValidationErrors,
  plagiarismController.getReport.bind(plagiarismController)
);

/**
 * @route GET /api/plagiarism/settings
 * @desc Get plagiarism detection settings
 * @access Private (Admin/Educator)
 */
router.get(
  '/settings',
  authenticateToken,
  requireEducatorOrAdmin,
  plagiarismController.getSettings.bind(plagiarismController)
);

/**
 * @route PUT /api/plagiarism/settings
 * @desc Update plagiarism detection settings
 * @access Private (Admin)
 */
router.put(
  '/settings',
  authenticateToken,
  requireAdmin,
  updateSettingsValidation,
  handleValidationErrors,
  plagiarismController.updateSettings.bind(plagiarismController)
);

/**
 * @route GET /api/plagiarism/analytics
 * @desc Get plagiarism detection analytics
 * @access Private (Admin/Educator)
 */
router.get(
  '/analytics',
  authenticateToken,
  requireEducatorOrAdmin,
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid date'),
  query('institutionId').optional().isUUID().withMessage('Institution ID must be a valid UUID'),
  handleValidationErrors,
  plagiarismController.getAnalytics.bind(plagiarismController)
);

/**
 * @route POST /api/plagiarism/appeal
 * @desc Submit an appeal for plagiarism detection
 * @access Private
 */
router.post(
  '/appeal',
  authenticateToken,
  appealValidation,
  handleValidationErrors,
  plagiarismController.submitAppeal.bind(plagiarismController)
);

/**
 * @route GET /api/plagiarism/health
 * @desc Health check for plagiarism detection service
 * @access Public
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'plagiarism-detection'
  });
});

export default router;
