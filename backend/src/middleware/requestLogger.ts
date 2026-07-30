/**
 * Request logging middleware.
 *
 * Emits a structured "HTTP request completed" log line for every request,
 * including status code and duration. The correlation ID is assigned upstream by
 * the requestId middleware (see {@link requestId}); this middleware only reads it,
 * and runs inside the AsyncLocalStorage context that middleware established.
 */

import { NextFunction, Request, Response } from 'express';
import logger from '../utils/logger';

const getRequestPath = (req: Request) => req.originalUrl || req.url || req.path;

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startedAt = Date.now();
  const requestPath = getRequestPath(req);

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
