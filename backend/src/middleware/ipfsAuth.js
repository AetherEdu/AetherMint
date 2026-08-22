const jwt = require('jsonwebtoken');
const { ipfsConfig } = require('../config/ipfs');
const { createIpfsError } = require('../utils/ipfsUtils');
const {
  AuthError,
  ForbiddenError,
  ValidationError,
  PayloadTooLargeError,
  RateLimitError,
  NotFoundError,
  ServiceUnavailableError,
  InternalError,
} = require('../utils/errors');

/**
 * Operation → HTTP status fallback table, applied only when an IPFS error
 * is constructed without an explicit {@link createIpfsError} `httpStatus`.
 * Each row maps the IPFS operation name (e.g. `'auth'`, `'validation'`) to
 * the status most appropriate for the RFC 7807 envelope.
 *
 * Callers that want a different status than the operation default MUST pass
 * the desired status as the 4th argument to `createIpfsError`.
 */
const OPERATION_STATUS_MAP = Object.freeze({
  auth: 401,
  validation: 400,
  init: 503,
  getContent: 404,
  getMetadata: 404,
  upload: 500,
  pinContent: 500,
  unpinContent: 500,
  getNodeInfo: 500,
  rateLimit: 429,
});

/**
 * Map an IPFS-domain error (created via {@link createIpfsError}) onto the
 * canonical RFC 7807 AppError family. Classification is now data-driven:
 * the explicit `httpStatus` set at the throw site wins; otherwise the
 * {@link OPERATION_STATUS_MAP} fallback determines the status. Message text
 * is never inspected.
 *
 * @param {Error|null|undefined} error - The thrown value.
 * @returns {import('../utils/errors').AppError} The matching inherited
 *   `AppError` so the central error handler emits the right envelope.
 */
const mapIpfsError = (error) => {
  if (!error || !error.isIpfsError) {
    return new AuthError('Authentication failed');
  }

  const status =
    typeof error.httpStatus === 'number'
      ? error.httpStatus
      : OPERATION_STATUS_MAP[error.operation] || 500;
  const message = error.message || 'IPFS operation failed';

  let appError;
  switch (status) {
    case 400:
      appError = new ValidationError(message);
      break;
    case 401:
      appError = new AuthError(message);
      break;
    case 403:
      appError = new ForbiddenError(message);
      break;
    case 404:
      appError = new NotFoundError(message);
      break;
    case 413:
      appError = new PayloadTooLargeError(message);
      break;
    case 429:
      appError = new RateLimitError(message);
      break;
    case 503:
      appError = new ServiceUnavailableError(message);
      break;
    default:
      appError = new InternalError(message);
      break;
  }

  if (error.details !== undefined) {
    appError.details = error.details;
  }
  return appError;
};

/**
 * IPFS Authentication Middleware
 * Validates JWT tokens and checks IPFS-specific permissions
 */

/**
 * Verify JWT token and extract user information
 * @param {string} token - The JWT token
 * @returns {Object} - The decoded user information
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw createIpfsError(
      'Invalid or expired token',
      'auth',
      { error: error.message },
      401,
    );
  }
};

/**
 * Check if user has IPFS upload permissions
 * @param {Object} user - The user object
 * @param {string} operation - The operation type (upload, download, pin, unpin)
 * @returns {boolean} - Whether the user has permission
 */
const hasPermission = (user, operation) => {
  // Admin users have all permissions
  if (user.role === 'admin') {
    return true;
  }

  // Check specific permissions based on user role
  const permissions = {
    instructor: ['upload', 'download', 'pin'],
    student: ['download'],
    guest: ['download']
  };

  const userPermissions = permissions[user.role] || [];
  return userPermissions.includes(operation);
};

/**
 * Rate limiting for IPFS operations
 * @param {Object} user - The user object
 * @param {string} operation - The operation type
 * @returns {boolean} - Whether the operation is allowed
 */
const checkRateLimit = (user, operation) => {
  // Define rate limits per operation and user role
  const rateLimits = {
    upload: {
      instructor: 50, // 50 uploads per hour
      student: 10,   // 10 uploads per hour
      guest: 5       // 5 uploads per hour
    },
    download: {
      instructor: 200,
      student: 100,
      guest: 50
    },
    pin: {
      instructor: 30,
      student: 5,
      guest: 0
    }
  };

  const userLimit = rateLimits[operation]?.[user.role] || 0;

  // For demo purposes, we'll use a simple in-memory counter
  // In production, use Redis or similar for distributed rate limiting
  const userKey = `${user.id}:${operation}`;
  const currentCount = global.ipfsRateLimit?.[userKey] || 0;

  if (currentCount >= userLimit) {
    // 429 Rate Limit is the canonical status for quota breaches — set it
    // explicitly rather than letting the auth fallback mis-classify this
    // as 401 Unauthorized.
    throw createIpfsError(
      'Rate limit exceeded',
      'auth',
      {
        operation,
        limit: userLimit,
        current: currentCount,
      },
      429,
    );
  }

  // Increment counter (reset every hour)
  if (!global.ipfsRateLimit) {
    global.ipfsRateLimit = {};
  }
  global.ipfsRateLimit[userKey] = currentCount + 1;

  // Reset counter after 1 hour
  setTimeout(() => {
    if (global.ipfsRateLimit && global.ipfsRateLimit[userKey]) {
      global.ipfsRateLimit[userKey]--;
    }
  }, 60 * 60 * 1000);

  return true;
};

