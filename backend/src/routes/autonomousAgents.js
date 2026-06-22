/**
 * @openapi
 * tags:
 *   - name: Autonomous Agents
 *     description: Multi-agent system for task automation
 */

const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const autonomousAgentsController = require("../controllers/autonomousAgentsController");

router.use(authenticate);

/**
 * @openapi
 * /api/autonomous-agents/execute:
 *   post:
 *     tags: [Autonomous Agents]
 *     summary: Execute autonomous agent task
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Task executed
 */
router.post("/execute", autonomousAgentsController.execute);

/**
 * @openapi
 * /api/autonomous-agents/status/{taskId}:
 *   get:
 *     tags: [Autonomous Agents]
 *     summary: Get autonomous task status
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
 *         description: Task status retrieved
 */
router.get("/status/:taskId", autonomousAgentsController.getStatus);

/**
 * @openapi
 * /api/autonomous-agents/agents:
 *   get:
 *     tags: [Autonomous Agents]
 *     summary: List available agents
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Agents listed
 */
router.get("/agents", autonomousAgentsController.getAgents);

/**
 * @openapi
 * /api/autonomous-agents/agents/register:
 *   post:
 *     tags: [Autonomous Agents]
 *     summary: Register new agent
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Agent registered
 */
router.post("/agents/register", autonomousAgentsController.registerAgent);

/**
 * @openapi
 * /api/autonomous-agents/agents/{agentId}:
 *   get:
 *     tags: [Autonomous Agents]
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
 *   put:
 *     tags: [Autonomous Agents]
 *     summary: Update agent configuration
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
 *         description: Agent updated
 *   delete:
 *     tags: [Autonomous Agents]
 *     summary: Delete agent
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
 *         description: Agent deleted
 */
router.get("/agents/:agentId", autonomousAgentsController.getAgentById);
router.put("/agents/:agentId", autonomousAgentsController.updateAgent);
router.delete("/agents/:agentId", autonomousAgentsController.deleteAgent);

module.exports = router;
