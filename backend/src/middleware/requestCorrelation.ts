/**
 * Cross-service correlation ID propagation — Issue #256.
 *
 * The {@link requestId} middleware assigns every inbound HTTP request a
 * UUID v4 correlation ID, stores it in `req.requestId`, and seeds the
 * AsyncLocalStorage context so every log line emitted while the request
 * runs carries the same id.  This module closes the last gap: when the
 * backend calls *out* to downstream services (Stellar Horizon, IPFS,
 * federated learning peers, federated identity, …) we want the same
 * correlation ID to flow through the call chain so a single trace id
 * ties together an end-to-end user journey.
 *
 * Two integration points are exposed:
 *
 *   1. {@link installHttpClientCorrelationInterceptor} — patches a global
 *      axios instance (or any object exposing `interceptors`) so every
 *      outgoing request automatically carries an `X-Request-ID` header.
 *      The id is sourced from the AsyncLocalStorage context when one is
 *      active (during a request handler) and from a freshly generated
 *      UUID v4 otherwise (background workers, scripts, jobs).
 *
 *   2. {@link currentRequestId} and {@link propagationHeaders} — small
 *      utilities for hand-rolled HTTP clients (`fetch`, `@stellar/*`,
 *      `WebSocket.send`, gRPC metadata, …) that don't go through axios.
 *
 * Both integration points share the same header constant
 * (`X-Request-ID`) as the inbound middleware, so a downstream service
 * receiving the propagated header either accepts it (when it's a valid
 * UUID v4) or replaces it with its own id (per the existing
 * {@link requestId} rule).
 *
 * @see requestId
 */

import type { Request } from 'express';
import { v4 as uuidv4, validate as isUuid, version as uuidVersion } from 'uuid';
import { getRequestContext } from '../utils/requestContext';

export const CORRELATION_ID_HEADER = 'x-request-id';

/** Symbol used to install/uninstall the correlation id interceptor. */
export const CORRELATION_INTERCEPTOR_TAG = 'aethermint-correlation-id';

/**
 * Read the active request id from the AsyncLocalStorage context, falling
 * back to `undefined`.  Background jobs and service workers have no
 * active request, so callers should generate a fresh UUID v4 when this
 * returns `undefined`.
 */
export const currentRequestId = (): string | undefined => {
  const ctx = getRequestContext();
  const id = ctx?.requestId;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
};

/**
 * Returns a `Record<string,string>` containing the X-Request-ID header
 * when a correlation id is known.  When the caller is not inside a
 * tracked request, a freshly generated UUID v4 is supplied so background
 * workers still emit one traceable id per outbound job.
 */
export const propagationHeaders = (): Record<string, string> => {
  const id = currentRequestId() ?? uuidv4();
  return { [CORRELATION_ID_HEADER]: id };
};

/**
 * Validate (and normalise) an incoming X-Request-ID header — same logic
 * as the inbound {@link requestId} middleware, exported here so that
 * utility code that needs to pick an id from a request shares the
 * validation rules with the middleware.
 *
 * Returns the supplied id verbatim when it is a valid UUID v4, and a
 * fresh UUID v4 otherwise.  Anything that is not a UUID v4 is never
 * reflected downstream so untrusted input cannot pollute logs.
 */
export const resolveOutboundRequestId = (incoming: string | undefined): string => {
  if (typeof incoming === 'string' && isUuid(incoming) && uuidVersion(incoming) === 4) {
    return incoming;
  }
  return uuidv4();
};

/**
 * Axios interceptor-compatible "request fulfilled" hook that stamps the
 * active correlation id onto an outgoing request.
 *
 * Exposed as a constant so external axios instances can attach it
 * directly without re-importing this module:
 *
 *   axiosInstance.interceptors.request.use(correlationIdInjector);
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const correlationIdInjector = (config: any): any => {
  const id = currentRequestId() ?? uuidv4();

  const headers = config?.headers ?? {};
  // Preserve an explicit caller-provided UUID v4; replace anything else
  // so we never reflect untrusted input.
  const existing = (headers[CORRELATION_ID_HEADER] ?? headers['X-Request-ID']) as unknown;
  let chosen = id;
  if (typeof existing === 'string' && isUuid(existing) && uuidVersion(existing) === 4) {
    chosen = existing;
  }

  if (headers && typeof headers.set === 'function') {
    headers.set(CORRELATION_ID_HEADER, chosen);
  } else if (headers && typeof headers === 'object') {
    headers[CORRELATION_ID_HEADER] = chosen;
  }

  return config;
};

/**
 * Patch a global axios (or any `.interceptors.request`-bearing object)
 * with our correlation id interceptor.  Returns the ejector so tests
 * can clean up.
 */
export const installHttpClientCorrelationInterceptor = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
): (() => void) => {
  const id = client.interceptors.request.use(correlationIdInjector);
  return () => client.interceptors.request.eject(id);
};

/**
 * Express middleware convenience helper.
 *
 * Returns the existing `req.requestId` when it is a UUID v4, or
 * `undefined` otherwise.  Unlike {@link resolveCorrelationId} this
 * helper does NOT generate a fresh UUID — call sites that want a
 * guaranteed non-empty id should wrap this with
 * `resolveCorrelationId` instead.
 */
export const requestIdFromRequest = (req: Request): string | undefined => {
  const candidate = req?.requestId;
  if (typeof candidate === 'string' && isUuid(candidate) && uuidVersion(candidate) === 4) {
    return candidate;
  }
  return undefined;
};

/**
 * Default-ready helper.  Returns the correlation id in priority order:
 *   1. `req.requestId` when it is a valid UUID v4
 *   2. The AsyncLocalStorage context's `requestId` (set by the inbound
 *      {@link requestId} middleware)
 *   3. A freshly generated UUID v4
 */
export const resolveCorrelationId = (req?: Request): string => {
  const fromReq = requestIdFromRequest(req as Request);
  if (fromReq) {
    return fromReq;
  }
  const ctxId = currentRequestId();
  if (ctxId) {
    return ctxId;
  }
  return uuidv4();
};
