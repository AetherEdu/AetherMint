/**
 * Request logging middleware.
 *
 * Emits a structured "HTTP request completed" log line for every request,
 * including status code and duration. The correlation ID is assigned upstream by
 * the requestId middleware (see {@link requestId}); this middleware only reads it,
 * and runs inside the AsyncLocalStorage context that middleware established.
 *
 * High-frequency orchestrator probes ({@link SILENT_PATHS}) are skipped so they
 * do not pollute the access log – kubelets / load balancers hit these endpoints
 * every few seconds and would otherwise drown out meaningful traffic.
 */

import { NextFunction, Request, Response } from 'express';
import logger from '../utils/logger';

/**
 * Paths that may be probed on a tight schedule by infrastructure. Matching is
 * done on the request path (post-mount) so both `/health/ready` and the legacy
 * `/api/health` alias are excluded.
 */
const SILENT_PATHS: ReadonlySet<string> = new Set([
  '/health',
  '/health/ready',
  '/api/health',
]);

const getRequestPath = (req: Request) => req.originalUrl || req.url || req.path;

/**
 * Normalize a request path for silent-list comparison: strip trailing slashes
 * (Express keeps `/health/` distinct from `/health` for `req.path`).
 */
const normalizePath = (p: string): string => {
  if (!p) return '/';
  const stripped = p.replace(/\/+$/, '');
  return stripped === '' ? '/' : stripped;
};

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startedAt = Date.now();
  const requestPath = getRequestPath(req);

  // Skip the access log for probes – still let handlers run so probes get a
  // real response. The path comparison ignores query strings and trailing
  // slashes so `/health/` and `/health?probe=1` both bypass logging.
  if (SILENT_PATHS.has(normalizePath(req.path))) {
    next();
    return;
  }

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const statusCode = res.statusCode;
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    logger.log(level, 'HTTP request completed', {
      requestId: req.requestId,
      method: req.method,
      path: requestPath,
      statusCode,
      durationMs,
      ip: req.ip,
    });
  });

  next();
};

export default requestLogger;
export { SILENT_PATHS };
