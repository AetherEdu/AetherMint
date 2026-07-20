const rbacService = require('../services/rbacService');
const logger = require('../utils/logger');

/**
 * RBAC Controller functions
 */
const rbacController = {
  /**
   * List all roles
   * GET /api/rbac/roles
   */
  listRoles: async (req, res) => {
    try {
      res.status(200).json({
        success: true,
        data: { roles: ['admin', 'educator', 'student', 'moderator'] }
      });
    } catch (err) {
      logger.error('List Roles Error:', err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },

  /**
   * Create a new role
   * POST /api/rbac/roles
   */
  createRole: async (req, res) => {
    try {
      const { name, permissions } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, message: 'Role name is required' });
      }
      res.status(201).json({ success: true, data: { name, permissions } });
    } catch (err) {
      logger.error('Create Role Error:', err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },

  /**
   * Get role by ID
   * GET /api/rbac/roles/:roleId
   */
  getRole: async (req, res) => {
    try {
      const { roleId } = req.params;
      res.status(200).json({ success: true, data: { id: roleId, name: roleId, permissions: [] } });
    } catch (err) {
      logger.error('Get Role Error:', err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },

  /**
   * Update role
   * PUT /api/rbac/roles/:roleId
   */
  updateRole: async (req, res) => {
    try {
      const { roleId } = req.params;
      res.status(200).json({ success: true, data: { id: roleId, updated: true } });
    } catch (err) {
      logger.error('Update Role Error:', err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },

  /**
   * Delete role
   * DELETE /api/rbac/roles/:roleId
   */
  deleteRole: async (req, res) => {
    try {
      const { roleId } = req.params;
      res.status(200).json({ success: true, message: `Role ${roleId} deleted` });
    } catch (err) {
      logger.error('Delete Role Error:', err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },

  /**
   * Get user roles
   * GET /api/rbac/users/:userId/roles
   */
  getUserRoles: async (req, res) => {
    try {
      const { userId } = req.params;
      res.status(200).json({ success: true, data: { userId, roles: ['student'] } });
    } catch (err) {
      logger.error('Get User Roles Error:', err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },

  /**
   * Remove role from user
   * DELETE /api/rbac/users/:userId/roles/:roleId
   */
  removeRole: async (req, res) => {
    try {
      const { userId, roleId } = req.params;
      res.status(200).json({ success: true, message: `Role ${roleId} removed from user ${userId}` });
    } catch (err) {
      logger.error('Remove Role Error:', err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },

  /**
   * List all permissions
   * GET /api/rbac/permissions
   */
  listPermissions: async (req, res) => {
    try {
      const { PERMISSIONS } = require('../utils/roles');
      res.status(200).json({ success: true, data: { permissions: Object.values(PERMISSIONS) } });
    } catch (err) {
      logger.error('List Permissions Error:', err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },

  /**
   * Update role permissions
   * PUT /api/rbac/roles/:roleId/permissions
   */
  updateRolePermissions: async (req, res) => {
    try {
      const { roleId } = req.params;
      const { permissions } = req.body;
      res.status(200).json({ success: true, data: { roleId, permissions } });
    } catch (err) {
      logger.error('Update Role Permissions Error:', err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },

  /**
   * Update a user's role
   * POST /api/rbac/assign-role
   */
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
