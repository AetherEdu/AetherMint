/**
 * Validation Middleware
 * Validation functions for content versions and related operations
 */

import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { VersionControlUtils } from '../models/ContentVersion';
import Joi from 'joi';

/**
 * Handle validation errors middleware
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

/**
 * Validate content version creation request
 */
export const validateContentVersionCreation = [
  body('contentId')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Content ID is required'),
  
  body('title')
    .isString()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  
  body('description')
    .isString()
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  
  body('content')
    .notEmpty()
    .withMessage('Content is required')
    .isObject()
    .withMessage('Content must be an object'),
  
  body('changes')
    .isArray({ min: 1 })
    .withMessage('Changes array must contain at least one item'),
  
  body('changes.*')
    .isString()
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Each change description must be between 5 and 500 characters'),
  
  body('createdBy')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Creator ID is required'),
  
  handleValidationErrors
];

/**
 * Validate content version update request
 */
export const validateContentVersionUpdate = [
  body('title')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  
  body('content')
    .optional()
    .notEmpty()
    .withMessage('Content cannot be empty if provided')
    .isObject()
    .withMessage('Content must be an object'),
  
  body('changes')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Changes array must contain at least one item if provided'),
  
  body('changes.*')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Each change description must be between 5 and 500 characters'),
  
  handleValidationErrors
];

/**
 * Validate version restore request
 */
export const validateVersionRestore = [
  body('contentId')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Content ID is required'),
  
  body('versionId')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Version ID is required'),
  
  body('restoreReason')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Restore reason must be between 5 and 500 characters'),
  
  body('restoredBy')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Restored by user ID is required'),
  
  handleValidationErrors
];

/**
 * Validate version comparison request
 */
export const validateVersionComparison = [
  param('version1Id')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('First version ID is required'),
  
  param('version2Id')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Second version ID is required'),
  
  handleValidationErrors
];

/**
 * Validate version history query parameters
 */
export const validateVersionHistoryQuery = [
  param('contentId')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Content ID is required'),
  
  query('createdBy')
    .optional()
    .isString()
    .trim()
    .withMessage('Created by must be a string'),
  
  query('isCurrent')
    .optional()
    .isBoolean()
    .withMessage('Is current must be a boolean'),
  
  query('versionMin')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Minimum version must be a positive integer'),
  
  query('versionMax')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Maximum version must be a positive integer'),
  
  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid ISO 8601 date'),
  
  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid ISO 8601 date'),
  
  query('sortBy')
    .optional()
    .isIn(['version', 'createdAt', 'title'])
    .withMessage('Sort by must be one of: version, createdAt, title'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be either asc or desc'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

/**
 * Validate version control settings update
 */
export const validateVersionControlSettings = [
  body('autoVersioning')
    .optional()
    .isBoolean()
    .withMessage('Auto versioning must be a boolean'),
  
  body('maxVersions')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Max versions must be a non-negative integer (0 for unlimited)'),
  
  handleValidationErrors
];

/**
 * Validate version export request
 */
export const validateVersionExport = [
  param('contentId')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Content ID is required'),
  
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('Format must be either json or csv'),
  
  handleValidationErrors
];

/**
 * Custom validation middleware for content version data
 */
export const validateVersionData = (req: Request, res: Response, next: NextFunction) => {
  try {
    const versionData = req.body;
    const validation = VersionControlUtils.validateVersion(versionData);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Version data validation failed',
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }
    
    // Attach warnings to request for potential use in controllers
    req.versionWarnings = validation.warnings;
    
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Version validation error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Validate content ID parameter
 */
export const validateContentIdParam = [
  param('contentId')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Content ID is required'),
  
  handleValidationErrors
];

/**
 * Validate version ID parameter
 */
export const validateVersionIdParam = [
  param('versionId')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Version ID is required'),
  
  handleValidationErrors
];

/**
 * Validate version number parameter
 */
export const validateVersionNumberParam = [
  param('versionNumber')
    .isInt({ min: 1 })
    .withMessage('Version number must be a positive integer'),
  
  handleValidationErrors
];

/**
 * Middleware to check if user has permission to manage versions
 */
export const checkVersionManagementPermission = (req: Request, res: Response, next: NextFunction) => {
  // This would typically check user permissions
  // For now, we'll assume the user has permission if they're authenticated
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required for version management',
    });
  }
  
  // In a real implementation, you would check specific permissions
  // For example: if (!req.user.permissions.includes('manage_versions')) { ... }
  
  next();
};

