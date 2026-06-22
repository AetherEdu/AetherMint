/**
 * @openapi
 * tags:
 *   - name: Federated Learning Routes
 *     description: Federated learning routing and orchestration
 */

const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const federatedLearningRoutesController = require("../controllers/federatedLearningRoutesController");

router.use(authenticate, authorize("admin"));

/**
 * @openapi
 * /api/federated-learning-routes:
 *   get:
 *     tags: [Federated Learning Routes]
 *     summary: List federated learning routes
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Routes listed
 */
router.get("/", federatedLearningRoutesController.listRoutes);

/**
 * @openapi
 * /api/federated-learning-routes/{routeId}:
 *   get:
 *     tags: [Federated Learning Routes]
 *     summary: Get route details
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
 *     tags: [Federated Learning Routes]
 *     summary: Update route configuration
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
 *     tags: [Federated Learning Routes]
 *     summary: Delete route
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
router.get("/:routeId", federatedLearningRoutesController.getRoute);
router.put("/:routeId", federatedLearningRoutesController.updateRoute);
router.delete("/:routeId", federatedLearningRoutesController.deleteRoute);

module.exports = router;
