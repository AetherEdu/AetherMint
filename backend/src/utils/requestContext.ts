/**
 * Shared request-scoped context.
 *
 * Holds the AsyncLocalStorage store used to propagate a request's correlation ID
 * (and basic request metadata) across async boundaries. It lives in its own module
 * so both the logger and the requestId middleware share a single ALS instance
 * rather than each owning one.
 */

import { AsyncLocalStorage } from 'async_hooks';

export type RequestContext = Record<string, unknown> & {
  requestId?: string;
};

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/** Runs `callback` with `context` available to every async operation it spawns. */
export const runWithRequestContext = <T>(context: RequestContext, callback: () => T): T =>
  requestContextStorage.run(context, callback);

/** Returns the active request context, or undefined when outside a request. */
export const getRequestContext = (): RequestContext | undefined => requestContextStorage.getStore();
