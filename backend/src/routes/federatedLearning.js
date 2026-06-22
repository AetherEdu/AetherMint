/**
 * @openapi
 * tags:
 *   - name: Federated Learning
 *     description: Federated learning model training and management
 */

const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const federatedLearningController = require("../controllers/federatedLearningController");

router.use(authenticate, authorize("admin"));

/**
 * @openapi
 * /api/federated-learning/train:
 *   post:
 *     tags: [Federated Learning]
 *     summary: Start federated training session
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Training session started
 */
router.post("/train", federatedLearningController.startTraining);

/**
 * @openapi
 * /api/federated-learning/aggregate:
 *   post:
 *     tags: [Federated Learning]
 *     summary: Aggregate model updates
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Model aggregated
 */
router.post("/aggregate", federatedLearningController.aggregateUpdates);

/**
 * @openapi
 * /api/federated-learning/clients:
 *   get:
 *     tags: [Federated Learning]
 *     summary: List federated clients
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Clients listed
 */
router.get("/clients", federatedLearningController.listClients);

/**
 * @openapi
 * /api/federated-learning/clients/register:
 *   post:
 *     tags: [Federated Learning]
 *     summary: Register federated client
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Client registered
 */
router.post("/clients/register", federatedLearningController.registerClient);

/**
 * @openapi
 * /api/federated-learning/models/{modelId}:
 *   get:
 *     tags: [Federated Learning]
 *     summary: Get model details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Model details retrieved
 */
router.get("/models/:modelId", federatedLearningController.getModel);

/**
 * @openapi
 * /api/federated-learning/metrics/{sessionId}:
 *   get:
 *     tags: [Federated Learning]
 *     summary: Get training metrics for session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Metrics retrieved
 */
router.get("/metrics/:sessionId", federatedLearningController.getTrainingMetrics);

module.exports = router;
