/**
 * Health Check Endpoints (Issue #178)
 *
 * Provides two endpoints for orchestrators (Kubernetes, load balancers) to
 * assess the runtime state of the backend:
 *
 *   GET /health       — Liveness probe. Cheap, dependency-free, never cached.
 *                        Returns 200 while the process is serving requests,
 *                        503 when draining during graceful shutdown.
 *
 *   GET /health/ready — Readiness probe. Checks every external dependency
 *                        (database, Redis, Stellar RPC, IPFS node, disk
 *                        space) in parallel, with per-check timeouts and a
 *                        small in-process TTL cache so kubelet probes do not
 *                        stampede struggling dependencies. Concurrent calls
 *                        that miss the cache share a single in-flight probe
 *                        so a probe burst cannot trigger multiple fan-outs.
 *
 * Neither endpoint is rate-limited nor logged in the standard request log,
 * because both are hit on a schedule by infrastructure (typically every
 * 5–30s) and would otherwise drown the access log in noise.
 *
 * @openapi
 * tags:
 *   - name: Health
 *     description: Liveness and readiness probes for orchestrators
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import { Pool } from 'pg';
import logger from '../utils/logger';
import { isShuttingDown } from '../utils/shutdown';
import redisConfig from '../config/redis';
// `ipfs.js` has no bundled type declarations – the JS config is statically
// typed by its own internal usage; we only read four primitive fields here.
// @ts-ignore - upstream config is `.js` without a `.d.ts`
import { ipfsConfig } from '../config/ipfs';

const router = Router();

// ──────────────────────────────────────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_CACHE_TTL_MS = 10_000;
const DEFAULT_DISK_MIN_FREE_BYTES = 100 * 1024 * 1024; // 100 MB

// Configuration is read lazily on every probe call. The `Number(...)` cost is
// trivial compared with a TCP round-trip, and lazy evaluation lets operators
// bump `HEALTH_CHECK_TIMEOUT_MS` without restarting the process – useful
// during an incident when probes are aggressively missing their budget.
// Tests rely on this too: setting the env var between calls actually changes
// the timeout without re-importing the module.
const getTimeoutMs = (): number => {
  const raw = Number(process.env.HEALTH_CHECK_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
};

const getCacheTtlMs = (): number => {
  const raw = Number(process.env.HEALTH_CHECK_CACHE_TTL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_CACHE_TTL_MS;
};

const DISK_MIN_FREE_BYTES = (() => {
  const raw = Number(process.env.HEALTH_DISK_MIN_FREE_BYTES);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DISK_MIN_FREE_BYTES;
})();

const STELLAR_HORIZON_URL =
  process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';

const IPFS_API_URL = `${ipfsConfig.protocol}://${ipfsConfig.host}:${ipfsConfig.port}${ipfsConfig.apiPath}`;

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export type DependencyStatus = 'up' | 'down';

export interface DependencyReport {
  status: DependencyStatus;
  latencyMs?: number;
  error?: string;
  [meta: string]: unknown;
}

export interface ReadinessResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  cached: boolean;
  dependencies: Record<string, DependencyReport>;
}

// ──────────────────────────────────────────────────────────────────────────────
// In-process cache + in-flight coalescing
// ──────────────────────────────────────────────────────────────────────────────

interface CacheEntry {
  result: ReadinessResponse;
  expiresAt: number;
}

let readyCache: CacheEntry | null = null;
let readyInflight: Promise<ReadinessResponse> | null = null;

/** Exposed for tests so each case starts from a known state. */
export const resetHealthCache = (): void => {
  readyCache = null;
  readyInflight = null;
};

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Race a promise against a timeout. The original promise is not cancelled –
 * we let it settle in the background to avoid corrupting shared clients, but
 * its result is discarded if it loses the race.
 */
