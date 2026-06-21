const express = require('express');
const router = express.Router();
const rbacController = require('../controllers/rbacController');
const { requirePermission, protectRoleEscalation } = require('../middleware/rbac');
const { PERMISSIONS } = require('../utils/roles');
// Assuming we have a standard auth middleware already to populate req.user
// For now, using a placeholder requirement
const { verifyToken } = require('../middleware/ipfsAuth');

/**
 * Placeholder auth middleware for RBAC routes
 * Ideally, there should be a global auth middleware
 */
const rbacAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  const token = authHeader.substring(7);
  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

/**
 * RBAC Management Routes
 * Only admins can access these
 */

/**
 * Assign a role to a user
 * POST /api/rbac/assign-role
 */
router.post('/assign-role', 
  rbacAuth,
  requirePermission(PERMISSIONS.USER_ASSIGN_ROLE),
  protectRoleEscalation,
  rbacController.assignRole
);

/**
 * Get all available roles and permissions (Admin/Auditor only)
 * GET /api/rbac/permissions
 */
router.get('/permissions',
  rbacAuth,
  requirePermission(PERMISSIONS.ADMIN_PANEL),
  rbacController.getAvailablePermissions
);

module.exports = router;
