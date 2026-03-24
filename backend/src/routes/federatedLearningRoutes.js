const express = require('express');
const router = express.Router();
const FederatedLearningCoordinator = require('../services/federatedLearningCoordinator');
const PrivacyPreservingAggregator = require('../services/privacyPreservingAggregator');
const SecureMultiPartyComputation = require('../services/secureMultiPartyComputation');
const DifferentialPrivacyService = require('../services/differentialPrivacyService');
const ModelValidationService = require('../services/modelValidationService');
const FederatedLearningAnalytics = require('../services/federatedLearningAnalytics');

// Initialize services
const flCoordinator = new FederatedLearningCoordinator({
  minParticipants: 3,
  maxParticipants: 100,
  aggregationStrategy: 'fedavg',
  privacyBudget: 1.0,
  differentialPrivacy: true,
  secureAggregation: true
});

const privacyAggregator = new PrivacyPreservingAggregator({
  encryptionScheme: 'paillier',
  differentialPrivacy: true,
  epsilon: 1.0,
  delta: 1e-5,
  secureAggregation: true,
  homomorphicEncryption: true
});

const mpcService = new SecureMultiPartyComputation({
  thresholdScheme: 'shamir',
  threshold: 3,
  maxParticipants: 10
});

const dpService = new DifferentialPrivacyService({
  epsilon: 1.0,
  delta: 1e-5,
  sensitivity: 1.0,
  mechanism: 'gaussian',
  privacyBudget: 10.0
});

const validationService = new ModelValidationService({
  validationMetrics: ['accuracy', 'precision', 'recall', 'f1'],
  fairnessMetrics: ['demographic_parity', 'equalized_odds', 'equal_opportunity'],
  accuracyThreshold: 0.7,
  fairnessThreshold: 0.8,
  stabilityThreshold: 0.9
});

const analyticsService = new FederatedLearningAnalytics({
  updateInterval: 5000,
  retentionPeriod: 24 * 60 * 60 * 1000,
  maxDataPoints: 1000
});

// Middleware for request validation
const validateRequest = (req, res, next) => {
  try {
    // Basic validation
    if (!req.body && req.method !== 'GET') {
      return res.status(400).json({
        success: false,
        message: 'Request body is required'
      });
    }
    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Invalid request format',
      error: error.message
    });
  }
};

// Initialize federated learning system
router.post('/initialize', async (req, res) => {
  try {
    const { modelArchitecture } = req.body;
    
    if (!modelArchitecture) {
      return res.status(400).json({
        success: false,
        message: 'Model architecture is required'
      });
    }

    await flCoordinator.initialize(modelArchitecture);
    
    // Start analytics monitoring
    analyticsService.startMonitoring();

    res.json({
      success: true,
      message: 'Federated learning system initialized successfully',
      data: {
        coordinator: flCoordinator.getStatus(),
        privacy: privacyAggregator.getPrivacyBudgetStatus(),
        analytics: analyticsService.getMonitoringStatus()
      }
    });
  } catch (error) {
    console.error('❌ Failed to initialize FL system:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize federated learning system',
      error: error.message
    });
  }
});

// Register participant institution
router.post('/participants/register', validateRequest, async (req, res) => {
  try {
    const { institutionId, publicKey, metadata } = req.body;
    
    if (!institutionId || !publicKey) {
      return res.status(400).json({
        success: false,
        message: 'Institution ID and public key are required'
      });
    }

    const participant = flCoordinator.registerParticipant(institutionId, publicKey, metadata);
    
    res.json({
      success: true,
      message: 'Participant registered successfully',
      data: participant
    });
  } catch (error) {
    console.error('❌ Failed to register participant:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register participant',
      error: error.message
    });
  }
});

// Get all participants
router.get('/participants', (req, res) => {
  try {
    const participants = Array.from(flCoordinator.participants.values());
    
    res.json({
      success: true,
      data: participants,
      count: participants.length
    });
  } catch (error) {
    console.error('❌ Failed to get participants:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve participants',
      error: error.message
    });
  }
});

// Start new federated learning round
router.post('/rounds/start', validateRequest, async (req, res) => {
  try {
    const roundConfig = req.body;
    
    const round = await flCoordinator.startRound(roundConfig);
    
    res.json({
      success: true,
      message: 'Federated learning round started successfully',
      data: round
    });
  } catch (error) {
    console.error('❌ Failed to start round:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start federated learning round',
      error: error.message
    });
  }
});

