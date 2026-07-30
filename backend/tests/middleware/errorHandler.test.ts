/**
 * RFC 7807 Problem Details envelope verification — Issue #254.
 *
 * Spins up a tiny Express app wired with the production error middleware,
 * mocks the requestId/log environment, and asserts every documented
 * behavior of the standardized error contract.
 *
 * The suite exercises:
 *   - All RFC 7807 standard fields are emitted
 *   - Content-Type is `application/problem+json`
 *   - Status mirrors the AppError status
 *   - `type` URI matches the catalog
 *   - Validation details flow into the `errors` extension member
 *   - Legacy `body.error.*` mirror keeps existing clients happy
 *   - `headersSent` is respected (no double-write crash)
 *   - Unknown codes fall back to UNKNOWN_ERROR rather than throwing
 *   - `catchAsync` properly forwards rejected promises
 */

import express, { Express } from 'express';
import request from 'supertest';

// Mock logger before importing the middleware so the module picks up the stub.
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { errorHandler, catchAsync } from '../../src/middleware/errorHandler';
import { PROBLEM_JSON_CONTENT_TYPE } from '../../src/utils/problemDetails';
import {
  AppError,
  AuthError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  PayloadTooLargeError,
  RateLimitError,
  ServiceUnavailableError,
  UnsupportedMediaTypeError,
  ValidationError,
} from '../../src/utils/errors';
import { ErrorCatalog, ProblemTypes } from '../../src/utils/problemDetails';

// ─── helpers ─────────────────────────────────────────────────────────────────

const buildApp = (): Express => {
  const app = express();
  app.use(express.json());

  // Routes used across the suite.  Each one throws a specific AppError
  // so a single test can hit a precise status / catalog row.
  app.get('/throw/not-found', (_req, _res, next) => next(new NotFoundError('user missing')));
  app.get('/throw/validation', (_req, _res, next) =>
    next(
      new ValidationError('Validation failed', [
        { field: 'email', message: '"email" must be a valid email' },
        { field: 'password', message: '"password" length must be at least 8' },
      ]),
    ),
  );
  app.get('/throw/auth', (_req, _res, next) => next(new AuthError('token missing')));
  app.get('/throw/forbidden', (_req, _res, next) => next(new ForbiddenError('not allowed')));
  app.get('/throw/conflict', (_req, _res, next) => next(new ConflictError('email already taken')));
  app.get('/throw/rate-limit', (_req, _res, next) => next(new RateLimitError()));
  app.get('/throw/payload', (_req, _res, next) => next(new PayloadTooLargeError()));
  app.get('/throw/media-type', (_req, _res, next) => next(new UnsupportedMediaTypeError()));
  app.get('/throw/unavailable', (_req, _res, next) => next(new ServiceUnavailableError()));
  app.get('/throw/internal', (_req, _res, next) => next(new InternalError('boom')));
  app.get('/throw/raw-error', (_req, _res, next) => {
    try {
      throw new Error('plain Error');
    } catch (e) {
      next(e);
    }
  });
  app.get('/throw/string', (_req, _res, next) => next('a string was thrown'));

  // catchAsync wrapper coverage
  app.get(
    '/async/reject',
    catchAsync(async (_req, _res) => {
      throw new NotFoundError('async not found');
    }),
  );
  app.get(
    '/async/resolve',
    catchAsync(async (_req, res) => {
      res.status(200).json({ ok: true });
    }),
  );

  // headersSent guard — finish the original response then trigger the
  // error path.  The middleware must NOT attempt to write a second
  // response body (which would throw "Cannot set headers after they are
  // sent to the client").
  app.get('/throw/after-write', (_req, res, next) => {
    res.status(202).setHeader('X-Partial', 'true').send('partial body');
    next(new NotFoundError());
  });

  app.use(errorHandler);
  return app;
};

// ─── tests ───────────────────────────────────────────────────────────────────

