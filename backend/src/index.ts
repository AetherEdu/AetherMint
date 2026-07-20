import 'dotenv/config';
import express, { Application } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { Redis } from 'ioredis';
import swaggerUi from 'swagger-ui-express';
import logger from './utils/logger';
import requestId from './middleware/requestId';
import requestLogger from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { NotFoundError } from './utils/errors';
import { connectRedis } from './utils/redis';
import { initWebsocketService } from './services/websocketService';
import { setSyncWebsocketEmitter } from './services/syncService';
import { initCollaborationService } from './services/initCollaboration';
import redisConfig from './config/redis';
import {
  registerShutdownHandlers,
  shutdownGuard,
  isShuttingDown,
  closeHttpServer,
} from './utils/shutdown';
import { MigrationRunner, createPool } from './utils/migrate';
import * as path from 'path';
// @ts-ignore
import SecureRealtimeCommunication from './services/secureRealtimeCommunication';
import { swaggerSpec } from './config/swagger';
import { openApiSpec } from './docs/openapi';
import { Migrator } from './utils/migrate';

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
  requestSanitizer,
  cspMiddleware,
  securityHeadersMiddleware
} from './middleware/security';
import { detectSuspiciousPatterns } from './middleware/sanitizer';
// @ts-ignore
import { tieredRateLimiter, transactionLimiter } from './middleware/rateLimiter';

// Connect to Redis
connectRedis();

// Helper for default-exported route modules
const resolveRoute = (routeModule: any) => routeModule.default || routeModule;

// Graceful route loader: wraps require() in try-catch so a single broken route
// does not prevent the entire server (and test suite) from starting.
const safeRoute = (name: string, modulePath: string, isDefaultExport: boolean = true) => {
  try {
    const mod = require(modulePath);
    return isDefaultExport ? resolveRoute(mod) : mod;
  } catch (err: any) {
    if (err.code === 'MODULE_NOT_FOUND' || err.message?.includes('Cannot find module')) {
      logger.warn(`Route module not found: ${name} (${modulePath})`);
    } else {
      logger.warn(`Failed to load route ${name}: ${err.message}`);
    }
    // Return a fallback router that responds with 503 for the unavailable route
    const { Router } = require('express');
    const fallback = Router();
    fallback.all('*', (_req: any, res: any) => {
      res.status(503).json({ success: false, message: `Route ${name} is temporarily unavailable` });
    });
    return fallback;
  }
};

// Import routes (with graceful fallback for missing dependencies)
const quizRoutes = safeRoute('quizzes', './routes/quizRoutes');
const eventLoggerRoutes = safeRoute('eventLogger', './routes/eventLoggerRoutes');
const syncRoutes = safeRoute('sync', './routes/syncRoutes');
const rbacRoutes = safeRoute('rbac', './routes/rbacRoutes');
const contentRoutes = safeRoute('content', './routes/content', false);
const transactionRoutes = safeRoute('transactions', './routes/transactions', false);
const notificationRoutes = safeRoute('notifications', './routes/notificationRoutes');

// Your branch routes
const collaborationRoutes = safeRoute('collaboration', './routes/collaborationRoutes');
const holographicRoutes = safeRoute('holographic', './routes/holographicRoutes');
const secureCommRoutes = safeRoute('secureComm', './routes/secureCommRoutes');

// Upstream routes
const acoRoutes = safeRoute('aco', './routes/aco', false);
const federatedLearningRoutes = safeRoute('federatedLearning', './routes/federatedLearning', false);
const swarmLearningRoutes = safeRoute('swarmLearning', './routes/swarmLearning', false);
const smartWalletRoutes = safeRoute('smartWallet', './routes/smartWallet');

// AGI Tutor routes
const agiTutorRoutes = safeRoute('agiTutor', './routes/agiTutorRoutes');

// Analytics routes
const analyticsRoutes = safeRoute('analytics', './routes/analytics', false);

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
app.use(cspMiddleware);
app.use(securityHeadersMiddleware);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestId);
app.use(requestLogger);

// Reject new traffic with 503 once a graceful shutdown has begun, while still
// serving the health probe and root so orchestrators can read the drain state.
app.use(shutdownGuard(['/api/health', '/']));

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

// ── OpenAPI documentation endpoints ────────────────────────────────────────

// Primary interactive Swagger UI  →  GET /api/docs
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    explorer: true,
    customSiteTitle: 'AetherMint API Docs',
    customCss: '.swagger-ui .topbar { background-color: #1a1a2e; }',
    swaggerOptions: {
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
    },
  }),
);

// Raw OpenAPI JSON spec  →  GET /api/docs/json
app.get('/api/docs/json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(openApiSpec);
});

// Legacy alias kept for backward-compat  →  GET /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customSiteTitle: 'AetherMint API Docs (legacy)',
}));

