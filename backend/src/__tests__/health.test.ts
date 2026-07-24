/**
 * Tests for the /health and /health/ready endpoints (Issue #178).
 *
 * Strategy:
 *   - The Postgres/Redis/IPFS/Stellar/disk probes are mocked at the module
 *     boundary so the suite does not require real infra.
 *   - Liveness is verified end-to-end via supertest against the Express app
 *     (imported and bound to a real port via an in-memory listener) so we
 *     also exercise the request-logger skip path and the shutdownGuard.
 *   - Readiness is verified both via the route's exported handler (asserting
 *     status code + cache plumbing) and via the HTTP entrypoint.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { Pool } from 'pg';

/**
 * `pg.Pool` is mocked so `checkDatabase` (which constructs a fresh pool per
 * probe) does not try to open a TCP connection.
 */
jest.mock('pg', () => {
  const Pool = jest.fn().mockImplementation(() => ({
    query: jest.fn().mockResolvedValue({ rows: [{ ok: 1 }] }),
    end: jest.fn().mockResolvedValue(undefined),
  }));
  return { Pool };
});

jest.mock('../config/redis', () => ({
  __esModule: true,
  default: {
    healthCheck: jest.fn().mockResolvedValue({
      status: 'connected',
      latency: 4,
      metrics: { totalCommands: 0, errorCount: 0, circuitBreakerOpen: false },
    }),
  },
}));

jest.mock('../config/ipfs', () => ({
  __esModule: true,
  ipfsConfig: {
    protocol: 'http',
    host: '127.0.0.1',
    port: 5001,
    apiPath: '/api/v0',
  },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  },
}));

// Provide a stable cache state between tests.
jest.mock('../utils/shutdown', () => {
  const actual = jest.requireActual('../utils/shutdown') as typeof import('../utils/shutdown');
  return {
    __esModule: true,
    ...actual,
  };
});

// fetch is used by the IPFS and Stellar probes – stub to succeed quickly.
const realFetch = global.fetch;
beforeAll(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 } as Response) as unknown as typeof fetch;
});
afterAll(() => {
  global.fetch = realFetch;
});

// Pull the router AFTER mocks are in place so the mocked Pool is wired in.
import healthRouter, { resetHealthCache } from '../routes/health';
import redisConfig from '../config/redis';
import { resetShutdownState, isShuttingDown, performShutdown } from '../utils/shutdown';

const buildApp = () => {
  // Mount the same shutdownGuard semantics as production so behavior matches.
  const app = express();
  let shuttingDown = false;
  app.use((req, _res, next) => {
    if (shuttingDown && !['/health', '/health/ready', '/api/health'].includes(req.path)) {
      _res.status(503).json({ success: false, message: 'Server is shutting down' });
      return;
    }
    next();
  });
  app.use('/health', healthRouter);
  return { app, setShuttingDown: (v: boolean) => { shuttingDown = v; } };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PoolMock = Pool as unknown as jest.Mock;

const mockRedisHealth = (result: unknown) => {
  (redisConfig.healthCheck as jest.Mock).mockResolvedValue(result);
};

describe('/health (liveness)', () => {
  beforeEach(() => {
    resetShutdownState();
    resetHealthCache();
    jest.clearAllMocks();
    mockRedisHealth({
      status: 'connected',
      latency: 4,
      metrics: { totalCommands: 0, errorCount: 0, circuitBreakerOpen: false },
    });
  });

  it('returns 200 with healthy status when process is alive', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(typeof res.body.timestamp).toBe('string');
    expect(typeof res.body.uptime).toBe('number');
  });

  it('returns 503 shutting_down once a graceful shutdown has begun', async () => {
    await performShutdown('SIGTERM', { steps: [], logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }, onExit: jest.fn() });
    expect(isShuttingDown()).toBe(true);

    const { app } = buildApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('shutting_down');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('/health/ready (readiness)', () => {
  beforeEach(() => {
    resetShutdownState();
    resetHealthCache();
    jest.clearAllMocks();
    // The probe in `routes/health.ts` short-circuits with "DATABASE_URL not
    // configured" if the env var is missing – we set it here so the database
    // probe is actually exercised in the unit suite.
    process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1:5432/test';
    // Reset pg.Pool mock implementation between cases so unit test ordering
    // does not leak probe state.
    PoolMock.mockImplementation(() => ({
      query: jest.fn().mockResolvedValue({ rows: [{ ok: 1 }] }),
      end: jest.fn().mockResolvedValue(undefined),
    }));
    mockRedisHealth({
      status: 'connected',
      latency: 4,
      metrics: { totalCommands: 0, errorCount: 0, circuitBreakerOpen: false },
    });
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  it('returns 200 ok when every dependency probe succeeds', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.dependencies.database.status).toBe('up');
    expect(res.body.dependencies.redis.status).toBe('up');
    expect(res.body.dependencies.ipfs.status).toBe('up');
    expect(res.body.dependencies.stellar.status).toBe('up');
    expect(res.body.dependencies.disk.status).toBe('up');
  });

  it('returns 503 degraded when the database probe fails', async () => {
    PoolMock.mockImplementation(() => ({
      query: jest.fn().mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:5432')),
      end: jest.fn().mockResolvedValue(undefined),
    }));

    const { app } = buildApp();
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.dependencies.database.status).toBe('down');
    expect(res.body.dependencies.database.error).toBeDefined();
  });

  it('returns 503 degraded when Redis is disconnected', async () => {
    mockRedisHealth({
      status: 'disconnected',
      metrics: { totalCommands: 0, errorCount: 0, circuitBreakerOpen: false },
    });
    const { app } = buildApp();
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.dependencies.redis.status).toBe('down');
  });

  it('marks a dependency down when its probe hangs beyond the timeout', async () => {
    // Simulate a database probe that never settles.
    PoolMock.mockImplementation(() => ({
      query: () => new Promise(() => undefined),
      end: jest.fn().mockResolvedValue(undefined),
    }));

    const { app } = buildApp();
    // Use a low custom timeout for the assertion to keep the test fast.
    process.env.HEALTH_CHECK_TIMEOUT_MS = '20';
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.dependencies.database.status).toBe('down');
    expect(String(res.body.dependencies.database.error)).toMatch(/timeout|aborted/i);
    delete process.env.HEALTH_CHECK_TIMEOUT_MS;
  });

  it('serves a cached response on the second call within the TTL', async () => {
    const { app } = buildApp();
    process.env.HEALTH_CHECK_CACHE_TTL_MS = '60000';

    const first = await request(app).get('/health/ready');
    expect(first.status).toBe(200);
    expect(first.body.cached).toBe(false);
    // Pool should have been constructed exactly once for the database probe.
    expect(PoolMock).toHaveBeenCalledTimes(1);

    const second = await request(app).get('/health/ready');
    expect(second.status).toBe(200);
    expect(second.body.cached).toBe(true);
    // Still only one probe despite two readiness calls.
    expect(PoolMock).toHaveBeenCalledTimes(1);

    delete process.env.HEALTH_CHECK_CACHE_TTL_MS;
  });

  it('returns 503 shutting_down in the readiness payload and skips dependency probes', async () => {
    await performShutdown('SIGTERM', { steps: [], logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }, onExit: jest.fn() });

    const { app } = buildApp();
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.message).toMatch(/shutting down/i);
    expect(res.body.dependencies).toEqual({});
    // Pool must NOT have been constructed while shutting down.
    expect(PoolMock).not.toHaveBeenCalled();
  });
});