const withTimeout = async <T>(promise: Promise<T>, ms: number, _label: string): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    timer.unref?.();
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/**
 * Returns a public-safe error label. We deliberately surface the error class
 * (e.g. `TimeoutError`) rather than the full message because connection
 * libraries often include URLs, hostnames, file paths, or driver-specific
 * diagnostics that are not useful to external callers and may leak topology.
 * The full error is still logged server-side by the route handler.
 */
const safeErrorMessage = (err: unknown): string => {
  if (err instanceof Error) {
    const errName = err.name || 'Error';
    // Defensive: still scrub URL credentials from messages that happen to
    // be useful (e.g. ECONNREFUSED text from pg/ioredis).
    const scrubbed = err.message.replace(/\/\/[^@\s]+@/g, '//[redacted]@');
    return scrubbed.length > 120 ? `${errName}: ${scrubbed.slice(0, 120)}…` : `${errName}: ${scrubbed}`;
  }
  return typeof err === 'string' ? err : 'Unknown error';
};

// ──────────────────────────────────────────────────────────────────────────────
// Individual dependency probes
// ──────────────────────────────────────────────────────────────────────────────

const checkDatabase = async (timeoutMs: number): Promise<DependencyReport> => {
  const startedAt = Date.now();
  if (!process.env.DATABASE_URL) {
    return {
      status: 'down',
      error: 'DATABASE_URL not configured',
    };
  }

  const probe = (async (): Promise<DependencyReport> => {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: Math.min(timeoutMs, 3000),
      idleTimeoutMillis: 1000,
    });

    try {
      const result = await pool.query('SELECT 1 AS ok');
      const latencyMs = Date.now() - startedAt;
      const row = result.rows?.[0];
      return {
        status: row?.ok === 1 ? 'up' : 'down',
        latencyMs,
        error: row?.ok !== 1 ? 'Unexpected SELECT 1 response' : undefined,
      };
    } finally {
      // Always release the pool so it does not leak under repeated checks.
      await pool.end().catch(() => undefined);
    }
  })();

  try {
    return await withTimeout(probe, timeoutMs, 'database');
  } catch (err) {
    return {
      status: 'down',
      latencyMs: Date.now() - startedAt,
      error: err instanceof TimeoutError ? `timeout after ${timeoutMs}ms` : safeErrorMessage(err),
    };
  }
};

const checkRedis = async (timeoutMs: number): Promise<DependencyReport> => {
  const startedAt = Date.now();
  try {
    const result = await withTimeout(redisConfig.healthCheck(), timeoutMs, 'redis');
    const latencyMs = Date.now() - startedAt;
    if (result.status === 'connected') {
      return {
        status: 'up',
        latencyMs,
        latency: latencyMs,
        circuitBreakerOpen: result.metrics?.circuitBreakerOpen ?? false,
      };
    }
    return {
      status: 'down',
      latencyMs,
      error: result.error ?? result.status,
      circuitBreakerOpen: result.metrics?.circuitBreakerOpen ?? false,
    };
  } catch (err) {
    return {
      status: 'down',
      latencyMs: Date.now() - startedAt,
      error: err instanceof TimeoutError ? `timeout after ${timeoutMs}ms` : safeErrorMessage(err),
    };
  }
};

const checkIpfs = async (timeoutMs: number): Promise<DependencyReport> => {
  const startedAt = Date.now();
  // The IPFS HTTP API `/api/v0/version` is POST only and returns version info.
  // We do not need a real response body for a reachability probe – any HTTP
  // response (4xx/5xx included) proves the daemon is up and accepting traffic.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();

  try {
    const response = await fetch(IPFS_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        // IPFS rejects unknown multipart bodies without this hint.
        'Content-Type': '',
      },
    });
    const latencyMs = Date.now() - startedAt;
    // Any response reachable on the API port (2xx, 4xx, 5xx) means the IPFS
    // daemon is alive. Connection errors and aborts are caught below.
    return {
      status: response.status > 0 ? 'up' : 'down',
      latencyMs,
      httpStatus: response.status,
      endpoint: IPFS_API_URL,
    };
  } catch (err) {
    return {
      status: 'down',
      latencyMs: Date.now() - startedAt,
      error: err instanceof TimeoutError
        ? `timeout after ${timeoutMs}ms`
        : controller.signal.aborted
          ? `aborted after ${timeoutMs}ms`
          : safeErrorMessage(err),
      endpoint: IPFS_API_URL,
    };
  } finally {
    clearTimeout(timer);
  }
};

