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

// Audit routes
// @ts-ignore
const auditRoutes = resolveRoute(require('./routes/auditRoutes'));
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
import { NotFoundError } from './utils/errors';
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
