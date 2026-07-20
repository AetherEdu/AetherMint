/**
 * @openapi
 * tags:
 *   - name: Federated Learning
 *     description: Federated learning model training and management
 */

const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const FederatedLearningController = require("../controllers/federatedLearningController");

// Instantiate the controller (it's a class with constructor dependencies)
const federatedLearningController = new FederatedLearningController();

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
router.post("/train", (req, res) => federatedLearningController.startRound(req, res));

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
router.post("/aggregate", (req, res) => federatedLearningController.submitModelUpdate(req, res));

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
router.get("/clients", (req, res) => federatedLearningController.getParticipants(req, res));

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
router.post("/clients/register", (req, res) => federatedLearningController.registerParticipant(req, res));

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
router.get("/models/:modelId", (req, res) => federatedLearningController.getSessionStatus(req, res));

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
router.get("/metrics/:sessionId", (req, res) => federatedLearningController.getAnalytics(req, res));

module.exports = router;
