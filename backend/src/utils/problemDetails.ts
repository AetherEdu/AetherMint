/**
 * RFC 7807 Problem Details for HTTP APIs — Issue #254
 *
 * Provides the canonical wire shape used by every AetherMint API endpoint
 * for HTTP error responses.  Standard fields live at the top level
 * (`type`, `title`, `status`, `detail`, `instance`).  AetherMint-specific
 * extensions (`code`, `requestId`, `timestamp`, `success`, `errors`) are
 * added alongside and a deprecated `error` mirror preserves the legacy
 * `{success:false, error:{…}}` envelope for clients that still read it.
 *
 * Spec reference: https://datatracker.ietf.org/doc/html/rfc7807
 */

import { randomUUID } from 'crypto';
import { AppError, InternalError } from './errors';

// ─── Wire types ──────────────────────────────────────────────────────────────

/** A single field-level error (RFC 7807 §A — extensions example). */
export interface FieldValidationError {
  field: string;
  message: string;
  /** Optional Joi/express-validator rule name (e.g. `"string.email"`). */
  rule?: string;
}

/** Additional AetherMint-specific members attached to RFC 7807 responses. */
export interface ProblemExtensions {
  /** Machine-readable error code (e.g. `"VALIDATION_ERROR"`). */
  code: string;
  /** Always `false` for an error response. Preserves the prior envelope's flag. */
  success: false;
  /** Correlation id emitted by `requestId` middleware and echoed in `X-Request-ID`. */
  requestId: string;
  /** ISO-8601 timestamp captured when the response was composed. */
  timestamp: string;
  /** RFC 7807 §A — list of field-level validation errors (when applicable). */
  errors?: FieldValidationError[];
}

/**
 * RFC 7807 Problem Details object as emitted on the wire.
 *
 * The five standard members (`type`, `title`, `status`, `detail`, `instance`)
 * are always present for an RFC 7807-compliant response.  Extension
 * members are defined in {@link ProblemExtensions} and a deprecated
 * `error` mirror keeps the legacy envelope working during migration.
 */
export interface ProblemDetails extends ProblemExtensions {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  /** Legacy envelope preserved for backward compatibility — see PRD §6.2. */
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
    /** Stack trace is included only when `NODE_ENV === 'development'`. */
    stack?: string;
  };
}

/** Content-Type emitted with every Problem Details response. */
export const PROBLEM_JSON_CONTENT_TYPE = 'application/problem+json';

// ─── Error catalog ───────────────────────────────────────────────────────────

/**
 * Stable type URIs published under `https://aethermint.io/problems/…`.
 * Each URI is the authoritative identifier of a *kind* of error; clients may
 * dereference them to receive a human-readable description of the
 * problem type.  These URIs are intentionally stable across versions so
 * that older CLIs and dashboards keep working.
 */
export const ProblemTypes = {
  VALIDATION_ERROR: 'https://aethermint.io/problems/validation-error',
  UNAUTHORIZED: 'https://aethermint.io/problems/unauthorized',
  FORBIDDEN: 'https://aethermint.io/problems/forbidden',
  NOT_FOUND: 'https://aethermint.io/problems/not-found',
  CONFLICT: 'https://aethermint.io/problems/conflict',
  RATE_LIMITED: 'https://aethermint.io/problems/rate-limited',
  PAYLOAD_TOO_LARGE: 'https://aethermint.io/problems/payload-too-large',
  UNSUPPORTED_MEDIA_TYPE: 'https://aethermint.io/problems/unsupported-media-type',
  SERVICE_UNAVAILABLE: 'https://aethermint.io/problems/service-unavailable',
  INTERNAL_ERROR: 'https://aethermint.io/problems/internal-error',
  UNKNOWN_ERROR: 'https://aethermint.io/problems/unknown-error',
} as const;

/**
 * Machine-readable per-error metadata used to build the wire envelope.
 *
 * - `status` is the HTTP status code returned to the client
 * - `title` is the short, type-stable RFC 7807 `title` (does not change
 *   per-occurrence — see RFC 7807 §3.1)
 * - `type` is the stable URI identifying the problem class
 * - `userMessage` is the human-friendly default used when the throwing
 *   site does not supply a more specific message
 */
export interface ErrorCatalogEntry {
  status: number;
  title: string;
  type: string;
  userMessage: string;
}

/**
 * Source of truth for every documented error code the API can emit.
 *
 * When you introduce a new operational error:
 *   1. Add the AppError subclass in `utils/errors.ts`
 *   2. Add an entry here — never invent a code outside the catalog
 *   3. Mirror it in `backend/docs/ERROR_CATALOG.md`
 */
