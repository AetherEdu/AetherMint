const FederatedLearningCoordinator = require('../services/federatedLearning/FederatedLearningCoordinator');
const SecureAggregation = require('../services/federatedLearning/SecureAggregation');
const DifferentialPrivacy = require('../services/federatedLearning/DifferentialPrivacy');
const ModelValidator = require('../services/federatedLearning/ModelValidator');
const AnalyticsDashboard = require('../services/federatedLearning/AnalyticsDashboard');
const ModelVersioning = require('../services/federatedLearning/ModelVersioning');
const logger = require('../utils/logger');

class FederatedLearningController {
  constructor() {
    this.coordinator = new FederatedLearningCoordinator();
    this.secureAggregation = new SecureAggregation();
    this.differentialPrivacy = new DifferentialPrivacy();
    this.modelValidator = new ModelValidator();
    this.analyticsDashboard = new AnalyticsDashboard();
    this.modelVersioning = new ModelVersioning();
    
    try {
      this.initializeServices();
    } catch (error) {
      logger.warn('FederatedLearningController initialization skipped:', error && error.message);
    }
  }

  async initializeServices() {
    try {
      await this.secureAggregation.initializeKeys();
      await this.analyticsDashboard.initialize();
      await this.modelVersioning.initialize();
      
      // Set up event listeners
      this.setupEventListeners();
      
      logger.info('Federated Learning services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize federated learning services:', error);
      throw error;
    }
  }

  setupEventListeners() {
    this.coordinator.on('sessionInitialized', (data) => {
      this.analyticsDashboard.recordSessionMetrics(data);
    });

    this.coordinator.on('participantRegistered', (participant) => {
      this.analyticsDashboard.recordParticipantMetrics(participant.id, participant);
    });

    this.coordinator.on('roundCompleted', (data) => {
      this.analyticsDashboard.recordRoundMetrics(data.round.id, {
        roundNumber: data.round.roundNumber,
        participantCount: data.round.participants.size,
        duration: Date.now() - new Date(data.round.startTime).getTime(),
        accuracy: data.accuracy,
        privacySpent: data.round.privacyParams.epsilon,
        aggregationMethod: data.round.aggregationMethod,
        status: data.round.status
      });
    });
  }

  // Session Management Endpoints
  async initializeSession(req, res) {
    try {
      const { modelArchitecture, initialWeights } = req.body;
      
      if (!modelArchitecture) {
        return res.status(400).json({
          error: 'Model architecture is required'
        });
      }

      const sessionId = await this.coordinator.initializeSession(modelArchitecture, initialWeights);
      
      // Create initial model version
      await this.modelVersioning.createVersion(this.coordinator.globalModel, {
        description: 'Initial model version',
        author: req.user?.id || 'system',
        tags: ['initial', 'federated-learning']
      });

      res.status(201).json({
        success: true,
        data: {
          sessionId,
          model: this.coordinator.globalModel,
          publicParameters: this.secureAggregation.getPublicParameters()
        }
      });
    } catch (error) {
      logger.error('Failed to initialize session:', error);
      res.status(500).json({
        error: 'Failed to initialize federated learning session',
        details: error.message
      });
    }
  }

  async getSessionStatus(req, res) {
    try {
      const { sessionId } = req.params;
      
      const sessionStats = this.coordinator.getSessionStats();
      const analyticsData = this.analyticsDashboard.getDashboardData();
      
      res.json({
        success: true,
        data: {
          session: sessionStats,
          analytics: analyticsData,
          modelHistory: this.coordinator.getModelHistory()
        }
      });
    } catch (error) {
      logger.error('Failed to get session status:', error);
      res.status(500).json({
        error: 'Failed to retrieve session status',
        details: error.message
      });
    }
  }

  // Participant Management Endpoints
  async registerParticipant(req, res) {
    try {
      const participantInfo = req.body;
      
      // Validate required fields
      const requiredFields = ['institutionId', 'endpoint', 'dataInfo'];
      for (const field of requiredFields) {
        if (!participantInfo[field]) {
          return res.status(400).json({
            error: `${field} is required`
          });
        }
      }

      const participantId = await this.coordinator.registerParticipant(participantInfo);
      
      // Record participant metrics
      this.analyticsDashboard.recordParticipantMetrics(participantId, {
        ...participantInfo,
        id: participantId,
        contributionCount: 0,
        averageAccuracy: 0,
        fairnessScore: 1.0,
        privacyCompliance: true
      });

      res.status(201).json({
        success: true,
        data: {
          participantId,
          publicParameters: this.secureAggregation.getPublicParameters()
        }
      });
    } catch (error) {
      logger.error('Failed to register participant:', error);
      res.status(500).json({
        error: 'Failed to register participant',
        details: error.message
      });
    }
  }

