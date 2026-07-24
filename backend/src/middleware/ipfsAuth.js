const jwt = require('jsonwebtoken');
const { ipfsConfig } = require('../config/ipfs');
const { createIpfsError } = require('../utils/ipfsUtils');
const { AuthError, ForbiddenError, ValidationError, PayloadTooLargeError } = require('../utils/errors');

/**
 * Map an IPFS-domain error (created via {@link createIpfsError}) onto the
 * canonical RFC 7807 AppError family. Unknown errors are re-wrapped as
 * an AuthError because the IPFS auth middleware only emits authentication-
 * shaped failures.
 */
const mapIpfsError = (error, operation) => {
  if (!error || !error.isIpfsError) {
    return new AuthError('Authentication failed');
  }
  const message = error.message || 'Authentication failed';
  if (error.operation === 'validation') {
    const err = new ValidationError(message);
    err.details = error.details;
    return err;
  }
  // auth-shaped errors: distinguish 401 (missing/invalid token) vs 403
  // (insufficient permissions) using the message as the heuristic since
  // the IPFS layer does not currently classify these.  This still emits
  // a stable RFC 7807 envelope end-to-end.
  if (/insufficient/i.test(message) || /permission/i.test(message)) {
    const err = new ForbiddenError(message);
    err.details = error.details;
    return err;
  }
  const err = new AuthError(message);
  err.details = error.details;
  return err;
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
    throw createIpfsError('Invalid or expired token', 'auth', { error: error.message });
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
    throw createIpfsError('Rate limit exceeded', 'auth', { 
      operation, 
      limit: userLimit, 
      current: currentCount 
    });
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
        throw createIpfsError('Authorization token required', 'auth');
      }

      const token = authHeader.substring(7);
      
      // Verify token and extract user
      const user = verifyToken(token);

      // Check if user has required permissions
      if (!hasPermission(user, operation)) {
        throw createIpfsError('Insufficient permissions for this operation', 'auth', { 
          operation, 
          userRole: user.role 
        });
      }

      // Check rate limits
      checkRateLimit(user, operation);

      // Add user information to request object
      req.user = user;
      req.ipfsOperation = operation;

      next();
    } catch (error) {
      return next(mapIpfsError(error, operation));
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
          throw createIpfsError('Insufficient permissions for this operation', 'auth', {
            operation,
            userRole: user.role
          });
        }

        // Check rate limits for authenticated users
        checkRateLimit(user, operation);

        req.user = user;
      }

      req.ipfsOperation = operation;
      next();
    } catch (error) {
      if (error && error.isIpfsError) {
        // Permission failures are surfaced; invalid tokens for optional
        // auth fall through without attaching a user identity (preserved
        // pre-migration behaviour).
        if (/permission/i.test(error.message || '')) {
          return next(mapIpfsError(error, operation));
        }
        req.ipfsOperation = operation;
        return next();
      }
      // Unknown errors also fall through silently for optional auth.
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
 * Validates file size before upload
 */
const validateFileSize = (req, res, next) => {
  try {
    if (req.file && req.file.size > ipfsConfig.maxFileSize) {
      throw createIpfsError('File size exceeds maximum limit', 'validation', { 
        maxSize: ipfsConfig.maxFileSize,
        actualSize: req.file.size
      });
    }

    next();
  } catch (error) {
    if (error && error.isIpfsError) {
      // File-size overruns surface as a Pay-load Too Large problem
      // (RFC 7807) so the existing error catalog row matches the wire.
      return next(new PayloadTooLargeError(error.message || 'File size exceeds maximum limit'));
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
  checkRateLimit
};
