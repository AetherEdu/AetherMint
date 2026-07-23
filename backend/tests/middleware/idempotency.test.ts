/**
 * Standalone smoke test for the Idempotency Middleware (#264).
 *
 * Runs against a minimal express app without loading the global
 * `setup.js` (which transitively imports broken pre-existing TS files).
 * This file is meant to be exercised with `jest.isolated.config.js`.
 */

import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import {
  idempotencyMiddleware,
  __resetIdempotencyFallbackForTests,
} from '../../src/middleware/idempotency';

jest.mock('../../src/utils/redis', () => ({
  connectRedis: jest.fn(() => Promise.resolve(null)),
}));

function buildTestApp(opts: {
  processingDelayMs?: number;
  userId?: string;
  counter?: { value: number };
} = {}) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = { id: opts.userId ?? 'user-1' };
    next();
  });

  app.post(
    '/payments/intent',
    idempotencyMiddleware(),
    async (req: Request, res: Response) => {
      if (opts.counter) opts.counter.value += 1;
      if ((opts.processingDelayMs ?? 0) > 0) {
        await new Promise((r) => setTimeout(r, opts.processingDelayMs));
      }
      res.status(201).json({
        success: true,
        amount: req.body?.amount ?? 0,
        requestId: req.header('Idempotency-Key') ?? null,
      });
    }
  );

  app.post('/payments/failure', idempotencyMiddleware(), (_req, res) => {
    res.status(500).json({ success: false, message: 'boom' });
  });

  return app;
}

describe('Idempotency Middleware', () => {
  beforeEach(() => {
    __resetIdempotencyFallbackForTests();
  });

  it('passes through when no Idempotency-Key is present', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/payments/intent')
      .send({ amount: 100 });
    expect(res.status).toBe(201);
    expect(res.headers['idempotency-replayed']).toBeUndefined();
  });

  it('rejects invalid key format with 400', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/payments/intent')
      .set('Idempotency-Key', 'short')
      .send({ amount: 100 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('replays cached response on duplicate key', async () => {
    const app = buildTestApp();
    const key = 'order-test-1234567890';
    const a = await request(app)
      .post('/payments/intent')
      .set('Idempotency-Key', key)
      .send({ amount: 100 });
    const b = await request(app)
      .post('/payments/intent')
      .set('Idempotency-Key', key)
      .send({ amount: 100 });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.headers['idempotency-replayed']).toBe('true');
    expect(a.body).toEqual(b.body);
  });

  it('returns 409 when a duplicate request is concurrently in-flight', async () => {
    const counter = { value: 0 };
    const app = buildTestApp({
      processingDelayMs: 80,
      counter,
    });
    const key = 'concurrent-test-1234567890';

    const [a, b] = await Promise.all([
      request(app)
        .post('/payments/intent')
        .set('Idempotency-Key', key)
        .send({ amount: 250 }),
      request(app)
        .post('/payments/intent')
        .set('Idempotency-Key', key)
        .send({ amount: 250 }),
    ]);

    expect(counter.value).toBe(1);
    const statuses = [a.status, b.status].sort();
    expect(statuses[0]).toBe(201);
    expect([201, 409]).toContain(statuses[1]);

    const c = await request(app)
      .post('/payments/intent')
      .set('Idempotency-Key', key)
      .send({ amount: 250 });
    expect(c.status).toBe(201);
    expect(c.headers['idempotency-replayed']).toBe('true');
    expect(counter.value).toBe(1);
  });

  it('does not cache 5xx so retries are safe', async () => {
    const app = buildTestApp();
    const key = 'failure-key-1234567890abcdef';
    const a = await request(app)
      .post('/payments/failure')
      .set('Idempotency-Key', key)
      .send({ amount: 1 });
    expect(a.status).toBe(500);

    const b = await request(app)
      .post('/payments/failure')
      .set('Idempotency-Key', key)
      .send({ amount: 1 });
    expect(b.status).toBe(500);
    expect(b.headers['idempotency-replayed']).toBe('false');
  });

  it('isolates the key per user', async () => {
    const appA = buildTestApp({ userId: 'user-A-id-xxxxxxxxxxxxxxx' });
    const appB = buildTestApp({ userId: 'user-B-id-xxxxxxxxxxxxxxx' });
    __resetIdempotencyFallbackForTests();
    const key = 'shared-id-1234567890abcdef';

    const a = await request(appA)
      .post('/payments/intent')
      .set('Idempotency-Key', key)
      .send({ amount: 100 });
    expect(a.status).toBe(201);
    expect(a.headers['idempotency-replayed']).toBe('false');

    const b = await request(appB)
      .post('/payments/intent')
      .set('Idempotency-Key', key)
      .send({ amount: 200 });
    expect(b.status).toBe(201);
    expect(b.headers['idempotency-replayed']).toBe('false');
    expect(b.body.amount).toBe(200);
  });
});
