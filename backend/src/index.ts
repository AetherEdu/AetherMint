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
import { metricsMiddleware, websocketConnectionsActive } from './middleware/metrics';
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
import mongoose from 'mongoose';
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
import { rateLimits } from './middleware/rateLimit';
import { idempotency } from './middleware/idempotency';
import { createGraphQLPlaceholder } from './graphql';

// Connect to Redis
connectRedis();

// Helper for default-exported route modules
const resolveRoute = (routeModule: any) => routeModule.default || routeModule;
const loadRoute = (routePath: string) => {
  try {
    return resolveRoute(require(routePath));
  } catch (error) {
    logger.warn(`Skipping route ${routePath} during startup`, error as Error);
    return express.Router();
  }
};

// Import routes
// @ts-ignore
const quizRoutes = loadRoute('./routes/quizRoutes');
// @ts-ignore
const eventLoggerRoutes = loadRoute('./routes/eventLoggerRoutes');
// @ts-ignore
const syncRoutes = loadRoute('./routes/syncRoutes');
// @ts-ignore
const rbacRoutes = loadRoute('./routes/rbacRoutes');
// @ts-ignore
const contentRoutes = loadRoute('./routes/content');
// @ts-ignore
const transactionRoutes = loadRoute('./routes/transactions');
// @ts-ignore
const notificationRoutes = loadRoute('./routes/notificationRoutes');

// Your branch routes
// @ts-ignore
const collaborationRoutes = loadRoute('./routes/collaborationRoutes');
// @ts-ignore
const holographicRoutes = loadRoute('./routes/holographicRoutes');
// @ts-ignore
const secureCommRoutes = loadRoute('./routes/secureCommRoutes');

// Upstream routes
// @ts-ignore
const acoRoutes = loadRoute('./routes/aco');
// @ts-ignore
const federatedLearningRoutes = loadRoute('./routes/federatedLearning');
// @ts-ignore
const swarmLearningRoutes = loadRoute('./routes/swarmLearning');
// @ts-ignore
const smartWalletRoutes = loadRoute('./routes/smartWallet');

// AGI Tutor routes
// @ts-ignore
const agiTutorRoutes = loadRoute('./routes/agiTutorRoutes');

// Analytics routes
// @ts-ignore
const analyticsRoutes = loadRoute('./routes/analytics');

// CSP Violation Reporting route
// @ts-ignore
const cspViolationRoutes = loadRoute('./routes/cspViolationRoutes');

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
app.use(metricsMiddleware);

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
app.use('/api/transactions', idempotency(), transactionLimiter, transactionRoutes);
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
const autonomousAgentsRoutes = loadRoute('./routes/autonomousAgents');
app.use('/api/autonomous-agents', autonomousAgentsRoutes);

// Gamification routes
// @ts-ignore
const gamificationRoutes = loadRoute('./routes/gamification');
app.use('/api/gamification', gamificationRoutes);

// Bridge routes
// @ts-ignore
const bridgeRoutes = loadRoute('./routes/bridge');
app.use('/api/bridge', bridgeRoutes);

// Time-Locked Credential routes with idempotency (Issue #264)
// @ts-ignore
const timeLockCredentialsRoutes = loadRoute('./routes/timeLockCredentials');
app.use('/api/time-lock', idempotency(), timeLockCredentialsRoutes);

// VRF (Verifiable Random Function) routes
// @ts-ignore
const vrfRoutes = loadRoute('./routes/vrf');
app.use('/api/vrf', vrfRoutes);

// Real-time Translation routes
// @ts-ignore
const translationRoutes = loadRoute('./routes/translation');
app.use('/api/translate', translationRoutes);

// Bulk operations routes (Admin) – Issue #262
// @ts-ignore
const bulkOperationsRoutes = loadRoute('./routes/bulkOperations');
app.use('/api/admin/bulk', bulkOperationsRoutes);

// Feature flag admin routes – Issue #267
// @ts-ignore
const featureFlagRoutes = resolveRoute(require('./routes/admin/featureFlags'));
app.use('/api/admin/feature-flags', featureFlagRoutes);