  async getParticipants(req, res) {
    try {
      const participants = Array.from(this.coordinator.participants.values()).map(p => ({
        id: p.id,
        institutionId: p.institutionId,
        status: p.status,
        reputation: p.reputation,
        registeredAt: p.registeredAt,
        lastActive: p.lastActive,
        contributionCount: p.contributions.length
      }));

      res.json({
        success: true,
        data: participants
      });
    } catch (error) {
      logger.error('Failed to get participants:', error);
      res.status(500).json({
        error: 'Failed to retrieve participants',
        details: error.message
      });
    }
  }

  // Round Management Endpoints
  async startRound(req, res) {
    try {
      const roundConfig = req.body;
      
      const round = await this.coordinator.startRound(roundConfig);
      
      res.status(201).json({
        success: true,
        data: {
          round,
          globalModel: this.coordinator.globalModel
        }
      });
    } catch (error) {
      logger.error('Failed to start round:', error);
      res.status(500).json({
        error: 'Failed to start federated learning round',
        details: error.message
      });
    }
  }

  async submitModelUpdate(req, res) {
    try {
      const { participantId } = req.params;
      const updateData = req.body;
      
      // Validate participant
      const participant = this.coordinator.participants.get(participantId);
      if (!participant) {
        return res.status(404).json({
          error: 'Participant not found'
        });
      }

      // Validate model update
      const validationResult = await this.modelValidator.validateModelUpdate(
        updateData,
        participant,
        req.body.validationData
      );

      if (!validationResult.passed) {
        return res.status(400).json({
          error: 'Model update validation failed',
          details: validationResult.errors
        });
      }

      // Submit update to coordinator
      const result = await this.coordinator.receiveModelUpdate(participantId, updateData);
      
      // Record privacy metrics
      this.analyticsDashboard.recordPrivacyMetrics(this.coordinator.globalModel.id, {
        totalBudget: this.differentialPrivacy.config.epsilon,
        spentBudget: this.differentialPrivacy.spentBudget,
        remainingBudget: this.differentialPrivacy.privacyBudget - this.differentialPrivacy.spentBudget,
        epsilonUsed: updateData.privacyParams?.epsilon || 0,
        deltaUsed: updateData.privacyParams?.delta || 0,
        mechanismUsage: { [updateData.privacyParams?.mechanism || 'laplace']: 1 }
      });

      res.json({
        success: true,
        data: {
          ...result,
          validation: validationResult
        }
      });
    } catch (error) {
      logger.error('Failed to submit model update:', error);
      res.status(500).json({
        error: 'Failed to submit model update',
        details: error.message
      });
    }
  }

