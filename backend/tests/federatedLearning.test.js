const request = require('supertest');
const app = require('../src/index');
const FederatedLearningCoordinator = require('../src/services/federatedLearningCoordinator');
const PrivacyPreservingAggregator = require('../src/services/privacyPreservingAggregator');
const SecureMultiPartyComputation = require('../src/services/secureMultiPartyComputation');
const DifferentialPrivacyService = require('../src/services/differentialPrivacyService');
const ModelValidationService = require('../src/services/modelValidationService');
const FederatedLearningAnalytics = require('../src/services/federatedLearningAnalytics');

describe('Federated Learning System', () => {
  let flCoordinator;
  let privacyAggregator;
  let mpcService;
  let dpService;
  let validationService;
  let analyticsService;

  beforeEach(() => {
    flCoordinator = new FederatedLearningCoordinator({
      minParticipants: 2,
      maxParticipants: 5,
      aggregationStrategy: 'fedavg',
      privacyBudget: 1.0,
      differentialPrivacy: true,
      secureAggregation: true
    });

    privacyAggregator = new PrivacyPreservingAggregator({
      encryptionScheme: 'paillier',
      differentialPrivacy: true,
      epsilon: 1.0,
      delta: 1e-5,
      secureAggregation: true,
      homomorphicEncryption: true
    });

    mpcService = new SecureMultiPartyComputation({
      thresholdScheme: 'shamir',
      threshold: 2,
      maxParticipants: 5
    });

    dpService = new DifferentialPrivacyService({
      epsilon: 1.0,
      delta: 1e-5,
      sensitivity: 1.0,
      mechanism: 'gaussian',
      privacyBudget: 10.0
    });

    validationService = new ModelValidationService({
      validationMetrics: ['accuracy', 'precision', 'recall', 'f1'],
      fairnessMetrics: ['demographic_parity', 'equalized_odds', 'equal_opportunity'],
      accuracyThreshold: 0.7,
      fairnessThreshold: 0.8,
      stabilityThreshold: 0.9
    });

    analyticsService = new FederatedLearningAnalytics({
      updateInterval: 1000,
      retentionPeriod: 60000, // 1 minute for testing
      maxDataPoints: 100
    });
  });

  afterEach(() => {
    if (analyticsService.isMonitoring) {
      analyticsService.stopMonitoring();
    }
  });

  describe('Federated Learning Coordinator', () => {
    test('should initialize with correct configuration', () => {
      expect(flCoordinator.minParticipants).toBe(2);
      expect(flCoordinator.maxParticipants).toBe(5);
      expect(flCoordinator.aggregationStrategy).toBe('fedavg');
      expect(flCoordinator.differentialPrivacy).toBe(true);
      expect(flCoordinator.secureAggregation).toBe(true);
    });

    test('should register participant successfully', async () => {
      const participant = flCoordinator.registerParticipant(
        'institution1',
        'public-key-123',
        { name: 'Test University', location: 'US', dataSize: 1000 }
      );

      expect(participant.id).toBe('institution1');
      expect(participant.publicKey).toBe('public-key-123');
      expect(participant.metadata.name).toBe('Test University');
      expect(participant.status).toBe('registered');
      expect(flCoordinator.participants.size).toBe(1);
    });

    test('should initialize model architecture', async () => {
      const modelArchitecture = {
        layers: [
          { type: 'dense', inputShape: [10], units: 64, activation: 'relu' },
          { type: 'dense', units: 32, activation: 'relu' },
          { type: 'dense', units: 10, activation: 'softmax' }
        ],
        learningRate: 0.001,
        loss: 'categoricalCrossentropy'
      };

      const result = await flCoordinator.initialize(modelArchitecture);
      expect(result).toBe(true);
      expect(flCoordinator.globalModel).toBeDefined();
    });

    test('should start federated learning round', async () => {
      // Register participants
      flCoordinator.registerParticipant('inst1', 'key1');
      flCoordinator.registerParticipant('inst2', 'key2');
      flCoordinator.registerParticipant('inst3', 'key3');

      // Initialize model
      await flCoordinator.initialize({
        layers: [{ type: 'dense', inputShape: [10], units: 10 }],
        learningRate: 0.001
      });

      const round = await flCoordinator.startRound({ epochs: 1 });
      expect(round.status).toBe('active');
      expect(round.participants.length).toBe(3);
      expect(flCoordinator.activeRound).toBeDefined();
    });

    test('should fail to start round with insufficient participants', async () => {
      // Register only one participant
      flCoordinator.registerParticipant('inst1', 'key1');

      await expect(flCoordinator.startRound()).rejects.toThrow('Insufficient participants');
    });

    test('should receive model update and complete round', async () => {
      // Setup
      flCoordinator.registerParticipant('inst1', 'key1');
      flCoordinator.registerParticipant('inst2', 'key2');
      await flCoordinator.initialize({
        layers: [{ type: 'dense', inputShape: [10], units: 10 }],
        learningRate: 0.001
      });
      await flCoordinator.startRound();

      // Mock model update
      const modelUpdate = {
        weights: [[0.1, 0.2], [0.3, 0.4]],
        metadata: { epochs: 1, loss: 0.5 }
      };

      // Receive updates from both participants
      await flCoordinator.receiveModelUpdate('inst1', modelUpdate, 'signature1');
      await flCoordinator.receiveModelUpdate('inst2', modelUpdate, 'signature2');

      // Round should complete automatically
      expect(flCoordinator.activeRound).toBeNull();
      expect(flCoordinator.roundNumber).toBe(1);
    });
  });

  describe('Privacy-Preserving Aggregator', () => {
    test('should initialize with correct configuration', () => {
      expect(privacyAggregator.encryptionScheme).toBe('paillier');
      expect(privacyAggregator.differentialPrivacy).toBe(true);
      expect(privacyAggregator.epsilon).toBe(1.0);
      expect(privacyAggregator.secureAggregation).toBe(true);
    });

    test('should apply differential privacy to values', async () => {
      const value = 100;
      const result = privacyAggregator.applyDifferentialPrivacy(value, 1000, 1.0);

      expect(result.weights).toBeDefined();
      expect(result.noise).toBeDefined();
      expect(typeof result.weights[0]).toBe('number');
      expect(result.weights[0]).not.toBe(value); // Should be different due to noise
    });

    test('should aggregate model updates with privacy preservation', async () => {
      const updates = [
        {
          weights: [0.1, 0.2, 0.3],
          participant: { dataSize: 100 },
          weight: 1.0
        },
        {
          weights: [0.2, 0.3, 0.4],
          participant: { dataSize: 200 },
          weight: 2.0
        }
      ];

      const result = await privacyAggregator.aggregateModelUpdates(updates, 'fedavg');

      expect(result.weights).toBeDefined();
      expect(result.weights.length).toBe(3);
      expect(result.privacyMetadata).toBeDefined();
      expect(result.privacyMetadata.epsilon).toBe(1.0);
      expect(result.privacyMetadata.participants).toBe(2);
    });

    test('should validate privacy guarantees', () => {
      const aggregatedUpdate = {
        privacyMetadata: {
          epsilon: 1.0,
          delta: 1e-5,
          encryptionUsed: true,
          dpApplied: true
        }
      };

      const isValid = privacyAggregator.validatePrivacyGuarantees(aggregatedUpdate);
      expect(isValid).toBe(true);
    });

    test('should warn on high epsilon values', () => {
      const aggregatedUpdate = {
        privacyMetadata: {
          epsilon: 5.0, // High epsilon
          delta: 1e-5,
          encryptionUsed: true,
          dpApplied: true
        }
      };

      // Should not throw but should log warning
      const isValid = privacyAggregator.validatePrivacyGuarantees(aggregatedUpdate);
      expect(isValid).toBe(true);
    });
  });

  describe('Secure Multi-Party Computation', () => {
    test('should initialize computation correctly', async () => {
      const computation = await mpcService.initializeComputation(
        ['p1', 'p2', 'p3'],
        'aggregation'
      );

      expect(computation.id).toBeDefined();
      expect(computation.type).toBe('aggregation');
      expect(computation.status).toBe('initialized');
      expect(computation.participants).toEqual(['p1', 'p2', 'p3']);
      expect(computation.threshold).toBe(2);
    });

    test('should fail initialization with insufficient participants', async () => {
      await expect(
        mpcService.initializeComputation(['p1'], 'aggregation')
      ).rejects.toThrow('Insufficient participants');
    });

    test('should distribute shares correctly', async () => {
      const computation = await mpcService.initializeComputation(
        ['p1', 'p2', 'p3'],
        'aggregation'
      );

      const values = [100, 200];
      const shares = await mpcService.distributeShares(computation.id, values);

      expect(shares.size).toBe(3); // One share per participant
      expect(shares.get('p1')).toBeDefined();
      expect(shares.get('p1').length).toBe(2); // One share per value
    });

    test('should reconstruct secret from shares', async () => {
      const computation = await mpcService.initializeComputation(
        ['p1', 'p2', 'p3'],
        'aggregation'
      );

      const values = [42];
      await mpcService.distributeShares(computation.id, values);

      // Collect shares from 2 participants (threshold = 2)
      const shares1 = computation.shares.get('p1');
      const shares2 = computation.shares.get('p2');

      await mpcService.collectShares(computation.id, 'p1', shares1);
      const result = await mpcService.collectShares(computation.id, 'p2', shares2);

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0]).toBeCloseTo(42, 0); // Should be close to original value
    });
  });

  describe('Differential Privacy Service', () => {
    test('should apply differential privacy correctly', () => {
      const value = 50;
      const result = dpService.applyDifferentialPrivacy(value, 'count');

      expect(result.value).toBeDefined();
      expect(typeof result.value).toBe('number');
      expect(result.privacyMetadata).toBeDefined();
      expect(result.privacyMetadata.epsilon).toBe(1.0);
      expect(result.privacyMetadata.mechanism).toBe('gaussian');
    });

    test('should manage privacy budget correctly', () => {
      const initialBudget = dpService.getPrivacyBudgetStatus();
      expect(initialBudget.remainingBudget).toBe(10.0);

      // Apply DP twice
      dpService.applyDifferentialPrivacy(10, 'count');
      dpService.applyDifferentialPrivacy(20, 'count');

      const updatedBudget = dpService.getPrivacyBudgetStatus();
      expect(updatedBudget.remainingBudget).toBeLessThan(10.0);
      expect(updatedBudget.usedBudget).toBeGreaterThan(0);
    });

    test('should fail when privacy budget exhausted', () => {
      // Exhaust budget
      dpService.remainingBudget = 0.05;

      expect(() => {
        dpService.applyDifferentialPrivacy(10, 'count');
      }).toThrow('Insufficient privacy budget');
    });

    test('should apply DP to model weights', () => {
      const weights = [0.1, 0.2, 0.3, 0.4];
      const result = dpService.applyDPToModelWeights(weights);

      expect(result.weights).toBeDefined();
      expect(result.weights.length).toBe(weights.length);
      expect(result.privacyMetadata).toBeDefined();
    });

    test('should apply DP to gradients with clipping', () => {
      const gradients = [1.0, 2.0, 3.0, 4.0];
      const result = dpService.applyDPToGradients(gradients, 2.0);

      expect(result.gradients).toBeDefined();
      expect(result.gradients.length).toBe(gradients.length);
      expect(result.privacyMetadata.clipNorm).toBe(2.0);
    });

    test('should validate privacy parameters', () => {
      const isValid = dpService.validatePrivacyParameters();
      expect(isValid).toBe(true);

      // Test invalid parameters
      dpService.epsilon = -1;
      const isInvalid = dpService.validatePrivacyParameters();
      expect(isInvalid).toBe(false);

      // Reset for other tests
      dpService.epsilon = 1.0;
    });
  });

  describe('Model Validation Service', () => {
    test('should calculate basic metrics correctly', () => {
      const predicted = [1, 0, 1, 1, 0];
      const trueLabels = [1, 0, 0, 1, 0];

      const accuracy = validationService.calculateAccuracy(predicted, trueLabels);
      const precision = validationService.calculatePrecision(predicted, trueLabels);
      const recall = validationService.calculateRecall(predicted, trueLabels);
      const f1 = validationService.calculateF1Score(predicted, trueLabels);

      expect(accuracy).toBe(0.8); // 4/5 correct
      expect(precision).toBe(0.67); // 2/3 positive predictions correct
      expect(recall).toBe(1.0); // 2/2 actual positives found
      expect(f1).toBeCloseTo(0.8, 1);
    });

    test('should calculate confusion matrix correctly', () => {
      const predicted = [1, 0, 1, 1, 0];
      const trueLabels = [1, 0, 0, 1, 0];

      const matrix = validationService.calculateConfusionMatrix(predicted, trueLabels);
      expect(matrix).toEqual([[2, 1], [0, 2]]); // [[TN, FP], [FN, TP]]
    });

    test('should calculate demographic parity', () => {
      const groupMetrics = {
        group1: { positiveRate: 0.3 },
        group2: { positiveRate: 0.4 }
      };

      const dp = validationService.calculateDemographicParity(groupMetrics);
      expect(dp).toBe(0.9); // 1 - (0.4 - 0.3)
    });

    test('should identify fairness violations', () => {
      const groupMetrics = {
        group1: { positiveRate: 0.1 },
        group2: { positiveRate: 0.8 }
      };

      const dp = validationService.calculateDemographicParity(groupMetrics);
      expect(dp).toBe(0.3); // Large gap indicates violation
    });
  });

  describe('Federated Learning Analytics', () => {
    test('should start and stop monitoring', () => {
      expect(analyticsService.isMonitoring).toBe(false);

      analyticsService.startMonitoring();
      expect(analyticsService.isMonitoring).toBe(true);

      analyticsService.stopMonitoring();
      expect(analyticsService.isMonitoring).toBe(false);
    });

    test('should collect metrics', () => {
      analyticsService.collectMetrics();
      expect(analyticsService.metricsHistory.length).toBe(1);

      const metrics = analyticsService.metricsHistory[0];
      expect(metrics.timestamp).toBeDefined();
      expect(metrics.systemMetrics).toBeDefined();
      expect(metrics.modelMetrics).toBeDefined();
      expect(metrics.participantMetrics).toBeDefined();
      expect(metrics.privacyMetrics).toBeDefined();
    });

    test('should generate dashboard data', () => {
      // Collect some metrics first
      for (let i = 0; i < 5; i++) {
        analyticsService.collectMetrics();
      }

      const dashboardData = analyticsService.getDashboardData('1h');
      expect(dashboardData.timeRange).toBe('1h');
      expect(dashboardData.dataPoints).toBe(5);
      expect(dashboardData.summary).toBeDefined();
      expect(dashboardData.charts).toBeDefined();
    });

    test('should generate insights and recommendations', () => {
      // Collect metrics with specific values
      analyticsService.collectMetrics();
      
      // Mock latest metrics for testing
      const latest = analyticsService.metricsHistory[analyticsService.metricsHistory.length - 1];
      latest.modelMetrics.globalModelAccuracy = 0.95; // High accuracy
      latest.privacyMetrics.remainingBudget = 0.5; // Low budget

      const insights = analyticsService.generateInsights();
      const recommendations = analyticsService.generateRecommendations();

      expect(insights).toBeDefined();
      expect(recommendations).toBeDefined();
      expect(insights.length).toBeGreaterThan(0);
      expect(recommendations.length).toBeGreaterThan(0);
    });

    test('should export data in different formats', () => {
      // Collect some metrics
      analyticsService.collectMetrics();

      const jsonData = analyticsService.exportAnalyticsData('json');
      expect(jsonData).toBeDefined();
      expect(() => JSON.parse(jsonData)).not.toThrow();

      const csvData = analyticsService.exportAnalyticsData('csv');
      expect(csvData).toBeDefined();
      expect(csvData.split('\n').length).toBeGreaterThan(1); // Header + data
    });
  });

  describe('API Integration Tests', () => {
    test('should initialize federated learning system via API', async () => {
      const modelArchitecture = {
        layers: [
          { type: 'dense', inputShape: [10], units: 64, activation: 'relu' },
          { type: 'dense', units: 10, activation: 'softmax' }
        ],
        learningRate: 0.001
      };

      const response = await request(app)
        .post('/api/federated-learning/initialize')
        .send({ modelArchitecture })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('initialized successfully');
    });

    test('should register participant via API', async () => {
      const participantData = {
        institutionId: 'test-university',
        publicKey: 'test-public-key',
        metadata: {
          name: 'Test University',
          location: 'US',
          dataSize: 1000
        }
      };

      const response = await request(app)
        .post('/api/federated-learning/participants/register')
        .send(participantData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('test-university');
    });

    test('should get system health via API', async () => {
      const response = await request(app)
        .get('/api/federated-learning/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.services).toBeDefined();
    });

    test('should get system configuration via API', async () => {
      const response = await request(app)
        .get('/api/federated-learning/config')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.federatedLearning).toBeDefined();
      expect(response.body.data.privacy).toBeDefined();
      expect(response.body.data.mpc).toBeDefined();
    });

    test('should apply differential privacy via API', async () => {
      const dpRequest = {
        value: 100,
        queryType: 'count',
        epsilon: 1.0
      };

      const response = await request(app)
        .post('/api/federated-learning/privacy/apply')
        .send(dpRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.value).toBeDefined();
      expect(response.body.data.privacyMetadata).toBeDefined();
    });

    test('should get privacy budget status via API', async () => {
      const response = await request(app)
        .get('/api/federated-learning/privacy/budget')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.epsilon).toBeDefined();
      expect(response.body.data.remainingBudget).toBeDefined();
    });

    test('should get analytics dashboard data via API', async () => {
      const response = await request(app)
        .get('/api/federated-learning/analytics/dashboard')
        .query({ timeRange: '1h' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.timeRange).toBe('1h');
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.charts).toBeDefined();
    });

    test('should handle invalid requests gracefully', async () => {
      // Test missing required fields
      const response = await request(app)
        .post('/api/federated-learning/participants/register')
        .send({}) // Missing required fields
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('required');
    });

    test('should handle API errors gracefully', async () => {
      // Test invalid computation ID
      const response = await request(app)
        .post('/api/federated-learning/mpc/invalid-id/distribute-shares')
        .send({ values: [1, 2, 3] })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });
  });

  describe('End-to-End Integration', () => {
    test('should complete full federated learning workflow', async () => {
      // 1. Initialize system
      const initResponse = await request(app)
        .post('/api/federated-learning/initialize')
        .send({
          modelArchitecture: {
            layers: [{ type: 'dense', inputShape: [10], units: 10 }],
            learningRate: 0.001
          }
        });

      expect(initResponse.body.success).toBe(true);

      // 2. Register participants
      const participants = ['university1', 'university2', 'university3'];
      for (const participant of participants) {
        await request(app)
          .post('/api/federated-learning/participants/register')
          .send({
            institutionId: participant,
            publicKey: `key-${participant}`,
            metadata: { name: participant, dataSize: 1000 }
          });
      }

      // 3. Start round
      const roundResponse = await request(app)
        .post('/api/federated-learning/rounds/start')
        .send({ epochs: 1 });

      expect(roundResponse.body.success).toBe(true);
      const roundId = roundResponse.body.data.id;

      // 4. Submit model updates (mock)
      const modelUpdate = {
        weights: [[0.1, 0.2], [0.3, 0.4]],
        metadata: { epochs: 1, loss: 0.5 }
      };

      for (const participant of participants) {
        await request(app)
          .post(`/api/federated-learning/rounds/${roundId}/updates`)
          .send({
            participantId: participant,
            modelUpdate,
            signature: `signature-${participant}`
          });
      }

      // 5. Check system health
      const healthResponse = await request(app)
        .get('/api/federated-learning/health');

      expect(healthResponse.body.success).toBe(true);
      expect(healthResponse.body.data.status).toBe('healthy');

      // 6. Get analytics
      const analyticsResponse = await request(app)
        .get('/api/federated-learning/analytics/dashboard');

      expect(analyticsResponse.body.success).toBe(true);
      expect(analyticsResponse.body.data.summary).toBeDefined();
    });
  });
});
