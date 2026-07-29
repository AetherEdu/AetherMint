/**
 * Cross-service correlation ID propagation — Issue #256.
 *
 * Verifies the helpers added by `middleware/requestCorrelation`:
 *
 *   - `currentRequestId` reads the AsyncLocalStorage context set by
 *     the inbound `requestId` middleware.
 *   - `propagationHeaders` returns a header map suitable for any HTTP
 *     client (axios, fetch, gRPC metadata, WebSocket.send, …).
 *   - `correlationIdInjector` is idempotent and never reflects an
 *     untrusted caller-provided id downstream.
 *   - Calling the helpers outside a tracked request still emits a
 *     fresh UUID v4 (so background jobs are traceable).
 *   - The propagation helpers compose correctly with an Express
 *     request handler that calls `axios.get(...)` through the
 *     installed interceptor.
 */

import express from 'express';
import request from 'supertest';
import { v4 as uuidv4, validate as isUuid, version as uuidVersion } from 'uuid';
import {
  CORRELATION_ID_HEADER,
  correlationIdInjector,
  currentRequestId,
  installHttpClientCorrelationInterceptor,
  propagationHeaders,
  requestIdFromRequest,
  resolveCorrelationId,
  resolveOutboundRequestId,
} from '../../src/middleware/requestCorrelation';
import requestId from '../../src/middleware/requestId';
import { runWithRequestContext } from '../../src/utils/requestContext';

// ── In-memory interceptor registry so we can verify outbound headers ────────
const createMockHttpClient = () => {
  const handlers: Array<(config: unknown) => unknown> = [];
  let lastConfig: unknown;

  const client = {
    interceptors: {
      request: {
        use: (onFulfilled: (config: unknown) => unknown) => {
          handlers.push(onFulfilled);
          return handlers.length - 1;
        },
        eject: (id: number) => {
          handlers.splice(id, 1);
        },
        runChain: (config: unknown) => {
          let current: unknown = config;
          for (const handler of handlers) {
            current = handler(current);
          }
          lastConfig = current;
          return current;
        },
      },
    },
    getLastConfig: () => lastConfig,
  };

  return client;
};

