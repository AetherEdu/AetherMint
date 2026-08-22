/**
 * @openapi
 * tags:
 *   - name: Tenants
 *     description: Multi-tenant management
 */

const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const tenantController = require("../controllers/tenantController");

router.use(authenticate, authorize("admin"));

/**
 * @openapi
 * /api/tenants:
 *   get:
 *     tags: [Tenants]
 *     summary: List all tenants
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Tenants listed
 *   post:
 *     tags: [Tenants]
 *     summary: Create new tenant
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Tenant created
 */
router.get("/", tenantController.listTenants);
router.post("/", tenantController.createTenant);

/**
 * @openapi
 * /api/tenants/{tenantId}:
 *   get:
 *     tags: [Tenants]
 *     summary: Get tenant details
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
 *         description: Tenant details retrieved
 *   put:
 *     tags: [Tenants]
 *     summary: Update tenant
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
 *         description: Tenant updated
 *   delete:
 *     tags: [Tenants]
 *     summary: Delete tenant
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
 *         description: Tenant deleted
 */
router.get("/:tenantId", tenantController.getTenant);
router.put("/:tenantId", tenantController.updateTenant);
router.delete("/:tenantId", tenantController.deleteTenant);

/**
 * @openapi
 * /api/tenants/{tenantId}/config:
 *   get:
 *     tags: [Tenants]
 *     summary: Get tenant configuration
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
 *         description: Configuration retrieved
 *   put:
 *     tags: [Tenants]
 *     summary: Update tenant configuration
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
 *         description: Configuration updated
 */
router.get("/:tenantId/config", tenantController.getTenantConfig);
router.put("/:tenantId/config", tenantController.updateTenantConfig);

module.exports = router;