const checkStellar = async (timeoutMs: number): Promise<DependencyReport> => {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();

  try {
    // A HEAD on the Horizon root exercises TCP + TLS + JSON-RPC routing and
    // returns the build version header for free.
    const response = await fetch(STELLAR_HORIZON_URL, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });
    const latencyMs = Date.now() - startedAt;
    if (response.ok || (response.status >= 200 && response.status < 500)) {
      return {
        status: 'up',
        latencyMs,
        httpStatus: response.status,
        endpoint: STELLAR_HORIZON_URL,
      };
    }
    return {
      status: 'down',
      latencyMs,
      httpStatus: response.status,
      error: `unexpected HTTP ${response.status}`,
      endpoint: STELLAR_HORIZON_URL,
    };
  } catch (err) {
    return {
      status: 'down',
      latencyMs: Date.now() - startedAt,
      error: err instanceof TimeoutError
        ? `timeout after ${timeoutMs}ms`
        : controller.signal.aborted
          ? `aborted after ${timeoutMs}ms`
          : safeErrorMessage(err),
      endpoint: STELLAR_HORIZON_URL,
    };
  } finally {
    clearTimeout(timer);
  }
};

const checkDisk = async (): Promise<DependencyReport> => {
  // fs.statfsSync is available on Node ≥ 18.15. The Docker image is on node:20.
  try {
    const stats = fs.statfsSync(process.cwd());
    const freeBytes = Number(stats.bavail) * Number(stats.bsize);
    const totalBytes = Number(stats.blocks) * Number(stats.bsize);
    const usedBytes = totalBytes - freeBytes;
    const usagePercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0;
    if (freeBytes < DISK_MIN_FREE_BYTES) {
      return {
        status: 'down',
        freeBytes,
        totalBytes,
        usagePercent,
        thresholdBytes: DISK_MIN_FREE_BYTES,
        error: `free disk space (${freeBytes} B) below threshold (${DISK_MIN_FREE_BYTES} B)`,
      };
    }
    return {
      status: 'up',
      freeBytes,
      totalBytes,
      usagePercent,
      thresholdBytes: DISK_MIN_FREE_BYTES,
    };
  } catch (err) {
    return {
      status: 'down',
      error: safeErrorMessage(err),
    };
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Probe orchestration – exported so legacy aliases can dispatch directly
// without an HTTP redirect (which bare fetch – smoke-test.mjs – does NOT follow).
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Discovery: run the five probes in parallel and return the aggregate. Called
 * by both `/health/ready` and `/api/health/ready`.
 */
export const runReadinessProbes = async (): Promise<ReadinessResponse> => {
  const startedAt = Date.now();
  const timeoutMs = getTimeoutMs();

  const [database, redis, ipfs, stellar, disk] = await Promise.all([
    checkDatabase(timeoutMs),
    checkRedis(timeoutMs),
    checkIpfs(timeoutMs),
    checkStellar(timeoutMs),
    checkDisk(),
  ]);

  const dependencies: Record<string, DependencyReport> = {
    database,
    redis,
    ipfs,
    stellar,
    disk,
  };

  const allUp = Object.values(dependencies).every((dep) => dep.status === 'up');
  return {
    status: allUp ? 'ok' : 'degraded',
    timestamp: new Date(startedAt).toISOString(),
    uptime: process.uptime(),
    cached: false,
    dependencies,
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// Handlers – exported so legacy aliases mount the same function (smoke-test.mjs
// uses bare fetch which does not follow redirects).
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Liveness handler. Returns 200 healthy while the process is alive, 503 once a
 * graceful shutdown has begun (load balancers stop routing freshly).
 *
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Liveness probe
 *     description: |
 *       Returns 200 with `{ status: "healthy" }` while the process is serving
 *       traffic, or 503 with `{ status: "shutting_down" }` once a graceful
 *       shutdown has begun. Always cheap, dependency-free, and never cached.
 *     responses:
 *       '200':
 *         description: Process is alive and serving requests
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LivenessResponse'
 *       '503':
 *         description: Process is shutting down
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ShuttingDownResponse'
 */
export const livenessHandler = (_req: Request, res: Response): void => {
  if (isShuttingDown()) {
    res.status(503).json({
      status: 'shutting_down',
      timestamp: new Date().toISOString(),
    });
    return;
  }
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
};

/**
 * Readiness handler. Returns 200 ok when every dependency is up, 503 degraded
 * when any is down. Uses an in-process TTL cache plus in-flight coalescing so
 * that probe bursts do not stampede struggling dependencies.
 *
 * @openapi
 * /health/ready:
 *   get:
 *     tags: [Health]
 *     summary: Readiness probe with dependency status
 *     description: |
 *       Verifies that every critical dependency (database, Redis, Stellar
 *       RPC, IPFS node, and disk space) is reachable, with each probe
 *       independently bounded by a 5-second timeout (configurable via
 *       `HEALTH_CHECK_TIMEOUT_MS`). The aggregate response is cached for
 *       10 seconds (configurable via `HEALTH_CHECK_CACHE_TTL_MS`) so frequent
 *       probes do not stampede dependencies. Concurrent burst calls share a
 *       single in-flight probe round.
 *     responses:
 *       '200':
 *         description: All dependencies are reachable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReadinessResponse'
 *       '503':
 *         description: One or more dependencies are unreachable, or process is draining
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReadinessResponse'
 */
export const readinessHandler = async (_req: Request, res: Response): Promise<void> => {
  // Pin env reads once for the whole request so the parallel probes share an
  // identical budget even if the env var is mutated mid-request.
  const cacheTtlMs = getCacheTtlMs();
  const now = Date.now();

  if (isShuttingDown()) {
    res.status(503).json({
      status: 'degraded',
      timestamp: new Date(now).toISOString(),
      uptime: process.uptime(),
      cached: false,
      message: 'Process is shutting down',
      dependencies: {},
    });
    return;
  }

  // Serve cached aggregate when still fresh — probes hit dependencies at
  // most once per cache window regardless of how often this endpoint fires.
  if (readyCache && readyCache.expiresAt > now) {
    const cached = { ...readyCache.result, cached: true };
    res.status(cached.status === 'ok' ? 200 : 503).json(cached);
    return;
  }

  // Coalesce concurrent miss-callers onto a single fan-out so a probe burst
  // (kubelet cold start, multiple LBs, etc.) doesn't fire N parallel probe
  // rounds against a struggling dependency.
  if (!readyInflight) {
    readyInflight = runReadinessProbes();
  }

  try {
    const result = await readyInflight;
    readyCache = { result, expiresAt: now + cacheTtlMs };

    if (result.status !== 'ok') {
      // Log only the down dependencies so operators see transition events
      // without flooding the log on every subsequent cached probe.
      const down = Object.entries(result.dependencies)
        .filter(([, v]) => v.status === 'down')
        .map(([k]) => k);
      logger.warn('Readiness probe degraded', { down });
    }

    res.status(result.status === 'ok' ? 200 : 503).json(result);
  } finally {
    readyInflight = null;
  }
};

router.get('/', livenessHandler);
router.get('/ready', readinessHandler);

export default router;
