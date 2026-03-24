const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectRedis } = require('./utils/redis');
const dotenv = require('dotenv');
const { createServer } = require('http');
const { initWebsocketService } = require('./services/websocketService');
const { setSyncWebsocketEmitter } = require('./services/syncService');

// Load environment variables
dotenv.config();

// Connect to Redis
connectRedis();

// Import routes
const quizRoutes = require('./routes/quizRoutes');
const eventLoggerRoutes = require('./routes/eventLoggerRoutes');
const syncRoutes = require('./routes/syncRoutes');
const rbacRoutes = require('./routes/rbacRoutes');
const resolveRoute = (routeModule) => routeModule.default || routeModule;
const quizRoutes = resolveRoute(require('./routes/quizRoutes'));
const eventLoggerRoutes = resolveRoute(require('./routes/eventLoggerRoutes'));
const syncRoutes = resolveRoute(require('./routes/syncRoutes'));
const contentRoutes = require('./routes/content');
const transactionRoutes = require('./routes/transactions');


// Initialize Express app
const app = express();
const server = createServer(app);
const websocketService = initWebsocketService(server);
setSyncWebsocketEmitter((userId, event, data) => websocketService.emitToUser(userId, event, data));

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Global Security Middlewares
app.use(securityPerformanceTracker);
app.use(checkBlacklist);
app.use(ddosProtection);
app.use(botDetection);
app.use(advancedRestrictions);
app.use(requestSanitizer);
app.use(globalLimiter);

// For authenticated routes, you might want to switch to tieredRateLimiter
// but globalLimiter works as a safe default for all requests.

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API routes
app.use('/api/quizzes', quizRoutes);
app.use('/api/events', eventLoggerRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/rbac', rbacRoutes);
app.use('/api/transactions', transactionRoutes);


// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'StarkEd Education Backend API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Security Pulse / Status (Admin only)
app.get('/api/admin/security/pulse', authenticateToken, requireAdmin, async (req, res) => {
  const pulse = await securityService.getSecurityPulse();
  res.json({
    success: true,
    data: pulse
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Initialize Transaction Queue System
const transactionQueue = require('./services/transactionQueue');
const transactionProcessor = require('./workers/transactionProcessor');
const transactionEvents = require('./events/transactionEvents');

const PORT = process.env.PORT || 3001;

async function startServer () {
  try {
    // Initialize transaction system components
    await transactionQueue.initialize();
    await transactionProcessor.initialize();
    await transactionEvents.initialize();

    // Start transaction processing
    await transactionQueue.startProcessing();
    await transactionProcessor.start();
    await transactionEvents.startListening();

    server.listen(PORT, () => {
      console.log(`🚀 StarkEd Education Backend running on port ${PORT}`);
      console.log(`📚 Quiz Management API available at /api/quizzes`);
      console.log(`📊 Event Logger API available at /api/events`);
      console.log(`🔄 Sync API available at /api/sync`);
      console.log(`📁 Content Management API available at /api/content`);
      console.log(`💰 Transaction Queue API available at /api/transactions`);

      console.log(`🏥 Health check available at /api/health`);
      console.log(`✅ Transaction Queue System initialized successfully`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await transactionQueue.stopProcessing();
  await transactionProcessor.stop();
  await transactionEvents.stopListening();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await transactionQueue.stopProcessing();
  await transactionProcessor.stop();
  await transactionEvents.stopListening();
  process.exit(0);
});

if (require.main === module) {
  startServer();
}

module.exports = app;
module.exports.server = server;
