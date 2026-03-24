const EventEmitter = require('events');
const redisConfig = require('../config/redis');
const Transaction = require('../models/Transaction');
const logger = require('../utils/logger');

class TransactionQueue extends EventEmitter {
  constructor() {
    super();
    this.queueName = 'stellar_transactions';
    this.isProcessing = false;
    this.processingInterval = null;
    this.processingDelay = 2000; // 2 seconds between batches
    this.batchSize = 10;
    this.maxConcurrent = 5;
    this.currentlyProcessing = new Set();
    this.stats = {
      processed: 0,
      failed: 0,
      retried: 0,
      lastProcessed: null
    };
  }

  async initialize() {
    try {
      await redisConfig.initialize();
      
      // Subscribe to transaction events
      await redisConfig.subscribe('transaction_events', (message, channel) => {
        this.handleTransactionEvent(message);
      });

      logger.info('Transaction Queue initialized successfully');
      return true;

    } catch (error) {
      logger.error('Failed to initialize Transaction Queue:', error);
      throw error;
    }
  }

  /**
   * Add a transaction to the queue
   */
  async enqueueTransaction(transactionData, options = {}) {
    try {
      // Create transaction record
      const transaction = new Transaction({
        id: transactionData.id || this.generateTransactionId(),
        userId: transactionData.userId,
        type: transactionData.type,
        sourceAccount: transactionData.sourceAccount,
        destinationAccount: transactionData.destinationAccount,
        amount: transactionData.amount,
        asset: transactionData.asset,
        transactionXdr: transactionData.transactionXdr,
        priority: options.priority || 'medium',
        maxRetries: options.maxRetries || 3,
        metadata: transactionData.metadata || {}
      });

      await transaction.save();

      // Add to Redis queue
      const queueData = {
        transactionId: transaction.id,
        userId: transaction.userId,
        type: transaction.type,
        priority: transaction.priority,
        timestamp: transaction.createdAt.toISOString()
      };

      const queueOptions = {
        priority: this.getPriorityValue(transaction.priority),
        delay: options.delay || 0,
        maxRetries: transaction.maxRetries
      };

      await redisConfig.enqueue(this.queueName, queueData, queueOptions);

      // Emit event
      this.emit('transactionQueued', {
        transactionId: transaction.id,
        userId: transaction.userId,
        type: transaction.type
      });

      // Publish to Redis
      await redisConfig.publish('transaction_events', {
        type: 'TRANSACTION_QUEUED',
        data: {
          transactionId: transaction.id,
          userId: transaction.userId,
          queuePosition: await this.getQueuePosition(transaction.id)
        }
      });

      logger.info(`Transaction ${transaction.id} queued successfully`);
      return transaction;

    } catch (error) {
      logger.error(`Failed to enqueue transaction:`, error);
      throw error;
    }
  }

  /**
   * Start processing the queue
   */
  async startProcessing() {
    if (this.isProcessing) {
      logger.warn('Transaction queue processing already started');
      return;
    }

    this.isProcessing = true;
    logger.info('Starting transaction queue processing');

    this.processingInterval = setInterval(async () => {
      if (this.currentlyProcessing.size < this.maxConcurrent) {
        await this.processBatch();
      }
    }, this.processingDelay);

    // Process immediately on start
    await this.processBatch();
  }

  /**
   * Stop processing the queue
   */
  async stopProcessing() {
    if (!this.isProcessing) {
      return;
    }

    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    logger.info('Transaction queue processing stopped');
  }

  /**
   * Process a batch of transactions from the queue
   */
  async processBatch() {
    if (this.currentlyProcessing.size >= this.maxConcurrent) {
      return;
    }

    try {
      const itemsToProcess = Math.min(
        this.batchSize,
        this.maxConcurrent - this.currentlyProcessing.size
      );

      const transactions = [];
      
      for (let i = 0; i < itemsToProcess; i++) {
        try {
          const queueItem = await redisConfig.dequeue(this.queueName, 1);
          if (queueItem) {
            transactions.push(queueItem);
          }
        } catch (error) {
          logger.error('Error dequeuing transaction:', error);
        }
      }

      if (transactions.length === 0) {
        return;
      }

      // Process transactions in parallel
      const processingPromises = transactions.map(queueItem => 
        this.processTransaction(queueItem)
      );

      await Promise.allSettled(processingPromises);

    } catch (error) {
      logger.error('Error processing transaction batch:', error);
    }
  }

