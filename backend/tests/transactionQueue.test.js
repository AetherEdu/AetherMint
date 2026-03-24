const request = require('supertest');
const app = require('../src/index');
const { TransactionQueue } = require('../src/services/transactionQueue');
const { StellarService } = require('../src/services/stellarService');
const { MonitoringService } = require('../src/services/monitoringService');

// Mock services
jest.mock('../src/services/transactionQueue');
jest.mock('../src/services/stellarService');
jest.mock('../src/services/monitoringService');

describe('Transaction Queue API', () => {
  let authToken;
  let mockUser;

  beforeAll(async () => {
    // Setup test user and auth token
    mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'user',
      tier: 'basic',
    };

    // Generate mock JWT token
    const jwt = require('jsonwebtoken');
    authToken = jwt.sign(mockUser, process.env.JWT_SECRET || 'test-secret');
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock implementations
    TransactionQueue.mockImplementation(() => ({
      enqueue: jest.fn().mockResolvedValue({
        id: 'test-tx-id',
        status: 'queued',
        queuePosition: 1,
        estimatedProcessingTime: 5000,
      }),
      getTransaction: jest.fn().mockResolvedValue({
        id: 'test-tx-id',
        status: 'completed',
        type: 'credential_issuance',
        priority: 'medium',
        submittedAt: '2024-01-01T00:00:00.000Z',
        processedAt: '2024-01-01T00:00:05.000Z',
        completedAt: '2024-01-01T00:00:10.000Z',
        retryCount: 0,
        maxRetries: 3,
        stellarTransactionHash: 'test-hash',
      }),
      getQueueStats: jest.fn().mockResolvedValue({
        queued: 10,
        processing: 5,
        completed: 100,
        failed: 2,
        total: 117,
      }),
      getUserTransactions: jest.fn().mockResolvedValue({
        transactions: [
          {
            id: 'test-tx-1',
            type: 'credential_issuance',
            status: 'completed',
            submittedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          pages: 1,
        },
      }),
      cancelTransaction: jest.fn().mockResolvedValue(true),
      retryTransaction: jest.fn().mockResolvedValue({
        id: 'test-tx-id',
        status: 'queued',
        retryCount: 1,
        queuePosition: 1,
      }),
      enqueueBulk: jest.fn().mockResolvedValue({
        successful: [{ id: 'bulk-tx-1' }, { id: 'bulk-tx-2' }],
        failed: [],
        bulkId: 'bulk-test-id',
      }),
    }));

    StellarService.mockImplementation(() => ({
      getNetworkStatus: jest.fn().mockResolvedValue({
        congestionLevel: 0.3,
        feeStats: { min: 100, max: 1000, mode: 200 },
      }),
      getGasOptimizationInfo: jest.fn().mockResolvedValue({
        currentNetworkStats: { congestionLevel: 0.3 },
        optimizationStrategies: {
          economy: { confidence: 0.85, estimatedSavings: '20-30%' },
        },
      }),
    }));

    MonitoringService.mockImplementation(() => ({
      trackTransactionSubmitted: jest.fn(),
      trackTransactionCompleted: jest.fn(),
      trackTransactionFailed: jest.fn(),
      trackTransactionCancelled: jest.fn(),
      trackTransactionRetried: jest.fn(),
      trackBulkTransactionSubmitted: jest.fn(),
      getQueueMetrics: jest.fn().mockResolvedValue({
        queueSize: 10,
        processingCount: 5,
      }),
      getTransactionAnalytics: jest.fn().mockResolvedValue({
        summary: { submitted: 50, completed: 45, failed: 5 },
        performance: { avgProcessingTime: 5000, throughput: 10 },
      }),
    }));
  });

  describe('POST /api/transactions/submit', () => {
    const validTransaction = {
      type: 'credential_issuance',
      payload: {
        sourceAccount: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
        secretKey: 'SABCDEFGHIJKLMNOPQRSTUVWXYZ123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
        recipients: [
          {
            address: 'GBCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
            amount: '10',
          },
        ],
        credentialData: {
          courseId: 'test-course',
          studentName: 'Test Student',
        },
        gasOptimization: {
          strategy: 'standard',
          estimatedFee: 200,
          savings: 0,
          confidence: 0.95,
        },
      },
      priority: 'medium',
      userId: 'test-user-id',
    };

    it('should submit a transaction successfully', async () => {
      const response = await request(app)
        .post('/api/transactions/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validTransaction)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactionId).toBeDefined();
      expect(response.body.data.status).toBe('queued');
    });

    it('should reject invalid transaction type', async () => {
      const invalidTransaction = {
        ...validTransaction,
        type: 'invalid_type',
      };

      const response = await request(app)
        .post('/api/transactions/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidTransaction)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .post('/api/transactions/submit')
        .send(validTransaction)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Access token required');
    });

    it('should reject invalid Stellar public key', async () => {
      const invalidTransaction = {
        ...validTransaction,
        payload: {
          ...validTransaction.payload,
          sourceAccount: 'invalid-key',
        },
      };

      const response = await request(app)
        .post('/api/transactions/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidTransaction)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('GET /api/transactions/:transactionId/status', () => {
    it('should return transaction status', async () => {
      const response = await request(app)
        .get('/api/transactions/test-tx-id/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('test-tx-id');
      expect(response.body.data.status).toBe('completed');
    });

    it('should handle non-existent transaction', async () => {
      const mockQueue = new TransactionQueue();
      mockQueue.getTransaction = jest.fn().mockResolvedValue(null);
      
      TransactionQueue.mockImplementation(() => mockQueue);

      const response = await request(app)
        .get('/api/transactions/non-existent/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('GET /api/transactions/queue/stats', () => {
    it('should return queue statistics', async () => {
      const response = await request(app)
        .get('/api/transactions/queue/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.queued).toBe(10);
      expect(response.body.data.processing).toBe(5);
      expect(response.body.data.completed).toBe(100);
      expect(response.body.data.failed).toBe(2);
    });
  });

  describe('GET /api/transactions/user/:userId', () => {
    it('should return user transactions', async () => {
      const response = await request(app)
        .get('/api/transactions/test-user-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions).toHaveLength(1);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/transactions/test-user-id?page=2&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.page).toBe(2);
      expect(response.body.data.pagination.limit).toBe(10);
    });
  });

  describe('DELETE /api/transactions/:transactionId', () => {
    it('should cancel a transaction', async () => {
      const response = await request(app)
        .delete('/api/transactions/test-tx-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('cancelled successfully');
    });

    it('should handle cancellation failure', async () => {
      const mockQueue = new TransactionQueue();
      mockQueue.cancelTransaction = jest.fn().mockResolvedValue(false);
      
      TransactionQueue.mockImplementation(() => mockQueue);

      const response = await request(app)
        .delete('/api/transactions/test-tx-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('cannot be cancelled');
    });
  });

  describe('POST /api/transactions/:transactionId/retry', () => {
    it('should retry a failed transaction', async () => {
      const response = await request(app)
        .post('/api/transactions/test-tx-id/retry')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('queued');
      expect(response.body.data.retryCount).toBe(1);
    });
  });

  describe('POST /api/transactions/bulk', () => {
    const bulkTransactions = {
      transactions: [
        {
          type: 'credential_issuance',
          payload: {
            sourceAccount: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
            secretKey: 'SABCDEFGHIJKLMNOPQRSTUVWXYZ123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
            recipients: [{ address: 'GBCDEFGHIJKLMNOPQRSTUVWXYZ123456789', amount: '10' }],
            gasOptimization: { strategy: 'standard', estimatedFee: 200, savings: 0, confidence: 0.95 },
          },
        },
        {
          type: 'course_payment',
          payload: {
            sourceAccount: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
            secretKey: 'SABCDEFGHIJKLMNOPQRSTUVWXYZ123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
            merchantAccount: 'GBCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
            amount: '100',
            gasOptimization: { strategy: 'priority', estimatedFee: 300, savings: 0, confidence: 0.99 },
          },
        },
      ],
    };

    it('should submit bulk transactions', async () => {
      const response = await request(app)
        .post('/api/transactions/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send(bulkTransactions)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.submitted).toBe(2);
      expect(response.body.data.failed).toBe(0);
      expect(response.body.data.transactionIds).toHaveLength(2);
      expect(response.body.data.bulkId).toBeDefined();
    });

    it('should reject empty transactions array', async () => {
      const response = await request(app)
        .post('/api/transactions/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ transactions: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('cannot be empty');
    });

    it('should reject too many transactions', async () => {
      const tooManyTransactions = {
        transactions: Array(101).fill(bulkTransactions.transactions[0]),
      };

      const response = await request(app)
        .post('/api/transactions/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send(tooManyTransactions)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Maximum 100 transactions');
    });
  });

  describe('GET /api/transactions/analytics', () => {
    it('should return transaction analytics', async () => {
      const response = await request(app)
        .get('/api/transactions/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.performance).toBeDefined();
    });

    it('should support time range parameter', async () => {
      const response = await request(app)
        .get('/api/transactions/analytics?timeRange=7d')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.timeRange).toBe('7d');
    });
  });

  describe('GET /api/transactions/network/status', () => {
    it('should return network status', async () => {
      const response = await request(app)
        .get('/api/transactions/network/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.network).toBeDefined();
      expect(response.body.data.gasOptimization).toBeDefined();
    });
  });

  describe('POST /api/transactions/webhook/stellar', () => {
    it('should handle Stellar webhook', async () => {
      const webhookData = {
        transactionHash: 'test-hash',
        status: 'success',
        result: { ledger: 12345 },
      };

      const response = await request(app)
        .post('/api/transactions/webhook/stellar')
        .send(webhookData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});

describe('Transaction Queue Service', () => {
  let transactionQueue;

  beforeEach(() => {
    jest.clearAllMocks();
    transactionQueue = new TransactionQueue();
  });

  describe('Priority Queue Management', () => {
    it('should handle different priority levels', async () => {
      const criticalTx = { type: 'test', priority: 'critical' };
      const lowTx = { type: 'test', priority: 'low' };

      // Mock Redis operations
      transactionQueue.redis = {
        zAdd: jest.fn().mockResolvedValue(1),
        hSet: jest.fn().mockResolvedValue(1),
        sAdd: jest.fn().mockResolvedValue(1),
        zCard: jest.fn().mockResolvedValue(0),
        connect: jest.fn().mockResolvedValue(),
      };

      await transactionQueue.enqueue(criticalTx);
      await transactionQueue.enqueue(lowTx);

      expect(transactionQueue.redis.zAdd).toHaveBeenCalledWith(
        'tx:queue',
        expect.objectContaining({ score: 1 }) // Critical priority
      );
      expect(transactionQueue.redis.zAdd).toHaveBeenCalledWith(
        'tx:queue',
        expect.objectContaining({ score: 4 }) // Low priority
      );
    });
  });

  describe('Dependency Management', () => {
    it('should validate transaction dependencies', async () => {
      const transaction = {
        id: 'tx-1',
        dependencies: ['dep-1', 'dep-2'],
      };

      transactionQueue.redis = {
        hGet: jest.fn().mockResolvedValue(JSON.stringify({ status: 'completed' })),
        zAdd: jest.fn().mockResolvedValue(1),
        hSet: jest.fn().mockResolvedValue(1),
        sAdd: jest.fn().mockResolvedValue(1),
        zCard: jest.fn().mockResolvedValue(0),
        connect: jest.fn().mockResolvedValue(),
      };

      // Should not throw when dependencies are completed
      await expect(transactionQueue.validateDependencies(transaction.dependencies))
        .resolves.not.toThrow();
    });

    it('should reject incomplete dependencies', async () => {
      const transaction = {
        id: 'tx-1',
        dependencies: ['dep-1'],
      };

      transactionQueue.redis = {
        hGet: jest.fn().mockResolvedValue(JSON.stringify({ status: 'processing' })),
        connect: jest.fn().mockResolvedValue(),
      };

      await expect(transactionQueue.validateDependencies(transaction.dependencies))
        .rejects.toThrow('is not completed');
    });
  });

  describe('Retry Logic', () => {
    it('should handle transaction retries with exponential backoff', async () => {
      const transaction = {
        id: 'tx-1',
        retryCount: 1,
        maxRetries: 3,
        priority: 2,
      };

      transactionQueue.redis = {
        hGet: jest.fn().mockResolvedValue(JSON.stringify(transaction)),
        hSet: jest.fn().mockResolvedValue(1),
        sRem: jest.fn().mockResolvedValue(1),
        zAdd: jest.fn().mockResolvedValue(1),
        connect: jest.fn().mockResolvedValue(),
      };

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      await transactionQueue.handleTransactionFailure('tx-1', new Error('Test error'));

      expect(setTimeoutSpy).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Number) // Should be retryDelay * retryCount
      );

      setTimeoutSpy.mockRestore();
    });

    it('should mark transaction as permanently failed after max retries', async () => {
      const transaction = {
        id: 'tx-1',
        retryCount: 3,
        maxRetries: 3,
        priority: 2,
      };

      transactionQueue.redis = {
        hGet: jest.fn().mockResolvedValue(JSON.stringify(transaction)),
        hSet: jest.fn().mockResolvedValue(1),
        sRem: jest.fn().mockResolvedValue(1),
        sAdd: jest.fn().mockResolvedValue(1),
        connect: jest.fn().mockResolvedValue(),
      };

      await transactionQueue.handleTransactionFailure('tx-1', new Error('Test error'));

      expect(transactionQueue.redis.sAdd).toHaveBeenCalledWith('tx:failed', 'tx-1');
    });
  });
});

describe('Stellar Service', () => {
  let stellarService;

  beforeEach(() => {
    jest.clearAllMocks();
    stellarService = new StellarService();
  });

  describe('Gas Fee Optimization', () => {
    it('should optimize fees based on network congestion', async () => {
      const mockNetworkStatus = {
        congestionLevel: 0.9, // High congestion
        feeStats: { min: 100, max: 1000, p70: 500, p50: 200 },
      };

      stellarService.getNetworkStatus = jest.fn().mockResolvedValue(mockNetworkStatus);

      const optimization = await stellarService.optimizeGasFees({
        type: 'course_payment',
        payload: { amount: '100' },
        networkStatus: mockNetworkStatus,
      });

      expect(optimization.strategy).toBe('priority');
      expect(optimization.confidence).toBe(0.99);
      expect(optimization.estimatedFee).toBeGreaterThan(200); // Higher than base
    });

    it('should apply economy strategy for low congestion', async () => {
      const mockNetworkStatus = {
        congestionLevel: 0.1, // Low congestion
        feeStats: { min: 100, max: 1000, p50: 200 },
      };

      stellarService.getNetworkStatus = jest.fn().mockResolvedValue(mockNetworkStatus);

      const optimization = await stellarService.optimizeGasFees({
        type: 'profile_update',
        payload: { updatedFields: { name: 'test' } },
        networkStatus: mockNetworkStatus,
      });

      expect(optimization.strategy).toBe('economy');
      expect(optimization.confidence).toBe(0.85);
      expect(optimization.savings).toBeGreaterThan(0);
    });
  });

  describe('Transaction Building', () => {
    it('should build credential issuance transaction', async () => {
      const payload = {
        sourceAccount: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
        recipients: [{ address: 'GBCDEFGHIJKLMNOPQRSTUVWXYZ123456789', amount: '10' }],
        credentialData: { courseId: 'test-course' },
        gasOptimization: { estimatedFee: 200 },
      };

      // Mock Stellar SDK
      const mockTransaction = {
        addMemo: jest.fn(),
        addOperation: jest.fn(),
        setTimeout: jest.fn(),
        build: jest.fn().mockReturnValue({ hash: 'test-hash' }),
      };

      const mockBuilder = {
        addMemo: jest.fn().mockReturnThis(),
        addOperation: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue(mockTransaction),
      };

      jest.doMock('@stellar/stellar-sdk', () => ({
        Server: jest.fn(),
        Networks: { TESTNET: 'testnet' },
        TransactionBuilder: {
          fromXDR: jest.fn(),
        },
        Operation: {
          payment: jest.fn(),
          manageData: jest.fn(),
        },
        Asset: {
          native: jest.fn(),
        },
        Memo: {
          text: jest.fn(),
        },
      }));

      const transaction = await stellarService.buildCredentialIssuanceTransaction(
        { sequence: 1 }, // Mock account
        payload
      );

      expect(transaction).toBeDefined();
    });
  });
});

describe('Monitoring Service', () => {
  let monitoringService;

  beforeEach(() => {
    jest.clearAllMocks();
    monitoringService = new MonitoringService();
  });

  describe('Metrics Collection', () => {
    it('should track transaction submission', async () => {
      const transaction = {
        id: 'tx-1',
        type: 'credential_issuance',
        priority: 'medium',
        userId: 'user-1',
      };

      monitoringService.redis = {
        lPush: jest.fn().mockResolvedValue(1),
        lTrim: jest.fn().mockResolvedValue(1),
        incrBy: jest.fn().mockResolvedValue(1),
        expire: jest.fn().mockResolvedValue(1),
        connect: jest.fn().mockResolvedValue(),
      };

      await monitoringService.trackTransactionSubmitted(transaction);

      expect(monitoringService.redis.lPush).toHaveBeenCalledWith(
        'monitor:transactions:submitted',
        expect.stringContaining('tx-1')
      );
      expect(monitoringService.redis.incrBy).toHaveBeenCalledWith(
        'monitor:metrics:transactions_submitted',
        1
      );
    });

    it('should calculate failure rate correctly', async () => {
      monitoringService.redis = {
        get: jest.fn()
          .mockResolvedValueOnce('100') // completed
          .mockResolvedValueOnce('10')  // failed
          .mockResolvedValueOnce('110'), // submitted
      };

      const failureRate = await monitoringService.calculateFailureRate();
      expect(failureRate).toBe(10 / 110); // 10 failed out of 110 processed
    });

    it('should create alerts when thresholds are exceeded', async () => {
      monitoringService.thresholds.failureRate = 0.05; // 5%
      monitoringService.redis = {
        get: jest.fn()
          .mockResolvedValueOnce('95')  // completed
          .mockResolvedValueOnce('10')  // failed
          .mockResolvedValueOnce('105'), // submitted
        lPush: jest.fn().mockResolvedValue(1),
        lTrim: jest.fn().mockResolvedValue(1),
        connect: jest.fn().mockResolvedValue(),
      };

      await monitoringService.checkAlerts();

      expect(monitoringService.redis.lPush).toHaveBeenCalledWith(
        'monitor:alerts:active',
        expect.stringContaining('high_failure_rate')
      );
    });
  });

  describe('Analytics Generation', () => {
    it('should generate transaction analytics for time range', async () => {
      const mockEvents = [
        { timestamp: '2024-01-01T01:00:00Z', type: 'credential_issuance', userId: 'user1' },
        { timestamp: '2024-01-01T02:00:00Z', type: 'course_payment', userId: 'user1' },
      ];

      monitoringService.redis = {
        lRange: jest.fn().mockResolvedValue(mockEvents.map(JSON.stringify)),
        connect: jest.fn().mockResolvedValue(),
      };

      const analytics = await monitoringService.getTransactionAnalytics({
        timeRange: '24h',
        userId: 'user1',
      });

      expect(analytics.summary.submitted).toBe(2);
      expect(analytics.summary.completed).toBe(0); // No completed events in mock
      expect(analytics.breakdown.byType).toBeDefined();
      expect(analytics.breakdown.byHour).toBeDefined();
    });
  });
});
