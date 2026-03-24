const express = require('express');
const { TransactionQueue } = require('./services/transactionQueue');
const { StellarService } = require('./services/stellarService');
const { MonitoringService } = require('./services/monitoringService');
const { authenticateToken: authMiddleware } = require('../middleware/auth');
const { 
  validateTransaction, 
  validateBulkTransaction,
  validatePaginationQuery,
  validateTransactionFilter,
  validateAnalyticsQuery,
  validateTransactionDependencies,
  validateUserTierLimits
} = require('../middleware/validation');

const router = express.Router();

// Initialize services
const transactionQueue = new TransactionQueue();
const stellarService = new StellarService();
const monitoringService = new MonitoringService();

/**
 * Submit a new transaction to the queue
 * POST /api/transactions/submit
 */
router.post('/submit', authMiddleware, validateTransaction, validateTransactionDependencies, async (req, res) => {
  try {
    const { type, payload, priority, userId, dependencies } = req.body;
    
    const transaction = await transactionQueue.enqueue({
      type,
      payload,
      priority: priority || 'medium',
      userId,
      dependencies: dependencies || [],
      submittedAt: new Date(),
    });

    monitoringService.trackTransactionSubmitted(transaction);

    res.status(201).json({
      success: true,
      data: {
        transactionId: transaction.id,
        status: transaction.status,
        queuePosition: transaction.queuePosition,
        estimatedProcessingTime: transaction.estimatedProcessingTime,
      },
    });
  } catch (error) {
    console.error('Transaction submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit transaction',
      error: error.message,
    });
  }
});

/**
 * Get transaction status
 * GET /api/transactions/:transactionId/status
 */
router.get('/:transactionId/status', authMiddleware, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const transaction = await transactionQueue.getTransaction(transactionId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    res.json({
      success: true,
      data: {
        id: transaction.id,
        status: transaction.status,
        type: transaction.type,
        priority: transaction.priority,
        submittedAt: transaction.submittedAt,
        processedAt: transaction.processedAt,
        completedAt: transaction.completedAt,
        retryCount: transaction.retryCount,
        maxRetries: transaction.maxRetries,
        stellarTransactionHash: transaction.stellarTransactionHash,
        errorMessage: transaction.errorMessage,
        queuePosition: transaction.queuePosition,
        estimatedProcessingTime: transaction.estimatedProcessingTime,
      },
    });
  } catch (error) {
    console.error('Transaction status query error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get transaction status',
      error: error.message,
    });
  }
});

/**
 * Get queue statistics
 * GET /api/transactions/queue/stats
 */
router.get('/queue/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await transactionQueue.getQueueStats();
    const monitoringStats = await monitoringService.getQueueMetrics();

    res.json({
      success: true,
      data: {
        ...stats,
        monitoring: monitoringStats,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error('Queue stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get queue statistics',
      error: error.message,
    });
  }
});

/**
 * Get user's transaction history
 * GET /api/transactions/user/:userId
 */
router.get('/user/:userId', authMiddleware, validatePaginationQuery, validateTransactionFilter, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, status, type } = req.query;

    const transactions = await transactionQueue.getUserTransactions(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      type,
    });

    res.json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    console.error('User transactions query error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user transactions',
      error: error.message,
    });
  }
});

/**
 * Cancel a pending transaction
 * DELETE /api/transactions/:transactionId
 */
router.delete('/:transactionId', authMiddleware, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user.id;

    const success = await transactionQueue.cancelTransaction(transactionId, userId);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found or cannot be cancelled',
      });
    }

    monitoringService.trackTransactionCancelled(transactionId);

    res.json({
      success: true,
      message: 'Transaction cancelled successfully',
    });
  } catch (error) {
    console.error('Transaction cancellation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel transaction',
      error: error.message,
    });
  }
});

/**
 * Retry a failed transaction
 * POST /api/transactions/:transactionId/retry
 */
router.post('/:transactionId/retry', authMiddleware, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user.id;

    const transaction = await transactionQueue.retryTransaction(transactionId, userId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found or cannot be retried',
      });
    }

    monitoringService.trackTransactionRetried(transaction);

    res.json({
      success: true,
      data: {
        transactionId: transaction.id,
        status: transaction.status,
        retryCount: transaction.retryCount,
        queuePosition: transaction.queuePosition,
      },
    });
  } catch (error) {
    console.error('Transaction retry error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retry transaction',
      error: error.message,
    });
  }
});

/**
 * Submit bulk transactions
 * POST /api/transactions/bulk
 */
router.post('/bulk', authMiddleware, validateBulkTransaction, validateUserTierLimits, async (req, res) => {
  try {
    const { transactions, options = {} } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Transactions array is required and cannot be empty',
      });
    }

    if (transactions.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 100 transactions allowed per bulk submission',
      });
    }

    const results = await transactionQueue.enqueueBulk(transactions.map(tx => ({
      ...tx,
      userId,
      submittedAt: new Date(),
    })), options);

    monitoringService.trackBulkTransactionSubmitted(results);

    res.status(201).json({
      success: true,
      data: {
        submitted: results.successful.length,
        failed: results.failed.length,
        transactionIds: results.successful.map(tx => tx.id),
        errors: results.failed.map(f => ({ index: f.index, error: f.error })),
        bulkId: results.bulkId,
      },
    });
  } catch (error) {
    console.error('Bulk transaction submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit bulk transactions',
      error: error.message,
    });
  }
});

/**
 * Get transaction analytics
 * GET /api/transactions/analytics
 */
router.get('/analytics', authMiddleware, validateAnalyticsQuery, async (req, res) => {
  try {
    const { timeRange = '24h', userId, type } = req.query;
    
    const analytics = await monitoringService.getTransactionAnalytics({
      timeRange,
      userId,
      type,
    });

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('Transaction analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get transaction analytics',
      error: error.message,
    });
  }
});

/**
 * Get network status and gas optimization info
 * GET /api/transactions/network/status
 */
router.get('/network/status', authMiddleware, async (req, res) => {
  try {
    const networkStatus = await stellarService.getNetworkStatus();
    const gasOptimization = await stellarService.getGasOptimizationInfo();

    res.json({
      success: true,
      data: {
        network: networkStatus,
        gasOptimization,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error('Network status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get network status',
      error: error.message,
    });
  }
});

/**
 * Webhook endpoint for Stellar transaction confirmations
 * POST /api/transactions/webhook/stellar
 */
router.post('/webhook/stellar', async (req, res) => {
  try {
    const { transactionHash, status, result } = req.body;
    
    await transactionQueue.handleStellarWebhook(transactionHash, status, result);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Stellar webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process webhook',
      error: error.message,
    });
  }
});

module.exports = router;