  /**
   * Process a single transaction
   */
  async processTransaction(queueItem) {
    const { transactionId } = queueItem;
    
    if (this.currentlyProcessing.has(transactionId)) {
      return;
    }

    this.currentlyProcessing.add(transactionId);

    try {
      const transaction = await Transaction.findOne({ id: transactionId });
      
      if (!transaction) {
        logger.warn(`Transaction ${transactionId} not found in database`);
        return;
      }

      if (transaction.status !== 'pending') {
        logger.debug(`Transaction ${transactionId} already processed or in progress`);
        return;
      }

      // Mark as processing
      await transaction.markAsProcessing();

      // Emit processing event
      this.emit('transactionProcessing', {
        transactionId: transaction.id,
        userId: transaction.userId,
        type: transaction.type
      });

      // Publish to Redis
      await redisConfig.publish('transaction_events', {
        type: 'TRANSACTION_PROCESSING',
        data: {
          transactionId: transaction.id,
          userId: transaction.userId
        }
      });

      // Process the transaction (this will be handled by the transaction processor)
      const result = await this.submitToStellar(transaction);

      if (result.success) {
        await transaction.markAsSubmitted(result.hash);
        
        this.stats.processed++;
        this.stats.lastProcessed = new Date();

        this.emit('transactionSubmitted', {
          transactionId: transaction.id,
          userId: transaction.userId,
          hash: result.hash
        });

        await redisConfig.publish('transaction_events', {
          type: 'TRANSACTION_SUBMITTED',
          data: {
            transactionId: transaction.id,
            userId: transaction.userId,
            stellarHash: result.hash
          }
        });

        logger.info(`Transaction ${transaction.id} submitted successfully with hash ${result.hash}`);

      } else {
        throw new Error(result.error || 'Transaction submission failed');
      }

    } catch (error) {
      logger.error(`Error processing transaction ${transactionId}:`, error);

      const transaction = await Transaction.findOne({ id: transactionId });
      if (transaction) {
        await transaction.markAsFailed(error.message);

        if (transaction.canRetry()) {
          // Requeue for retry
          await redisConfig.requeueForRetry(this.queueName, queueItem);
          await transaction.resetForRetry();
          
          this.stats.retried++;

          this.emit('transactionRetry', {
            transactionId: transaction.id,
            userId: transaction.userId,
            retryCount: transaction.retryCount,
            error: error.message
          });

          await redisConfig.publish('transaction_events', {
            type: 'TRANSACTION_RETRY',
            data: {
              transactionId: transaction.id,
              userId: transaction.userId,
              retryCount: transaction.retryCount,
              error: error.message
            }
          });

        } else {
          // Move to failed queue
          await redisConfig.moveToFailed(this.queueName, queueItem, error);
          
          this.stats.failed++;

          this.emit('transactionFailed', {
            transactionId: transaction.id,
            userId: transaction.userId,
            error: error.message
          });

          await redisConfig.publish('transaction_events', {
            type: 'TRANSACTION_FAILED',
            data: {
              transactionId: transaction.id,
              userId: transaction.userId,
              error: error.message
            }
          });
        }
      }

    } finally {
      this.currentlyProcessing.delete(transactionId);
    }
  }

  /**
   * Submit transaction to Stellar network
   */
  async submitToStellar(transaction) {
    // This is a placeholder - the actual Stellar submission will be handled
    // by the transaction processor worker
    return {
      success: true,
      hash: `stellar_hash_${transaction.id}_${Date.now()}`
    };
  }

  /**
   * Handle transaction events from Redis
   */
  async handleTransactionEvent(message) {
    try {
      switch (message.type) {
        case 'TRANSACTION_CONFIRMED':
          await this.handleTransactionConfirmed(message.data);
          break;
        case 'TRANSACTION_TIMEOUT':
          await this.handleTransactionTimeout(message.data);
          break;
        default:
          logger.debug(`Unknown transaction event type: ${message.type}`);
      }
    } catch (error) {
      logger.error('Error handling transaction event:', error);
    }
  }

