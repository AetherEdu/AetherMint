const EventEmitter = require('events');
const redisConfig = require('../config/redis');
const Transaction = require('../models/Transaction');
const logger = require('../utils/logger');

class TransactionEvents extends EventEmitter {
  constructor() {
    super();
    this.isListening = false;
    this.eventHandlers = new Map();
    this.stats = {
      eventsReceived: 0,
      eventsProcessed: 0,
      eventsFailed: 0,
      lastEvent: null
    };
  }

  async initialize() {
    try {
      await redisConfig.initialize();
      
      // Subscribe to transaction events
      await redisConfig.subscribe('transaction_events', (message, channel) => {
        this.handleEvent(message);
      });

      logger.info('Transaction Events initialized successfully');
      return true;

    } catch (error) {
      logger.error('Failed to initialize Transaction Events:', error);
      throw error;
    }
  }

  /**
   * Start listening for events
   */
  async startListening() {
    if (this.isListening) {
      logger.warn('Transaction Events already listening');
      return;
    }

    this.isListening = true;
    logger.info('Started listening for transaction events');

    this.emit('listeningStarted');
  }

  /**
   * Stop listening for events
   */
  async stopListening() {
    if (!this.isListening) {
      return;
    }

    this.isListening = false;
    logger.info('Stopped listening for transaction events');

    this.emit('listeningStopped');
  }

  /**
   * Handle incoming events
   */
  async handleEvent(message) {
    this.stats.eventsReceived++;
    this.stats.lastEvent = new Date();

    try {
      const { type, data } = message;

      logger.debug(`Received transaction event: ${type}`, data);

      // Emit the event for general listeners
      this.emit(type, data);

      // Call specific event handlers
      if (this.eventHandlers.has(type)) {
        const handlers = this.eventHandlers.get(type);
        await Promise.all(
          handlers.map(handler => this.safeExecuteHandler(handler, data, type))
        );
      }

      // Call the default handler
      await this.defaultEventHandler(type, data);

      this.stats.eventsProcessed++;

    } catch (error) {
      this.stats.eventsFailed++;
      logger.error(`Error handling transaction event:`, error);
      this.emit('eventError', { error, message });
    }
  }

  /**
   * Safely execute event handler
   */
  async safeExecuteHandler(handler, data, eventType) {
    try {
      await handler(data, eventType);
    } catch (error) {
      logger.error(`Error in event handler for ${eventType}:`, error);
      this.emit('handlerError', { error, data, eventType });
    }
  }

  /**
   * Default event handler
   */
  async defaultEventHandler(type, data) {
    switch (type) {
      case 'TRANSACTION_QUEUED':
        await this.handleTransactionQueued(data);
        break;
      case 'TRANSACTION_PROCESSING':
        await this.handleTransactionProcessing(data);
        break;
      case 'TRANSACTION_SUBMITTED':
        await this.handleTransactionSubmitted(data);
        break;
      case 'TRANSACTION_CONFIRMED':
        await this.handleTransactionConfirmed(data);
        break;
      case 'TRANSACTION_FAILED':
        await this.handleTransactionFailed(data);
        break;
      case 'TRANSACTION_TIMEOUT':
        await this.handleTransactionTimeout(data);
        break;
      case 'TRANSACTION_RETRY':
        await this.handleTransactionRetry(data);
        break;
      case 'TRANSACTION_RETRIED':
        await this.handleTransactionRetried(data);
        break;
      case 'TRANSACTION_COMPLETED':
        await this.handleTransactionCompleted(data);
        break;
      default:
        logger.debug(`Unknown event type: ${type}`);
    }
  }

  /**
   * Handle transaction queued event
   */
  async handleTransactionQueued(data) {
    try {
      logger.info(`Transaction queued: ${data.transactionId} for user ${data.userId}`);
      
      // Update user notification preferences if needed
      await this.updateUserNotificationStatus(data.userId, 'transaction_queued');
      
      // Emit for WebSocket notifications
      this.emit('userNotification', {
        userId: data.userId,
        type: 'transaction_queued',
        data: {
          transactionId: data.transactionId,
          queuePosition: data.queuePosition,
          message: 'Your transaction has been queued for processing'
        }
      });

    } catch (error) {
      logger.error('Error handling transaction queued event:', error);
    }
  }

  /**
   * Handle transaction processing event
   */
  async handleTransactionProcessing(data) {
    try {
      logger.info(`Transaction processing: ${data.transactionId} for user ${data.userId}`);
      
      // Emit for WebSocket notifications
      this.emit('userNotification', {
        userId: data.userId,
        type: 'transaction_processing',
        data: {
          transactionId: data.transactionId,
          message: 'Your transaction is now being processed'
        }
      });

    } catch (error) {
      logger.error('Error handling transaction processing event:', error);
    }
  }

