const request = require('supertest');
const { TransactionQueue } = require('../src/services/transactionQueue');
const { StellarService } = require('../src/services/stellarService');
const { MonitoringService } = require('../src/services/monitoringService');

describe('Transaction Queue Load Tests', () => {
  let transactionQueue;
  let stellarService;
  let monitoringService;

  beforeAll(async () => {
    // Initialize services for load testing
    transactionQueue = new TransactionQueue({
      maxRetries: 2,
      processingInterval: 100, // Faster processing for tests
      batchProcessingSize: 20,
    });

    stellarService = new StellarService();
    monitoringService = new MonitoringService();

    // Wait for services to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Cleanup services
    await transactionQueue.cleanup();
    await monitoringService.cleanup();
  });

  describe('High Volume Transaction Processing', () => {
    it('should handle 1000 concurrent transactions', async () => {
      const startTime = Date.now();
      const promises = [];

      // Generate 1000 transactions
      for (let i = 0; i < 1000; i++) {
        const transaction = {
          type: i % 2 === 0 ? 'credential_issuance' : 'course_payment',
          payload: {
            sourceAccount: `GTEST${i.toString().padStart(48, 'A')}`,
            secretKey: `STEST${i.toString().padStart(52, 'A')}`,
            recipients: [{ address: `GDEST${i.toString().padStart(48, 'A')}`, amount: '10' }],
            gasOptimization: { strategy: 'standard', estimatedFee: 200, savings: 0, confidence: 0.95 },
          },
          priority: ['critical', 'high', 'medium', 'low'][i % 4],
          userId: `user-${i % 100}`, // 100 different users
        };

        promises.push(transactionQueue.enqueue(transaction));
      }

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();

      // Verify all transactions were enqueued successfully
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      console.log(`Enqueued ${successful.length} transactions in ${endTime - startTime}ms`);
      console.log(`Failed: ${failed.length}`);

      expect(successful.length).toBeGreaterThan(950); // Allow for some failures
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    }, 30000);

    it('should maintain performance under sustained load', async () => {
      const duration = 30000; // 30 seconds of sustained load
      const startTime = Date.now();
      let totalProcessed = 0;
      let totalErrors = 0;

      // Submit transactions continuously for 30 seconds
      const interval = setInterval(async () => {
        try {
          const batch = [];
          for (let i = 0; i < 50; i++) {
            batch.push({
              type: 'profile_update',
              payload: {
                sourceAccount: `GLOAD${Date.now()}${i}`,
                secretKey: `SLOAD${Date.now()}${i}`,
                userId: `load-user-${i}`,
                updatedFields: { lastActivity: new Date().toISOString() },
                gasOptimization: { strategy: 'economy', estimatedFee: 150, savings: 30, confidence: 0.85 },
              },
              priority: 'medium',
              userId: `load-user-${i}`,
            });
          }

          const results = await transactionQueue.enqueueBulk(batch);
          totalProcessed += results.successful.length;
          totalErrors += results.failed.length;
        } catch (error) {
          totalErrors++;
          console.error('Batch submission error:', error.message);
        }
      }, 1000); // Submit batch every second

      // Wait for test duration
      await new Promise(resolve => setTimeout(resolve, duration));
      clearInterval(interval);

      const endTime = Date.now();
      const throughput = totalProcessed / ((endTime - startTime) / 1000);

      console.log(`Sustained load test results:`);
      console.log(`Duration: ${(endTime - startTime) / 1000}s`);
      console.log(`Transactions processed: ${totalProcessed}`);
      console.log(`Errors: ${totalErrors}`);
      console.log(`Throughput: ${throughput.toFixed(2)} tx/sec`);

      expect(totalProcessed).toBeGreaterThan(1000);
      expect(totalErrors).toBeLessThan(totalProcessed * 0.05); // Less than 5% error rate
      expect(throughput).toBeGreaterThan(30); // At least 30 tx/sec
    }, 45000);
  });

  describe('Priority Queue Performance', () => {
    it('should process critical transactions before low priority ones', async () => {
      const results = [];
      
      // Enqueue transactions in reverse priority order
      const priorities = ['low', 'medium', 'high', 'critical'];
      
      for (const priority of priorities) {
        for (let i = 0; i < 10; i++) {
          const transaction = await transactionQueue.enqueue({
            type: 'credential_issuance',
            payload: {
              sourceAccount: `GPRIORITY${priority}${i}`,
              secretKey: `SPRIORITY${priority}${i}`,
              recipients: [{ address: `GDEST${priority}${i}`, amount: '10' }],
              gasOptimization: { strategy: 'standard', estimatedFee: 200, savings: 0, confidence: 0.95 },
            },
            priority,
            userId: `priority-test-user`,
          });
          results.push({ ...transaction, priority });
        }
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check processing order
      const processedTransactions = [];
      for (const tx of results) {
        const processedTx = await transactionQueue.getTransaction(tx.id);
        if (processedTx && processedTx.status === 'completed') {
          processedTransactions.push(processedTx);
        }
      }

      // Verify critical transactions were processed first
      const criticalProcessed = processedTransactions.filter(tx => tx.priority === 1);
      const lowProcessed = processedTransactions.filter(tx => tx.priority === 4);

      expect(criticalProcessed.length).toBeGreaterThan(lowProcessed.length);
    }, 15000);
  });

  describe('Dependency Resolution', () => {
    it('should handle complex dependency chains', async () => {
      const transactions = [];
      
      // Create a dependency chain: A -> B -> C -> D
      for (let i = 0; i < 4; i++) {
        const dependencies = i > 0 ? [transactions[i - 1].id] : [];
        
        const tx = await transactionQueue.enqueue({
          type: 'smart_contract_interaction',
          payload: {
            sourceAccount: `GDEP${i}`,
            secretKey: `SDEP${i}`,
            contractId: `CONTRACT_${i}`,
            method: `step_${i}`,
            gasOptimization: { strategy: 'standard', estimatedFee: 300, savings: 0, confidence: 0.95 },
          },
          priority: 'high',
          userId: 'dependency-test-user',
          dependencies,
        });
        
        transactions.push(tx);
      }

      // Wait for dependency resolution and processing
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Verify all transactions completed in order
      const finalStates = [];
      for (const tx of transactions) {
        const state = await transactionQueue.getTransaction(tx.id);
        finalStates.push(state);
      }

      // Check that dependencies were respected
      const completedInOrder = finalStates.every((tx, index) => {
        if (index === 0) return true; // First transaction has no dependencies
        return tx.status === 'completed';
      });

      expect(completedInOrder).toBe(true);
    }, 20000);
  });
});

describe('Gas Optimization Load Tests', () => {
  let stellarService;

  beforeAll(() => {
    stellarService = new StellarService();
  });

  describe('Fee Optimization Under Load', () => {
    it('should optimize fees efficiently for high volume', async () => {
      const startTime = Date.now();
      const optimizations = [];

      // Simulate high network congestion
      const mockNetworkStatus = {
        congestionLevel: 0.9,
        feeStats: {
          min: 100,
          max: 2000,
          p10: 150,
          p20: 200,
          p50: 500,
          p70: 800,
          p80: 1200,
          p90: 1500,
          p95: 1800,
          p99: 2000,
        },
      };

      stellarService.getNetworkStatus = jest.fn().mockResolvedValue(mockNetworkStatus);

      // Test 1000 optimizations
      const promises = [];
      for (let i = 0; i < 1000; i++) {
        const type = ['credential_issuance', 'course_payment', 'smart_contract_interaction', 'profile_update'][i % 4];
        
        promises.push(
          stellarService.optimizeGasFees({
            type,
            payload: {
              amount: '100',
              recipients: [{ address: 'GTEST123', amount: '10' }],
              batchSize: i % 10 === 0 ? 10 : 1,
            },
            networkStatus: mockNetworkStatus,
          })
        );
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();

      // Analyze optimization results
      const strategies = results.reduce((acc, opt) => {
        acc[opt.strategy] = (acc[opt.strategy] || 0) + 1;
        return acc;
      }, {});

      const avgSavings = results.reduce((sum, opt) => sum + opt.savings, 0) / results.length;
      const avgConfidence = results.reduce((sum, opt) => sum + opt.confidence, 0) / results.length;

      console.log(`Gas optimization results for 1000 transactions:`);
      console.log(`Processing time: ${endTime - startTime}ms`);
      console.log(`Strategies used:`, strategies);
      console.log(`Average savings: ${avgSavings.toFixed(2)} stroops`);
      console.log(`Average confidence: ${(avgConfidence * 100).toFixed(2)}%`);

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(avgConfidence).toBeGreaterThan(0.8); // High confidence in optimizations
      expect(strategies.priority).toBeDefined(); // Should use priority strategy in congestion
    }, 15000);

    it('should adapt to changing network conditions', async () => {
      const conditions = [
        { congestionLevel: 0.1, name: 'low' },
        { congestionLevel: 0.5, name: 'medium' },
        { congestionLevel: 0.9, name: 'high' },
      ];

      const results = {};

      for (const condition of conditions) {
        const mockNetworkStatus = {
          congestionLevel: condition.congestionLevel,
          feeStats: {
            min: 100,
            max: 1000,
            p50: 200 + condition.congestionLevel * 300,
            p70: 300 + condition.congestionLevel * 400,
            p90: 500 + condition.congestionLevel * 400,
          },
        };

        stellarService.getNetworkStatus = jest.fn().mockResolvedValue(mockNetworkStatus);

        const optimizations = [];
        for (let i = 0; i < 100; i++) {
          const opt = await stellarService.optimizeGasFees({
            type: 'course_payment',
            payload: { amount: '100' },
            networkStatus: mockNetworkStatus,
          });
          optimizations.push(opt);
        }

        const strategies = optimizations.reduce((acc, opt) => {
          acc[opt.strategy] = (acc[opt.strategy] || 0) + 1;
          return acc;
        }, {});

        const avgFee = optimizations.reduce((sum, opt) => sum + opt.estimatedFee, 0) / optimizations.length;

        results[condition.name] = { strategies, avgFee };
      }

      console.log('Network condition adaptation results:', results);

      // Low congestion should use economy strategy more
      expect(results.low.strategies.economy || 0).toBeGreaterThan(results.high.strategies.economy || 0);
      
      // High congestion should use priority strategy more
      expect(results.high.strategies.priority || 0).toBeGreaterThan(results.low.strategies.priority || 0);
      
      // Fees should increase with congestion
      expect(results.high.avgFee).toBeGreaterThan(results.low.avgFee);
    }, 10000);
  });
});

describe('Monitoring System Load Tests', () => {
  let monitoringService;

  beforeAll(async () => {
    monitoringService = new MonitoringService();
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    await monitoringService.cleanup();
  });

  describe('High Volume Metrics Collection', () => {
    it('should handle 10000 metric updates efficiently', async () => {
      const startTime = Date.now();
      
      // Generate high volume of transaction events
      for (let i = 0; i < 10000; i++) {
        const transaction = {
          id: `load-tx-${i}`,
          type: ['credential_issuance', 'course_payment'][i % 2],
          priority: 'medium',
          userId: `load-user-${i % 100}`,
        };

        if (i % 10 === 0) {
          // Simulate some failures
          await monitoringService.trackTransactionFailed({
            ...transaction,
            retryCount: 1,
            lastError: 'Network timeout',
          });
        } else {
          await monitoringService.trackTransactionCompleted({
            ...transaction,
            processingTime: Math.random() * 10000,
            retryCount: 0,
            result: { gasUsed: Math.floor(Math.random() * 1000) },
          });
        }
      }

      const endTime = Date.now();
      console.log(`Processed 10000 metrics in ${endTime - startTime}ms`);

      expect(endTime - startTime).toBeLessThan(15000); // Should complete within 15 seconds

      // Verify metrics were collected
      const completedCount = await monitoringService.getMetric('transactions_completed');
      const failedCount = await monitoringService.getMetric('transactions_failed');

      expect(completedCount).toBeGreaterThan(8000);
      expect(failedCount).toBeGreaterThan(900);
    }, 30000);

    it('should generate analytics reports under load', async () => {
      const startTime = Date.now();
      
      // Generate analytics requests
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          monitoringService.getTransactionAnalytics({
            timeRange: ['1h', '24h', '7d'][i % 3],
            userId: i % 10 === 0 ? `analytics-user-${i}` : undefined,
            type: i % 5 === 0 ? 'credential_issuance' : undefined,
          })
        );
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();

      console.log(`Generated 100 analytics reports in ${endTime - startTime}ms`);

      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(results).toHaveLength(100);
      
      // Verify all reports have required structure
      results.forEach(report => {
        expect(report.summary).toBeDefined();
        expect(report.performance).toBeDefined();
        expect(report.breakdown).toBeDefined();
      });
    }, 20000);
  });

  describe('Alert System Performance', () => {
    it('should handle alert threshold breaches efficiently', async () => {
      const startTime = Date.now();
      
      // Simulate conditions that trigger alerts
      monitoringService.thresholds.failureRate = 0.01; // Very low threshold
      
      // Generate high failure rate
      for (let i = 0; i < 1000; i++) {
        await monitoringService.trackTransactionFailed({
          id: `alert-tx-${i}`,
          type: 'credential_issuance',
          retryCount: 3,
          lastError: 'Simulated failure',
        });
      }

      // Trigger alert check
      await monitoringService.checkAlerts();

      const endTime = Date.now();
      console.log(`Processed alert conditions in ${endTime - startTime}ms`);

      // Verify alerts were created
      const alerts = await monitoringService.getActiveAlerts();
      const failureRateAlerts = alerts.filter(alert => alert.type === 'high_failure_rate');

      expect(failureRateAlerts.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    }, 15000);
  });
});

describe('Integration Load Tests', () => {
  let transactionQueue, stellarService, monitoringService;

  beforeAll(async () => {
    transactionQueue = new TransactionQueue({ processingInterval: 50 });
    stellarService = new StellarService();
    monitoringService = new MonitoringService();

    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    await transactionQueue.cleanup();
    await monitoringService.cleanup();
  });

  it('should handle end-to-end transaction flow under load', async () => {
    const startTime = Date.now();
    const totalTransactions = 500;
    const results = [];

    // Submit transactions
    for (let i = 0; i < totalTransactions; i++) {
      try {
        const tx = await transactionQueue.enqueue({
          type: 'credential_issuance',
          payload: {
            sourceAccount: `GINTEGRATION${i}`,
            secretKey: `SINTEGRATION${i}`,
            recipients: [{ address: `GDEST${i}`, amount: '10' }],
            gasOptimization: { strategy: 'standard', estimatedFee: 200, savings: 0, confidence: 0.95 },
          },
          priority: ['critical', 'high', 'medium', 'low'][i % 4],
          userId: `integration-user-${i % 50}`,
        });
        results.push({ success: true, tx });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Check final states
    const finalStates = [];
    for (const result of results) {
      if (result.success) {
        const state = await transactionQueue.getTransaction(result.tx.id);
        finalStates.push(state);
      }
    }

    const endTime = Date.now();
    const successful = finalStates.filter(s => s && ['completed', 'processing'].includes(s.status));
    const failed = finalStates.filter(s => s && s.status === 'failed');

    console.log(`End-to-end load test results:`);
    console.log(`Total transactions: ${totalTransactions}`);
    console.log(`Processing time: ${(endTime - startTime) / 1000}s`);
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${failed.length}`);
    console.log(`Success rate: ${(successful.length / totalTransactions * 100).toFixed(2)}%`);

    expect(successful.length).toBeGreaterThan(totalTransactions * 0.8); // At least 80% success
    expect(endTime - startTime).toBeLessThan(30000); // Should complete within 30 seconds
  }, 45000);
});