  /**
   * Handle confirmed transaction
   */
  async handleTransactionConfirmed(data) {
    try {
      const transaction = await Transaction.findOne({ 
        stellarTransactionHash: data.hash 
      });

      if (transaction && transaction.status === 'submitted') {
        await transaction.markAsSuccess(data.ledger);
        
        this.emit('transactionConfirmed', {
          transactionId: transaction.id,
          userId: transaction.userId,
          hash: data.hash,
          ledger: data.ledger
        });

        await redisConfig.publish('transaction_events', {
          type: 'TRANSACTION_COMPLETED',
          data: {
            transactionId: transaction.id,
            userId: transaction.userId,
            stellarHash: data.hash,
            ledger: data.ledger
          }
        });
      }

    } catch (error) {
      logger.error('Error handling confirmed transaction:', error);
    }
  }

  /**
   * Handle transaction timeout
   */
  async handleTransactionTimeout(data) {
    try {
      const transaction = await Transaction.findOne({ id: data.transactionId });
      
      if (transaction && transaction.status === 'submitted') {
        await transaction.markAsTimeout();
        
        // Requeue for retry if possible
        if (transaction.canRetry()) {
          const queueItem = {
            transactionId: transaction.id,
            userId: transaction.userId,
            type: transaction.type,
            priority: transaction.priority,
            timestamp: new Date().toISOString()
          };

          await redisConfig.requeueForRetry(this.queueName, queueItem);
          await transaction.resetForRetry();
        }

        this.emit('transactionTimeout', {
          transactionId: transaction.id,
          userId: transaction.userId
        });
      }

    } catch (error) {
      logger.error('Error handling transaction timeout:', error);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    try {
      const redisStats = await redisConfig.getQueueStats(this.queueName);
      
      return {
        ...redisStats,
        currentlyProcessing: this.currentlyProcessing.size,
        isProcessing: this.isProcessing,
        stats: { ...this.stats }
      };

    } catch (error) {
      logger.error('Error getting queue stats:', error);
      throw error;
    }
  }

  /**
   * Get user's transaction queue position
   */
  async getQueuePosition(transactionId) {
    try {
      const pending = await redisConfig.client.lRange(`${this.queueName}:pending`, 0, -1);
      const position = pending.findIndex(item => {
        const parsed = JSON.parse(item);
        return parsed.transactionId === transactionId;
      });

      return position >= 0 ? position + 1 : null;

    } catch (error) {
      logger.error('Error getting queue position:', error);
      return null;
    }
  }

  /**
   * Get user's pending transactions
   */
  async getUserPendingTransactions(userId) {
    try {
      return await Transaction.findByUser(userId, { status: 'pending' });

    } catch (error) {
      logger.error('Error getting user pending transactions:', error);
      throw error;
    }
  }

  /**
   * Clear the queue (admin function)
   */
  async clearQueue() {
    try {
      await redisConfig.clearQueue(this.queueName);
      await Transaction.deleteMany({ status: 'pending' });
      
      logger.info('Transaction queue cleared');
      return true;

    } catch (error) {
      logger.error('Error clearing queue:', error);
      throw error;
    }
  }

  /**
   * Get priority value for queue ordering
   */
  getPriorityValue(priority) {
    const priorityMap = {
      high: 3,
      medium: 2,
      low: 1
    };
    return priorityMap[priority] || 2;
  }

  /**
   * Generate unique transaction ID
   */
  generateTransactionId() {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources (alias for destroy)
   */
  async cleanup() {
    return this.destroy();
  }

  /**
   * Cleanup resources
   */
  async destroy() {
    await this.stopProcessing();
    await redisConfig.disconnect();
    this.removeAllListeners();
    logger.info('Transaction Queue destroyed');
  }
}

// Create singleton instance
const transactionQueue = new TransactionQueue();

module.exports = {
  TransactionQueue,
  transactionQueue
};
