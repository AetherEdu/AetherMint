const express = require('express');
const router = express.Router();
const AutonomousAgentController = require('../services/autonomousAgents/AutonomousAgentController');
const logger = require('../../utils/logger');

// Initialize controller
let agentController;

try {
  agentController = new AutonomousAgentController({
    enableCustomerService: true,
    enablePerformanceOptimization: true,
    enableSecurityMonitoring: true,
    enableSelfHealing: true,
    humanOversightEnabled: true
  });
  logger.info('Autonomous agent controller initialized');
} catch (error) {
  logger.error('Failed to initialize autonomous agent controller:', error);
}

/**
 * @route GET /api/autonomous-agents/status
 * @desc Get overall system status and metrics
 */
router.get('/status', async (req, res) => {
  try {
    const report = agentController.getSystemReport();
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error('Error getting system status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/autonomous-agents/support/ticket
 * @desc Submit support ticket for autonomous handling
 */
router.post('/support/ticket', async (req, res) => {
  try {
    const { userId, title, description, priority, category } = req.body;

    if (!userId || !title || !description) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, title, description'
      });
    }

    const ticket = {
      id: `ticket_${Date.now()}`,
      userId,
      title,
      description,
      priority: priority || 'normal',
      category: category || 'general',
      createdAt: new Date(),
      status: 'open'
    };

    const result = await agentController.handleSupportTicket(ticket);

    res.status(result.resolved ? 200 : 202).json({
      success: true,
      data: {
        ticketId: ticket.id,
        resolved: result.resolved,
        action: result.action,
        requiresHumanAgent: result.requiresHumanAgent,
        resolutionTime: result.resolutionTime
      }
    });
  } catch (error) {
    logger.error('Error handling support ticket:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/autonomous-agents/performance/optimize
 * @desc Trigger performance optimization
 */
router.post('/performance/optimize', async (req, res) => {
  try {
    const result = await agentController.optimizePerformance();

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error optimizing performance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/autonomous-agents/security/status
 * @desc Get current security posture
 */
router.get('/security/status', async (req, res) => {
  try {
    const status = await agentController.checkSecurityStatus();

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Error getting security status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route PUT /api/autonomous-agents/oversight
 * @desc Enable/disable human oversight
 */
router.put('/oversight', async (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enabled must be a boolean'
      });
    }

    agentController.setHumanOversight(enabled);

    res.json({
      success: true,
      message: `Human oversight ${enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    logger.error('Error toggling human oversight:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/autonomous-agents/metrics
 * @desc Get detailed performance metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const report = agentController.getSystemReport();
    
    res.json({
      success: true,
      data: {
        systemMetrics: report.systemMetrics,
        autonomyRate: report.autonomyRate,
        targetAchieved: parseFloat(report.autonomyRate) >= 80,
        agents: report.agents
      }
    });
  } catch (error) {
    logger.error('Error getting metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/autonomous-agents/agents/:type
 * @desc Get specific agent status and metrics
 */
router.get('/agents/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const report = agentController.getSystemReport();
    
    const agentReport = report.agents[type];
    
    if (!agentReport) {
      return res.status(404).json({
        success: false,
        error: `Agent type ${type} not found`
      });
    }

    res.json({
      success: true,
      data: agentReport
    });
  } catch (error) {
    logger.error('Error getting agent status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
