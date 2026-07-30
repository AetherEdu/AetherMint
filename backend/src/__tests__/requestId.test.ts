import { describe, it, expect } from '@jest/globals';
import express, { type Request, type Response } from 'express';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import requestId, { REQUEST_ID_HEADER } from '../middleware/requestId';
import { getRequestContext } from '../utils/requestContext';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const buildApp = () => {
  const app = express();
  app.use(requestId);
  app.get('/ping', (req, res) => {
    res.json({
      reqId: req.requestId,
      contextId: getRequestContext()?.requestId,
    });
  });
  return app;
};

describe('requestId middleware', () => {
  it('generates a UUID v4 when no X-Request-ID header is supplied', async () => {
    const res = await request(buildApp()).get('/ping');

    const header = res.headers[REQUEST_ID_HEADER];
    expect(header).toMatch(UUID_V4);
    expect(res.body.reqId).toBe(header);
  });

  it('reuses a valid UUID v4 supplied by the caller', async () => {
    const provided = uuidv4();

    const res = await request(buildApp()).get('/ping').set(REQUEST_ID_HEADER, provided);

    expect(res.headers[REQUEST_ID_HEADER]).toBe(provided);
    expect(res.body.reqId).toBe(provided);
  });

  it('discards an untrusted, non-UUID X-Request-ID and generates a fresh one', async () => {
    const res = await request(buildApp()).get('/ping').set(REQUEST_ID_HEADER, 'abc123');

    expect(res.headers[REQUEST_ID_HEADER]).not.toBe('abc123');
    expect(res.headers[REQUEST_ID_HEADER]).toMatch(UUID_V4);
  });

  it('exposes the ID via AsyncLocalStorage for downstream async code', async () => {
    const res = await request(buildApp()).get('/ping');

    expect(res.body.contextId).toBe(res.headers[REQUEST_ID_HEADER]);
  });

  it('adds well under 1ms of overhead per request', () => {
    const iterations = 2000;
    const res = { setHeader: () => undefined } as unknown as Response;
    const makeReq = () =>
      ({
        header: () => undefined,
        method: 'GET',
        originalUrl: '/bench',
        url: '/bench',
        path: '/bench',
        ip: '127.0.0.1',
      } as unknown as Request);

    const start = process.hrtime.bigint();
    for (let i = 0; i < iterations; i += 1) {
      requestId(makeReq(), res, () => undefined);
    }
    const perCallMs = Number(process.hrtime.bigint() - start) / 1e6 / iterations;

    expect(perCallMs).toBeLessThan(1);
  });
});
