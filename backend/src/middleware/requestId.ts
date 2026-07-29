/**
 * Request ID middleware.
 *
 * Assigns every request a correlation ID and makes it available everywhere:
 *   - accepts a caller supplied `X-Request-ID` only when it is a valid UUID v4,
 *     otherwise generates a fresh one so untrusted input is never reflected,
 *   - attaches the ID to `req.requestId` for synchronous downstream access,
 *   - echoes the ID back in the `X-Request-ID` response header,
 *   - seeds the AsyncLocalStorage request context (see {@link runWithRequestContext})
 *     so the ID and basic request metadata propagate across async boundaries and
 *     appear in every log line emitted while the request is handled.
 *
 * Must be registered before {@link requestLogger} and the route handlers.
 */

import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4, validate as isUuid, version as uuidVersion } from 'uuid';
import { runWithRequestContext } from '../utils/requestContext';

export const REQUEST_ID_HEADER = 'x-request-id';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Correlation ID assigned by the requestId middleware. */
      requestId?: string;
    }
  }
}

/**
 * Resolves the correlation ID for a request. A caller supplied value is trusted
 * only when it is a syntactically valid UUID v4; anything missing, malformed, or
 * otherwise untrusted is replaced with a freshly generated UUID v4 so that an
 * arbitrary client header is never reflected into logs or response headers.
 */
const resolveRequestId = (headerValue: string | undefined): string =>
  typeof headerValue === 'string' && isUuid(headerValue) && uuidVersion(headerValue) === 4
    ? headerValue
    : uuidv4();

export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const id = resolveRequestId(req.header(REQUEST_ID_HEADER));

  req.requestId = id;
  res.setHeader(REQUEST_ID_HEADER, id);

  runWithRequestContext(
    {
      requestId: id,
      method: req.method,
      path: req.originalUrl || req.url || req.path,
      ip: req.ip,
    },
    () => next(),
  );
};

export default requestId;
