const express = require('express');
const Joi = require('joi');
const Transaction = require('../models/Transaction');
const transactionQueue = require('../services/transactionQueue');
const transactionProcessor = require('../workers/transactionProcessor');
const transactionEvents = require('../events/transactionEvents');
const stellarUtils = require('../utils/stellarUtils');
const logger = require('../utils/logger');
const { transactionLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Validation schemas
const createTransactionSchema = Joi.object({
  userId: Joi.string().required(),
  type: Joi.string().valid('payment', 'account_creation', 'trustline', 'claimable_balance', 'multisig', 'other').required(),
  sourceAccount: Joi.string().required(),
  destinationAccount: Joi.string().when('type', {
    is: 'payment',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  amount: Joi.string().when('type', {
    is: 'payment',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  asset: Joi.object({
    code: Joi.string().required(),
    issuer: Joi.string().when('code', {
      is: 'XLM',
      then: Joi.optional(),
      otherwise: Joi.required()
    })
  }).when('type', {
    is: 'payment',
    then: Joi.optional(),
    otherwise: Joi.optional()
  }),
  transactionXdr: Joi.string().optional(),
  signedTransactionXdr: Joi.string().optional(),
  priority: Joi.string().valid('high', 'medium', 'low').default('medium'),
  maxRetries: Joi.number().integer().min(1).max(10).default(3),
  metadata: Joi.object().default({})
});

const getTransactionsSchema = Joi.object({
  userId: Joi.string().required(),
  status: Joi.string().valid('pending', 'processing', 'submitted', 'success', 'failed', 'timeout').optional(),
  type: Joi.string().valid('payment', 'account_creation', 'trustline', 'claimable_balance', 'multisig', 'other').optional(),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0)
});

/**
 * POST /api/transactions
 * Create and queue a new transaction
 */
router.post('/', transactionLimiter, async (req, res) => {
  try {
    const { error, value } = createTransactionSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    // Validate Stellar addresses if provided
    if (!stellarUtils.validateAddress(value.sourceAccount)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid source account address'
      });
    }

    if (value.destinationAccount && !stellarUtils.validateAddress(value.destinationAccount)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid destination account address'
      });
    }

    // Create and queue transaction
    const transaction = await transactionQueue.enqueueTransaction(value, {
      priority: value.priority,
      maxRetries: value.maxRetries
    });

    res.status(201).json({
      success: true,
      message: 'Transaction queued successfully',
      data: {
        transactionId: transaction.id,
        userId: transaction.userId,
        type: transaction.type,
        status: transaction.status,
        priority: transaction.priority,
        createdAt: transaction.createdAt
      }
    });

  } catch (error) {
    logger.error('Error creating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * GET /api/transactions
 * Get transactions with optional filtering
 */
router.get('/', async (req, res) => {
  try {
    const { error, value } = getTransactionsSchema.validate(req.query);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const transactions = await Transaction.findByUser(value.userId, {
      status: value.status,
      type: value.type,
      limit: value.limit
    });

    const totalCount = await Transaction.countDocuments({
      userId: value.userId,
      ...(value.status && { status: value.status }),
      ...(value.type && { type: value.type })
    });

    res.json({
      success: true,
      data: {
        transactions: transactions.map(tx => ({
          id: tx.id,
          userId: tx.userId,
          type: tx.type,
          status: tx.status,
          priority: tx.priority,
          sourceAccount: tx.sourceAccount,
          destinationAccount: tx.destinationAccount,
          amount: tx.amount,
          asset: tx.asset,
          stellarTransactionHash: tx.stellarTransactionHash,
          stellarLedger: tx.stellarLedger,
          retryCount: tx.retryCount,
          lastError: tx.lastError,
          createdAt: tx.createdAt,
          updatedAt: tx.updatedAt,
          submittedAt: tx.submittedAt,
          completedAt: tx.completedAt
        })),
        pagination: {
          total: totalCount,
          limit: value.limit,
          offset: value.offset,
          hasMore: totalCount > value.offset + value.limit
        }
      }
    });

  } catch (error) {
    logger.error('Error getting transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * GET /api/transactions/:transactionId
 * Get specific transaction details
 */
router.get('/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;

    const transaction = await Transaction.findOne({ id: transactionId });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: transaction.id,
        userId: transaction.userId,
        type: transaction.type,
        status: transaction.status,
        priority: transaction.priority,
        sourceAccount: transaction.sourceAccount,
        destinationAccount: transaction.destinationAccount,
        amount: transaction.amount,
        asset: transaction.asset,
        transactionXdr: transaction.transactionXdr,
        signedTransactionXdr: transaction.signedTransactionXdr,
        stellarTransactionHash: transaction.stellarTransactionHash,
        stellarLedger: transaction.stellarLedger,
        retryCount: transaction.retryCount,
        maxRetries: transaction.maxRetries,
        lastError: transaction.lastError,
        metadata: transaction.metadata,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
        submittedAt: transaction.submittedAt,
        completedAt: transaction.completedAt
      }
    });

  } catch (error) {
    logger.error('Error getting transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * GET /api/transactions/:transactionId/status
 * Get transaction status with additional details
 */
router.get('/:transactionId/status', async (req, res) => {
  try {
    const { transactionId } = req.params;

    const transaction = await Transaction.findOne({ id: transactionId });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    let stellarStatus = null;
    if (transaction.stellarTransactionHash) {
      try {
        stellarStatus = await stellarUtils.getTransactionStatus(transaction.stellarTransactionHash);
      } catch (error) {
        logger.warn(`Error getting Stellar status for ${transactionId}:`, error);
      }
    }

    const queuePosition = await transactionQueue.getQueuePosition(transactionId);

    res.json({
      success: true,
      data: {
        transactionId: transaction.id,
        status: transaction.status,
        queuePosition,
        stellarStatus,
        retryCount: transaction.retryCount,
        maxRetries: transaction.maxRetries,
        lastError: transaction.lastError,
        canRetry: transaction.canRetry(),
        timestamps: {
          createdAt: transaction.createdAt,
          updatedAt: transaction.updatedAt,
          submittedAt: transaction.submittedAt,
          completedAt: transaction.completedAt
        }
      }
    });

  } catch (error) {
    logger.error('Error getting transaction status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * POST /api/transactions/:transactionId/retry
 * Retry a failed transaction
 */
router.post('/:transactionId/retry', async (req, res) => {
  try {
    const { transactionId } = req.params;

    const transaction = await Transaction.findOne({ id: transactionId });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    if (!transaction.canRetry()) {
      return res.status(400).json({
        success: false,
        message: 'Transaction cannot be retried',
        data: {
          status: transaction.status,
          retryCount: transaction.retryCount,
          maxRetries: transaction.maxRetries
        }
      });
    }

    // Reset transaction for retry
    await transaction.resetForRetry();

    // Re-queue transaction
    await transactionQueue.enqueueTransaction({
      id: transaction.id,
      userId: transaction.userId,
      type: transaction.type,
      sourceAccount: transaction.sourceAccount,
      destinationAccount: transaction.destinationAccount,
      amount: transaction.amount,
      asset: transaction.asset,
      transactionXdr: transaction.transactionXdr,
      signedTransactionXdr: transaction.signedTransactionXdr,
      metadata: transaction.metadata
    }, {
      priority: transaction.priority,
      maxRetries: transaction.maxRetries
    });

    res.json({
      success: true,
      message: 'Transaction queued for retry',
      data: {
        transactionId: transaction.id,
        retryCount: transaction.retryCount,
        status: transaction.status
      }
    });

  } catch (error) {
    logger.error('Error retrying transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * GET /api/transactions/queue/stats
 * Get queue statistics
 */
router.get('/queue/stats', async (req, res) => {
  try {
    const queueStats = await transactionQueue.getQueueStats();
    const processorStats = transactionProcessor.getStats();
    const eventStats = transactionEvents.getStats();

    res.json({
      success: true,
      data: {
        queue: queueStats,
        processor: processorStats,
        events: eventStats
      }
    });

  } catch (error) {
    logger.error('Error getting queue stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * GET /api/transactions/user/:userId/pending
 * Get pending transactions for a user
 */
router.get('/user/:userId/pending', async (req, res) => {
  try {
    const { userId } = req.params;

    const pendingTransactions = await transactionQueue.getUserPendingTransactions(userId);

    res.json({
      success: true,
      data: {
        transactions: pendingTransactions.map(tx => ({
          id: tx.id,
          type: tx.type,
          priority: tx.priority,
          createdAt: tx.createdAt,
          queuePosition: null // Will be populated if needed
        })),
        count: pendingTransactions.length
      }
    });

  } catch (error) {
    logger.error('Error getting pending transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * GET /api/transactions/user/:userId/events
 * Get recent events for a user
 */
router.get('/user/:userId/events', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;

    const events = await transactionEvents.getUserRecentEvents(userId, parseInt(limit));

    res.json({
      success: true,
      data: {
        events,
        count: events.length
      }
    });

  } catch (error) {
    logger.error('Error getting user events:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * POST /api/transactions/admin/clear-queue
 * Clear the transaction queue (admin only)
 */
router.post('/admin/clear-queue', async (req, res) => {
  try {
    // This should be protected by admin middleware in production
    await transactionQueue.clearQueue();

    res.json({
      success: true,
      message: 'Transaction queue cleared successfully'
    });

  } catch (error) {
    logger.error('Error clearing queue:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * POST /api/transactions/admin/retry-failed
 * Retry all failed transactions (admin only)
 */
router.post('/admin/retry-failed', async (req, res) => {
  try {
    // This should be protected by admin middleware in production
    const { limit = 10 } = req.body;

    const retriedCount = await transactionProcessor.retryFailedTransactions(limit);

    res.json({
      success: true,
      message: `Retried ${retriedCount} failed transactions`,
      data: {
        retriedCount
      }
    });

  } catch (error) {
    logger.error('Error retrying failed transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * GET /api/transactions/stellar/account/:accountId
 * Get Stellar account information
 */
router.get('/stellar/account/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;

    if (!stellarUtils.validateAddress(accountId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Stellar account address'
      });
    }

    const accountInfo = await stellarUtils.getAccount(accountId);
    const balances = await stellarUtils.getAccountBalances(accountId);

    res.json({
      success: true,
      data: {
        account: accountInfo,
        balances
      }
    });

  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    logger.error('Error getting Stellar account:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * GET /api/transactions/stellar/fee-stats
 * Get Stellar network fee statistics
 */
router.get('/stellar/fee-stats', async (req, res) => {
  try {
    const feeStats = await stellarUtils.getFeeStats();

    res.json({
      success: true,
      data: feeStats
    });

  } catch (error) {
    logger.error('Error getting fee stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * POST /api/transactions/stellar/estimate-fee
 * Estimate transaction fee
 */
router.post('/stellar/estimate-fee', async (req, res) => {
  try {
    const { priority = 'medium' } = req.body;

    const estimatedFee = await stellarUtils.estimateSmartFee(priority);

    res.json({
      success: true,
      data: {
        priority,
        estimatedFee,
        feeInXLM: (estimatedFee / 10000000).toFixed(7) // Convert stroops to XLM
      }
    });

  } catch (error) {
    logger.error('Error estimating fee:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * POST /api/transactions/validate
 * Validate transaction data before submission
 */
router.post('/validate', async (req, res) => {
  try {
    const { error, value } = createTransactionSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const validationResults = {
      sourceAccount: stellarUtils.validateAddress(value.sourceAccount),
      destinationAccount: value.destinationAccount ? stellarUtils.validateAddress(value.destinationAccount) : true,
      asset: true
    };

    if (value.asset && value.asset.code !== 'XLM' && value.asset.issuer) {
      validationResults.asset = stellarUtils.validateAddress(value.asset.issuer);
    }

    const isValid = Object.values(validationResults).every(result => result === true);

    res.json({
      success: true,
      data: {
        isValid,
        validationResults,
        estimatedFee: await stellarUtils.estimateSmartFee(value.priority)
      }
    });

  } catch (error) {
    logger.error('Error validating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

module.exports = router;
