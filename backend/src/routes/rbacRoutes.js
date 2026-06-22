/**
 * @openapi
 * tags:
 *   - name: RBAC
 *     description: Role-based access control management
 */

const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const rbacController = require("../controllers/rbacController");

router.use(authenticate, authorize("admin"));

/**
 * @openapi
 * /api/rbac/roles:
 *   get:
 *     tags: [RBAC]
 *     summary: List all roles
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Roles listed
 *   post:
 *     tags: [RBAC]
 *     summary: Create new role
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Role created
 */
router.get("/roles", rbacController.listRoles);
router.post("/roles", rbacController.createRole);

/**
 * @openapi
 * /api/rbac/roles/{roleId}:
 *   get:
 *     tags: [RBAC]
 *     summary: Get role by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Role retrieved
 *   put:
 *     tags: [RBAC]
 *     summary: Update role
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Role updated
 *   delete:
 *     tags: [RBAC]
 *     summary: Delete role
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Role deleted
 */
router.get("/roles/:roleId", rbacController.getRole);
router.put("/roles/:roleId", rbacController.updateRole);
router.delete("/roles/:roleId", rbacController.deleteRole);

/**
 * @openapi
 * /api/rbac/users/{userId}/roles:
 *   get:
 *     tags: [RBAC]
 *     summary: Get user roles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: User roles retrieved
 *   post:
 *     tags: [RBAC]
 *     summary: Assign role to user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Role assigned
 */
router.get("/users/:userId/roles", rbacController.getUserRoles);
router.post("/users/:userId/roles", rbacController.assignRole);

/**
 * @openapi
 * /api/rbac/users/{userId}/roles/{roleId}:
 *   delete:
 *     tags: [RBAC]
 *     summary: Remove role from user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Role removed
 */
router.delete("/users/:userId/roles/:roleId", rbacController.removeRole);

/**
 * @openapi
 * /api/rbac/permissions:
 *   get:
 *     tags: [RBAC]
 *     summary: List all permissions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Permissions listed
 */
router.get("/permissions", rbacController.listPermissions);

/**
 * @openapi
 * /api/rbac/roles/{roleId}/permissions:
 *   put:
 *     tags: [RBAC]
 *     summary: Update role permissions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Permissions updated
 */
router.put("/roles/:roleId/permissions", rbacController.updateRolePermissions);

module.exports = router;
