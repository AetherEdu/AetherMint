import express, { Application } from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { Redis } from 'ioredis';
import logger from './utils/logger';
import requestLogger from './middleware/requestLogger';
import { connectRedis } from './utils/redis';
import { initWebsocketService } from './services/websocketService';
import { setSyncWebsocketEmitter } from './services/syncService';
import { initCollaborationService } from './services/initCollaboration';
// @ts-ignore
import SecureRealtimeCommunication from './services/secureRealtimeCommunication';

// @ts-ignore
import * as transactionQueue from './services/transactionQueue';
// @ts-ignore
import * as transactionProcessor from './workers/transactionProcessor';
// @ts-ignore
import * as transactionEvents from './events/transactionEvents';

// Import security middleware
import {
  securityPerformanceTracker,
  checkBlacklist,
  ddosProtection,
  botDetection,
  advancedRestrictions,
  requestSanitizer
} from './middleware/security';
import { detectSuspiciousPatterns } from './middleware/sanitizer';
// @ts-ignore
import { globalLimiter } from './middleware/rateLimiter';

// Load environment variables
dotenv.config();

// Connect to Redis
connectRedis();

// Helper for default-exported route modules
const resolveRoute = (routeModule: any) => routeModule.default || routeModule;

// Import routes
// @ts-ignore
const quizRoutes = resolveRoute(require('./routes/quizRoutes'));
// @ts-ignore
const eventLoggerRoutes = resolveRoute(require('./routes/eventLoggerRoutes'));
// @ts-ignore
const syncRoutes = resolveRoute(require('./routes/syncRoutes'));
// @ts-ignore
const rbacRoutes = resolveRoute(require('./routes/rbacRoutes'));
// @ts-ignore
const contentRoutes = require('./routes/content');
// @ts-ignore
const transactionRoutes = require('./routes/transactions');
// @ts-ignore
const notificationRoutes = resolveRoute(require('./routes/notificationRoutes'));

// Your branch routes
// @ts-ignore
const collaborationRoutes = resolveRoute(require('./routes/collaborationRoutes'));
// @ts-ignore
const holographicRoutes = resolveRoute(require('./routes/holographicRoutes'));
// @ts-ignore
const secureCommRoutes = resolveRoute(require('./routes/secureCommRoutes'));

// Upstream routes
// @ts-ignore
const acoRoutes = require('./routes/aco');
// @ts-ignore
const federatedLearningRoutes = require('./routes/federatedLearning');
// @ts-ignore
const swarmLearningRoutes = require('./routes/swarmLearning');
// @ts-ignore
const smartWalletRoutes = resolveRoute(require('./routes/smartWallet'));

// AGI Tutor routes
// @ts-ignore
const agiTutorRoutes = require('./routes/agiTutorRoutes');

// Analytics routes
// @ts-ignore
const analyticsRoutes = require('./routes/analytics');

// Initialize Express app
const app: Application = express();
const server = createServer(app);
const websocketService = initWebsocketService(server);
const collaborationService = initCollaborationService(server);

// Initialize secure communication
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD
});
const secureCommService = new (SecureRealtimeCommunication as any)(websocketService.getIO(), redis);

setSyncWebsocketEmitter((userId: string, event: string, data: any) => {
  websocketService.emitToUser(userId, event, data);
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Integration of sanitization middleware
// Performance tracker first
app.use(securityPerformanceTracker);
// Blacklist check
app.use(checkBlacklist);
// DDoS protection
app.use(ddosProtection);
// Bot detection
app.use(botDetection);

// NEW: Suspicious pattern detection (Reject requests early)
app.use(detectSuspiciousPatterns);

// NEW/Updated: Sanitize all inputs
app.use(requestSanitizer);

// API routes
app.use('/api/quizzes', quizRoutes);
app.use('/api/events', eventLoggerRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/rbac', rbacRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/collaboration', collaborationRoutes);
app.use('/api/holographic', holographicRoutes);
app.use('/api/aco', acoRoutes);
app.use('/api/federated-learning', federatedLearningRoutes);
app.use('/api/swarm-learning', swarmLearningRoutes);
app.use('/api/smart-wallet', smartWalletRoutes);
app.use('/api/secure-comm', secureCommRoutes);
app.use('/api/agi-tutor', agiTutorRoutes);
app.use('/api/analytics', analyticsRoutes);

// Autonomous Agents routes
// @ts-ignore
const autonomousAgentsRoutes = require('./routes/autonomousAgents');
app.use('/api/autonomous-agents', autonomousAgentsRoutes);

// Gamification routes
// @ts-ignore
const gamificationRoutes = require('./routes/gamification');
app.use('/api/gamification', gamificationRoutes);

// Bridge routes
// @ts-ignore
const bridgeRoutes = require('./routes/bridge');
app.use('/api/bridge', bridgeRoutes);

// Time-Locked Credential routes
// @ts-ignore
const timeLockCredentialsRoutes = require('./routes/timeLockCredentials');
app.use('/api/time-lock', timeLockCredentialsRoutes);

// VRF (Verifiable Random Function) routes
// @ts-ignore
const vrfRoutes = require('./routes/vrf');
app.use('/api/vrf', vrfRoutes);

// Real-time Translation routes
// @ts-ignore
const translationRoutes = require('./routes/translation');
app.use('/api/translate', translationRoutes);

// Cross-Protocol Bridge routes
// @ts-ignore
const crossProtocolBridgeRoutes = require('./routes/crossProtocolBridge');
app.use('/api/cross-protocol-bridge', crossProtocolBridgeRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'AetherMint Education Backend API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 404 handler
app.use('*', (req: any, res: any) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl,
  });
});

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  logger.error('Unhandled application error', err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await (transactionQueue as any).startProcessing();
    await (transactionProcessor as any).start();
    await (transactionEvents as any).startListening();

    server.listen(PORT, () => {
      logger.info('AetherMint Education Backend started', {
        port: PORT,
        routes: [
          '/api/quizzes',
          '/api/events',
          '/api/sync',
          '/api/content',
          '/api/transactions',
          '/api/collaboration',
          '/api/holographic',
          '/api/aco',
          '/api/federated-learning',
          '/api/agi-tutor',
          '/api/secure-comm',
          '/api/health',
        ],
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await (transactionQueue as any).stopProcessing();
  await (transactionProcessor as any).stop();
  await (transactionEvents as any).stopListening();
  process.exit(0);
});

if (require.main === module) {
  startServer();
}

export default app;
export { server };
