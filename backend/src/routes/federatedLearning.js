const express = require('express');
const router = express.Router();
const FederatedLearningController = require('../controllers/federatedLearningController');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Initialize controller
const flController = new FederatedLearningController();

// Rate limiting for sensitive operations
const sensitiveOperationLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many requests, please try again later'
  }
});

const modelUpdateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 model updates per minute
  message: {
    error: 'Too many model updates, please try again later'
  }
});

// Session Management Routes
router.post('/sessions', auth, async (req, res) => {
  await flController.initializeSession(req, res);
});

router.get('/sessions/:sessionId/status', auth, async (req, res) => {
  await flController.getSessionStatus(req, res);
});

// Participant Management Routes
router.post('/participants', auth, async (req, res) => {
  await flController.registerParticipant(req, res);
});

router.get('/participants', auth, async (req, res) => {
  await flController.getParticipants(req, res);
});

// Round Management Routes
router.post('/rounds', auth, sensitiveOperationLimit, async (req, res) => {
  await flController.startRound(req, res);
});

router.post('/participants/:participantId/updates', auth, modelUpdateLimit, async (req, res) => {
  await flController.submitModelUpdate(req, res);
});

router.get('/rounds/history', auth, async (req, res) => {
  await flController.getRoundHistory(req, res);
});

// Model Management Routes
router.get('/models/versions', auth, async (req, res) => {
  await flController.getModelVersions(req, res);
});

router.post('/models/rollback/:versionId', auth, sensitiveOperationLimit, async (req, res) => {
  await flController.rollbackModel(req, res);
});

router.get('/models/compare', auth, async (req, res) => {
  await flController.compareModels(req, res);
});

// Analytics Routes
router.get('/analytics', auth, async (req, res) => {
  await flController.getAnalytics(req, res);
});

router.get('/analytics/export', auth, async (req, res) => {
  await flController.exportAnalytics(req, res);
});

// Privacy Management Routes
router.get('/privacy/status', auth, async (req, res) => {
  await flController.getPrivacyStatus(req, res);
});

router.post('/privacy/reset-budget', auth, sensitiveOperationLimit, async (req, res) => {
  await flController.resetPrivacyBudget(req, res);
});

// Validation Routes
router.post('/validation/validate', auth, async (req, res) => {
  await flController.validateModel(req, res);
});

router.get('/validation/stats', auth, async (req, res) => {
  await flController.getValidationStats(req, res);
});

// System Health Routes
router.get('/health', async (req, res) => {
  await flController.getSystemHealth(req, res);
});

router.post('/shutdown', auth, sensitiveOperationLimit, async (req, res) => {
  await flController.shutdown(req, res);
});

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Federated Learning Route Error:', error);
  
  res.status(error.status || 500).json({
    error: error.message || 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

module.exports = router;
