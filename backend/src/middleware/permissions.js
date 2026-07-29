const { canPerformAction, hasPermission, UserRole } = require('../utils/roles');
const { AuthError, ForbiddenError, NotFoundError, InternalError } = require('../utils/errors');

/**
 * Check if user can perform specific action on resource
 * @param {string} action - Action to perform (create, read, update, delete)
 * @param {string} resource - Resource type (course, quiz, user, etc.)
 * @returns {Function} Middleware function
 */
const checkActionPermission = (action, resource) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthError('Authentication required'));
    }

    const userRole = req.user.role;

    if (!canPerformAction(userRole, action, resource)) {
      return next(new ForbiddenError(`You don't have permission to ${action} ${resource}`));
    }

    next();
  };
};

/**
 * Resource ownership checker - users can only modify their own resources
 * @param {string} resourceType - Type of resource
 * @param {string} resourceIdParam - Parameter containing resource ID
 * @returns {Function} Middleware function
 */
const checkResourceOwnership = (resourceType, resourceIdParam = 'id') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AuthError('Authentication required'));
      }

      const userRole = req.user.role;
      const resourceId = req.params[resourceIdParam];
      const userId = req.user.id || req.user.sub;

      // Admins can access any resource
      if (userRole === UserRole.ADMIN) {
        return next();
      }

      // For non-admin users, check ownership
      const resource = await getResourceById(resourceType, resourceId);

      if (!resource) {
        return next(new NotFoundError(`${resourceType} with ID ${resourceId} not found`));
      }

      if (resource.owner !== userId && resource.userId !== userId) {
        return next(new ForbiddenError(`You can only modify your own ${resourceType}`));
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return next(new InternalError('Error checking permissions'));
    }
  };
};

/**
 * Course-specific permission checker
 */
const canManageCourse = (req, res, next) => {
  if (!req.user) {
    return next(new AuthError('Authentication required'));
  }

  const userRole = req.user.role;
  const action = req.method.toLowerCase() === 'get' ? 'read' :
                 req.method.toLowerCase() === 'post' ? 'create' :
                 req.method.toLowerCase() === 'put' ? 'update' : 'delete';

  if (!canPerformAction(userRole, action, 'course')) {
    return next(new ForbiddenError(`You don't have permission to ${action} courses`));
  }

  next();
};

/**
 * Quiz-specific permission checker
 */
const canManageQuiz = (req, res, next) => {
  if (!req.user) {
    return next(new AuthError('Authentication required'));
  }

  const userRole = req.user.role;
  const action = req.method.toLowerCase() === 'get' ? 'read' :
                 req.method.toLowerCase() === 'post' ? 'create' :
                 req.method.toLowerCase() === 'put' ? 'update' : 'delete';

  if (!canPerformAction(userRole, action, 'quiz')) {
    return next(new ForbiddenError(`You don't have permission to ${action} quizzes`));
  }

  next();
};

/**
 * User management permission checker
 */
const canManageUser = (req, res, next) => {
  if (!req.user) {
    return next(new AuthError('Authentication required'));
  }

  const userRole = req.user.role;
  const targetUserId = req.params.userId || req.params.id;
  const currentUserId = req.user.id || req.user.sub;

  // Admins can manage any user
  if (userRole === UserRole.ADMIN) {
    return next();
  }

  // Users can only read their own profile
  if (req.method.toLowerCase() === 'get' && currentUserId === targetUserId) {
    return next();
  }

  // Users can update their own profile
  if (['put', 'patch'].includes(req.method.toLowerCase()) && currentUserId === targetUserId) {
    return next();
  }

  return next(new ForbiddenError('You can only access and modify your own user profile'));
};

/**
 * Content management permission checker
 */
const canManageContent = (req, res, next) => {
  if (!req.user) {
    return next(new AuthError('Authentication required'));
  }

  const userRole = req.user.role;
  const action = req.method.toLowerCase() === 'get' ? 'read' :
                 req.method.toLowerCase() === 'post' ? 'create' :
                 req.method.toLowerCase() === 'put' ? 'update' : 'delete';

  if (!canPerformAction(userRole, action, 'content')) {
    return next(new ForbiddenError(`You don't have permission to ${action} content`));
  }

  next();
};

/**
 * Helper function to get resource by ID (placeholder - should be implemented with actual database queries)
 * @param {string} resourceType - Type of resource
 * @param {string} resourceId - Resource ID
 * @returns {Promise<Object|null>} - Resource object or null
 */
async function getResourceById(resourceType, resourceId) {
  // This is a placeholder implementation
  // In a real application, you would query your database here
  // For now, we'll return a mock object that passes ownership checks
  return {
    id: resourceId,
    owner: resourceId, // This would normally be the actual owner ID
    userId: resourceId // Alternative owner field
  };
}

module.exports = {
  checkActionPermission,
  checkResourceOwnership,
  canManageCourse,
  canManageQuiz,
  canManageUser,
  canManageContent
};
