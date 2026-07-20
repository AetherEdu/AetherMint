const rbacService = require('../services/rbacService');
const logger = require('../utils/logger');

/**
 * RBAC Controller functions
 */
const rbacController = {
  /**
   * Update a user's role
   * POST /api/rbac/assign-role
   */
  listRoles: async (req, res) => {
    res.status(200).json({ success: true, data: [] });
  },
  createRole: async (req, res) => {
    res.status(201).json({ success: true, data: { id: 'stub' } });
  },
  getRole: async (req, res) => {
    res.status(200).json({ success: true, data: {} });
  },
  updateRole: async (req, res) => {
    res.status(200).json({ success: true, data: {} });
  },
  deleteRole: async (req, res) => {
    res.status(200).json({ success: true });
  },
  getUserRoles: async (req, res) => {
    res.status(200).json({ success: true, data: [] });
  },
  removeRole: async (req, res) => {
    res.status(200).json({ success: true });
  },
  listPermissions: async (req, res) => {
    res.status(200).json({ success: true, data: [] });
  },
  updateRolePermissions: async (req, res) => {
    res.status(200).json({ success: true, data: {} });
  },
  assignRole: async (req, res) => {
    try {
      const { userId, role } = req.body;
      const admin = req.user;

      if (!userId || !role) {
        return res.status(400).json({
          success: false,
          message: 'User ID and Role are required'
        });
      }

      // 1. Check if the performer is authorized (Admin level or hierarchy)
      if (!rbacService.canAssignRole(admin.role, role)) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You do not have permission to assign this role',
          code: 'PRIVILEGE_ESCALATION_DENIED'
        });
      }

      // 2. Perform role assignment via service
      const result = await rbacService.assignRole(admin.id, userId, role);

      res.status(200).json({
        success: true,
        message: 'Role assigned successfully',
        data: result
      });
    } catch (err) {
      logger.error('RBAC Assignment Error:', err);
      res.status(500).json({
        success: false,
        message: err.message || 'Error occurred during role assignment'
      });
    }
  },

  /**
   * Get all user and role permissions for auditing
   * GET /api/rbac/permissions
   */
  getAvailablePermissions: async (req, res) => {
    try {
      const { ROLE_PERMISSIONS } = require('../utils/roles');
      res.status(200).json({
        success: true,
        data: {
          roles: Object.keys(ROLE_PERMISSIONS),
          permissions: ROLE_PERMISSIONS
        }
      });
    } catch (err) {
      logger.error('RBAC Permissions Error:', err);
      res.status(500).json({
        success: false,
        message: 'Internal server error while retrieving permission list'
      });
    }
  }
};

module.exports = rbacController;