/**
 * Main authentication middleware
 * @param {string} operation - The required operation (upload, download, pin, unpin)
 * @returns {Function} - Express middleware function
 */
const ipfsAuth = (operation = 'download') => {
  return async (req, res, next) => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw createIpfsError(
          'Authorization token required',
          'auth',
          undefined,
          401,
        );
      }

      const token = authHeader.substring(7);

      // Verify token and extract user
      const user = verifyToken(token);

      // Check if user has required permissions
      if (!hasPermission(user, operation)) {
        // Explicit 403 — does NOT rely on message-text heuristics.
        throw createIpfsError(
          'Insufficient permissions for this operation',
          'auth',
          {
            operation,
            userRole: user.role,
          },
          403,
        );
      }

      // Check rate limits
      checkRateLimit(user, operation);

      // Add user information to request object
      req.user = user;
      req.ipfsOperation = operation;

      next();
    } catch (error) {
      return next(mapIpfsError(error));
    }
  };
};

/**
 * Optional authentication middleware
 * Allows requests without authentication but adds user info if token is provided
 */
const optionalIpfsAuth = (operation = 'download') => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const user = verifyToken(token);

        // Check permissions if user is authenticated
        if (!hasPermission(user, operation)) {
          // Explicit 403 — surface as a forbidden response.
          throw createIpfsError(
            'Insufficient permissions for this operation',
            'auth',
            {
              operation,
              userRole: user.role,
            },
            403,
          );
        }

        // Check rate limits for authenticated users
        checkRateLimit(user, operation);

        req.user = user;
      }

      req.ipfsOperation = operation;
      next();
    } catch (error) {
      // Check the explicit/routed status instead of message-text. Only
      // 403 (permission denial) is surfaced; other failures (401 invalid
      // token, 429 rate limit, 500 unexpected) silently degrade to a
      // no-user request, preserving the prior "optional auth" semantics.
      if (error && error.isIpfsError) {
        const status =
          typeof error.httpStatus === 'number'
            ? error.httpStatus
            : OPERATION_STATUS_MAP[error.operation];
        if (status === 403) {
          return next(mapIpfsError(error));
        }
        req.ipfsOperation = operation;
        return next();
      }
      // Unknown / non-IPFS errors also fall through silently.
      req.ipfsOperation = operation;
      next();
    }
  };
};

/**
 * Content access validation middleware
 * Checks if user has access to specific content based on ownership or permissions
 */
const validateContentAccess = async (req, res, next) => {
  try {
    const { cid } = req.params;
    const user = req.user;

    // If no user is provided, only allow public content
    if (!user) {
      // In a real implementation, you would check if the content is public
      // For now, we'll allow access to all content for demo purposes
      return next();
    }

    // Admin users can access all content
    if (user.role === 'admin') {
      return next();
    }

    // In a real implementation, you would:
    // 1. Check if the user is the content owner
    // 2. Check if the content is shared with the user
    // 3. Check if the content is part of a course the user is enrolled in

    // For demo purposes, we'll allow access
    next();
  } catch (error) {
    return next(new ForbiddenError('Content access validation failed'));
  }
};

/**
 * File size validation middleware
 * Validates file size before upload.
 *
 * Sets an explicit `httpStatus: 413` on the IPFS error it raises so
 * {@link mapIpfsError} produces a `PayloadTooLargeError` envelope instead
 * of the previous blanket-mapping that mis-classified every IPFS error as
 * 413 (Issue #254 follow-up).
 */
const validateFileSize = (req, res, next) => {
  try {
    if (req.file && req.file.size > ipfsConfig.maxFileSize) {
      // Explicit 413 — drives the matching AppError subclass through
      // `mapIpfsError` rather than relying on the validation fallback.
      throw createIpfsError(
        'File size exceeds maximum limit',
        'validation',
        {
          maxSize: ipfsConfig.maxFileSize,
          actualSize: req.file.size,
        },
        413,
      );
    }

    next();
  } catch (error) {
    if (error && error.isIpfsError) {
      // Use mapIpfsError so the status field drives the AppError
      // selection — file-size overruns become 413 PayloadTooLargeError
      // and other ipfs validation failures bubble up as 400 ValidationError
      // (or whatever the throw site specified).
      return next(mapIpfsError(error));
    }
    return next(new ValidationError('File validation failed'));
  }
};

module.exports = {
  ipfsAuth,
  optionalIpfsAuth,
  validateContentAccess,
  validateFileSize,
  verifyToken,
  hasPermission,
  checkRateLimit,
  // Exported for unit tests; consumers should normally use `mapIpfsError`.
  mapIpfsError,
  OPERATION_STATUS_MAP,
};
