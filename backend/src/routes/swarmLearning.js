/**
 * @openapi
 * tags:
 *   - name: Swarm Learning
 *     description: Swarm intelligence based learning system
 */

const express = require('express');
const router = express.Router();
const SwarmLearningController = require('../controllers/swarmLearningController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Initialize controller
const swarmController = new SwarmLearningController();

// Rate limiting for sensitive operations
const sensitiveOperationLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many requests, please try again later'
  }
});

const agentOperationLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: {
    error: 'Too many agent operations, please try again later'
  }
});

/**
 * @openapi
 * /api/swarm-learning/initialize:
 *   post:
 *     tags: [Swarm Learning]
 *     summary: Initialize swarm learning system
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: System initialized
 */
router.post('/initialize', authenticateToken, requireAdmin, sensitiveOperationLimit, async (req, res) => {
  await swarmController.initialize(req, res);
});

/**
 * @openapi
 * /api/swarm-learning/shutdown:
 *   post:
 *     tags: [Swarm Learning]
 *     summary: Shutdown swarm learning system
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: System shut down
 */
router.post('/shutdown', authenticateToken, requireAdmin, sensitiveOperationLimit, async (req, res) => {
  await swarmController.shutdown(req, res);
});

/**
 * @openapi
 * /api/swarm-learning/swarms:
 *   post:
 *     tags: [Swarm Learning]
 *     summary: Create a new swarm
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Swarm created
 */
router.post('/swarms', authenticateToken, async (req, res) => {
  await swarmController.createSwarm(req, res);
});

/**
 * @openapi
 * /api/swarm-learning/swarms/{taskId}/start:
 *   post:
 *     tags: [Swarm Learning]
 *     summary: Start swarm learning task
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Swarm learning started
 */
router.post('/swarms/:taskId/start', authenticateToken, async (req, res) => {
  await swarmController.startSwarmLearning(req, res);
});

/**
 * @openapi
 * /api/swarm-learning/swarms/status:
 *   get:
 *     tags: [Swarm Learning]
 *     summary: Get swarm status
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Swarm status retrieved
 */
router.get('/swarms/status', authenticateToken, async (req, res) => {
  await swarmController.getSwarmStatus(req, res);
});

/**
 * @openapi
 * /api/swarm-learning/agents:
 *   post:
 *     tags: [Swarm Learning]
 *     summary: Register new agent
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Agent registered
 */
router.post('/agents', authenticateToken, agentOperationLimit, async (req, res) => {
  await swarmController.registerAgent(req, res);
});

/**
 * @openapi
 * /api/swarm-learning/agents/{agentId}:
 *   get:
 *     tags: [Swarm Learning]
 *     summary: Get agent details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Agent details retrieved
 */
router.get('/agents/:agentId', authenticateToken, async (req, res) => {
  await swarmController.getAgentDetails(req, res);
});

/**
 * @openapi
 * /api/swarm-learning/tasks/{taskId}:
 *   get:
 *     tags: [Swarm Learning]
 *     summary: Get task details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Task details retrieved
 */
router.get('/tasks/:taskId', authenticateToken, async (req, res) => {
  await swarmController.getTaskDetails(req, res);
});

/**
 * @openapi
 * /api/swarm-learning/behaviors:
 *   get:
 *     tags: [Swarm Learning]
 *     summary: Get swarm behaviors
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Behaviors retrieved
 */
router.get('/behaviors', authenticateToken, async (req, res) => {
  await swarmController.getBehaviors(req, res);
});

/**
 * @openapi
 * /api/swarm-learning/analytics:
 *   get:
 *     tags: [Swarm Learning]
 *     summary: Get analytics data
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Analytics retrieved
 */
router.get('/analytics', authenticateToken, async (req, res) => {
  await swarmController.getAnalytics(req, res);
});

/**
 * @openapi
 * /api/swarm-learning/analytics/report:
 *   get:
 *     tags: [Swarm Learning]
 *     summary: Generate analytics report
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Report generated
 */
router.get('/analytics/report', authenticateToken, async (req, res) => {
  await swarmController.getAnalyticsReport(req, res);
});

/**
 * @openapi
 * /api/swarm-learning/analytics/export:
 *   get:
 *     tags: [Swarm Learning]
 *     summary: Export analytics data
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Data exported
 */
router.get('/analytics/export', authenticateToken, async (req, res) => {
  await swarmController.exportAnalytics(req, res);
});

/**
 * @openapi
 * /api/swarm-learning/alerts:
 *   get:
 *     tags: [Swarm Learning]
 *     summary: Get swarm alerts
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Alerts retrieved
 */
router.get('/alerts', authenticateToken, async (req, res) => {
  await swarmController.getAlerts(req, res);
});

/**
 * @openapi
 * /api/swarm-learning/alerts/{alertId}/acknowledge:
 *   post:
 *     tags: [Swarm Learning]
 *     summary: Acknowledge alert
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Alert acknowledged
 */
router.post('/alerts/:alertId/acknowledge', authenticateToken, async (req, res) => {
  await swarmController.acknowledgeAlert(req, res);
});

/**
 * @openapi
 * /api/swarm-learning/configuration:
 *   put:
 *     tags: [Swarm Learning]
 *     summary: Update swarm configuration
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Configuration updated
 */
router.put('/configuration', authenticateToken, requireAdmin, sensitiveOperationLimit, async (req, res) => {
  await swarmController.updateConfiguration(req, res);
});

/**
 * @openapi
 * /api/swarm-learning/health:
 *   get:
 *     tags: [Swarm Learning]
 *     summary: Health check
 *     responses:
 *       '200':
 *         description: Health status
 */
router.get('/health', async (req, res) => {
  await swarmController.healthCheck(req, res);
});

module.exports = router;
