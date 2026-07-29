/**
 * Enhanced File Upload Validation Middleware
 * Complements the existing sanitizer.ts with comprehensive file validation.
 *
 * Provides: MIME type allow/block lists, extension validation, size limits,
 * and extension-MIME type mismatch detection.
 */

const path = require('path');
const logger = require('../utils/logger');

// ────────────────────────────────────────────────────────────────────────────
// Allowed & Blocked File Types
// ────────────────────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = {
  // Documents
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/plain': ['.txt', '.csv', '.md'],
  // Images
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
  // Media
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  // Code / data
  'application/javascript': ['.js'],
  'text/javascript': ['.js'],
  'text/html': ['.html'],
  'text/css': ['.css'],
  'application/json': ['.json'],
};

const BLOCKED_MIME_TYPES = [
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-msi',
  'application/x-sh',
  'application/x-php',
  'application/x-python',
  'application/x-perl',
];

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.dll', '.msi', '.scr',
  '.pif', '.sh', '.bash', '.csh', '.ksh', '.zsh',
  '.php', '.phtml', '.php3', '.php4', '.php5', '.phar',
  '.py', '.pyc', '.pyo', '.pyw',
  '.pl', '.pm', '.rb', '.asp', '.aspx', '.jsp',
  '.cgi', '.swf',
]);

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '50', 10) * 1024 * 1024;

// ────────────────────────────────────────────────────────────────────────────
// Validation Functions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Validate a single uploaded file.
 * @param {Object} file - File object (from multer)
 * @returns {{ valid: boolean, error?: string }}
 */
const validateFile = (file) => {
  if (!file) return { valid: false, error: 'No file provided' };

  // Empty file (cheapest check first)
  if (file.size === 0) {
    return { valid: false, error: 'Empty file not allowed' };
  }

  // Blocked extension
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `File type '${ext}' is not allowed` };
  }

  // Blocked MIME type
  if (file.mimetype && BLOCKED_MIME_TYPES.includes(file.mimetype)) {
    return { valid: false, error: `File type '${file.mimetype}' is blocked` };
  }

  // Unknown MIME type
  if (file.mimetype && !ALLOWED_MIME_TYPES[file.mimetype]) {
    return { valid: false, error: `Unsupported file type: ${file.mimetype}` };
  }

  // Extension-MIME mismatch
  if (file.mimetype && ext) {
    const allowedExts = ALLOWED_MIME_TYPES[file.mimetype];
    if (allowedExts && !allowedExts.includes(ext)) {
      return {
        valid: false,
        error: `File extension '${ext}' does not match MIME type '${file.mimetype}'`,
      };
    }
  }

  // Size limit
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large: ${(file.size / (1024 * 1024)).toFixed(2)}MB exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
    };
  }

  return { valid: true };
};

/**
 * Validate all uploaded files in a request.
 * @param {Object} req - Express request
 * @returns {{ valid: boolean, errors: string[] }}
 */
const validateUploadedFiles = (req) => {
  const errors = [];
  const files = req.files || (req.file ? [req.file] : []);

  const fileArray = Array.isArray(files)
    ? files
    : Object.values(files).flat();

  for (const file of fileArray) {
    const result = validateFile(file);
    if (!result.valid) errors.push(result.error);
  }

  return { valid: errors.length === 0, errors };
};

// ────────────────────────────────────────────────────────────────────────────
// Express Middleware
// ────────────────────────────────────────────────────────────────────────────

/**
 * File upload validation middleware.
 * Applies after multer has processed the upload.
 * Rejects requests with invalid files (400).
 */
const validateFileUpload = (req, res, next) => {
  if (!req.files && !req.file) return next(); // No files to validate

  try {
    const result = validateUploadedFiles(req);
    if (!result.valid) {
      logger.warn(`File upload validation failed from ${req.ip}: ${result.errors.join('; ')}`);
      return res.status(400).json({
        success: false,
        message: 'File upload validation failed',
        errors: result.errors,
      });
    }
    next();
  } catch (error) {
    logger.error(`File upload validation error: ${error.message}`);
    next(error);
  }
};

// ────────────────────────────────────────────────────────────────────────────
// Exports
// ────────────────────────────────────────────────────────────────────────────

module.exports = {
  validateFileUpload,
  validateFile,
  validateUploadedFiles,
  ALLOWED_MIME_TYPES,
  BLOCKED_MIME_TYPES,
  BLOCKED_EXTENSIONS,
  MAX_FILE_SIZE,
};