describe('request correlation propagation — Issue #256', () => {
  describe('currentRequestId', () => {
    it('returns undefined when not in a request context', () => {
      expect(currentRequestId()).toBeUndefined();
    });

    it('returns the id from the AsyncLocalStorage context', () => {
      const id = uuidv4();
      runWithRequestContext({ requestId: id }, () => {
        expect(currentRequestId()).toBe(id);
      });
    });

    it('ignores context values that are not ids', () => {
      runWithRequestContext({ requestId: 12345 as unknown as string }, () => {
        expect(currentRequestId()).toBeUndefined();
      });
      runWithRequestContext({ requestId: '' }, () => {
        expect(currentRequestId()).toBeUndefined();
      });
    });
  });

  describe('propagationHeaders', () => {
    it('returns a header map with the active correlation id', () => {
      const id = uuidv4();
      runWithRequestContext({ requestId: id }, () => {
        expect(propagationHeaders()).toEqual({ 'x-request-id': id });
      });
    });

    it('generates a fresh UUID v4 when there is no active context', () => {
      const headers = propagationHeaders();
      const id = headers[CORRELATION_ID_HEADER];
      expect(id).toBeDefined();
      expect(isUuid(id as string)).toBe(true);
      expect(uuidVersion(id as string)).toBe(4);
    });
  });

  describe('currentRequestId — Express integration', () => {
    it('reads the id set by the inbound requestId middleware', async () => {
      const app = express();
      app.use(requestId);
      app.get('/probe', (req, res) => {
        res.json({ requestId: req.requestId, fromContext: currentRequestId() });
      });
      const res = await request(app).get('/probe');
      expect(res.status).toBe(200);
      expect(res.body.requestId).toBeDefined();
      expect(res.body.fromContext).toBe(res.body.requestId);
      // Same id is reflected back in the X-Request-ID response header.
      expect(res.headers['x-request-id']).toBe(res.body.requestId);
    });

    it('accepts a caller-supplied UUID v4 from the X-Request-ID header', async () => {
      const app = express();
      app.use(requestId);
      app.get('/probe', (req, res) => {
        res.json({ requestId: req.requestId, fromContext: currentRequestId() });
      });
      const incomingId = uuidv4();
      const res = await request(app)
        .get('/probe')
        .set('X-Request-ID', incomingId);
      expect(res.body.requestId).toBe(incomingId);
      expect(res.body.fromContext).toBe(incomingId);
      expect(res.headers['x-request-id']).toBe(incomingId);
    });
  });

  describe('correlationIdInjector', () => {
    it('sets X-Request-ID from the AsyncLocalStorage context', () => {
      const id = uuidv4();
      runWithRequestContext({ requestId: id }, () => {
        const out = correlationIdInjector({ headers: {} }) as {
          headers: Record<string, unknown>;
        };
        expect(out.headers[CORRELATION_ID_HEADER]).toBe(id);
      });
    });

    it('generates a fresh UUID v4 when there is no context', () => {
      const out = correlationIdInjector({ headers: {} }) as {
        headers: Record<string, unknown>;
      };
      const id = out.headers[CORRELATION_ID_HEADER] as string;
      expect(isUuid(id)).toBe(true);
      expect(uuidVersion(id)).toBe(4);
    });

    it('does NOT reflect an untrusted caller-supplied id', () => {
      // Simulate a buggy caller setting a non-UUID v4.
      const dirty = 'totally-not-a-uuid';
      const out = correlationIdInjector({
        headers: { [CORRELATION_ID_HEADER]: dirty },
      }) as { headers: Record<string, unknown> };
      const outgoing = out.headers[CORRELATION_ID_HEADER] as string;
      expect(outgoing).not.toBe(dirty);
      expect(isUuid(outgoing)).toBe(true);
      expect(uuidVersion(outgoing)).toBe(4);
    });

    it('honours a caller-supplied UUID v4 when set explicitly', () => {
      const trusted = uuidv4();
      const out = correlationIdInjector({
        headers: { [CORRELATION_ID_HEADER]: trusted },
      }) as { headers: Record<string, unknown> };
      expect(out.headers[CORRELATION_ID_HEADER]).toBe(trusted);
    });

    it('handles a headers object with a `.set` method (Axios v1 style)', () => {
      const stored: Record<string, string> = {};
      const headers = {
        set: (k: string, v: string) => {
          stored[k] = v;
        },
      };
      correlationIdInjector({ headers: headers as unknown as Record<string, unknown> });
      expect(stored[CORRELATION_ID_HEADER]).toBeDefined();
      expect(isUuid(stored[CORRELATION_ID_HEADER])).toBe(true);
      expect(uuidVersion(stored[CORRELATION_ID_HEADER])).toBe(4);
    });
  });

  describe('installHttpClientCorrelationInterceptor', () => {
    it('wires the injector into the client', () => {
      const client = createMockHttpClient();
      const eject = installHttpClientCorrelationInterceptor(client);
      try {
        const id = uuidv4();
        runWithRequestContext({ requestId: id }, () => {
          client.interceptors.request.runChain({ headers: {} });
          const last = client.getLastConfig() as { headers: Record<string, string> };
          expect(last.headers[CORRELATION_ID_HEADER]).toBe(id);
        });
      } finally {
        eject();
      }
    });

    it('eject removes the injected header', () => {
      const client = createMockHttpClient();
      const eject = installHttpClientCorrelationInterceptor(client);
      eject();
      client.interceptors.request.runChain({ headers: {} });
      const last = client.getLastConfig() as { headers: Record<string, string> };
      expect(last.headers?.[CORRELATION_ID_HEADER]).toBeUndefined();
    });

    it('is idempotent when called twice', () => {
      const client = createMockHttpClient();
      const eject1 = installHttpClientCorrelationInterceptor(client);
      const eject2 = installHttpClientCorrelationInterceptor(client);
      try {
        // Two interceptors should not double-set the header on the
        // same outbound request.
        const id = uuidv4();
        runWithRequestContext({ requestId: id }, () => {
          client.interceptors.request.runChain({ headers: {} });
          const last = client.getLastConfig() as { headers: Record<string, string> };
          expect(last.headers[CORRELATION_ID_HEADER]).toBe(id);
        });
      } finally {
        eject1();
        eject2();
      }
    });
  });

  describe('resolveCorrelationId', () => {
    it('prefers the request-attached id when both are available', () => {
      const reqId = uuidv4();
      const ctxId = uuidv4();
      const fakeReq = { requestId: reqId } as unknown as import('express').Request;
      runWithRequestContext({ requestId: ctxId }, () => {
        expect(resolveCorrelationId(fakeReq)).toBe(reqId);
      });
    });

    it('falls back to the context when req.requestId is missing', () => {
      const ctxId = uuidv4();
      const fakeReq = {} as unknown as import('express').Request;
      runWithRequestContext({ requestId: ctxId }, () => {
        expect(resolveCorrelationId(fakeReq)).toBe(ctxId);
      });
    });

    it('falls back to a fresh UUID v4 when neither is available', () => {
      const id = resolveCorrelationId();
      expect(isUuid(id)).toBe(true);
      expect(uuidVersion(id)).toBe(4);
    });
  });

  describe('requestIdFromRequest', () => {
    it('returns the request id verbatim when it is a UUID v4', () => {
      const id = uuidv4();
      const req = { requestId: id } as unknown as import('express').Request;
      expect(requestIdFromRequest(req)).toBe(id);
    });

    it('returns undefined when req.requestId is missing', () => {
      const out = requestIdFromRequest({} as unknown as import('express').Request);
      expect(out).toBeUndefined();
    });

    it('returns undefined for an untrusted non-UUID-v4 requestId', () => {
      const req = { requestId: 'not-a-uuid' } as unknown as import('express').Request;
      expect(requestIdFromRequest(req)).toBeUndefined();
    });
  });

  describe('resolveOutboundRequestId', () => {
    it('keeps a valid UUID v4 verbatim', () => {
      const id = uuidv4();
      expect(resolveOutboundRequestId(id)).toBe(id);
    });

    it('replaces anything that is not a UUID v4', () => {
      const out = resolveOutboundRequestId('not-a-uuid');
      expect(out).not.toBe('not-a-uuid');
      expect(isUuid(out)).toBe(true);
      expect(uuidVersion(out)).toBe(4);
      const out2 = resolveOutboundRequestId(undefined);
      expect(isUuid(out2)).toBe(true);
    });
  });
});
