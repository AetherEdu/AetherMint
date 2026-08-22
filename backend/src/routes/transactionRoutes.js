/**
 * @openapi
 * tags:
 *   - name: Transaction Routes
 *     description: API transaction routing and management
 */

const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const transactionRoutesController = require("../controllers/transactionRoutesController");

router.use(authenticate);

/**
 * @openapi
 * /api/transaction-routes:
 *   get:
 *     tags: [Transaction Routes]
 *     summary: List all transaction routes
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Routes listed
 */
router.get("/", transactionRoutesController.listRoutes);

/**
 * @openapi
 * /api/transaction-routes/{routeId}:
 *   get:
 *     tags: [Transaction Routes]
 *     summary: Get transaction route details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: routeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Route details retrieved
 *   put:
 *     tags: [Transaction Routes]
 *     summary: Update transaction route
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: routeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Route updated
 *   delete:
 *     tags: [Transaction Routes]
 *     summary: Delete transaction route
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: routeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Route deleted
 */
router.get("/:routeId", transactionRoutesController.getRoute);
router.put("/:routeId", transactionRoutesController.updateRoute);
router.delete("/:routeId", transactionRoutesController.deleteRoute);

/**
 * @openapi
 * /api/transaction-routes/stats:
 *   get:
 *     tags: [Transaction Routes]
 *     summary: Get route usage statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Statistics retrieved
 */
router.get("/stats", transactionRoutesController.getRouteStats);

module.exports = router;