// Submit model update from participant
router.post('/rounds/:roundId/updates', validateRequest, async (req, res) => {
  try {
    const { roundId } = req.params;
    const { participantId, modelUpdate, signature } = req.body;
    
    if (!participantId || !modelUpdate || !signature) {
      return res.status(400).json({
        success: false,
        message: 'Participant ID, model update, and signature are required'
      });
    }

    const result = await flCoordinator.receiveModelUpdate(participantId, modelUpdate, signature);
    
    res.json({
      success: true,
      message: 'Model update received successfully',
      data: { result }
    });
  } catch (error) {
    console.error('❌ Failed to receive model update:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to receive model update',
      error: error.message
    });
  }
});

// Get current round status
router.get('/rounds/current', (req, res) => {
  try {
    const status = flCoordinator.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('❌ Failed to get round status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve round status',
      error: error.message
    });
  }
});

// Get global model
router.get('/model', (req, res) => {
  try {
    const model = flCoordinator.getGlobalModel();
    
    res.json({
      success: true,
      data: model
    });
  } catch (error) {
    console.error('❌ Failed to get global model:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve global model',
      error: error.message
    });
  }
});

// Privacy-preserving aggregation
router.post('/aggregate', validateRequest, async (req, res) => {
  try {
    const { updates, aggregationMethod } = req.body;
    
    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        message: 'Updates array is required'
      });
    }

    const result = await privacyAggregator.aggregateModelUpdates(updates, aggregationMethod);
    
    // Validate privacy guarantees
    const privacyValid = privacyAggregator.validatePrivacyGuarantees(result);
    
    res.json({
      success: true,
      message: 'Privacy-preserving aggregation completed',
      data: {
        aggregation: result,
        privacyValid
      }
    });
  } catch (error) {
    console.error('❌ Failed to aggregate models:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform privacy-preserving aggregation',
      error: error.message
    });
  }
});

// Secure multi-party computation
router.post('/mpc/initialize', validateRequest, async (req, res) => {
  try {
    const { participantIds, computationType } = req.body;
    
    if (!participantIds || !Array.isArray(participantIds)) {
      return res.status(400).json({
        success: false,
        message: 'Participant IDs array is required'
      });
    }

    const computation = await mpcService.initializeComputation(participantIds, computationType);
    
    res.json({
      success: true,
      message: 'Secure computation initialized',
      data: computation
    });
  } catch (error) {
    console.error('❌ Failed to initialize MPC:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize secure multi-party computation',
      error: error.message
    });
  }
});

// Distribute shares in MPC
router.post('/mpc/:computationId/distribute-shares', validateRequest, async (req, res) => {
  try {
    const { computationId } = req.params;
    const { values } = req.body;
    
    if (!values || !Array.isArray(values)) {
      return res.status(400).json({
        success: false,
        message: 'Values array is required'
      });
    }

    const shares = await mpcService.distributeShares(computationId, values);
    
    res.json({
      success: true,
      message: 'Shares distributed successfully',
      data: shares
    });
  } catch (error) {
    console.error('❌ Failed to distribute shares:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to distribute shares',
      error: error.message
    });
  }
});

// Collect shares in MPC
router.post('/mpc/:computationId/collect-shares', validateRequest, async (req, res) => {
  try {
    const { computationId } = req.params;
    const { participantId, shares } = req.body;
    
    if (!participantId || !shares) {
      return res.status(400).json({
        success: false,
        message: 'Participant ID and shares are required'
      });
    }

    const result = await mpcService.collectShares(computationId, participantId, shares);
    
    res.json({
      success: true,
      message: result ? 'Computation completed' : 'Shares collected, waiting for more participants',
      data: { result, completed: result !== null }
    });
  } catch (error) {
    console.error('❌ Failed to collect shares:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to collect shares',
      error: error.message
    });
  }
});

// Apply differential privacy
router.post('/privacy/apply', validateRequest, async (req, res) => {
  try {
    const { value, queryType, epsilon } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Value is required'
      });
    }

    const result = dpService.applyDifferentialPrivacy(value, queryType, epsilon);
    
    res.json({
      success: true,
      message: 'Differential privacy applied successfully',
      data: result
    });
  } catch (error) {
    console.error('❌ Failed to apply differential privacy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply differential privacy',
      error: error.message
    });
  }
});

// Get privacy budget status
router.get('/privacy/budget', (req, res) => {
  try {
    const budget = dpService.getPrivacyBudgetStatus();
    
    res.json({
      success: true,
      data: budget
    });
  } catch (error) {
    console.error('❌ Failed to get privacy budget:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve privacy budget status',
      error: error.message
    });
  }
});

// Update privacy parameters
router.put('/privacy/parameters', validateRequest, async (req, res) => {
  try {
    const params = req.body;
    
    dpService.updatePrivacyParameters(params);
    
    res.json({
      success: true,
      message: 'Privacy parameters updated successfully',
      data: dpService.getPrivacyBudgetStatus()
    });
  } catch (error) {
    console.error('❌ Failed to update privacy parameters:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update privacy parameters',
      error: error.message
    });
  }
});