describe('RFC 7807 Problem Details envelope — middleware/errorHandler', () => {
  const app = buildApp();

  it('emits Content-Type: application/problem+json on every error response', async () => {
    const res = await request(app).get('/throw/not-found');
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
  });

  it('emits all five RFC 7807 standard fields plus AetherMint extensions', async () => {
    const res = await request(app).get('/throw/not-found');
    expect(res.status).toBe(404);

    expect(typeof res.body.type).toBe('string');
    expect(res.body.type).toMatch(/^https:\/\/aethermint\.io\/problems\//);

    expect(typeof res.body.title).toBe('string');
    expect(res.body.title.length).toBeGreaterThan(0);

    expect(res.body.status).toBe(404);

    expect(typeof res.body.detail).toBe('string');

    expect(typeof res.body.instance).toBe('string');
    expect(res.body.instance).toContain('GET');
    expect(res.body.instance).toContain('/throw/not-found');

    // AetherMint extensions
    expect(res.body.code).toBe('NOT_FOUND');
    expect(res.body.success).toBe(false);
    expect(typeof res.body.requestId).toBe('string');
    expect(typeof res.body.timestamp).toBe('string');
    expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('keeps the legacy `error` mirror as a deprecation shim', async () => {
    const res = await request(app).get('/throw/not-found');
    expect(res.body.success).toBe(false); // old shape, still there
    expect(res.body.error).toMatchObject({
      code: 'NOT_FOUND',
      requestId: expect.any(String),
    });
    expect(res.body.error.message).toBe('user missing');
  });

  it('mirrors the catalog row for every documented code', async () => {
    const cases: Array<{ path: string; code: keyof typeof ErrorCatalog; status: number; typeUri: string }> = [
      { path: '/throw/not-found', code: 'NOT_FOUND', status: 404, typeUri: ProblemTypes.NOT_FOUND },
      { path: '/throw/auth', code: 'UNAUTHORIZED', status: 401, typeUri: ProblemTypes.UNAUTHORIZED },
      { path: '/throw/forbidden', code: 'FORBIDDEN', status: 403, typeUri: ProblemTypes.FORBIDDEN },
      { path: '/throw/conflict', code: 'CONFLICT', status: 409, typeUri: ProblemTypes.CONFLICT },
      { path: '/throw/rate-limit', code: 'RATE_LIMITED', status: 429, typeUri: ProblemTypes.RATE_LIMITED },
      { path: '/throw/payload', code: 'PAYLOAD_TOO_LARGE', status: 413, typeUri: ProblemTypes.PAYLOAD_TOO_LARGE },
      {
        path: '/throw/media-type',
        code: 'UNSUPPORTED_MEDIA_TYPE',
        status: 415,
        typeUri: ProblemTypes.UNSUPPORTED_MEDIA_TYPE,
      },
      {
        path: '/throw/unavailable',
        code: 'SERVICE_UNAVAILABLE',
        status: 503,
        typeUri: ProblemTypes.SERVICE_UNAVAILABLE,
      },
      {
        path: '/throw/internal',
        code: 'INTERNAL_ERROR',
        status: 500,
        typeUri: ProblemTypes.INTERNAL_ERROR,
      },
    ];

    for (const tc of cases) {
      const res = await request(app).get(tc.path);
      expect(res.status).toBe(tc.status);
      expect(res.body.type).toBe(tc.typeUri);
      expect(res.body.code).toBe(tc.code);
      expect(res.body.title).toBe(ErrorCatalog[tc.code].title);
    }
  });

  it('preserves validation details in the `errors` extension array', async () => {
    const res = await request(app).get('/throw/validation');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors).toEqual([
      { field: 'email', message: '"email" must be a valid email' },
      { field: 'password', message: '"password" length must be at least 8' },
    ]);
    // Legacy `error.details` mirror still present
    expect(res.body.error.details).toEqual(res.body.errors);
  });

  it('masks the raw error message for non-operational (500-class) errors', async () => {
    const res = await request(app).get('/throw/internal');
    expect(res.status).toBe(500);
    // detail should be the catalog default message, NOT the "boom" string
    expect(res.body.detail).toBe('An unexpected error occurred. Please try again later.');
    expect(res.body.detail).not.toContain('boom');
  });

  it('falls back to UNKNOWN_ERROR when a code is absent from the catalog', async () => {
    class BizarreError extends AppError {
      constructor() {
        super('not in catalog', 418, 'IM_A_TEAPOT_NOT_IN_CATALOG');
      }
    }
    const local = express();
    local.use((_req, _res, next) => next(new BizarreError()));
    local.use(errorHandler);
    const res = await request(local).get('/');
    expect(res.status).toBe(418);
    expect(res.body.code).toBe('IM_A_TEAPOT_NOT_IN_CATALOG');
    expect(res.body.type).toBe(ProblemTypes.UNKNOWN_ERROR);
    expect(res.body.title).toBe('Unknown Error');
  });

  it('coerces non-AppError throwables into a sanitised 500 envelope', async () => {
    const res1 = await request(app).get('/throw/raw-error');
    expect(res1.status).toBe(500);
    expect(res1.body.code).toBe('INTERNAL_ERROR');
    expect(res1.body.detail).toBe('An unexpected error occurred. Please try again later.');

    const res2 = await request(app).get('/throw/string');
    expect(res2.status).toBe(500);
    expect(res2.body.code).toBe('INTERNAL_ERROR');
  });

  it('catchAsync forwards async rejections into the central middleware', async () => {
    const res = await request(app).get('/async/reject');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('catchAsync lets resolved promises pass through normally', async () => {
    const res = await request(app).get('/async/resolve');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('does NOT throw when headers have already been sent', async () => {
    // The handler must short-circuit on headersSent and not attempt a
    // second res.send.  Express completes the original 202 response and
    // the ProblemDetails envelope must NOT be emitted again.
    const res = await request(app).get('/throw/after-write');
    expect(res.status).toBe(202);
    expect(res.headers['x-partial']).toBe('true');
    expect(res.headers['content-type'] || '').not.toMatch(/application\/problem\+json/);
    expect(res.text).toBe('partial body');
  });

  it('emits `instance` as "<METHOD> <path>"', async () => {
    const res = await request(app).get('/throw/internal');
    expect(res.body.instance).toBe('GET /throw/internal');
  });

  it('uses `application/problem+json` const value', () => {
    expect(PROBLEM_JSON_CONTENT_TYPE).toBe('application/problem+json');
  });
});
