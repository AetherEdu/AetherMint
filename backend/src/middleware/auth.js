const jwt = require('jsonwebtoken');
const { hasPermission, hasRoleLevel, UserRole } = require('../utils/roles');

/**
 * JWT Authentication Middleware
 * Verifies JWT token and attaches user to request object
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      message: 'Please provide a valid JWT token'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ 
        error: 'Invalid token',
        message: 'The provided token is invalid or expired'
      });
    }
    
    req.user = user;
    next();
  });
};

/**
 * Role-based access control middleware
 * @param {string[]} allowedRoles - Array of allowed roles
 * @returns {Function} Middleware function
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please authenticate to access this resource'
      });
    }

    const userRole = req.user.role;
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`
      });
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
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please authenticate to access this resource'
      });
    }

    const userRole = req.user.role;
    
    if (!hasPermission(userRole, permission)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: `Access denied. Required permission: ${permission}`
      });
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
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please authenticate to access this resource'
      });
    }

    const userRole = req.user.role;
    
    if (!hasRoleLevel(userRole, minimumRole)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: `Access denied. Minimum role required: ${minimumRole}`
      });
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
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please authenticate to access this resource'
      });
    }

    const userRole = req.user.role;
    const targetUserId = req.params[userIdParam];
    const currentUserId = req.user.id || req.user.sub;

    // Admins can access any resource, users can only access their own
    if (userRole !== UserRole.ADMIN && currentUserId !== targetUserId) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'You can only access your own resources'
      });
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

// Aliases for compatibility with routes that use different naming conventions
const authenticate = authenticateToken;
const authorize = (role) => requireRole([role]);

module.exports = {
  authenticateToken,
  authenticate,
  authorize,
  requireRole,
  requirePermission,
  requireMinimumRole,
  requireSelfOrAdmin,
  requireEducatorOrAdmin,
  requireAdmin,
  requireStudentOrAbove
};