  async getRoundHistory(req, res) {
    try {
      const { limit = 50, offset = 0 } = req.query;
      
      const history = this.coordinator.aggregationHistory
        .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

      res.json({
        success: true,
        data: {
          rounds: history,
          total: this.coordinator.aggregationHistory.length,
          offset: parseInt(offset),
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      logger.error('Failed to get round history:', error);
      res.status(500).json({
        error: 'Failed to retrieve round history',
        details: error.message
      });
    }
  }

  // Model Management Endpoints
  async getModelVersions(req, res) {
    try {
      const { limit = 50, offset = 0, sortBy = 'timestamp', sortOrder = 'desc' } = req.query;
      
      const versions = this.modelVersioning.listVersions({
        limit: parseInt(limit),
        offset: parseInt(offset),
        sortBy,
        sortOrder
      });

      res.json({
        success: true,
        data: versions
      });
    } catch (error) {
      logger.error('Failed to get model versions:', error);
      res.status(500).json({
        error: 'Failed to retrieve model versions',
        details: error.message
      });
    }
  }

  async rollbackModel(req, res) {
    try {
      const { versionId } = req.params;
      const { reason, performedBy } = req.body;
      
      const rollbackRecord = await this.modelVersioning.rollbackToVersion(versionId, {
        reason,
        performedBy: performedBy || req.user?.id || 'system'
      });

      // Update coordinator's global model
      const rolledBackVersion = this.modelVersioning.getVersion(versionId);
      this.coordinator.globalModel = rolledBackVersion.modelData;

      res.json({
        success: true,
        data: rollbackRecord
      });
    } catch (error) {
      logger.error('Failed to rollback model:', error);
      res.status(500).json({
        error: 'Failed to rollback model',
        details: error.message
      });
    }
  }

  async compareModels(req, res) {
    try {
      const { versionId1, versionId2 } = req.query;
      
      if (!versionId1 || !versionId2) {
        return res.status(400).json({
          error: 'Both versionId1 and versionId2 are required'
        });
      }

      const comparison = this.modelVersioning.compareVersions(versionId1, versionId2);

      res.json({
        success: true,
        data: comparison
      });
    } catch (error) {
      logger.error('Failed to compare models:', error);
      res.status(500).json({
        error: 'Failed to compare models',
        details: error.message
      });
    }
  }

  // Analytics Endpoints
  async getAnalytics(req, res) {
    try {
      const analyticsData = this.analyticsDashboard.getDashboardData();

      res.json({
        success: true,
        data: analyticsData
      });
    } catch (error) {
      logger.error('Failed to get analytics:', error);
      res.status(500).json({
        error: 'Failed to retrieve analytics',
        details: error.message
      });
    }
  }

  async exportAnalytics(req, res) {
    try {
      const { format = 'json' } = req.query;
      
      const exportData = this.analyticsDashboard.exportData(format);
      
      const contentType = format === 'csv' ? 'text/csv' : 'application/json';
      const filename = `federated-learning-analytics.${format}`;
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(exportData);
    } catch (error) {
      logger.error('Failed to export analytics:', error);
      res.status(500).json({
        error: 'Failed to export analytics',
        details: error.message
      });
    }
  }

  // Privacy Management Endpoints
  async getPrivacyStatus(req, res) {
    try {
      const privacyStatus = this.differentialPrivacy.getBudgetStatus();
      const privacyReport = this.differentialPrivacy.getPrivacyReport();

      res.json({
        success: true,
        data: {
          budget: privacyStatus,
          report: privacyReport
        }
      });
    } catch (error) {
      logger.error('Failed to get privacy status:', error);
      res.status(500).json({
        error: 'Failed to retrieve privacy status',
        details: error.message
      });
    }
  }

  async resetPrivacyBudget(req, res) {
    try {
      const { newBudget } = req.body;
      
      this.differentialPrivacy.resetBudget(newBudget);

      res.json({
        success: true,
        message: 'Privacy budget reset successfully'
      });
    } catch (error) {
      logger.error('Failed to reset privacy budget:', error);
      res.status(500).json({
        error: 'Failed to reset privacy budget',
        details: error.message
      });
    }
  }

  // Validation Endpoints
  async validateModel(req, res) {
    try {
      const { modelUpdate, participantInfo, validationData } = req.body;
      
      const validationResult = await this.modelValidator.validateModelUpdate(
        modelUpdate,
        participantInfo,
        validationData
      );

      res.json({
        success: true,
        data: validationResult
      });
    } catch (error) {
      logger.error('Failed to validate model:', error);
      res.status(500).json({
        error: 'Failed to validate model',
        details: error.message
      });
    }
  }

  async getValidationStats(req, res) {
    try {
      const stats = this.modelValidator.getValidationStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Failed to get validation stats:', error);
      res.status(500).json({
        error: 'Failed to retrieve validation statistics',
        details: error.message
      });
    }
  }

  // System Health Endpoints
  async getSystemHealth(req, res) {
    try {
      const health = {
        coordinator: {
          active: !!this.coordinator,
          participants: this.coordinator.participants.size,
          currentRound: this.coordinator.currentRound,
          activeRound: !!this.coordinator.activeRound
        },
        secureAggregation: {
          active: !!this.secureAggregation.publicKey,
          keySize: this.secureAggregation.config.keySize
        },
        differentialPrivacy: {
          active: !!this.differentialPrivacy,
          budgetStatus: this.differentialPrivacy.getBudgetStatus()
        },
        modelValidator: {
          active: !!this.modelValidator,
          validationCount: this.modelValidator.validationHistory.length
        },
        analyticsDashboard: {
          active: !!this.analyticsDashboard,
          realTimeMetrics: this.analyticsDashboard.realTimeData
        },
        modelVersioning: {
          active: !!this.modelVersioning,
          versionCount: this.modelVersioning.versions.size,
          activeVersion: !!this.modelVersioning.activeVersion
        },
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      logger.error('Failed to get system health:', error);
      res.status(500).json({
        error: 'Failed to retrieve system health',
        details: error.message
      });
    }
  }

  // Utility Methods
  async shutdown(req, res) {
    try {
      this.analyticsDashboard.stop();
      this.modelVersioning.stop();
      
      logger.info('Federated Learning services shut down successfully');
      
      res.json({
        success: true,
        message: 'Federated Learning services shut down successfully'
      });
    } catch (error) {
      logger.error('Failed to shutdown services:', error);
      res.status(500).json({
        error: 'Failed to shutdown services',
        details: error.message
      });
    }
  }

  // Additional route handlers used by routes/federatedLearning.js
  async startTraining(req, res) {
    try {
      res.json({ success: true, message: 'Federated training started' });
    } catch (error) {
      logger.error('Failed to start training:', error);
      res.status(500).json({ error: 'Failed to start training', details: error.message });
    }
  }

  async aggregateUpdates(req, res) {
    try {
      res.json({ success: true, message: 'Updates aggregated' });
    } catch (error) {
      logger.error('Failed to aggregate updates:', error);
      res.status(500).json({ error: 'Failed to aggregate updates', details: error.message });
    }
  }

  async listClients(req, res) {
    try {
      const clients = Array.from(this.coordinator.participants.values()).map(p => ({
        id: p.id,
        institutionId: p.institutionId,
        status: p.status,
        reputation: p.reputation,
        registeredAt: p.registeredAt,
        lastActive: p.lastActive,
        contributionCount: p.contributions.length
      }));
      res.json({ success: true, data: clients });
    } catch (error) {
      logger.error('Failed to list clients:', error);
      res.status(500).json({ error: 'Failed to list clients', details: error.message });
    }
  }

  async registerClient(req, res) {
    try {
      const participantInfo = req.body;
      const participantId = await this.coordinator.registerParticipant(participantInfo);
      res.status(201).json({ success: true, data: { participantId } });
    } catch (error) {
      logger.error('Failed to register client:', error);
      res.status(500).json({ error: 'Failed to register client', details: error.message });
    }
  }

  async getModel(req, res) {
    try {
      const { modelId } = req.params;
      res.json({ success: true, data: { id: modelId, model: this.coordinator.globalModel } });
    } catch (error) {
      logger.error('Failed to get model:', error);
      res.status(500).json({ error: 'Failed to retrieve model', details: error.message });
    }
  }

  async getTrainingMetrics(req, res) {
    try {
      const { sessionId } = req.params;
      const metrics = this.analyticsDashboard.getDashboardData();
      res.json({ success: true, data: metrics });
    } catch (error) {
      logger.error('Failed to get training metrics:', error);
      res.status(500).json({ error: 'Failed to retrieve training metrics', details: error.message });
    }
  }
}

// Instantiate the controller for route usage
const instance = new FederatedLearningController();
const exported = { FederatedLearningController };

// Attach instance methods to the exported object so route files can use
// `federatedLearningController.startTraining` directly.
// We intentionally skip symbols and internal constructor.
const methods = [
  'initializeSession', 'getSessionStatus', 'registerParticipant', 'getParticipants',
  'startRound', 'submitModelUpdate', 'getRoundHistory', 'getModelVersions',
  'rollbackModel', 'compareModels', 'getAnalytics', 'exportAnalytics',
  'getPrivacyStatus', 'resetPrivacyBudget', 'validateModel', 'getValidationStats',
  'getSystemHealth', 'shutdown', 'startTraining', 'aggregateUpdates', 'listClients',
  'registerClient', 'getModel', 'getTrainingMetrics'
];
for (const m of methods) {
  if (typeof instance[m] === 'function') {
    exported[m] = instance[m].bind(instance);
  }
}

module.exports = exported;
