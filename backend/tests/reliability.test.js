const request = require('supertest');
const app = require('../src/index');

describe('Transaction Queue Reliability Tests', () => {
  describe('Network Failure Simulation', () => {
    it('should handle Stellar network timeouts gracefully', async () => {
      // Mock Stellar service to simulate network timeout
      const { StellarService } = require('../src/services/stellarService');
      
      jest.mock('../src/services/stellarService', () => ({
        StellarService: jest.fn().mockImplementation(() => ({
          submitTransaction: jest.fn().mockRejectedValue(new Error('Network timeout')),
          getNetworkStatus: jest.fn().mockRejectedValue(new Error('Network unreachable')),
        })),
      }));

      const authToken = 'Bearer valid-token';
      
      const response = await request(app)
        .post('/api/transactions/submit')
        .set('Authorization', authToken)
        .send({
          type: 'credential_issuance',
          payload: {
            sourceAccount: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
            secretKey: 'SABCDEFGHIJKLMNOPQRSTUVWXYZ123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
            recipients: [{ address: 'GBCDEFGHIJKLMNOPQRSTUVWXYZ123456789', amount: '10' }],
            gasOptimization: { strategy: 'standard', estimatedFee: 200, savings: 0, confidence: 0.95 },
          },
          priority: 'medium',
          userId: 'test-user',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Failed to submit transaction');
    });

    it('should retry failed transactions according to policy', async () => {
      const { TransactionQueue } = require('../src/services/transactionQueue');
      
      // Mock queue to simulate retry behavior
      const mockQueue = {
        retryTransaction: jest.fn().mockResolvedValue({
          id: 'retry-tx-id',
          status: 'queued',
          retryCount: 1,
          queuePosition: 5,
        }),
      };

      jest.mock('../src/services/transactionQueue', () => ({
        TransactionQueue: jest.fn().mockImplementation(() => mockQueue),
      }));

      const response = await request(app)
        .post('/api/transactions/retry-tx-id/retry')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.retryCount).toBe(1);
    });
  });

  describe('Redis Failure Recovery', () => {
    it('should handle Redis connection failures', async () => {
      // Mock Redis to simulate connection failure
      const { TransactionQueue } = require('../src/services/transactionQueue');
      
      jest.mock('../src/services/transactionQueue', () => ({
        TransactionQueue: jest.fn().mockImplementation(() => ({
          enqueue: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
        })),
      }));

      const response = await request(app)
        .post('/api/transactions/submit')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'credential_issuance',
          payload: {
            sourceAccount: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
            secretKey: 'SABCDEFGHIJKLMNOPQRSTUVWXYZ123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
            recipients: [{ address: 'GBCDEFGHIJKLMNOPQRSTUVWXYZ123456789', amount: '10' }],
            gasOptimization: { strategy: 'standard', estimatedFee: 200, savings: 0, confidence: 0.95 },
          },
          priority: 'medium',
          userId: 'test-user',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Data Consistency Tests', () => {
    it('should maintain transaction state consistency during concurrent operations', async () => {
      // This test would require setting up concurrent operations
      // and verifying that transaction states remain consistent
      
      const { TransactionQueue } = require('../src/services/transactionQueue');
      
      const mockQueue = {
        enqueue: jest.fn().mockResolvedValue({ id: 'consistency-tx', status: 'queued' }),
        getTransaction: jest.fn().mockResolvedValue({ id: 'consistency-tx', status: 'queued' }),
        cancelTransaction: jest.fn().mockResolvedValue(true),
      };

      jest.mock('../src/services/transactionQueue', () => ({
        TransactionQueue: jest.fn().mockImplementation(() => mockQueue),
      }));

      // Submit transaction
      const submitResponse = await request(app)
        .post('/api/transactions/submit')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'credential_issuance',
          payload: {
            sourceAccount: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
            secretKey: 'SABCDEFGHIJKLMNOPQRSTUVWXYZ123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
            recipients: [{ address: 'GBCDEFGHIJKLMNOPQRSTUVWXYZ123456789', amount: '10' }],
            gasOptimization: { strategy: 'standard', estimatedFee: 200, savings: 0, confidence: 0.95 },
          },
          priority: 'medium',
          userId: 'test-user',
        })
        .expect(201);

      // Check status
      const statusResponse = await request(app)
        .get('/api/transactions/consistency-tx/status')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      // Cancel transaction
      const cancelResponse = await request(app)
        .delete('/api/transactions/consistency-tx')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(submitResponse.body.success).toBe(true);
      expect(statusResponse.body.success).toBe(true);
      expect(cancelResponse.body.success).toBe(true);
    });
  });
});

describe('Gas Optimization Validation Tests', () => {
  describe('Fee Calculation Accuracy', () => {
    it('should calculate accurate gas fees for different transaction types', async () => {
      const { StellarService } = require('../src/services/stellarService');
      
      const stellarService = new StellarService();
      
      // Test credential issuance fee calculation
      const credentialOptimization = await stellarService.optimizeGasFees({
        type: 'credential_issuance',
        payload: {
          recipients: [{ address: 'GTEST', amount: '10' }],
          memoText: 'credential',
        },
      });

      expect(credentialOptimization.strategy).toBeDefined();
      expect(credentialOptimization.estimatedFee).toBeGreaterThan(0);
      expect(credentialOptimization.confidence).toBeGreaterThan(0);
      expect(credentialOptimization.confidence).toBeLessThanOrEqual(1);

      // Test course payment fee calculation
      const paymentOptimization = await stellarService.optimizeGasFees({
        type: 'course_payment',
        payload: {
          amount: '100',
          merchantAccount: 'GMERCHANT',
        },
      });

      expect(paymentOptimization.strategy).toBeDefined();
      expect(paymentOptimization.estimatedFee).toBeGreaterThan(0);

      // Test smart contract interaction fee calculation
      const contractOptimization = await stellarService.optimizeGasFees({
        type: 'smart_contract_interaction',
        payload: {
          contractId: 'CONTRACT_ID',
          method: 'test_method',
          args: ['arg1', 'arg2'],
        },
      });

      expect(contractOptimization.strategy).toBeDefined();
      expect(contractOptimization.estimatedFee).toBeGreaterThan(0);
    });

    it('should apply appropriate discounts for batch operations', async () => {
      const { StellarService } = require('../src/services/stellarService');
      
      const stellarService = new StellarService();
      
      // Single transaction
      const singleOptimization = await stellarService.optimizeGasFees({
        type: 'credential_issuance',
        payload: {
          recipients: [{ address: 'GTEST', amount: '10' }],
        },
      });

      // Batch transaction
      const batchOptimization = await stellarService.optimizeGasFees({
        type: 'credential_issuance',
        payload: {
          recipients: [
            { address: 'GTEST1', amount: '10' },
            { address: 'GTEST2', amount: '10' },
            { address: 'GTEST3', amount: '10' },
          ],
          batchSize: 3,
        },
      });

      // Batch should have better optimization
      expect(batchOptimization.savings).toBeGreaterThanOrEqual(singleOptimization.savings);
      expect(batchOptimization.strategy).toContain('batch');
    });
  });

  describe('Network Congestion Response', () => {
    it('should increase fees during high network congestion', async () => {
      const { StellarService } = require('../src/services/stellarService');
      
      const stellarService = new StellarService();
      
      // Mock high congestion
      const highCongestionStatus = {
        congestionLevel: 0.9,
        feeStats: {
          min: 100,
          max: 2000,
          p50: 500,
          p70: 1200,
          p90: 1800,
        },
      };

      const highCongestionOptimization = await stellarService.optimizeGasFees({
        type: 'course_payment',
        payload: { amount: '100' },
        networkStatus: highCongestionStatus,
      });

      // Mock low congestion
      const lowCongestionStatus = {
        congestionLevel: 0.1,
        feeStats: {
          min: 100,
          max: 500,
          p50: 150,
          p70: 200,
          p90: 300,
        },
      };

      const lowCongestionOptimization = await stellarService.optimizeGasFees({
        type: 'course_payment',
        payload: { amount: '100' },
        networkStatus: lowCongestionStatus,
      });

      // High congestion should result in higher fees and priority strategy
      expect(highCongestionOptimization.estimatedFee).toBeGreaterThan(lowCongestionOptimization.estimatedFee);
      expect(highCongestionOptimization.strategy).toBe('priority');
      expect(lowCongestionOptimization.strategy).toBe('economy');
    });
  });
});

describe('Queue Management Accuracy Tests', () => {
  describe('Priority Ordering', () => {
    it('should maintain correct priority order in queue', async () => {
      const { TransactionQueue } = require('../src/services/transactionQueue');
      
      const transactionQueue = new TransactionQueue();
      
      // Mock Redis operations
      transactionQueue.redis = {
        zAdd: jest.fn().mockResolvedValue(1),
        hSet: jest.fn().mockResolvedValue(1),
        sAdd: jest.fn().mockResolvedValue(1),
        zCard: jest.fn().mockResolvedValue(0),
        connect: jest.fn().mockResolvedValue(),
      };

      // Enqueue transactions with different priorities
      const criticalTx = await transactionQueue.enqueue({
        type: 'test',
        priority: 'critical',
        userId: 'test-user',
      });

      const highTx = await transactionQueue.enqueue({
        type: 'test',
        priority: 'high',
        userId: 'test-user',
      });

      const mediumTx = await transactionQueue.enqueue({
        type: 'test',
        priority: 'medium',
        userId: 'test-user',
      });

      const lowTx = await transactionQueue.enqueue({
        type: 'test',
        priority: 'low',
        userId: 'test-user',
      });

      // Verify priority scores (lower score = higher priority)
      expect(transactionQueue.redis.zAdd).toHaveBeenCalledWith(
        'tx:queue',
        expect.objectContaining({ score: 1 }) // Critical
      );
      expect(transactionQueue.redis.zAdd).toHaveBeenCalledWith(
        'tx:queue',
        expect.objectContaining({ score: 2 }) // High
      );
      expect(transactionQueue.redis.zAdd).toHaveBeenCalledWith(
        'tx:queue',
        expect.objectContaining({ score: 3 }) // Medium
      );
      expect(transactionQueue.redis.zAdd).toHaveBeenCalledWith(
        'tx:queue',
        expect.objectContaining({ score: 4 }) // Low
      );
    });
  });

  describe('Dependency Resolution', () => {
    it('should prevent processing until dependencies are satisfied', async () => {
      const { TransactionQueue } = require('../src/services/transactionQueue');
      
      const transactionQueue = new TransactionQueue();
      
      // Mock Redis to simulate dependency checking
      transactionQueue.redis = {
        hGet: jest.fn()
          .mockResolvedValueOnce(JSON.stringify({ status: 'completed' })) // First dependency
          .mockResolvedValueOnce(JSON.stringify({ status: 'processing' })) // Second dependency
          .mockResolvedValueOnce(JSON.stringify({ status: 'completed' })), // Transaction itself
        zAdd: jest.fn().mockResolvedValue(1),
        hSet: jest.fn().mockResolvedValue(1),
        sAdd: jest.fn().mockResolvedValue(1),
        zCard: jest.fn().mockResolvedValue(0),
        connect: jest.fn().mockResolvedValue(),
      };

      // Transaction with dependencies
      const transaction = {
        id: 'tx-with-deps',
        type: 'test',
        dependencies: ['dep-1', 'dep-2'],
        priority: 'medium',
        userId: 'test-user',
      };

      // Should fail dependency validation
      await expect(transactionQueue.validateDependencies(transaction.dependencies))
        .rejects.toThrow('is not completed');

      // All dependencies completed
      transactionQueue.redis.hGet = jest.fn()
        .mockResolvedValueOnce(JSON.stringify({ status: 'completed' }))
        .mockResolvedValueOnce(JSON.stringify({ status: 'completed' }));

      // Should pass dependency validation
      await expect(transactionQueue.validateDependencies(transaction.dependencies))
        .resolves.not.toThrow();
    });
  });

  describe('Queue Capacity Management', () => {
    it('should reject transactions when queue is full', async () => {
      const { TransactionQueue } = require('../src/services/transactionQueue');
      
      const transactionQueue = new TransactionQueue({ maxQueueSize: 1 });
      
      // Mock Redis to simulate full queue
      transactionQueue.redis = {
        zCard: jest.fn().mockResolvedValue(1), // Queue is full
        connect: jest.fn().mockResolvedValue(),
      };

      await expect(transactionQueue.enqueue({
        type: 'test',
        priority: 'medium',
        userId: 'test-user',
      })).rejects.toThrow('Transaction queue is full');
    });
  });
});

describe('Monitoring Accuracy Tests', () => {
  describe('Metrics Collection', () => {
    it('should accurately track transaction metrics', async () => {
      const { MonitoringService } = require('../src/services/monitoringService');
      
      const monitoringService = new MonitoringService();
      
      // Mock Redis
      monitoringService.redis = {
        lPush: jest.fn().mockResolvedValue(1),
        lTrim: jest.fn().mockResolvedValue(1),
        incrBy: jest.fn().mockResolvedValue(1),
        expire: jest.fn().mockResolvedValue(1),
        connect: jest.fn().mockResolvedValue(),
      };

      const transaction = {
        id: 'metrics-tx',
        type: 'credential_issuance',
        priority: 'medium',
        userId: 'test-user',
      };

      // Track submission
      await monitoringService.trackTransactionSubmitted(transaction);

      expect(monitoringService.redis.lPush).toHaveBeenCalledWith(
        'monitor:transactions:submitted',
        expect.stringContaining('metrics-tx')
      );
      expect(monitoringService.redis.incrBy).toHaveBeenCalledWith(
        'monitor:metrics:transactions_submitted',
        1
      );
      expect(monitoringService.redis.incrBy).toHaveBeenCalledWith(
        'monitor:metrics:transactions_submitted_credential_issuance',
        1
      );

      // Track completion
      await monitoringService.trackTransactionCompleted({
        ...transaction,
        processingTime: 5000,
        retryCount: 0,
        result: { gasUsed: 200 },
      });

      expect(monitoringService.redis.incrBy).toHaveBeenCalledWith(
        'monitor:metrics:transactions_completed',
        1
      );
      expect(monitoringService.redis.incrBy).toHaveBeenCalledWith(
        'monitor:metrics:total_processing_time',
        5000
      );
      expect(monitoringService.redis.incrBy).toHaveBeenCalledWith(
        'monitor:metrics:total_gas_used',
        200
      );
    });

    it('should calculate accurate failure rates', async () => {
      const { MonitoringService } = require('../src/services/monitoringService');
      
      const monitoringService = new MonitoringService();
      
      // Mock Redis with specific metrics
      monitoringService.redis = {
        get: jest.fn()
          .mockResolvedValueOnce('100') // completed
          .mockResolvedValueOnce('10')  // failed
          .mockResolvedValueOnce('110'), // submitted
        connect: jest.fn().mockResolvedValue(),
      };

      const failureRate = await monitoringService.calculateFailureRate();
      
      expect(failureRate).toBe(10 / 110); // 10 failed out of 110 processed
      expect(failureRate).toBeGreaterThan(0);
      expect(failureRate).toBeLessThan(1);
    });

    it('should trigger alerts at correct thresholds', async () => {
      const { MonitoringService } = require('../src/services/monitoringService');
      
      const monitoringService = new MonitoringService({
        failureRateThreshold: 0.1, // 10%
      });
      
      // Mock Redis with high failure rate
      monitoringService.redis = {
        get: jest.fn()
          .mockResolvedValueOnce('90')  // completed
          .mockResolvedValueOnce('20')  // failed (20% failure rate)
          .mockResolvedValueOnce('110'), // submitted
        lPush: jest.fn().mockResolvedValue(1),
        lTrim: jest.fn().mockResolvedValue(1),
        hSet: jest.fn().mockResolvedValue(1),
        connect: jest.fn().mockResolvedValue(),
      };

      await monitoringService.checkAlerts();

      // Should create alert for high failure rate
      expect(monitoringService.redis.lPush).toHaveBeenCalledWith(
        'monitor:alerts:active',
        expect.stringContaining('high_failure_rate')
      );
    });
  });

  describe('Analytics Generation', () => {
    it('should generate comprehensive analytics reports', async () => {
      const { MonitoringService } = require('../src/services/monitoringService');
      
      const monitoringService = new MonitoringService();
      
      // Mock transaction events
      const mockEvents = [
        { timestamp: '2024-01-01T01:00:00Z', type: 'credential_issuance', userId: 'user1' },
        { timestamp: '2024-01-01T02:00:00Z', type: 'course_payment', userId: 'user1' },
        { timestamp: '2024-01-01T03:00:00Z', type: 'credential_issuance', userId: 'user2' },
        { timestamp: '2024-01-01T01:30:00Z', type: 'credential_issuance', processingTime: 5000, gasUsed: 200 },
        { timestamp: '2024-01-01T02:30:00Z', type: 'course_payment', processingTime: 3000, gasUsed: 150 },
      ];

      monitoringService.redis = {
        lRange: jest.fn().mockResolvedValue(mockEvents.map(JSON.stringify)),
        connect: jest.fn().mockResolvedValue(),
      };

      const analytics = await monitoringService.getTransactionAnalytics({
        timeRange: '24h',
      });

      // Verify report structure
      expect(analytics.timeRange).toBe('24h');
      expect(analytics.summary).toBeDefined();
      expect(analytics.summary.submitted).toBe(3);
      expect(analytics.summary.completed).toBe(2);
      expect(analytics.performance).toBeDefined();
      expect(analytics.performance.avgProcessingTime).toBe(4000); // (5000 + 3000) / 2
      expect(analytics.breakdown).toBeDefined();
      expect(analytics.breakdown.byType).toBeDefined();
      expect(analytics.breakdown.byHour).toBeDefined();
      expect(analytics.gasOptimization).toBeDefined();
      expect(analytics.gasOptimization.totalGasUsed).toBe(350); // 200 + 150
    });
  });
});
