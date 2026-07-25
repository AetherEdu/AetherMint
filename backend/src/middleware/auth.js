const jwt = require('jsonwebtoken');
const { hasPermission, hasRoleLevel, UserRole } = require('../utils/roles');
const { AuthError, ForbiddenError } = require('../utils/errors');

/**
 * JWT Authentication Middleware
 * Verifies JWT token and attaches user to request object
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return next(new AuthError('Authentication required'));
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return next(new AuthError('Invalid or expired token'));
    }

    req.user = user;
    next();
  });
};

/**
 * Authorization middleware (alias for requireRole)
 * @param {string|string[]} allowedRoles - Single role or array of allowed roles
 * @returns {Function} Middleware function
 */
const authorize = (allowedRoles) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return requireRole(roles);
};

/**
 * Role-based access control middleware
 * @param {string[]} allowedRoles - Array of allowed roles
 * @returns {Function} Middleware function
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthError('Authentication required'));
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return next(new ForbiddenError(`Access denied. Required roles: ${allowedRoles.join(', ')}`));
    }

    next();
  };
};

/**
 * Permission-based access control middleware
 * @param {string} permission - Required permission
 * @returns {Function} Middleware function
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthError('Authentication required'));
    }

    const userRole = req.user.role;

    if (!hasPermission(userRole, permission)) {
      return next(new ForbiddenError(`Access denied. Required permission: ${permission}`));
    }

    next();
  };
};

/**
 * Minimum role level middleware
 * @param {string} minimumRole - Minimum required role
 * @returns {Function} Middleware function
 */
const requireMinimumRole = (minimumRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthError('Authentication required'));
    }

    const userRole = req.user.role;

    if (!hasRoleLevel(userRole, minimumRole)) {
      return next(new ForbiddenError(`Access denied. Minimum role required: ${minimumRole}`));
    }

    next();
  };
};

/**
 * Self or admin middleware - allows users to access their own resources or admins to access any
 * @param {string} userIdParam - Parameter name containing user ID (default: 'userId')
 * @returns {Function} Middleware function
 */
const requireSelfOrAdmin = (userIdParam = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthError('Authentication required'));
    }

    const userRole = req.user.role;
    const targetUserId = req.params[userIdParam];
    const currentUserId = req.user.id || req.user.sub;

    // Admins can access any resource, users can only access their own
    if (userRole !== UserRole.ADMIN && currentUserId !== targetUserId) {
      return next(new ForbiddenError('You can only access your own resources'));
    }

    next();
  };
};

/**
 * Educator or admin middleware
 */
const requireEducatorOrAdmin = requireRole([UserRole.EDUCATOR, UserRole.ADMIN]);

/**
 * Admin only middleware
 */
const requireAdmin = requireRole([UserRole.ADMIN]);

/**
 * Student or above middleware (all roles)
 */
const requireStudentOrAbove = requireRole([UserRole.STUDENT, UserRole.EDUCATOR, UserRole.ADMIN]);

module.exports = {
  authenticateToken,
  authenticate: authenticateToken,
  authorize,
  requireRole,
  requirePermission,
  requireMinimumRole,
  requireSelfOrAdmin,
  requireEducatorOrAdmin,
  requireAdmin,
  requireStudentOrAbove
};
