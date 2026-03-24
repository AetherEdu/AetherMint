const EventEmitter = require('events');
const Transaction = require('../models/Transaction');
const stellarUtils = require('../utils/stellarUtils');
const redisConfig = require('../config/redis');
const logger = require('../utils/logger');

class TransactionProcessor extends EventEmitter {
  constructor() {
    super();
    this.isRunning = false;
    this.processingInterval = null;
    this.checkInterval = 30000; // 30 seconds
    this.confirmationTimeout = 300000; // 5 minutes
    this.maxConcurrentConfirmations = 10;
    this.currentlyConfirming = new Set();
    this.stats = {
      processed: 0,
      confirmed: 0,
      failed: 0,
      timeouts: 0,
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

      logger.info('Transaction Processor initialized successfully');
      return true;

    } catch (error) {
      logger.error('Failed to initialize Transaction Processor:', error);
      throw error;
    }
  }

  /**
   * Start the transaction processor
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Transaction processor already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting transaction processor');

    // Start periodic confirmation checks
    this.processingInterval = setInterval(async () => {
      await this.checkPendingConfirmations();
    }, this.checkInterval);

    // Check immediately on start
    await this.checkPendingConfirmations();

    this.emit('processorStarted');
    logger.info('Transaction processor started successfully');
  }

  /**
   * Stop the transaction processor
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Wait for current confirmations to finish
    while (this.currentlyConfirming.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.emit('processorStopped');
    logger.info('Transaction processor stopped');
  }

  /**
   * Process a transaction submission
   */
  async processTransactionSubmission(transaction) {
    try {
      logger.info(`Processing transaction submission: ${transaction.id}`);

      // Update transaction status to processing
      await transaction.markAsProcessing();

      // Prepare transaction data for Stellar submission
      const transactionData = await this.prepareTransactionData(transaction);

      if (!transactionData.success) {
        throw new Error(transactionData.error);
      }

      // Submit to Stellar network
      const result = await stellarUtils.submitTransaction(transactionData.signedXdr);

      if (result.success) {
        // Update transaction with submission details
        await transaction.markAsSubmitted(result.hash);

        this.stats.processed++;
        this.stats.lastProcessed = new Date();

        this.emit('transactionSubmitted', {
          transactionId: transaction.id,
          userId: transaction.userId,
          hash: result.hash,
          ledger: result.ledger
        });

        // Publish confirmation event
        await redisConfig.publish('transaction_events', {
          type: 'TRANSACTION_SUBMITTED',
          data: {
            transactionId: transaction.id,
            userId: transaction.userId,
            stellarHash: result.hash,
            ledger: result.ledger
          }
        });

        logger.info(`Transaction ${transaction.id} submitted successfully with hash ${result.hash}`);

        // Start confirmation monitoring
        this.monitorConfirmation(transaction.id, result.hash);

        return {
          success: true,
          hash: result.hash,
          ledger: result.ledger
        };

      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      logger.error(`Error processing transaction ${transaction.id}:`, error);

      await transaction.markAsFailed(error.message);

      this.stats.failed++;

      this.emit('transactionFailed', {
        transactionId: transaction.id,
        userId: transaction.userId,
        error: error.message
      });

      // Publish failure event
      await redisConfig.publish('transaction_events', {
        type: 'TRANSACTION_FAILED',
        data: {
          transactionId: transaction.id,
          userId: transaction.userId,
          error: error.message
        }
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Prepare transaction data for submission
   */
  async prepareTransactionData(transaction) {
    try {
      let signedXdr;

      switch (transaction.type) {
        case 'payment':
          signedXdr = await this.preparePaymentTransaction(transaction);
          break;
        case 'account_creation':
          signedXdr = await this.prepareAccountCreationTransaction(transaction);
          break;
        case 'trustline':
          signedXdr = await this.prepareTrustlineTransaction(transaction);
          break;
        case 'claimable_balance':
          signedXdr = await this.prepareClaimableBalanceTransaction(transaction);
          break;
        case 'multisig':
          signedXdr = await this.prepareMultisigTransaction(transaction);
          break;
        default:
          if (transaction.signedTransactionXdr) {
            signedXdr = transaction.signedTransactionXdr;
          } else {
            throw new Error(`Unsupported transaction type: ${transaction.type}`);
          }
      }

      return {
        success: true,
        signedXdr
      };

    } catch (error) {
      logger.error('Error preparing transaction data:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Prepare payment transaction
   */
  async preparePaymentTransaction(transaction) {
    const { sourceAccount, destinationAccount, amount, asset } = transaction;
    const { secretKey } = transaction.metadata;

    if (!secretKey) {
      throw new Error('Source account secret key required for payment transaction');
    }

    const result = await stellarUtils.sendPayment(
      secretKey,
      destinationAccount,
      amount,
      asset
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.signedXdr;
  }

  /**
   * Prepare account creation transaction
   */
  async prepareAccountCreationTransaction(transaction) {
    const { sourceAccount, destinationAccount } = transaction;
    const { secretKey, startingBalance } = transaction.metadata;

    if (!secretKey) {
      throw new Error('Source account secret key required for account creation');
    }

    const result = await stellarUtils.createAccount(
      secretKey,
      destinationAccount,
      startingBalance || '5'
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.signedXdr;
  }

  /**
   * Prepare trustline transaction
   */
  async prepareTrustlineTransaction(transaction) {
    const { sourceAccount, asset } = transaction;
    const { secretKey } = transaction.metadata;

    if (!secretKey) {
      throw new Error('Account secret key required for trustline creation');
    }

    if (!asset) {
      throw new Error('Asset details required for trustline creation');
    }

    const result = await stellarUtils.createTrustline(secretKey, asset);

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.signedXdr;
  }

  /**
   * Prepare claimable balance transaction
   */
  async prepareClaimableBalanceTransaction(transaction) {
    // This would implement claimable balance creation
    // For now, return the pre-signed XDR if available
    if (transaction.signedTransactionXdr) {
      return transaction.signedTransactionXdr;
    }

    throw new Error('Claimable balance transactions require pre-signed XDR');
  }

  /**
   * Prepare multisig transaction
   */
  async prepareMultisigTransaction(transaction) {
    // For multisig transactions, we expect a pre-signed XDR
    if (transaction.signedTransactionXdr) {
      return transaction.signedTransactionXdr;
    }

    throw new Error('Multisig transactions require pre-signed XDR');
  }

  /**
   * Monitor transaction confirmation
   */
  async monitorConfirmation(transactionId, stellarHash) {
    if (this.currentlyConfirming.has(transactionId)) {
      return;
    }

    if (this.currentlyConfirming.size >= this.maxConcurrentConfirmations) {
      // Add to queue for later processing
      setTimeout(() => this.monitorConfirmation(transactionId, stellarHash), 5000);
      return;
    }

    this.currentlyConfirming.add(transactionId);

    try {
      const startTime = Date.now();
      
      while (Date.now() - startTime < this.confirmationTimeout) {
        try {
          const status = await stellarUtils.getTransactionStatus(stellarHash);
          
          if (status.successful !== undefined) {
            const transaction = await Transaction.findOne({ id: transactionId });
            
            if (transaction) {
              if (status.successful) {
                await transaction.markAsSuccess(status.ledger);
                
                this.stats.confirmed++;

                this.emit('transactionConfirmed', {
                  transactionId: transaction.id,
                  userId: transaction.userId,
                  hash: stellarHash,
                  ledger: status.ledger
                });

                await redisConfig.publish('transaction_events', {
                  type: 'TRANSACTION_CONFIRMED',
                  data: {
                    transactionId: transaction.id,
                    userId: transaction.userId,
                    hash: stellarHash,
                    ledger: status.ledger
                  }
                });

                logger.info(`Transaction ${transactionId} confirmed on ledger ${status.ledger}`);

              } else {
                await transaction.markAsFailed('Transaction failed on Stellar network');
                
                this.stats.failed++;

                this.emit('transactionFailed', {
                  transactionId: transaction.id,
                  userId: transaction.userId,
                  error: 'Transaction failed on Stellar network'
                });

                await redisConfig.publish('transaction_events', {
                  type: 'TRANSACTION_FAILED',
                  data: {
                    transactionId: transaction.id,
                    userId: transaction.userId,
                    error: 'Transaction failed on Stellar network'
                  }
                });

                logger.error(`Transaction ${transactionId} failed on Stellar network`);
              }
            }

            return;
          }

          // Wait before checking again
          await new Promise(resolve => setTimeout(resolve, 5000));

        } catch (error) {
          logger.error(`Error checking confirmation for ${transactionId}:`, error);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      // Timeout reached
      await this.handleConfirmationTimeout(transactionId, stellarHash);

    } finally {
      this.currentlyConfirming.delete(transactionId);
    }
  }

  /**
   * Handle confirmation timeout
   */
  async handleConfirmationTimeout(transactionId, stellarHash) {
    try {
      const transaction = await Transaction.findOne({ id: transactionId });
      
      if (transaction && transaction.status === 'submitted') {
        await transaction.markAsTimeout();
        
        this.stats.timeouts++;

        this.emit('transactionTimeout', {
          transactionId: transaction.id,
          userId: transaction.userId,
          hash: stellarHash
        });

        await redisConfig.publish('transaction_events', {
          type: 'TRANSACTION_TIMEOUT',
          data: {
            transactionId: transaction.id,
            userId: transaction.userId,
            hash: stellarHash
          }
        });

        logger.warn(`Transaction ${transactionId} confirmation timeout`);
      }

    } catch (error) {
      logger.error(`Error handling confirmation timeout for ${transactionId}:`, error);
    }
  }

  /**
   * Check pending confirmations
   */
  async checkPendingConfirmations() {
    try {
      const submittedTransactions = await Transaction.find({
        status: 'submitted',
        submittedAt: {
          $gte: new Date(Date.now() - this.confirmationTimeout)
        }
      }).limit(50);

      for (const transaction of submittedTransactions) {
        if (!this.currentlyConfirming.has(transaction.id)) {
          this.monitorConfirmation(transaction.id, transaction.stellarTransactionHash);
        }
      }

    } catch (error) {
      logger.error('Error checking pending confirmations:', error);
    }
  }

  /**
   * Handle transaction events from Redis
   */
  async handleTransactionEvent(message) {
    try {
      switch (message.type) {
        case 'TRANSACTION_PROCESSING':
          // Handle processing event if needed
          break;
        case 'TRANSACTION_SUBMITTED':
          // Handle submitted event if needed
          break;
        default:
          logger.debug(`Unknown transaction event type: ${message.type}`);
      }
    } catch (error) {
      logger.error('Error handling transaction event:', error);
    }
  }

  /**
   * Get processor statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      currentlyConfirming: this.currentlyConfirming.size,
      maxConcurrentConfirmations: this.maxConcurrentConfirmations
    };
  }

  /**
   * Retry failed transactions
   */
  async retryFailedTransactions(limit = 10) {
    try {
      const failedTransactions = await Transaction.find({
        status: 'failed',
        retryCount: { $lt: 3 }
      }).limit(limit);

      let retriedCount = 0;

      for (const transaction of failedTransactions) {
        try {
          // Reset transaction for retry
          await transaction.resetForRetry();
          
          // Re-queue transaction
          await redisConfig.enqueue('stellar_transactions', {
            transactionId: transaction.id,
            userId: transaction.userId,
            type: transaction.type,
            priority: transaction.priority,
            timestamp: new Date().toISOString()
          });

          retriedCount++;

          this.emit('transactionRetried', {
            transactionId: transaction.id,
            userId: transaction.userId
          });

          await redisConfig.publish('transaction_events', {
            type: 'TRANSACTION_RETRIED',
            data: {
              transactionId: transaction.id,
              userId: transaction.userId
            }
          });

        } catch (error) {
          logger.error(`Error retrying transaction ${transaction.id}:`, error);
        }
      }

      logger.info(`Retried ${retriedCount} failed transactions`);
      return retriedCount;

    } catch (error) {
      logger.error('Error retrying failed transactions:', error);
      throw error;
    }
  }

  /**
   * Cleanup old completed transactions
   */
  async cleanupOldTransactions(daysOld = 30) {
    try {
      const cutoffDate = new Date(Date.now() - (daysOld * 24 * 60 * 60 * 1000));
      
      const result = await Transaction.deleteMany({
        status: { $in: ['success', 'failed'] },
        updatedAt: { $lt: cutoffDate }
      });

      logger.info(`Cleaned up ${result.deletedCount} old transactions`);
      return result.deletedCount;

    } catch (error) {
      logger.error('Error cleaning up old transactions:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  async destroy() {
    await this.stop();
    await redisConfig.disconnect();
    this.removeAllListeners();
    logger.info('Transaction Processor destroyed');
  }
}

// Create singleton instance
const transactionProcessor = new TransactionProcessor();

module.exports = transactionProcessor;
