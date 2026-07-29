import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors';
import logger from '../utils/logger';

const MAX_STRING_LENGTH = 10000;

type RequestWithUploads = Request & {
  file?: any;
  files?: any[] | Record<string, any[]>;
};

/**
 * Encodes HTML entities to prevent XSS attacks.
 */
const encodeHtmlEntities = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Strips HTML tags from a string.
 */
const stripHtml = (str: string): string => {
  return str
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, '')
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gmi, '')
    .replace(/<iframe\b[^>]*>([\s\S]*?)<\/iframe>/gmi, '')
    .replace(/<[^>]*>?/gm, '')
    .trim();
};

/**
 * Sanitizes string with length validation and encoding.
 */
const sanitizeString = (str: string): string => {
  let sanitized = stripHtml(str);
  sanitized = encodeHtmlEntities(sanitized);
  sanitized = sanitized.trim();
  if (sanitized.length > MAX_STRING_LENGTH) {
    sanitized = sanitized.substring(0, MAX_STRING_LENGTH);
  }
  return sanitized;
};

/**
 * Recursively sanitizes an object.
 */
const sanitizeRecursive = (obj: any): any => {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeRecursive(item));
  }

  if (obj !== null && typeof obj === 'object') {
    const sanitizedObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        let sanitizedKey = key;
        if (key.startsWith('$')) {
          sanitizedKey = key.replace(/^\$/, 'sanitized_');
        }
        sanitizedObj[sanitizedKey] = sanitizeRecursive(obj[key]);
      }
    }
    return sanitizedObj;
  }

  return obj;
};

/**
 * Sanitizes file upload metadata.
 */
const sanitizeFileMetadata = (file: any) => {
  if (file.originalname) {
    file.originalname = sanitizeString(file.originalname).replace(/[^a-zA-Z0-9.\-_]/g, '_');
  }
  if (file.fieldname) {
    file.fieldname = sanitizeString(file.fieldname);
  }
};

/**
 * Middleware to sanitize all incoming request data.
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const uploadRequest = req as RequestWithUploads;

  try {
    if (uploadRequest.body) {
      uploadRequest.body = sanitizeRecursive(uploadRequest.body);
    }
    if (uploadRequest.query) {
      uploadRequest.query = sanitizeRecursive(uploadRequest.query);
    }
    if (uploadRequest.params) {
      uploadRequest.params = sanitizeRecursive(uploadRequest.params);
    }
    if (uploadRequest.file) {
      sanitizeFileMetadata(uploadRequest.file);
    }
    if (uploadRequest.files) {
      if (Array.isArray(uploadRequest.files)) {
        uploadRequest.files.forEach(sanitizeFileMetadata);
      } else {
        Object.values(uploadRequest.files).forEach((fileArray: any) => {
          fileArray.forEach(sanitizeFileMetadata);
        });
      }
    }
    next();
  } catch (error) {
    logger.error('Input sanitization error:', error);
    next(error);
  }
};

/**
 * Rejects requests with suspicious patterns (XSS, SQLi, NoSQLi).
 */
export const detectSuspiciousPatterns = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousRegex = [
    /<script\b[^>]*>([\s\S]*?)<\/script>/i,
    /<style\b[^>]*>([\s\S]*?)<\/style>/i,
    /<iframe\b[^>]*>([\s\S]*?)<\/iframe>/i,
    /on\w+=/i,
    /javascript:/i,
    /vbscript:/i,
    /data:/i,
    /\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|TRUNCATE)\b/i,
    /('\s*--)|(--\s*')|(\/\*)|(\*\/)|(;\s*)/i,
    /\{\s*"\$|\$\s*\{/i
  ];

  const checkSuspicious = (obj: any): boolean => {
    if (!obj) return false;
    const str = JSON.stringify(obj);
    return suspiciousRegex.some((regex) => regex.test(str));
  };

  if (checkSuspicious(req.body) || checkSuspicious(req.query) || checkSuspicious(req.params)) {
    logger.warn(`Suspicious activity detected from IP: ${req.ip}`, {
      path: req.path,
      method: req.method,
      userAgent: req.headers['user-agent']
    });
    return next(new ForbiddenError('Request rejected due to suspicious patterns.'));
  }

  next();
};