/**
 * Middleware to check if user can restore versions (typically course creators/admins)
 */
export const checkVersionRestorePermission = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required for version restoration',
    });
  }
  
  // In a real implementation, check if user is course creator or admin
  // For example: check if user owns the content or has admin privileges
  
  next();
};

/**
 * Middleware to validate date range for version history filtering
 */
export const validateDateRange = (req: Request, res: Response, next: NextFunction) => {
  const { dateFrom, dateTo } = req.query;
  
  if (dateFrom && dateTo) {
    const from = new Date(dateFrom as string);
    const to = new Date(dateTo as string);
    
    if (from >= to) {
      return res.status(400).json({
        success: false,
        message: 'Date from must be before date to',
      });
    }
  }
  
  next();
};

// Extend Express Request interface to include custom properties
declare global {
  namespace Express {
    interface Request {
      versionWarnings?: Array<{
        field: string;
        message: string;
        value?: any;
      }>;
    }
  }
}

// Assignment validation schemas
export interface ValidationSchema {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}

export const validateRequest = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];

    // Validate request body
    if (schema.body) {
      const { error } = schema.body.validate(req.body);
      if (error) {
        errors.push(`Body: ${error.details[0].message}`);
      }
    }

    // Validate query parameters
    if (schema.query) {
      const { error } = schema.query.validate(req.query);
      if (error) {
        errors.push(`Query: ${error.details[0].message}`);
      }
    }

    // Validate route parameters
    if (schema.params) {
      const { error } = schema.params.validate(req.params);
      if (error) {
        errors.push(`Params: ${error.details[0].message}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    next();
  };
};

// Assignment validation schemas
export const createAssignmentSchema: ValidationSchema = {
  body: Joi.object({
    title: Joi.string().min(3).max(200).required(),
    description: Joi.string().min(10).max(2000).required(),
    instructions: Joi.string().min(10).max(5000).required(),
    type: Joi.string().valid('quiz', 'essay', 'code', 'project', 'video', 'file_upload', 'text_submission').required(),
    submissionTypes: Joi.array().items(Joi.string().valid('text', 'file', 'code', 'video', 'audio', 'multiple_files')).min(1).required(),
    maxPoints: Joi.number().min(1).max(1000).required(),
    dueDate: Joi.date().iso().required(),
    allowLateSubmissions: Joi.boolean().default(false),
    latePolicy: Joi.string().valid('no_late_submissions', 'penalty_per_hour', 'penalty_per_day', 'no_penalty').optional(),
    latePenaltyAmount: Joi.number().min(0).max(100).optional(),
    maxAttempts: Joi.number().min(1).max(10).optional(),
    timeLimit: Joi.number().min(1).max(480).optional(),
    allowedFileTypes: Joi.array().items(Joi.string()).optional(),
    maxFileSize: Joi.number().min(1).max(500).optional(),
    maxFiles: Joi.number().min(1).max(50).optional(),
    isPublished: Joi.boolean().default(false),
    showSolutions: Joi.date().iso().optional(),
    autoGrade: Joi.boolean().default(false),
    plagiarismCheck: Joi.boolean().default(true),
    groupAssignment: Joi.boolean().default(false),
    maxGroupSize: Joi.number().min(2).max(10).optional(),
    resources: Joi.array().items(Joi.object({
      title: Joi.string().required(),
      description: Joi.string().optional(),
      type: Joi.string().valid('file', 'link', 'video', 'text').required(),
      url: Joi.string().uri().optional(),
      content: Joi.string().optional(),
      fileName: Joi.string().optional(),
      fileSize: Joi.number().optional(),
      mimeType: Joi.string().optional()
    })).default([])
  }),
  params: Joi.object({
    courseId: Joi.string().uuid().required()
  })
};

export const updateAssignmentSchema: ValidationSchema = {
  body: Joi.object({
    title: Joi.string().min(3).max(200).optional(),
    description: Joi.string().min(10).max(2000).optional(),
    instructions: Joi.string().min(10).max(5000).optional(),
    dueDate: Joi.date().iso().optional(),
    allowLateSubmissions: Joi.boolean().optional(),
    latePolicy: Joi.string().valid('no_late_submissions', 'penalty_per_hour', 'penalty_per_day', 'no_penalty').optional(),
    latePenaltyAmount: Joi.number().min(0).max(100).optional(),
    maxAttempts: Joi.number().min(1).max(10).optional(),
    timeLimit: Joi.number().min(1).max(480).optional(),
    allowedFileTypes: Joi.array().items(Joi.string()).optional(),
    maxFileSize: Joi.number().min(1).max(500).optional(),
    maxFiles: Joi.number().min(1).max(50).optional(),
    isPublished: Joi.boolean().optional(),
    showSolutions: Joi.date().iso().optional(),
    autoGrade: Joi.boolean().optional(),
    plagiarismCheck: Joi.boolean().optional(),
    groupAssignment: Joi.boolean().optional(),
    maxGroupSize: Joi.number().min(2).max(10).optional(),
    resources: Joi.array().items(Joi.object({
      title: Joi.string().required(),
      description: Joi.string().optional(),
      type: Joi.string().valid('file', 'link', 'video', 'text').required(),
      url: Joi.string().uri().optional(),
      content: Joi.string().optional(),
      fileName: Joi.string().optional(),
      fileSize: Joi.number().optional(),
      mimeType: Joi.string().optional()
    })).optional()
  }),
  params: Joi.object({
    assignmentId: Joi.string().uuid().required()
  })
};

export const createSubmissionSchema: ValidationSchema = {
  body: Joi.object({
    textContent: Joi.string().max(10000).optional(),
    codeSubmission: Joi.object({
      language: Joi.string().required(),
      code: Joi.string().required(),
      fileName: Joi.string().optional()
    }).optional(),
    videoSubmission: Joi.object({
      url: Joi.string().uri().required(),
      duration: Joi.number().min(1).required(),
      thumbnail: Joi.string().uri().optional(),
      fileSize: Joi.number().required(),
      format: Joi.string().required()
    }).optional(),
    audioSubmission: Joi.object({
      url: Joi.string().uri().required(),
      duration: Joi.number().min(1).required(),
      fileSize: Joi.number().required(),
      format: Joi.string().required(),
      transcription: Joi.string().optional()
    }).optional()
  }),
  params: Joi.object({
    assignmentId: Joi.string().uuid().required()
  })
};

export const gradeSubmissionSchema: ValidationSchema = {
  body: Joi.object({
    totalPoints: Joi.number().min(0).required(),
    earnedPoints: Joi.number().min(0).required(),
    feedback: Joi.string().max(5000).optional(),
    privateFeedback: Joi.string().max(5000).optional(),
    rubricGrades: Joi.array().items(Joi.object({
      criterionId: Joi.string().uuid().required(),
      levelId: Joi.string().uuid().required(),
      points: Joi.number().min(0).required(),
      feedback: Joi.string().max(1000).optional()
    })).optional(),
    annotations: Joi.array().items(Joi.object({
      type: Joi.string().valid('text', 'drawing', 'highlight', 'comment').required(),
      content: Joi.string().required(),
      position: Joi.object({
        x: Joi.number().required(),
        y: Joi.number().required(),
        page: Joi.number().optional(),
        selection: Joi.object({
          start: Joi.number().required(),
          end: Joi.number().required()
        }).optional()
      }).required()
    })).optional()
  }),
  params: Joi.object({
    submissionId: Joi.string().uuid().required()
  })
};

export const bulkGradeSchema: ValidationSchema = {
  body: Joi.object({
    operation: Joi.string().valid('apply_rubric', 'apply_late_penalty', 'bulk_feedback', 'auto_grade').required(),
    criteria: Joi.object().optional(),
    gradingData: Joi.object().optional()
  }),
  params: Joi.object({
    assignmentId: Joi.string().uuid().required()
  })
};
