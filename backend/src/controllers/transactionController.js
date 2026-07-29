/**
 * Transaction Controller
 * Handles transaction history and management
 */

const transactionService = require('../services/transactionService');
const logger = require('../utils/logger');

/**
 * List all transactions
 * GET /api/transactions
 */
const listTransactions = async (req, res) => {
  try {
    const transactions = await transactionService.getAllTransactions();
    res.status(200).json({
      success: true,
      data: transactions
    });
  } catch (err) {
    logger.error('List Transactions Error:', err);
    res.status(500).json({
      success: false,
      message: 'Error retrieving transactions'
    });
  }
};

/**
 * Get transaction by ID
 * GET /api/transactions/:transactionId
 */
const getTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const transaction = await transactionService.getTransactionById(transactionId);
    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (err) {
    logger.error('Get Transaction Error:', err);
    res.status(500).json({
      success: false,
      message: 'Error retrieving transaction'
    });
  }
};

/**
 * Verify transaction
 * POST /api/transactions/:transactionId/verify
 */
const verifyTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const result = await transactionService.verifyTransaction(transactionId);
    res.status(200).json({
      success: true,
      message: 'Transaction verified successfully',
      data: result
    });
  } catch (err) {
    logger.error('Verify Transaction Error:', err);
    res.status(500).json({
      success: false,
      message: 'Error verifying transaction'
    });
  }
};

/**
 * Get transactions by user
 * GET /api/transactions/user/:userId
 */
const getUserTransactions = async (req, res) => {
  try {
    const { userId } = req.params;
    const transactions = await transactionService.getTransactionsByUser(userId);
    res.status(200).json({
      success: true,
      data: transactions
    });
  } catch (err) {
    logger.error('Get User Transactions Error:', err);
    res.status(500).json({
      success: false,
      message: 'Error retrieving user transactions'
    });
  }
};

/**
 * Get transaction statistics
 * GET /api/transactions/stats
 */
const getTransactionStats = async (req, res) => {
  try {
    const stats = await transactionService.getTransactionStatistics();
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (err) {
    logger.error('Get Transaction Stats Error:', err);
    res.status(500).json({
      success: false,
      message: 'Error retrieving transaction statistics'
    });
  }
};

module.exports = {
  listTransactions,
  getTransaction,
  verifyTransaction,
  getUserTransactions,
  getTransactionStats
};