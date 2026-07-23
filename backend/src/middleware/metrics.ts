/**
 * Prometheus Metrics Middleware
 *
 * Collects and exposes metrics for monitoring via Prometheus. Includes:
 * - HTTP request duration histogram (method, route, status_code labels)
 * - HTTP request count by status code (method, route, status_code labels)
 * - Active WebSocket connections gauge
 * - Redis cache hit/miss ratio counters
 * - Database query duration histogram
 * - Credential issuance rate counter
 *
 * Also enables prom-client's default metrics (event loop lag, memory, GC, etc.).
 */

import { NextFunction, Request, Response } from 'express';
import client from 'prom-client';

// ── Registry ──────────────────────────────────────────────────────────────────

const register = new client.Registry();
register.setDefaultLabels({
  app: 'aethermint-backend',
});

// Enable default metrics (event loop lag, heap, GC, process CPU, open handles, etc.)
client.collectDefaultMetrics({ register, prefix: 'aethermint_' });

// ── HTTP Metrics ──────────────────────────────────────────────────────────────

export const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'aethermint_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const httpRequestsTotal = new client.Counter({
  name: 'aethermint_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// ── WebSocket Metrics ─────────────────────────────────────────────────────────

export const websocketConnectionsActive = new client.Gauge({
  name: 'aethermint_websocket_connections_active',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

// ── Redis Metrics ─────────────────────────────────────────────────────────────

export const redisOperationsTotal = new client.Counter({
  name: 'aethermint_redis_operations_total',
  help: 'Total number of Redis operations',
  labelNames: ['operation', 'status'], // status: 'hit' | 'miss' | 'error'
  registers: [register],
});

// ── Database Metrics ──────────────────────────────────────────────────────────

export const databaseQueryDurationSeconds = new client.Histogram({
  name: 'aethermint_database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'collection'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [register],
});

// ── Business Metrics ──────────────────────────────────────────────────────────

export const credentialIssuanceTotal = new client.Counter({
  name: 'aethermint_credential_issuance_total',
  help: 'Total number of credentials issued',
  labelNames: ['type'], // 'time_locked' | 'standard'
  registers: [register],
});

export const enrollmentTotal = new client.Counter({
  name: 'aethermint_enrollment_total',
  help: 'Total number of course enrollments',
  registers: [register],
});

export const courseCompletionTotal = new client.Counter({
  name: 'aethermint_course_completion_total',
  help: 'Total number of course completions',
  registers: [register],
});

// ── Middleware ─────────────────────────────────────────────────────────────────

/**
 * Express middleware that records HTTP request duration and count.
 * Must be registered early in the middleware chain (after requestId/requestLogger).
 */
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(startTime);
    const durationSeconds = diff[0] + diff[1] / 1e9;

    const route = req.route?.path || req.path || 'unknown';
    const method = req.method;
    const statusCode = res.statusCode.toString();

    httpRequestDurationMicroseconds.observe({ method, route, status_code: statusCode }, durationSeconds);
    httpRequestsTotal.inc({ method, route, status_code: statusCode });
  });

  next();
};

// ── Exports ───────────────────────────────────────────────────────────────────

export { register };
export default metricsMiddleware;