// Public evaluation endpoint for SPA / mobile clients – Issue #267
// First pulls `publicRouter` off the same module so the admin auth
// middleware on the default export is not applied to public callers.
// @ts-ignore
const featureFlagModule = require('./routes/admin/featureFlags');
const publicFeatureFlagRouter = (featureFlagModule as any).publicRouter ?? featureFlagModule;
app.use('/api/feature-flags', publicFeatureFlagRouter);

// Cross-Protocol Bridge routes
// @ts-ignore
const crossProtocolBridgeRoutes = loadRoute('./routes/crossProtocolBridge');
app.use('/api/cross-protocol-bridge', crossProtocolBridgeRoutes);

// Audit routes
// @ts-ignore
const auditRoutes = loadRoute('./routes/auditRoutes');
app.use('/api/audit', auditRoutes);

// CSP Violation Reporting endpoint
app.use('/api/csp-violation', cspViolationRoutes);

// Prometheus metrics endpoint
// @ts-ignore
const metricsRoutes = resolveRoute(require('./routes/metrics'));
app.use('/api/metrics', metricsRoutes);

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

/**
 * Ensure all registered Mongoose model indexes are created on existing
 * collections. If a MONGODB_URI env var is set and Mongoose is not yet
 * connected, a connection is established first.
 *
 * Called at startup so deployments against an existing database pick up any
 * new index definitions added to the schemas without requiring a manual
 * migration step.  (Issue #168)
 */
async function ensureMongooseIndexes(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

  // Attempt to connect if a MongoDB URI is configured and not yet connected
  if (mongoUri && mongoose.connection.readyState !== 1) {
    try {
      await mongoose.connect(mongoUri);
      logger.info('MongoDB connected for index synchronization');
    } catch (err) {
      logger.warn('MongoDB connection failed, skipping index sync', err as Error);
      return;
    }
  }

  if (mongoose.connection.readyState !== 1) {
    return;
  }

  const modelNames = mongoose.modelNames();
  if (modelNames.length === 0) return;

  logger.info(`Ensuring Mongoose indexes for ${modelNames.length} model(s)...`);

  for (const name of modelNames) {
    try {
      const model = mongoose.model(name);
      await model.createIndexes();
      logger.debug(`✓ Indexes ensured for model: ${name}`);
    } catch (err) {
      // Duplicate-key errors or missing-field warnings are non-fatal at
      // startup – the index definition may reference a field that does not
      // yet exist in every document.
      logger.warn(`Index creation for ${name} had warnings`, err as Error);
    }
  }

  logger.info('Mongoose index synchronization complete');
}

// Track the WebSocket metrics interval for cleanup on shutdown
let wsMetricsInterval: ReturnType<typeof setInterval> | undefined;

async function startServer() {
  try {
    // Ensure Mongoose indexes are created on existing collections (Issue #168)
    await ensureMongooseIndexes();

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

    if (typeof (transactionQueue as any).startProcessing === 'function') {
      await (transactionQueue as any).startProcessing();
    }
    if (typeof (transactionProcessor as any).start === 'function') {
      await (transactionProcessor as any).start();
    }
    if (typeof (transactionEvents as any).startListening === 'function') {
      await (transactionEvents as any).startListening();
    }
    await graphqlBootstrap.start();

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

// Periodically update WebSocket active connection count for Prometheus metrics
wsMetricsInterval = setInterval(() => {
  try {
    const io = websocketService.getIO();
    const count = io?.engine?.clientsCount ?? 0;
    websocketConnectionsActive.set(count);
  } catch {
    // Silently ignore if WebSocket not available
  }
}, 15_000);

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
           '/api/metrics',
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
      { name: 'ws-metrics-interval', run: () => { if (wsMetricsInterval) clearInterval(wsMetricsInterval); } },
      { name: 'http-server', run: () => closeHttpServer(server) },
      { name: 'transaction-queue', run: () => typeof (transactionQueue as any).stopProcessing === 'function' && (transactionQueue as any).stopProcessing() },
      { name: 'transaction-processor', run: () => typeof (transactionProcessor as any).stop === 'function' && (transactionProcessor as any).stop() },
      { name: 'transaction-events', run: () => typeof (transactionEvents as any).stopListening === 'function' && (transactionEvents as any).stopListening() },
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
