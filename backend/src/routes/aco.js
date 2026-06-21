/**
 * ACO Optimization API Routes
 * Provides REST endpoints for ant colony optimization functionality
 */

const express = require('express');
const router = express.Router();
const LearningPathOptimizer = require('../services/aco/LearningPathOptimizer');
const ResourceAllocationOptimizer = require('../services/aco/ResourceAllocationOptimizer');
const DynamicPathReplanner = require('../services/aco/DynamicPathReplanner');
const SwarmIntelligenceCoordinator = require('../services/aco/SwarmIntelligenceCoordinator');
const OptimizationAnalytics = require('../services/aco/OptimizationAnalytics');

// Initialize services
const learningOptimizer = new LearningPathOptimizer();
const resourceOptimizer = new ResourceAllocationOptimizer();
const pathReplanner = new DynamicPathReplanner();
const swarmCoordinator = new SwarmIntelligenceCoordinator();
const analytics = new OptimizationAnalytics();

// Middleware for request validation
const validateRequest = (req, res, next) => {
  try {
    // Basic validation
    if (!req.body && req.method !== 'GET') {
      return res.status(400).json({ error: 'Request body is required' });
    }
    next();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Learning Path Optimization Routes
 */

// Setup learning environment
router.post('/learning/setup', validateRequest, (req, res) => {
  try {
    const { courses, dependencies } = req.body;
    
    if (!courses || !Array.isArray(courses)) {
      return res.status(400).json({ error: 'Courses array is required' });
    }
    
    learningOptimizer.setupLearningEnvironment(courses, dependencies || {});
    
    res.json({ 
      success: true, 
      message: 'Learning environment setup successfully',
      coursesCount: courses.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Optimize learning path
router.post('/learning/optimize', validateRequest, (req, res) => {
  try {
    const { startCourse, endCourse, preferences } = req.body;
    
    if (!startCourse || !endCourse) {
      return res.status(400).json({ error: 'Start and end courses are required' });
    }
    
    learningOptimizer.setUserPreferences(preferences || {});
    const result = learningOptimizer.optimizeLearningPath(startCourse, endCourse);
    
    // Record analytics
    analytics.recordMetrics(`learning_${Date.now()}`, {
      type: 'learning_path',
      efficiency: result.efficiency,
      totalDistance: result.totalDistance,
      iterations: result.iterations,
      pathLength: result.path.length
    });
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get alternative learning paths
router.post('/learning/alternatives', validateRequest, (req, res) => {
  try {
    const { startCourse, endCourse, numAlternatives } = req.body;
    
    if (!startCourse || !endCourse) {
      return res.status(400).json({ error: 'Start and end courses are required' });
    }
    
    const alternatives = learningOptimizer.getAlternativePaths(
      startCourse, 
      endCourse, 
      numAlternatives || 3
    );
    
    res.json({
      success: true,
      alternatives
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get learning path analytics
router.post('/learning/analytics', validateRequest, (req, res) => {
  try {
    const { path } = req.body;
    
    if (!path || !Array.isArray(path)) {
      return res.status(400).json({ error: 'Path array is required' });
    }
    
    const analytics = learningOptimizer.getPathAnalytics(path);
    
    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Resource Allocation Optimization Routes
 */

// Setup resource environment
router.post('/resources/setup', validateRequest, (req, res) => {
  try {
    const { resources, demands, constraints, objectives } = req.body;
    
    if (!resources || !Array.isArray(resources)) {
      return res.status(400).json({ error: 'Resources array is required' });
    }
    
    resourceOptimizer.setupResources(resources);
    
    if (demands && Array.isArray(demands)) {
      resourceOptimizer.setupDemands(demands);
    }
    
    if (constraints && Array.isArray(constraints)) {
      resourceOptimizer.setupConstraints(constraints);
    }
    
    if (objectives && Array.isArray(objectives)) {
      resourceOptimizer.setObjectives(objectives);
    }
    
    res.json({ 
      success: true, 
      message: 'Resource environment setup successfully',
      resourcesCount: resources.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Optimize resource allocation
router.post('/resources/optimize', validateRequest, (req, res) => {
  try {
    const result = resourceOptimizer.optimizeAllocation();
    
    // Record analytics
    analytics.recordMetrics(`resource_${Date.now()}`, {
      type: 'resource_allocation',
      efficiency: result.utilization,
      utilization: result.utilization,
      satisfaction: result.satisfaction,
      cost: result.totalCost,
      score: result.score
    });
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get resource allocation analytics
router.get('/resources/analytics/:allocationId', (req, res) => {
  try {
    const { allocationId } = req.params;
    
    // This would typically fetch allocation from database
    // For now, return a placeholder
    res.json({
      success: true,
      allocationId,
      message: 'Analytics endpoint - requires database integration'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Dynamic Path Replanning Routes
 */

// Initialize user path
router.post('/replanning/initialize', validateRequest, (req, res) => {
  try {
    const { userId, startCourse, endCourse, preferences } = req.body;
    
    if (!userId || !startCourse || !endCourse) {
      return res.status(400).json({ error: 'UserId, startCourse, and endCourse are required' });
    }
    
    const path = pathReplanner.initializePath(userId, startCourse, endCourse, preferences);
    
    res.json({
      success: true,
      path
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Record change event
router.post('/replanning/events', validateRequest, (req, res) => {
  try {
    const event = req.body;
    
    if (!event.type || !event.data) {
      return res.status(400).json({ error: 'Event type and data are required' });
    }
    
    const eventId = pathReplanner.recordChangeEvent(event);
    
    res.json({
      success: true,
      eventId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current user path
router.get('/replanning/path/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const path = pathReplanner.getCurrentPath(userId);
    
    if (!path) {
      return res.status(404).json({ error: 'Path not found for user' });
    }
    
    res.json({
      success: true,
      path
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user path analytics
router.get('/replanning/analytics/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const analytics = pathReplanner.getPathAnalytics(userId);
    
    if (!analytics) {
      return res.status(404).json({ error: 'Analytics not found for user' });
    }
    
    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get system statistics
router.get('/replanning/statistics', (req, res) => {
  try {
    const stats = pathReplanner.getSystemStatistics();
    
    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Swarm Intelligence Routes
 */

// Add agent to swarm
router.post('/swarm/agents', validateRequest, (req, res) => {
  try {
    const { agentId, agent, specialization } = req.body;
    
    if (!agentId || !agent) {
      return res.status(400).json({ error: 'AgentId and agent are required' });
    }
    
    const agentInfo = swarmCoordinator.addAgent(agentId, agent, specialization);
    
    res.json({
      success: true,
      agent: agentInfo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Execute swarm iteration
router.post('/swarm/execute', validateRequest, (req, res) => {
  try {
    const { problemContext } = req.body;
    
    if (!problemContext) {
      return res.status(400).json({ error: 'Problem context is required' });
    }
    
    // Execute iteration asynchronously
    swarmCoordinator.executeIteration(problemContext).then(result => {
      // Record analytics
      analytics.recordMetrics(`swarm_${Date.now()}`, {
        type: 'swarm_intelligence',
        efficiency: result.globalBest?.fitness || 0,
        iterations: result.iteration,
        convergence: result.convergence ? 1 : 0
      });
    }).catch(error => {
      console.error('Swarm execution error:', error);
    });
    
    res.json({
      success: true,
      message: 'Swarm iteration started'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get swarm statistics
router.get('/swarm/statistics', (req, res) => {
  try {
    const stats = swarmCoordinator.getSwarmStatistics();
    
    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Analytics and Visualization Routes
 */

// Get performance visualization data
router.get('/analytics/visualization/:optimizationId', (req, res) => {
  try {
    const { optimizationId } = req.params;
    const { timeRange } = req.query;
    
    const visualization = analytics.getPerformanceVisualization(
      optimizationId, 
      timeRange ? parseInt(timeRange) : null
    );
    
    res.json({
      success: true,
      visualization
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate comparative analysis
router.post('/analytics/comparison', validateRequest, (req, res) => {
  try {
    const { optimizationIds } = req.body;
    
    if (!optimizationIds || !Array.isArray(optimizationIds)) {
      return res.status(400).json({ error: 'Optimization IDs array is required' });
    }
    
    const comparison = analytics.generateComparativeAnalysis(optimizationIds);
    
    res.json({
      success: true,
      comparison
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get dashboard data
router.get('/analytics/dashboard', (req, res) => {
  try {
    const dashboard = analytics.getDashboardData();
    
    res.json({
      success: true,
      dashboard
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export analytics data
router.get('/analytics/export', (req, res) => {
  try {
    const { format } = req.query;
    const data = analytics.exportData(format || 'json');
    
    const contentType = format === 'csv' ? 'text/csv' : 'application/json';
    const filename = `analytics_${Date.now()}.${format || 'json'}`;
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * System Management Routes
 */

// Get system health
router.get('/health', (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        learningOptimizer: 'active',
        resourceOptimizer: 'active',
        pathReplanner: 'active',
        swarmCoordinator: 'active',
        analytics: 'active'
      },
      metrics: {
        totalOptimizations: analytics.metrics.size,
        activeOptimizations: analytics.realTimeMetrics.size,
        swarmAgents: swarmCoordinator.agents.size
      }
    };
    
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get system configuration
router.get('/config', (req, res) => {
  try {
    const config = {
      learningOptimizer: {
        numAnts: learningOptimizer.aco.numAnts,
        numIterations: learningOptimizer.aco.numIterations,
        alpha: learningOptimizer.aco.alpha,
        beta: learningOptimizer.aco.beta,
        rho: learningOptimizer.aco.rho
      },
      resourceOptimizer: {
        numAnts: resourceOptimizer.aco.numAnts,
        numIterations: resourceOptimizer.aco.numIterations,
        alpha: resourceOptimizer.aco.alpha,
        beta: resourceOptimizer.aco.beta,
        rho: resourceOptimizer.aco.rho
      },
      pathReplanner: {
        thresholds: pathReplanner.replanThresholds
      },
      swarmCoordinator: {
        populationSize: swarmCoordinator.config.populationSize,
        communicationRadius: swarmCoordinator.config.communicationRadius,
        knowledgeSharingRate: swarmCoordinator.config.knowledgeSharingRate,
        collaborationMode: swarmCoordinator.config.collaborationMode
      },
      analytics: {
        alertThresholds: analytics.alertThresholds
      }
    };
    
    res.json({
      success: true,
      config
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update system configuration
router.put('/config', validateRequest, (req, res) => {
  try {
    const { service, config } = req.body;
    
    if (!service || !config) {
      return res.status(400).json({ error: 'Service and config are required' });
    }
    
    switch (service) {
      case 'pathReplanner':
        pathReplanner.setReplanThresholds(config.thresholds);
        break;
      case 'swarmCoordinator':
        swarmCoordinator.updateConfig(config);
        break;
      case 'analytics':
        analytics.setAlertThresholds(config.alertThresholds);
        break;
      default:
        return res.status(400).json({ error: 'Unknown service' });
    }
    
    res.json({
      success: true,
      message: `${service} configuration updated successfully`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('ACO API Error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

module.exports = router;
