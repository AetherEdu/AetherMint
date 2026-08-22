/**
 * @openapi
 * tags:
 *   - name: Admin
 *     description: Administrative operations
 */

const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const adminController = require("../controllers/adminController");

router.use(authenticate, authorize("admin"));

/**
 * @openapi
 * /api/admin/users/{userId}:
 *   get:
 *     tags: [Admin]
 *     summary: Get user details (admin)
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
 *         description: User details retrieved
 */
router.get("/users/:userId", adminController.getUser);

/**
 * @openapi
 * /api/admin/users/{userId}:
 *   put:
 *     tags: [Admin]
 *     summary: Update user (admin)
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
 *         description: User updated
 */
router.put("/users/:userId", adminController.updateUser);

/**
 * @openapi
 * /api/admin/users/{userId}:
 *   delete:
 *     tags: [Admin]
 *     summary: Delete user (admin)
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
 *         description: User deleted
 */
router.delete("/users/:userId", adminController.deleteUser);

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List all users (admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Users listed
 */
router.get("/users", adminController.listUsers);

/**
 * @openapi
 * /api/admin/system/health:
 *   get:
 *     tags: [Admin]
 *     summary: Get system health status (admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Health status retrieved
 */
router.get("/system/health", adminController.getSystemHealth);

/**
 * @openapi
 * /api/admin/system/metrics:
 *   get:
 *     tags: [Admin]
 *     summary: Get system metrics (admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Metrics retrieved
 */
router.get("/system/metrics", adminController.getSystemMetrics);

/**
 * @openapi
 * /api/admin/system/logs:
 *   get:
 *     tags: [Admin]
 *     summary: Get system logs (admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Logs retrieved
 */
router.get("/system/logs", adminController.getSystemLogs);

/**
 * @openapi
 * /api/admin/backup:
 *   post:
 *     tags: [Admin]
 *     summary: Create system backup (admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Backup created
 */
router.post("/backup", adminController.createBackup);

/**
 * @openapi
 * /api/admin/restore:
 *   post:
 *     tags: [Admin]
 *     summary: Restore system backup (admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Backup restored
 */
router.post("/restore", adminController.restoreBackup);

/**
 * @openapi
 * /api/admin/audit-logs:
 *   get:
 *     tags: [Admin]
 *     summary: Get audit logs (admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Audit logs retrieved
 */
router.get("/audit-logs", adminController.getAuditLogs);

/**
 * @openapi
 * /api/admin/maintenance:
 *   post:
 *     tags: [Admin]
 *     summary: Trigger maintenance tasks (admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Maintenance triggered
 */
router.post("/maintenance", adminController.triggerMaintenance);

module.exports = router;