  /**
   * Handle transaction submitted event
   */
  async handleTransactionSubmitted(data) {
    try {
      logger.info(`Transaction submitted: ${data.transactionId} with hash ${data.stellarHash}`);
      
      // Update user notification preferences
      await this.updateUserNotificationStatus(data.userId, 'transaction_submitted');
      
      // Emit for WebSocket notifications
      this.emit('userNotification', {
        userId: data.userId,
        type: 'transaction_submitted',
        data: {
          transactionId: data.transactionId,
          stellarHash: data.stellarHash,
          message: 'Your transaction has been submitted to the Stellar network'
        }
      });

      // Trigger analytics tracking
      this.emit('analyticsEvent', {
        event: 'transaction_submitted',
        userId: data.userId,
        data: {
          transactionId: data.transactionId,
          stellarHash: data.stellarHash
        }
      });

    } catch (error) {
      logger.error('Error handling transaction submitted event:', error);
    }
  }

  /**
   * Handle transaction confirmed event
   */
  async handleTransactionConfirmed(data) {
    try {
      logger.info(`Transaction confirmed: ${data.transactionId} on ledger ${data.ledger}`);
      
      // Update user notification preferences
      await this.updateUserNotificationStatus(data.userId, 'transaction_completed');
      
      // Emit for WebSocket notifications
      this.emit('userNotification', {
        userId: data.userId,
        type: 'transaction_completed',
        data: {
          transactionId: data.transactionId,
          stellarHash: data.hash,
          ledger: data.ledger,
          message: 'Your transaction has been confirmed on the Stellar network'
        }
      });

      // Trigger analytics tracking
      this.emit('analyticsEvent', {
        event: 'transaction_completed',
        userId: data.userId,
        data: {
          transactionId: data.transactionId,
          stellarHash: data.hash,
          ledger: data.ledger
        }
      });

      // Update user statistics
      await this.updateUserTransactionStats(data.userId);

    } catch (error) {
      logger.error('Error handling transaction confirmed event:', error);
    }
  }

  /**
   * Handle transaction failed event
   */
  async handleTransactionFailed(data) {
    try {
      logger.error(`Transaction failed: ${data.transactionId} - ${data.error}`);
      
      // Emit for WebSocket notifications
      this.emit('userNotification', {
        userId: data.userId,
        type: 'transaction_failed',
        data: {
          transactionId: data.transactionId,
          error: data.error,
          message: `Your transaction failed: ${data.error}`
        }
      });

      // Trigger analytics tracking
      this.emit('analyticsEvent', {
        event: 'transaction_failed',
        userId: data.userId,
        data: {
          transactionId: data.transactionId,
          error: data.error
        }
      });

      // Create alert for monitoring
      this.emit('alert', {
        level: 'warning',
        type: 'transaction_failed',
        message: `Transaction ${data.transactionId} failed for user ${data.userId}`,
        data
      });

    } catch (error) {
      logger.error('Error handling transaction failed event:', error);
    }
  }

  /**
   * Handle transaction timeout event
   */
  async handleTransactionTimeout(data) {
    try {
      logger.warn(`Transaction timeout: ${data.transactionId} with hash ${data.hash}`);
      
      // Emit for WebSocket notifications
      this.emit('userNotification', {
        userId: data.userId,
        type: 'transaction_timeout',
        data: {
          transactionId: data.transactionId,
          stellarHash: data.hash,
          message: 'Your transaction is taking longer than expected to confirm'
        }
      });

      // Create alert for monitoring
      this.emit('alert', {
        level: 'warning',
        type: 'transaction_timeout',
        message: `Transaction ${data.transactionId} timed out for user ${data.userId}`,
        data
      });

    } catch (error) {
      logger.error('Error handling transaction timeout event:', error);
    }
  }

  /**
   * Handle transaction retry event
   */
  async handleTransactionRetry(data) {
    try {
      logger.info(`Transaction retry: ${data.transactionId} (attempt ${data.retryCount})`);
      
      // Emit for WebSocket notifications
      this.emit('userNotification', {
        userId: data.userId,
        type: 'transaction_retry',
        data: {
          transactionId: data.transactionId,
          retryCount: data.retryCount,
          error: data.error,
          message: `Retrying your transaction (attempt ${data.retryCount})`
        }
      });

    } catch (error) {
      logger.error('Error handling transaction retry event:', error);
    }
  }

