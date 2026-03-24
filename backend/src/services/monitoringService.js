const Redis = require('redis');
const winston = require('winston');
const { EventEmitter } = require('events');

class MonitoringService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.redis = Redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: options.redisDb || 2, // Separate DB for monitoring
    });

    // Logger configuration
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'transaction-monitoring' },
      transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ],
    });

    // Metrics storage keys
    this.keys = {
      metrics: 'monitor:metrics',
      alerts: 'monitor:alerts',
      performance: 'monitor:performance',
      transactions: 'monitor:transactions',
      queue: 'monitor:queue',
      network: 'monitor:network',
    };

    // Alert thresholds
    this.thresholds = {
      queueSize: options.queueSizeThreshold || 1000,
      failureRate: options.failureRateThreshold || 0.1, // 10%
      avgProcessingTime: options.avgProcessingTimeThreshold || 30000, // 30 seconds
      gasFeeSpike: options.gasFeeSpikeThreshold || 2.0, // 2x normal
      networkCongestion: options.networkCongestionThreshold || 0.8,
    };

    // Initialize metrics
    this.initializeMetrics();
  }

  async initializeMetrics() {
    try {
      await this.redis.connect();
      
      // Set up periodic metrics collection
      this.startMetricsCollection();
      
      console.log('Monitoring service initialized');
      
    } catch (error) {
      console.error('Failed to initialize monitoring service:', error);
      throw error;
    }
  }

  startMetricsCollection() {
    // Collect metrics every 30 seconds
    setInterval(async () => {
      try {
        await this.collectQueueMetrics();
        await this.collectPerformanceMetrics();
        await this.checkAlerts();
      } catch (error) {
        this.logger.error('Error in metrics collection:', error);
      }
    }, 30000);

    // Generate hourly reports
    setInterval(async () => {
      try {
        await this.generateHourlyReport();
      } catch (error) {
        this.logger.error('Error generating hourly report:', error);
      }
    }, 3600000); // 1 hour
  }

  async trackTransactionSubmitted(transaction) {
    try {
      const timestamp = new Date().toISOString();
      
      // Store transaction event
      await this.redis.lPush(
        `${this.keys.transactions}:submitted`,
        JSON.stringify({
          transactionId: transaction.id,
          type: transaction.type,
          priority: transaction.priority,
          userId: transaction.userId,
          timestamp,
        })
      );

      // Keep only last 1000 events
      await this.redis.lTrim(`${this.keys.transactions}:submitted`, 0, 999);

      // Update metrics
      await this.updateMetric('transactions_submitted', 1);
      await this.updateMetric(`transactions_submitted_${transaction.type}`, 1);

      // Log event
      this.logger.info('Transaction submitted', {
        transactionId: transaction.id,
        type: transaction.type,
        userId: transaction.userId,
      });

      // Emit event for real-time monitoring
      this.emit('transaction_submitted', transaction);

    } catch (error) {
      this.logger.error('Failed to track transaction submission:', error);
    }
  }

  async trackTransactionCompleted(transaction) {
    try {
      const timestamp = new Date().toISOString();
      const processingTime = new Date(transaction.completedAt) - new Date(transaction.processedAt);
      
      // Store completion event
      await this.redis.lPush(
        `${this.keys.transactions}:completed`,
        JSON.stringify({
          transactionId: transaction.id,
          type: transaction.type,
          processingTime,
          retryCount: transaction.retryCount,
          gasUsed: transaction.result?.gasUsed || 0,
          timestamp,
        })
      );

      // Keep only last 1000 events
      await this.redis.lTrim(`${this.keys.transactions}:completed`, 0, 999);

      // Update metrics
      await this.updateMetric('transactions_completed', 1);
      await this.updateMetric(`transactions_completed_${transaction.type}`, 1);
      await this.updateMetric('total_processing_time', processingTime);
      await this.updateMetric('total_gas_used', transaction.result?.gasUsed || 0);

      // Calculate average processing time
      const avgProcessingTime = await this.calculateAverageProcessingTime();
      await this.redis.set(`${this.keys.performance}:avg_processing_time`, avgProcessingTime);

      // Log completion
      this.logger.info('Transaction completed', {
        transactionId: transaction.id,
        type: transaction.type,
        processingTime,
        retryCount: transaction.retryCount,
      });

      // Emit event
      this.emit('transaction_completed', transaction);

    } catch (error) {
      this.logger.error('Failed to track transaction completion:', error);
    }
  }

  async trackTransactionFailed(transaction) {
    try {
      const timestamp = new Date().toISOString();
      
      // Store failure event
      await this.redis.lPush(
        `${this.keys.transactions}:failed`,
        JSON.stringify({
          transactionId: transaction.id,
          type: transaction.type,
          retryCount: transaction.retryCount,
          error: transaction.lastError,
          timestamp,
        })
      );

      // Keep only last 1000 events
      await this.redis.lTrim(`${this.keys.transactions}:failed`, 0, 999);

      // Update metrics
      await this.updateMetric('transactions_failed', 1);
      await this.updateMetric(`transactions_failed_${transaction.type}`, 1);

      // Calculate failure rate
      const failureRate = await this.calculateFailureRate();
      await this.redis.set(`${this.keys.metrics}:failure_rate`, failureRate);

      // Check if failure rate exceeds threshold
      if (failureRate > this.thresholds.failureRate) {
        await this.createAlert('high_failure_rate', {
          currentRate: failureRate,
          threshold: this.thresholds.failureRate,
          timestamp,
        });
      }

      // Log failure
      this.logger.error('Transaction failed', {
        transactionId: transaction.id,
        type: transaction.type,
        retryCount: transaction.retryCount,
        error: transaction.lastError,
      });

      // Emit event
      this.emit('transaction_failed', transaction);

    } catch (error) {
      this.logger.error('Failed to track transaction failure:', error);
    }
  }

  async trackTransactionCancelled(transactionId) {
    try {
      const timestamp = new Date().toISOString();
      
      await this.redis.lPush(
        `${this.keys.transactions}:cancelled`,
        JSON.stringify({
          transactionId,
          timestamp,
        })
      );

      await this.redis.lTrim(`${this.keys.transactions}:cancelled`, 0, 999);

      await this.updateMetric('transactions_cancelled', 1);

      this.logger.info('Transaction cancelled', { transactionId });

      this.emit('transaction_cancelled', { transactionId });

    } catch (error) {
      this.logger.error('Failed to track transaction cancellation:', error);
    }
  }

  async trackTransactionRetried(transaction) {
    try {
      const timestamp = new Date().toISOString();
      
      await this.redis.lPush(
        `${this.keys.transactions}:retried`,
        JSON.stringify({
          transactionId: transaction.id,
          retryCount: transaction.retryCount,
          timestamp,
        })
      );

      await this.redis.lTrim(`${this.keys.transactions}:retried`, 0, 999);

      await this.updateMetric('transactions_retried', 1);

      this.logger.info('Transaction retried', {
        transactionId: transaction.id,
        retryCount: transaction.retryCount,
      });

      this.emit('transaction_retried', transaction);

    } catch (error) {
      this.logger.error('Failed to track transaction retry:', error);
    }
  }

  async trackBulkTransactionSubmitted(results) {
    try {
      const timestamp = new Date().toISOString();
      
      await this.redis.lPush(
        `${this.keys.transactions}:bulk_submitted`,
        JSON.stringify({
          bulkId: results.bulkId,
          submitted: results.successful.length,
          failed: results.failed.length,
          timestamp,
        })
      );

      await this.redis.lTrim(`${this.keys.transactions}:bulk_submitted`, 0, 999);

      await this.updateMetric('bulk_submissions', 1);
      await this.updateMetric('bulk_transactions_submitted', results.successful.length);
      await this.updateMetric('bulk_transactions_failed', results.failed.length);

      this.logger.info('Bulk transaction submitted', {
        bulkId: results.bulkId,
        submitted: results.successful.length,
        failed: results.failed.length,
      });

      this.emit('bulk_transaction_submitted', results);

    } catch (error) {
      this.logger.error('Failed to track bulk transaction submission:', error);
    }
  }

  async trackQueueFull() {
    try {
      const timestamp = new Date().toISOString();
      
      await this.redis.lPush(
        `${this.keys.queue}:full_events`,
        JSON.stringify({ timestamp })
      );

      await this.redis.lTrim(`${this.keys.queue}:full_events`, 0, 99);

      await this.updateMetric('queue_full_events', 1);

      await this.createAlert('queue_full', {
        timestamp,
        message: 'Transaction queue is full',
      });

      this.logger.warn('Transaction queue is full');

      this.emit('queue_full');

    } catch (error) {
      this.logger.error('Failed to track queue full event:', error);
    }
  }

  async collectQueueMetrics() {
    try {
      // This would connect to the transaction queue service to get real metrics
      // For now, we'll simulate the collection
      const queueMetrics = {
        timestamp: new Date().toISOString(),
        queueSize: Math.floor(Math.random() * 100),
        processingCount: Math.floor(Math.random() * 10),
        completedCount: Math.floor(Math.random() * 1000),
        failedCount: Math.floor(Math.random() * 50),
      };

      await this.redis.hSet(
        `${this.keys.queue}:metrics`,
        'latest',
        JSON.stringify(queueMetrics)
      );

      // Store historical data (keep last 24 hours)
      await this.redis.lPush(
        `${this.keys.queue}:history`,
        JSON.stringify(queueMetrics)
      );
      await this.redis.lTrim(`${this.keys.queue}:history`, 0, 2879); // 48 entries per hour * 24 hours

    } catch (error) {
      this.logger.error('Failed to collect queue metrics:', error);
    }
  }

  async collectPerformanceMetrics() {
    try {
      const timestamp = new Date().toISOString();
      
      // Calculate performance metrics
      const [avgProcessingTime, failureRate, throughput] = await Promise.all([
        this.calculateAverageProcessingTime(),
        this.calculateFailureRate(),
        this.calculateThroughput(),
      ]);

      const performanceMetrics = {
        timestamp,
        avgProcessingTime,
        failureRate,
        throughput, // transactions per minute
        gasOptimization: await this.calculateGasOptimizationRate(),
      };

      await this.redis.hSet(
        `${this.keys.performance}:metrics`,
        'latest',
        JSON.stringify(performanceMetrics)
      );

      // Store historical data
      await this.redis.lPush(
        `${this.keys.performance}:history`,
        JSON.stringify(performanceMetrics)
      );
      await this.redis.lTrim(`${this.keys.performance}:history`, 0, 2879);

    } catch (error) {
      this.logger.error('Failed to collect performance metrics:', error);
    }
  }

  async calculateAverageProcessingTime() {
    try {
      const recentCompletions = await this.redis.lRange(
        `${this.keys.transactions}:completed`,
        0,
        99 // Last 100 completions
      );

      if (recentCompletions.length === 0) return 0;

      const totalProcessingTime = recentCompletions.reduce((sum, event) => {
        const data = JSON.parse(event);
        return sum + data.processingTime;
      }, 0);

      return Math.round(totalProcessingTime / recentCompletions.length);

    } catch (error) {
      this.logger.error('Failed to calculate average processing time:', error);
      return 0;
    }
  }

  async calculateFailureRate() {
    try {
      const [submitted, completed, failed] = await Promise.all([
        this.getMetric('transactions_submitted'),
        this.getMetric('transactions_completed'),
        this.getMetric('transactions_failed'),
      ]);

      const totalProcessed = completed + failed;
      if (totalProcessed === 0) return 0;

      return failed / totalProcessed;

    } catch (error) {
      this.logger.error('Failed to calculate failure rate:', error);
      return 0;
    }
  }

  async calculateThroughput() {
    try {
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      
      const recentCompletions = await this.redis.lRange(
        `${this.keys.transactions}:completed`,
        0,
        -1
      );

      const hourlyCompletions = recentCompletions.filter(event => {
        const data = JSON.parse(event);
        return data.timestamp > oneHourAgo;
      });

      return Math.round(hourlyCompletions.length / 60); // per minute

    } catch (error) {
      this.logger.error('Failed to calculate throughput:', error);
      return 0;
    }
  }

  async calculateGasOptimizationRate() {
    try {
      const recentCompletions = await this.redis.lRange(
        `${this.keys.transactions}:completed`,
        0,
        99
      );

      if (recentCompletions.length === 0) return 0;

      const optimizedTransactions = recentCompletions.filter(event => {
        const data = JSON.parse(event);
        return data.gasUsed > 0;
      });

      return optimizedTransactions.length / recentCompletions.length;

    } catch (error) {
      this.logger.error('Failed to calculate gas optimization rate:', error);
      return 0;
    }
  }

  async checkAlerts() {
    try {
      const metrics = await this.getAllMetrics();
      
      // Check various alert conditions
      if (metrics.queueSize > this.thresholds.queueSize) {
        await this.createAlert('high_queue_size', {
          current: metrics.queueSize,
          threshold: this.thresholds.queueSize,
        });
      }

      if (metrics.avgProcessingTime > this.thresholds.avgProcessingTime) {
        await this.createAlert('slow_processing', {
          current: metrics.avgProcessingTime,
          threshold: this.thresholds.avgProcessingTime,
        });
      }

      if (metrics.failureRate > this.thresholds.failureRate) {
        await this.createAlert('high_failure_rate', {
          current: metrics.failureRate,
          threshold: this.thresholds.failureRate,
        });
      }

    } catch (error) {
      this.logger.error('Failed to check alerts:', error);
    }
  }

  async createAlert(type, data) {
    try {
      const alert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        severity: this.getAlertSeverity(type),
        data,
        timestamp: new Date().toISOString(),
        acknowledged: false,
      };

      await this.redis.lPush(
        `${this.keys.alerts}:active`,
        JSON.stringify(alert)
      );

      // Keep only last 100 alerts
      await this.redis.lTrim(`${this.keys.alerts}:active`, 0, 99);

      this.logger.warn('Alert created', { type, data });

      this.emit('alert', alert);

    } catch (error) {
      this.logger.error('Failed to create alert:', error);
    }
  }

  getAlertSeverity(type) {
    const severityMap = {
      'queue_full': 'critical',
      'high_failure_rate': 'high',
      'slow_processing': 'medium',
      'high_queue_size': 'medium',
      'network_congestion': 'high',
    };

    return severityMap[type] || 'low';
  }

  async getQueueMetrics() {
    try {
      const latest = await this.redis.hGet(`${this.keys.queue}:metrics`, 'latest');
      return latest ? JSON.parse(latest) : null;
    } catch (error) {
      this.logger.error('Failed to get queue metrics:', error);
      return null;
    }
  }

  async getTransactionAnalytics(options = {}) {
    try {
      const { timeRange = '24h', userId, type } = options;
      
      // Calculate time range
      const now = new Date();
      let startTime;
      
      switch (timeRange) {
        case '1h':
          startTime = new Date(now.getTime() - 3600000);
          break;
        case '24h':
          startTime = new Date(now.getTime() - 86400000);
          break;
        case '7d':
          startTime = new Date(now.getTime() - 604800000);
          break;
        case '30d':
          startTime = new Date(now.getTime() - 2592000000);
          break;
        default:
          startTime = new Date(now.getTime() - 86400000);
      }

      const startTimeStr = startTime.toISOString();

      // Get transactions in time range
      const [submitted, completed, failed] = await Promise.all([
        this.getTransactionsInTimeRange('submitted', startTimeStr, userId, type),
        this.getTransactionsInTimeRange('completed', startTimeStr, userId, type),
        this.getTransactionsInTimeRange('failed', startTimeStr, userId, type),
      ]);

      // Calculate analytics
      const analytics = {
        timeRange,
        period: {
          start: startTimeStr,
          end: now.toISOString(),
        },
        summary: {
          submitted: submitted.length,
          completed: completed.length,
          failed: failed.length,
          successRate: submitted.length > 0 ? completed.length / submitted.length : 0,
          failureRate: submitted.length > 0 ? failed.length / submitted.length : 0,
        },
        performance: {
          avgProcessingTime: this.calculateAvgProcessingTimeFromList(completed),
          throughput: submitted.length / ((now - startTime) / 60000), // per minute
        },
        breakdown: {
          byType: this.breakdownByType(submitted, completed, failed),
          byHour: this.breakdownByHour(submitted, startTime),
        },
        gasOptimization: {
          totalGasUsed: completed.reduce((sum, tx) => sum + (tx.gasUsed || 0), 0),
          avgGasPerTransaction: completed.length > 0 ? 
            completed.reduce((sum, tx) => sum + (tx.gasUsed || 0), 0) / completed.length : 0,
        },
      };

      return analytics;

    } catch (error) {
      this.logger.error('Failed to get transaction analytics:', error);
      throw error;
    }
  }

  async getTransactionsInTimeRange(status, startTime, userId, type) {
    try {
      const events = await this.redis.lRange(`${this.keys.transactions}:${status}`, 0, -1);
      
      return events
        .map(event => JSON.parse(event))
        .filter(event => {
          const matchesTime = event.timestamp >= startTime;
          const matchesUser = !userId || event.userId === userId;
          const matchesType = !type || event.type === type;
          return matchesTime && matchesUser && matchesType;
        });

    } catch (error) {
      this.logger.error(`Failed to get ${status} transactions:`, error);
      return [];
    }
  }

  calculateAvgProcessingTimeFromList(transactions) {
    if (transactions.length === 0) return 0;
    
    const totalTime = transactions.reduce((sum, tx) => sum + (tx.processingTime || 0), 0);
    return Math.round(totalTime / transactions.length);
  }

  breakdownByType(submitted, completed, failed) {
    const breakdown = {};
    
    // Combine all transactions and group by type
    [...submitted, ...completed, ...failed].forEach(tx => {
      if (!breakdown[tx.type]) {
        breakdown[tx.type] = { submitted: 0, completed: 0, failed: 0 };
      }
      
      if (submitted.includes(tx)) breakdown[tx.type].submitted++;
      else if (completed.includes(tx)) breakdown[tx.type].completed++;
      else if (failed.includes(tx)) breakdown[tx.type].failed++;
    });

    return breakdown;
  }

  breakdownByHour(transactions, startTime) {
    const breakdown = {};
    
    transactions.forEach(tx => {
      const hour = new Date(tx.timestamp).getHours();
      breakdown[hour] = (breakdown[hour] || 0) + 1;
    });

    return breakdown;
  }

  async getAllMetrics() {
    try {
      const [queueMetrics, performanceMetrics] = await Promise.all([
        this.getQueueMetrics(),
        this.redis.hGet(`${this.keys.performance}:metrics`, 'latest'),
      ]);

      return {
        queueSize: queueMetrics?.queueSize || 0,
        avgProcessingTime: performanceMetrics ? 
          JSON.parse(performanceMetrics).avgProcessingTime : 0,
        failureRate: await this.calculateFailureRate(),
        throughput: await this.calculateThroughput(),
      };

    } catch (error) {
      this.logger.error('Failed to get all metrics:', error);
      return {};
    }
  }

  async updateMetric(key, value) {
    try {
      await this.redis.incrBy(`${this.keys.metrics}:${key}`, value);
      await this.redis.expire(`${this.keys.metrics}:${key}`, 86400); // 24 hours
    } catch (error) {
      this.logger.error('Failed to update metric:', error);
    }
  }

  async getMetric(key) {
    try {
      const value = await this.redis.get(`${this.keys.metrics}:${key}`);
      return value ? parseInt(value) : 0;
    } catch (error) {
      this.logger.error('Failed to get metric:', error);
      return 0;
    }
  }

  async generateHourlyReport() {
    try {
      const timestamp = new Date().toISOString();
      const metrics = await this.getAllMetrics();
      
      const report = {
        timestamp,
        metrics,
        alerts: await this.getActiveAlerts(),
        recommendations: this.generateRecommendations(metrics),
      };

      // Store report
      await this.redis.lPush(
        `${this.keys.metrics}:hourly_reports`,
        JSON.stringify(report)
      );
      await this.redis.lTrim(`${this.keys.metrics}:hourly_reports`, 0, 167); // Keep 7 days

      this.logger.info('Hourly report generated', report);

    } catch (error) {
      this.logger.error('Failed to generate hourly report:', error);
    }
  }

  async getActiveAlerts() {
    try {
      const alerts = await this.redis.lRange(`${this.keys.alerts}:active`, 0, -1);
      return alerts.map(alert => JSON.parse(alert));
    } catch (error) {
      this.logger.error('Failed to get active alerts:', error);
      return [];
    }
  }

  generateRecommendations(metrics) {
    const recommendations = [];

    if (metrics.queueSize > this.thresholds.queueSize * 0.8) {
      recommendations.push({
        type: 'queue_capacity',
        message: 'Queue approaching capacity limit',
        action: 'Consider increasing queue size or optimizing processing',
      });
    }

    if (metrics.avgProcessingTime > this.thresholds.avgProcessingTime * 0.8) {
      recommendations.push({
        type: 'performance',
        message: 'Processing time is elevated',
        action: 'Review transaction complexity and optimize gas fees',
      });
    }

    if (metrics.failureRate > this.thresholds.failureRate * 0.5) {
      recommendations.push({
        type: 'reliability',
        message: 'Failure rate is increasing',
        action: 'Review retry logic and network conditions',
      });
    }

    return recommendations;
  }

  async cleanup() {
    await this.redis.quit();
  }
}

module.exports = { MonitoringService };
