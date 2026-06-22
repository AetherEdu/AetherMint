/**
 * @openapi
 * tags:
 *   - name: Tenant Analytics
 *     description: Per-tenant analytics and reporting
 */

const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const tenantAnalyticsController = require("../controllers/tenantAnalyticsController");

router.use(authenticate, authorize("admin"));

/**
 * @openapi
 * /api/tenant-analytics/{tenantId}/overview:
 *   get:
 *     tags: [Tenant Analytics]
 *     summary: Get analytics overview for tenant
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Overview retrieved
 */
router.get("/:tenantId/overview", tenantAnalyticsController.getTenantOverview);

/**
 * @openapi
 * /api/tenant-analytics/{tenantId}/users:
 *   get:
 *     tags: [Tenant Analytics]
 *     summary: Get user analytics for tenant
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: User analytics retrieved
 */
router.get("/:tenantId/users", tenantAnalyticsController.getTenantUserAnalytics);

/**
 * @openapi
 * /api/tenant-analytics/{tenantId}/revenue:
 *   get:
 *     tags: [Tenant Analytics]
 *     summary: Get revenue analytics for tenant
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Revenue analytics retrieved
 */
router.get("/:tenantId/revenue", tenantAnalyticsController.getTenantRevenueAnalytics);

/**
 * @openapi
 * /api/tenant-analytics/{tenantId}/export:
 *   post:
 *     tags: [Tenant Analytics]
 *     summary: Export analytics report for tenant
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Report exported
 */
router.post("/:tenantId/export", tenantAnalyticsController.exportTenantReport);

module.exports = router;
