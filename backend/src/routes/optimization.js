const express = require('express');
const router = express.Router();
const OptimizationController = require('../controllers/optimizationController');

// Initialize optimization controller
const optimizationController = new OptimizationController();

// Initialize optimization services
router.post('/initialize', async (req, res) => {
  await optimizationController.initialize(req, res);
});

// Learning Path Optimization
router.post('/learning-paths/optimize', async (req, res) => {
  await optimizationController.optimizeLearningPath(req, res);
});

// Resource Allocation Optimization
router.post('/resources/optimize', async (req, res) => {
  await optimizationController.optimizeResourceAllocation(req, res);
});

// Dynamic Replanning
router.post('/replanning/register', async (req, res) => {
  await optimizationController.registerPath(req, res);
});

router.post('/replanning/update-environment', async (req, res) => {
  await optimizationController.updateEnvironmentState(req, res);
});

// Swarm Coordination
router.post('/swarm/initialize', async (req, res) => {
  await optimizationController.initializeSwarm(req, res);
});

// Analytics and Visualization
router.get('/analytics', async (req, res) => {
  await optimizationController.getAnalytics(req, res);
});

router.get('/visualizations/:vizId', async (req, res) => {
  await optimizationController.getVisualization(req, res);
});

router.get('/visualizations', async (req, res) => {
  await optimizationController.getAllVisualizations(req, res);
});

router.get('/realtime', async (req, res) => {
  await optimizationController.getRealTimeData(req, res);
});

// Session Management
router.get('/sessions/:sessionId', async (req, res) => {
  await optimizationController.getSessionStatus(req, res);
});

// Data Export
router.get('/export', async (req, res) => {
  await optimizationController.exportData(req, res);
});

// Health Check
router.get('/health', async (req, res) => {
  await optimizationController.healthCheck(req, res);
});

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Optimization API error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
    timestamp: new Date()
  });
});

module.exports = router;
