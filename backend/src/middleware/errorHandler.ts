/**
 * Centralized Error Handler Middleware — Issue #127, RFC 7807 — Issue #254.
 *
 * This is the single Express error-handling middleware for the entire app.
 * Register it LAST, after all routes, in {@link ./index.ts}.
 *
 * Response contract (RFC 7807 + AetherMint extensions):
 *
 *   Content-Type: application/problem+json
 *
 *   {
 *     "type":        "https://aethermint.io/problems/...",
 *     "title":       "Validation Error",
 *     "status":      400,
 *     "detail":      "Validation failed for 2 fields",
 *     "instance":    "POST /api/auth/register",
 *     "code":        "VALIDATION_ERROR",
 *     "success":     false,
 *     "requestId":   "uuid-v4",
 *     "timestamp":   "2026-07-24T12:34:56.000Z",
 *     "errors":      [{ "field": "email", "message": "must be a valid email" }],
 *     "error":       {                                  // legacy mirror (deprecated)
 *        "code":      "VALIDATION_ERROR",
 *        "message":   "Validation failed for 2 fields",
 *        "details":   [{ "field": "email", "message": "must be a valid email" }],
 *        "requestId": "uuid-v4"
 *     }
 *   }
 *
 * Stack traces are only included when `NODE_ENV === 'development'`.
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import logger from '../utils/logger';
import {
  PROBLEM_JSON_CONTENT_TYPE,
  ProblemDetails,
  buildProblemDetails,
  resolveRequestId,
  toAppError,
} from '../utils/problemDetails';

// ─── Re-exports ──────────────────────────────────────────────────────────────
//
// `catchAsync` and `PROBLEM_JSON_CONTENT_TYPE` are exposed from this
// module to preserve the pre-existing import path used across the
// codebase (`middleware/errorHandler`).  The canonical definitions live
// in `utils/problemDetails.ts`.

export { catchAsync, PROBLEM_JSON_CONTENT_TYPE } from '../utils/problemDetails';

// ─── Middleware ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Resolve correlation id BEFORE we touch the request; an early throw
  // inside a route should still propagate a stable id to the client.
  //
  // Priority 1. Response header set by the requestId middleware
  //           2. Incoming X-Request-ID header (retained for non-middleware
  //              entry points such as worker callbacks)
  //           3. Fresh UUID v4 as last resort.
  const requestId = resolveRequestId(
    res.getHeader('x-request-id'),
    req.headers['x-request-id'],
  );

  // Single source of truth for the normalised error. Both the log line
  // and the wire envelope are derived from this same object so they
  // cannot drift apart.
  const appError: AppError = toAppError(err);

  // ── Logging ────────────────────────────────────────────────────────────────
  // 5xx and non-operational errors are genuinely unexpected; treat them as
  // high severity.  4xx are expected operational signals — log at warn.
  if (appError.statusCode >= 500 || !appError.isOperational) {
    logger.error('Unhandled application error', {
      requestId,
      statusCode: appError.statusCode,
      errorCode: appError.errorCode,
      method: req.method,
      path: req.originalUrl,
      error: appError,
    });
  } else if (appError.statusCode >= 400) {
    logger.warn('Operational error', {
      requestId,
      statusCode: appError.statusCode,
      errorCode: appError.errorCode,
      message: appError.message,
      method: req.method,
      path: req.originalUrl,
    });
  }

  // Guard against writing headers after the response has already been sent
  // (e.g. when a downstream handler flushed and then threw).
  if (res.headersSent) {
    return;
  }

  // RFC 7807 mandates `Content-Type: application/problem+json` for
  // problem responses so intermediaries and clients can recognise them
  // without parsing the body.
  res.setHeader('Content-Type', PROBLEM_JSON_CONTENT_TYPE);

  const body: ProblemDetails = buildProblemDetails(
    appError,
    requestId,
    { method: req.method, originalUrl: req.originalUrl },
    500,
  );

  res.status(body.status).send(body);
};

export default errorHandler;