// Every API request receives a global per-IP limit plus the applicable
// public, authenticated-user, or admin tier.
app.use('/api', tieredRateLimiter);

// API routes
// Auth routes - load eagerly since they are critical for the platform
// @ts-ignore
const authRoutes = safeRoute('auth', './routes/auth', false);
app.use('/api/auth', authRoutes);

app.use('/api/quizzes', quizRoutes);
app.use('/api/events', eventLoggerRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/rbac', rbacRoutes);
app.use('/api/transactions', transactionLimiter, transactionRoutes);
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
const autonomousAgentsRoutes = safeRoute('autonomousAgents', './routes/autonomousAgents', false);
app.use('/api/autonomous-agents', autonomousAgentsRoutes);

// Gamification routes
const gamificationRoutes = safeRoute('gamification', './routes/gamification', false);
app.use('/api/gamification', gamificationRoutes);

// Bridge routes
const bridgeRoutes = safeRoute('bridge', './routes/bridge', false);
app.use('/api/bridge', bridgeRoutes);

// Time-Locked Credential routes
const timeLockCredentialsRoutes = safeRoute('timeLockCredentials', './routes/timeLockCredentials', false);
app.use('/api/time-lock', timeLockCredentialsRoutes);

// VRF (Verifiable Random Function) routes
const vrfRoutes = safeRoute('vrf', './routes/vrf', false);
app.use('/api/vrf', vrfRoutes);

// Real-time Translation routes
const translationRoutes = safeRoute('translation', './routes/translation', false);
app.use('/api/translate', translationRoutes);

// Cross-Protocol Bridge routes
const crossProtocolBridgeRoutes = safeRoute('crossProtocolBridge', './routes/crossProtocolBridge', false);
app.use('/api/cross-protocol-bridge', crossProtocolBridgeRoutes);

// Audit routes
const auditRoutes = safeRoute('audit', './routes/auditRoutes');
app.use('/api/audit', auditRoutes);

// Root endpoint
app.get('/', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.json({
    message: 'AetherMint Education Backend API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    documentation: {
      ui: `${baseUrl}/api/docs`,
      json: `${baseUrl}/api/docs/json`,
    },
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  // During a graceful shutdown report "shutting down" with a 503 so liveness
  // probes and load balancers stop routing traffic while the server drains.
  if (isShuttingDown()) {
    res.status(503).json({
      status: 'shutting down',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
    return;
  }

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 404 catch-all — must come after all route definitions
app.use('*', (req: any, _res: any, next: any) => {
  next(new NotFoundError(`Endpoint not found: ${req.originalUrl}`));
});

// Centralised error handler — must be last middleware registered (Issue #127)
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // Run migrations automatically if DATABASE_URL is configured
    const autoRunMigrations = process.env.AUTO_RUN_MIGRATIONS !== 'false';
    if (process.env.DATABASE_URL && autoRunMigrations) {
      try {
        const pool = createPool();
        const migrationsDir = path.join(process.cwd(), 'migrations');
        const migrationRunner = new MigrationRunner(pool, migrationsDir, true);
        await migrationRunner.autoMigrate();
        await pool.end();
      } catch (migrationError) {
        logger.warn('Migration auto-run failed, continuing startup', migrationError);
      }
    }

    await (transactionQueue as any).startProcessing();
    await (transactionProcessor as any).start();
    await (transactionEvents as any).startListening();

    if (process.env.AUTO_MIGRATE === 'true') {
      logger.info('Auto-running pending migrations...');
      const migrator = new Migrator();
      try {
        await migrator.up();
      } catch (err) {
        logger.error('Auto-migration failed', err as Error);
      } finally {
        await migrator.close();
      }
    }

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
           '/api/audit',
           '/api/health',
         ],
       });
     });
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

// Graceful shutdown: stop new traffic, drain in-flight HTTP, close WebSocket,
// Redis, and background workers, then exit. Handlers are registered only when
// running as the entrypoint so importing this module (for example in tests)
// does not attach process-wide signal listeners.
if (require.main === module) {
  registerShutdownHandlers({
    logger,
    steps: [
      { name: 'websocket', run: () => websocketService.close() },
      { name: 'http-server', run: () => closeHttpServer(server) },
      { name: 'transaction-queue', run: () => (transactionQueue as any).stopProcessing() },
      { name: 'transaction-processor', run: () => (transactionProcessor as any).stop() },
      { name: 'transaction-events', run: () => (transactionEvents as any).stopListening() },
      {
        name: 'redis',
        run: async () => {
          await redisConfig.disconnect();
          await redis.quit();
        },
      },
    ],
  });

  startServer();
}

export default app;
export { server };
// CommonJS require() compatibility for test files
// This makes `const app = require('./index')` return the app directly
module.exports = Object.assign(app, { default: app, server });