export const ErrorCatalog: Record<string, ErrorCatalogEntry> = {
  VALIDATION_ERROR: {
    status: 400,
    title: 'Validation Error',
    type: ProblemTypes.VALIDATION_ERROR,
    userMessage: 'The request payload failed validation.',
  },
  UNAUTHORIZED: {
    status: 401,
    title: 'Unauthorized',
    type: ProblemTypes.UNAUTHORIZED,
    userMessage: 'Authentication is required to access this resource.',
  },
  FORBIDDEN: {
    status: 403,
    title: 'Forbidden',
    type: ProblemTypes.FORBIDDEN,
    userMessage: 'You do not have permission to perform this action.',
  },
  NOT_FOUND: {
    status: 404,
    title: 'Not Found',
    type: ProblemTypes.NOT_FOUND,
    userMessage: 'The requested resource could not be found.',
  },
  CONFLICT: {
    status: 409,
    title: 'Conflict',
    type: ProblemTypes.CONFLICT,
    userMessage: 'The request conflicts with the current state of the resource.',
  },
  RATE_LIMITED: {
    status: 429,
    title: 'Too Many Requests',
    type: ProblemTypes.RATE_LIMITED,
    userMessage: 'You have exceeded the rate limit. Please retry after a moment.',
  },
  PAYLOAD_TOO_LARGE: {
    status: 413,
    title: 'Payload Too Large',
    type: ProblemTypes.PAYLOAD_TOO_LARGE,
    userMessage: 'The request body exceeds the maximum allowed size.',
  },
  UNSUPPORTED_MEDIA_TYPE: {
    status: 415,
    title: 'Unsupported Media Type',
    type: ProblemTypes.UNSUPPORTED_MEDIA_TYPE,
    userMessage: 'The request media type is not supported by this endpoint.',
  },
  SERVICE_UNAVAILABLE: {
    status: 503,
    title: 'Service Unavailable',
    type: ProblemTypes.SERVICE_UNAVAILABLE,
    userMessage: 'The service is temporarily unavailable. Please retry shortly.',
  },
  INTERNAL_ERROR: {
    status: 500,
    title: 'Internal Server Error',
    type: ProblemTypes.INTERNAL_ERROR,
    userMessage: 'An unexpected error occurred. Please try again later.',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build the `instance` URI — the request location that produced the
 * problem.  Falls back to a synthetic identifier built from method+path
 * when the request object is unavailable (e.g. when we are invoked from
 * outside the request lifecycle in tests).
 */
export function buildInstance(method: string | undefined, originalUrl: string | undefined): string {
  const safeMethod = (method || 'REQUEST').toUpperCase();
  const rawPath = originalUrl || '/';
  // Strip query string from path-clobber example bodies; keep it for real
  // requests so clients can correlate by full URL.
  return `${safeMethod} ${rawPath}`;
}

/**
 * Extract or mint a request id from the request/response cycle.
 * Mirrors the priority order used by the existing error middleware:
 * 1. `X-Request-ID` response header (set by `requestId` middleware)
 * 2. `X-Request-ID` request header (validated UUID v4 upstream)
 * 3. Fresh UUID v4 as last resort.
 */
export function resolveRequestId(
  responseHeader: string | string[] | number | undefined,
  requestHeader: string | string[] | undefined,
): string {
  if (typeof responseHeader === 'string' && responseHeader.length > 0) {
    return responseHeader;
  }
  if (typeof requestHeader === 'string' && requestHeader.length > 0) {
    return requestHeader;
  }
  if (Array.isArray(requestHeader) && requestHeader[0]) {
    return requestHeader[0];
  }
  return randomUUID();
}

/**
 * True when an `errorCode` is present in {@link ErrorCatalog}.
 * Unknown codes still get a usable RFC 7807 envelope but with the
 * generic UNKNOWN_ERROR metadata so we never silently drop a code.
 */
function lookupEntry(errorCode: string, fallbackStatus: number): ErrorCatalogEntry {
  return (
    ErrorCatalog[errorCode] ?? {
      status: fallbackStatus,
      title: 'Unknown Error',
      type: ProblemTypes.UNKNOWN_ERROR,
      userMessage: 'An unspecified error occurred.',
    }
  );
}

import type { NextFunction, Request, Response } from 'express';

/**
 * Normalise any thrown value into an {@link AppError}.
 *
 * - Already an AppError → returned as-is so the original stack is preserved.
 * - Plain Error in development → the original message is surfaced.
 * - Plain Error in production → masked behind a generic 500 envelope.
 * - Anything else (string, object, …) → coerced into a sanitized
 *   `InternalError` so we never leak non-string values into logs.
 *
 * Exported so {@link middleware/errorHandler.ts} can use the same shape for
 * log lines as the one that will eventually be serialised into the wire
 * envelope.  Keeping a single normalisation path eliminates drift between
 * log payload and HTTP response payload.
 */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  const isDev = process.env.NODE_ENV === 'development';
  const message =
    isDev && err instanceof Error && err.message ? err.message : 'Internal server error';

  const appError = new InternalError(message);
  if (err instanceof Error && err.stack) {
    appError.stack = err.stack;
  }
  return appError;
}

/**
 * Compose a fully-populated RFC 7807 ProblemDetails envelope for a
 * thrown error.  Designed to be called once, from the central error
 * middleware, after request id and logging context are resolved.
 *
 * The `toAppError(err)` re-normalisation inside this helper looks
 * redundant when called from `errorHandler.ts` (which already pre-
 * normalised the throwable) but is retained intentionally so the
 * helper is safe to call directly from unit tests, scheduled jobs,
 * and any other entry point that does not go through Express.
 *
 * @param err             The original thrown value (already normalised).
 * @param requestId       Correlation id.
 * @param requestMeta     Method + path used to build `instance`.
 * @param fallbackStatus  HTTP status to use for unknown errors.
 */
export function buildProblemDetails(
  err: unknown,
  requestId: string,
  requestMeta: { method: string; originalUrl: string },
  fallbackStatus: number,
): ProblemDetails {
  const appError = toAppError(err);
  const entry = lookupEntry(appError.errorCode, fallbackStatus);

  // The runtime status from the AppError wins over the catalog fallback
  // so per-instance custom statuses (e.g. a 401 mapped from a 500 in a
  // future auth refactor) still surface correctly.
  const status = appError.statusCode || entry.status;
  const title = entry.title;
  const type = entry.type;

  // `detail` is the per-occurrence human message.  Use the developer
  // supplied message for operational errors; mask everything else.
  const detail = appError.isOperational
    ? appError.message || entry.userMessage
    : entry.userMessage;

  const instance = buildInstance(requestMeta.method, requestMeta.originalUrl);

  const isDev = process.env.NODE_ENV === 'development';

  // Build the side-car `errors` array when validation details are
  // carried. ValidationError stores details as
  //   { field: string, message: string }[]  — match that shape.
  const fieldErrors = normaliseFieldErrors(appError.details);

  const body: ProblemDetails = {
    type,
    title,
    status,
    detail,
    instance,
    code: appError.errorCode,
    success: false,
    requestId,
    timestamp: new Date().toISOString(),
    error: {
      code: appError.errorCode,
      message: detail,
      requestId,
      ...(appError.details !== undefined && { details: appError.details }),
      ...(isDev && appError.stack ? { stack: appError.stack } : {}),
    },
  };

  if (fieldErrors && fieldErrors.length > 0) {
    body.errors = fieldErrors;
  }

  return body;
}

/**
 * Coerce the various shapes `details` may take into the canonical
 * field-error array used by the `errors` extension member.
 *
 * Accepts:
 *   - `undefined` / `null` → returns `undefined`
 *   - `FieldValidationError[]` → returned verbatim
 *   - `Record<string, unknown>` (Joi error map keyed by field name)
 *   - Other serializable shapes → returned as-is wrapped in a single
 *     entry under `field: '_'` so the client still sees *something*.
 */
function normaliseFieldErrors(details: unknown): FieldValidationError[] | undefined {
  if (details === undefined || details === null) return undefined;

  if (Array.isArray(details)) {
    return (details as unknown[])
      .map((entry) => coerceFieldError(entry))
      .filter((entry): entry is FieldValidationError => Boolean(entry));
  }

  if (typeof details === 'object') {
    return Object.entries(details as Record<string, unknown>).flatMap(([field, value]) => {
      if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const message = typeof record.message === 'string' ? record.message : String(value);
        return [{ field, message }];
      }
      return [{ field, message: String(value) }];
    });
  }

  return undefined;
}

function coerceFieldError(value: unknown): FieldValidationError | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const field =
    typeof record.field === 'string' ? record.field : (record.path as string | undefined) ?? '_';
  const message =
    typeof record.message === 'string'
      ? record.message
      : typeof record.error === 'string'
        ? record.error
        : JSON.stringify(record);
  return { field, message };
}

/**
 * Express async-route wrapper that forwards a promise rejection into the
 * centralised error middleware (Issue #127).  Co-located with the rest of
 * the RFC 7807 helpers because every async handler that throws ends up in
 * the same envelope.
 */
export const catchAsync = <
  T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
>(
  fn: T,
): ((req: Request, res: Response, next: NextFunction) => void) =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