  /**
   * Handle transaction retried event
   */
  async handleTransactionRetried(data) {
    try {
      logger.info(`Transaction retried: ${data.transactionId}`);
      
      // Emit for WebSocket notifications
      this.emit('userNotification', {
        userId: data.userId,
        type: 'transaction_retried',
        data: {
          transactionId: data.transactionId,
          message: 'Your failed transaction has been queued for retry'
        }
      });

    } catch (error) {
      logger.error('Error handling transaction retried event:', error);
    }
  }

  /**
   * Handle transaction completed event
   */
  async handleTransactionCompleted(data) {
    try {
      logger.info(`Transaction completed: ${data.transactionId}`);
      
      // Update user notification preferences
      await this.updateUserNotificationStatus(data.userId, 'transaction_completed');
      
      // Emit for WebSocket notifications
      this.emit('userNotification', {
        userId: data.userId,
        type: 'transaction_completed_final',
        data: {
          transactionId: data.transactionId,
          stellarHash: data.stellarHash,
          ledger: data.ledger,
          message: 'Your transaction has been completed successfully'
        }
      });

      // Trigger analytics tracking
      this.emit('analyticsEvent', {
        event: 'transaction_completed_final',
        userId: data.userId,
        data: {
          transactionId: data.transactionId,
          stellarHash: data.stellarHash,
          ledger: data.ledger
        }
      });

    } catch (error) {
      logger.error('Error handling transaction completed event:', error);
    }
  }

  /**
   * Register custom event handler
   */
  registerHandler(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    
    this.eventHandlers.get(eventType).push(handler);
    logger.debug(`Registered handler for event type: ${eventType}`);
  }

  /**
   * Unregister event handler
   */
  unregisterHandler(eventType, handler) {
    if (this.eventHandlers.has(eventType)) {
      const handlers = this.eventHandlers.get(eventType);
      const index = handlers.indexOf(handler);
      
      if (index > -1) {
        handlers.splice(index, 1);
        logger.debug(`Unregistered handler for event type: ${eventType}`);
      }
    }
  }

  /**
   * Update user notification status
   */
  async updateUserNotificationStatus(userId, status) {
    try {
      // This would integrate with your user notification system
      // For now, just log the update
      logger.debug(`Updated notification status for user ${userId}: ${status}`);
    } catch (error) {
      logger.error('Error updating user notification status:', error);
    }
  }

  /**
   * Update user transaction statistics
   */
  async updateUserTransactionStats(userId) {
    try {
      // Get transaction statistics for the user
      const stats = await Transaction.getTransactionStats(userId);
      
      // Emit stats update event
      this.emit('userStatsUpdated', {
        userId,
        stats
      });

      // This would integrate with your user statistics system
      logger.debug(`Updated transaction stats for user ${userId}:`, stats);
    } catch (error) {
      logger.error('Error updating user transaction stats:', error);
    }
  }

  /**
   * Publish custom event
   */
  async publishEvent(eventType, data) {
    try {
      await redisConfig.publish('transaction_events', {
        type: eventType,
        data
      });

      logger.debug(`Published custom event: ${eventType}`);
      return true;

    } catch (error) {
      logger.error('Error publishing custom event:', error);
      throw error;
    }
  }

  /**
   * Get event statistics
   */
  getStats() {
    return {
      ...this.stats,
      isListening: this.isListening,
      registeredHandlers: Array.from(this.eventHandlers.keys())
    };
  }

  /**
   * Get recent events for a user
   */
  async getUserRecentEvents(userId, limit = 10) {
    try {
      // This would typically query an events database
      // For now, return recent transactions
      const transactions = await Transaction.findByUser(userId, { limit });
      
      return transactions.map(tx => ({
        type: this.getTransactionEventType(tx.status),
        timestamp: tx.updatedAt,
        data: {
          transactionId: tx.id,
          status: tx.status,
          type: tx.type,
          stellarHash: tx.stellarTransactionHash
        }
      }));

    } catch (error) {
      logger.error('Error getting user recent events:', error);
      throw error;
    }
  }

  /**
   * Map transaction status to event type
   */
  getTransactionEventType(status) {
    const statusMap = {
      'pending': 'TRANSACTION_QUEUED',
      'processing': 'TRANSACTION_PROCESSING',
      'submitted': 'TRANSACTION_SUBMITTED',
      'success': 'TRANSACTION_CONFIRMED',
      'failed': 'TRANSACTION_FAILED',
      'timeout': 'TRANSACTION_TIMEOUT'
    };
    
    return statusMap[status] || 'TRANSACTION_UNKNOWN';
  }

  /**
   * Cleanup resources
   */
  async destroy() {
    await this.stopListening();
    await redisConfig.disconnect();
    this.eventHandlers.clear();
    this.removeAllListeners();
    logger.info('Transaction Events destroyed');
  }
}

// Create singleton instance
const transactionEvents = new TransactionEvents();

module.exports = transactionEvents;
