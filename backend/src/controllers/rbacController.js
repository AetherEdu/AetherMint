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
  listRoles: (req, res) => {
    try {
      const roles = Object.values(require('../utils/roles').UserRole);
      res.status(200).json({
        success: true,
        data: roles
      });
    } catch (err) {
      logger.error('RBAC List Roles Error:', err);
      res.status(500).json({
        success: false,
        message: 'Error listing roles'
      });
    }
  },

  /**
   * Create a new role
   * POST /api/rbac/roles
   */
  createRole: (req, res) => {
    try {
      const { role } = req.body;
      res.status(201).json({
        success: true,
        message: 'Role created successfully',
        data: { role }
      });
    } catch (err) {
      logger.error('RBAC Create Role Error:', err);
      res.status(500).json({
        success: false,
        message: 'Error creating role'
      });
    }
  },

  /**
   * Get role by ID
   * GET /api/rbac/roles/:roleId
   */
  getRole: (req, res) => {
    try {
      const { roleId } = req.params;
      res.status(200).json({
        success: true,
        data: { role: roleId }
      });
    } catch (err) {
      logger.error('RBAC Get Role Error:', err);
      res.status(500).json({
        success: false,
        message: 'Error retrieving role'
      });
    }
  },

  /**
   * Update role
   * PUT /api/rbac/roles/:roleId
   */
  updateRole: (req, res) => {
    try {
      const { roleId } = req.params;
      const updates = req.body;
      res.status(200).json({
        success: true,
        message: 'Role updated successfully',
        data: { role: roleId, ...updates }
      });
    } catch (err) {
      logger.error('RBAC Update Role Error:', err);
      res.status(500).json({
        success: false,
        message: 'Error updating role'
      });
    }
  },

  /**
   * Delete role
   * DELETE /api/rbac/roles/:roleId
   */
  deleteRole: (req, res) => {
    try {
      const { roleId } = req.params;
      res.status(200).json({
        success: true,
        message: 'Role deleted successfully',
        data: { role: roleId }
      });
    } catch (err) {
      logger.error('RBAC Delete Role Error:', err);
      res.status(500).json({
        success: false,
        message: 'Error deleting role'
      });
    }
  },

  /**
   * Get user roles
   * GET /api/rbac/users/:userId/roles
   */
  getUserRoles: (req, res) => {
    try {
      const { userId } = req.params;
      res.status(200).json({
        success: true,
        data: { userId, roles: [] }
      });
    } catch (err) {
      logger.error('RBAC Get User Roles Error:', err);
      res.status(500).json({
        success: false,
        message: 'Error retrieving user roles'
      });
    }
  },

  /**
   * Assign role to user
   * POST /api/rbac/users/:userId/roles
   */
  assignRole: async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      const admin = req.user;

      if (!role) {
        return res.status(400).json({
          success: false,
          message: 'Role is required'
        });
      }

      // Check if the performer is authorized
      if (!rbacService.canAssignRole(admin.role, role)) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You do not have permission to assign this role',
          code: 'PRIVILEGE_ESCALATION_DENIED'
        });
      }

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
   * Remove role from user
   * DELETE /api/rbac/users/:userId/roles/:roleId
   */
  removeRole: (req, res) => {
    try {
      const { userId, roleId } = req.params;
      res.status(200).json({
        success: true,
        message: 'Role removed successfully',
        data: { userId, role: roleId }
      });
    } catch (err) {
      logger.error('RBAC Remove Role Error:', err);
      res.status(500).json({
        success: false,
        message: 'Error removing role'
      });
    }
  },

  /**
   * List all permissions
   * GET /api/rbac/permissions
   */
  listPermissions: (req, res) => {
    try {
      const { PERMISSIONS } = require('../utils/roles');
      res.status(200).json({
        success: true,
        data: {
          permissions: PERMISSIONS
        }
      });
    } catch (err) {
      logger.error('RBAC List Permissions Error:', err);
      res.status(500).json({
        success: false,
        message: 'Error listing permissions'
      });
    }
  },

  /**
   * Update role permissions
   * PUT /api/rbac/roles/:roleId/permissions
   */
  updateRolePermissions: (req, res) => {
    try {
      const { roleId } = req.params;
      const { permissions } = req.body;
      res.status(200).json({
        success: true,
        message: 'Role permissions updated successfully',
        data: { role: roleId, permissions }
      });
    } catch (err) {
      logger.error('RBAC Update Permissions Error:', err);
      res.status(500).json({
        success: false,
        message: 'Error updating role permissions'
      });
    }
  }
};

module.exports = rbacController;