// Validate model
router.post('/validation/validate', validateRequest, async (req, res) => {
  try {
    const { model, testData, sensitiveAttributes } = req.body;
    
    if (!model || !testData) {
      return res.status(400).json({
        success: false,
        message: 'Model and test data are required'
      });
    }

    const results = await validationService.validateModel(model, testData, sensitiveAttributes);
    
    res.json({
      success: true,
      message: 'Model validation completed',
      data: results
    });
  } catch (error) {
    console.error('❌ Failed to validate model:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate model',
      error: error.message
    });
  }
});

// Generate fairness report
router.post('/validation/fairness-report', validateRequest, async (req, res) => {
  try {
    const { validationResults } = req.body;
    
    if (!validationResults) {
      return res.status(400).json({
        success: false,
        message: 'Validation results are required'
      });
    }

    const report = validationService.generateFairnessReport(validationResults);
    
    res.json({
      success: true,
      message: 'Fairness report generated successfully',
      data: report
    });
  } catch (error) {
    console.error('❌ Failed to generate fairness report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate fairness report',
      error: error.message
    });
  }
});

// Get validation history
router.get('/validation/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = validationService.getValidationHistory(limit);
    
    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    console.error('❌ Failed to get validation history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve validation history',
      error: error.message
    });
  }
});

// Analytics dashboard data
router.get('/analytics/dashboard', (req, res) => {
  try {
    const timeRange = req.query.timeRange || '1h';
    const dashboardData = analyticsService.getDashboardData(timeRange);
    
    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('❌ Failed to get dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard data',
      error: error.message
    });
  }
});

// Get analytics report
router.get('/analytics/report', (req, res) => {
  try {
    const reportType = req.query.type || 'comprehensive';
    const report = analyticsService.getAnalyticsReport(reportType);
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('❌ Failed to generate analytics report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate analytics report',
      error: error.message
    });
  }
});

// Export analytics data
router.get('/analytics/export', (req, res) => {
  try {
    const format = req.query.format || 'json';
    const data = analyticsService.exportAnalyticsData(format);
    
    const contentType = format === 'csv' ? 'text/csv' : 'application/json';
    const filename = `federated-learning-analytics.${format}`;
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(data);
  } catch (error) {
    console.error('❌ Failed to export analytics data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export analytics data',
      error: error.message
    });
  }
});

// System health check
router.get('/health', (req, res) => {
  try {
    const health = {
      timestamp: new Date(),
      status: 'healthy',
      services: {
        coordinator: flCoordinator.getStatus(),
        privacy: privacyAggregator.getPrivacyBudgetStatus(),
        mpc: { activeComputations: mpcService.activeComputations.size },
        differentialPrivacy: dpService.getPrivacyBudgetStatus(),
        validation: { historyCount: validationService.validationHistory.length },
        analytics: analyticsService.getMonitoringStatus()
      }
    };
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('❌ Health check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message
    });
  }
});

// System configuration
router.get('/config', (req, res) => {
  try {
    const config = {
      federatedLearning: {
        minParticipants: flCoordinator.minParticipants,
        maxParticipants: flCoordinator.maxParticipants,
        aggregationStrategy: flCoordinator.aggregationStrategy,
        privacyBudget: flCoordinator.privacyBudget,
        differentialPrivacy: flCoordinator.differentialPrivacy,
        secureAggregation: flCoordinator.secureAggregation
      },
      privacy: {
        encryptionScheme: privacyAggregator.encryptionScheme,
        epsilon: privacyAggregator.epsilon,
        delta: privacyAggregator.delta,
        secureAggregation: privacyAggregator.secureAggregation,
        homomorphicEncryption: privacyAggregator.homomorphicEncryption
      },
      mpc: {
        thresholdScheme: mpcService.thresholdScheme,
        threshold: mpcService.threshold,
        maxParticipants: mpcService.maxParticipants
      },
      differentialPrivacy: {
        epsilon: dpService.epsilon,
        delta: dpService.delta,
        sensitivity: dpService.sensitivity,
        mechanism: dpService.mechanism,
        privacyBudget: dpService.privacyBudget
      },
      validation: {
        accuracyThreshold: validationService.thresholds.accuracy,
        fairnessThreshold: validationService.thresholds.fairness,
        stabilityThreshold: validationService.thresholds.stability
      },
      analytics: analyticsService.dashboardConfig
    };
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('❌ Failed to get configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve system configuration',
      error: error.message
    });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('❌ Federated Learning API Error:', error);
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

module.exports = router;
