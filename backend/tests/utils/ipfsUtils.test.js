const { createIpfsError } = require('../../src/utils/ipfsUtils');
const {
  AuthError,
  ForbiddenError,
  ValidationError,
  PayloadTooLargeError,
  RateLimitError,
  NotFoundError,
  ServiceUnavailableError,
  InternalError,
} = require('../../src/utils/errors');
const {
  mapIpfsError,
  OPERATION_STATUS_MAP,
} = require('../../src/middleware/ipfsAuth');

/**
 * Issue #254 follow-up: data-driven httpStatus classification
 * between {@link createIpfsError} (utils/ipfsUtils.js) and
 * {@link mapIpfsError} (middleware/ipfsAuth.js). These tests pin the
 * behaviour so future refactors cannot silently regress to the
 * message-text heuristic.
 */

describe('createIpfsError — httpStatus parameter', () => {
  it('defaults httpStatus to null when only three arguments are passed (backward compat)', () => {
    const err = createIpfsError('boom', 'upload', { foo: 'bar' });
    expect(err.isIpfsError).toBe(true);
    expect(err.operation).toBe('upload');
    expect(err.details).toEqual({ foo: 'bar' });
    expect(err.httpStatus).toBeNull();
  });

  it('records the explicit httpStatus when the 4th argument is passed', () => {
    const err = createIpfsError('boom', 'auth', undefined, 403);
    expect(err.httpStatus).toBe(403);
    expect(err.operation).toBe('auth');
  });

  it('accepts a numeric httpStatus without polluting details', () => {
    const err = createIpfsError('quota', 'auth', { limit: 5 }, 429);
    expect(err.httpStatus).toBe(429);
    expect(err.details).toEqual({ limit: 5 });
  });
});

describe('mapIpfsError — explicit httpStatus wins over fallback table', () => {
  it('maps 400 → ValidationError', () => {
    const err = createIpfsError('bad input', 'validation', undefined, 400);
    const mapped = mapIpfsError(err);
    expect(mapped).toBeInstanceOf(ValidationError);
    expect(mapped.statusCode).toBe(400);
    expect(mapped.errorCode).toBe('VALIDATION_ERROR');
  });

  it('maps 401 → AuthError', () => {
    const err = createIpfsError('no token', 'auth', undefined, 401);
    const mapped = mapIpfsError(err);
    expect(mapped).toBeInstanceOf(AuthError);
    expect(mapped.statusCode).toBe(401);
    expect(mapped.errorCode).toBe('UNAUTHORIZED');
  });

  it('maps 403 → ForbiddenError (replaces the old regex branch)', () => {
    const err = createIpfsError(
      'Insufficient permissions for this operation',
      'auth',
      { userRole: 'guest' },
      403,
    );
    const mapped = mapIpfsError(err);
    expect(mapped).toBeInstanceOf(ForbiddenError);
    expect(mapped.statusCode).toBe(403);
    expect(mapped.errorCode).toBe('FORBIDDEN');
    // No more regex-of-message: even a 403 whose message does not mention
    // 'permission' or 'insufficient' still routes to ForbiddenError.
    expect(mapped.message).toContain('Insufficient permissions');
  });

  it('maps 404 → NotFoundError', () => {
    const err = createIpfsError('Invalid CID', 'getContent', { cid: 'abc' }, 404);
    const mapped = mapIpfsError(err);
    expect(mapped).toBeInstanceOf(NotFoundError);
    expect(mapped.statusCode).toBe(404);
  });

  it('maps 413 → PayloadTooLargeError (validateFileSize fix)', () => {
    const err = createIpfsError(
      'File size exceeds maximum limit',
      'validation',
      { maxSize: 100, actualSize: 1024 },
      413,
    );
    const mapped = mapIpfsError(err);
    expect(mapped).toBeInstanceOf(PayloadTooLargeError);
    expect(mapped.statusCode).toBe(413);
    expect(mapped.errorCode).toBe('PAYLOAD_TOO_LARGE');
  });

  it('maps 429 → RateLimitError (checkRateLimit fix)', () => {
    const err = createIpfsError(
      'Rate limit exceeded',
      'auth',
      { limit: 5, current: 5 },
      429,
    );
    const mapped = mapIpfsError(err);
    expect(mapped).toBeInstanceOf(RateLimitError);
    expect(mapped.statusCode).toBe(429);
    expect(mapped.errorCode).toBe('RATE_LIMITED');
  });

  it('maps 503 → ServiceUnavailableError', () => {
    const err = createIpfsError('IPFS down', 'init', undefined, 503);
    const mapped = mapIpfsError(err);
    expect(mapped).toBeInstanceOf(ServiceUnavailableError);
    expect(mapped.statusCode).toBe(503);
  });

  it('maps unknown status → InternalError', () => {
    const err = createIpfsError('weird', 'auth', undefined, 418);
    const mapped = mapIpfsError(err);
    expect(mapped).toBeInstanceOf(InternalError);
    expect(mapped.statusCode).toBe(500);
  });

  it('propagates the throw site details onto the AppError', () => {
    const err = createIpfsError(
      'Insufficient permissions for this operation',
      'auth',
      { operation: 'upload', userRole: 'guest' },
      403,
    );
    const mapped = mapIpfsError(err);
    expect(mapped.details).toEqual({ operation: 'upload', userRole: 'guest' });
  });

  it('does NOT inspect error.message for 401 vs 403 classification', () => {
    // A 403 IPFS error whose message contains neither 'insufficient' nor
    // 'permission' must still route to ForbiddenError. This was the bug
    // the regex heuristic caused.
    const err = createIpfsError('Forbidden', 'auth', undefined, 403);
    const mapped = mapIpfsError(err);
    expect(mapped).toBeInstanceOf(ForbiddenError);
  });
});

describe('mapIpfsError — operation fallback when httpStatus is null', () => {
  it.each([
    ['auth', 401, AuthError],
    ['validation', 400, ValidationError],
    ['init', 503, ServiceUnavailableError],
    ['getContent', 404, NotFoundError],
    ['getMetadata', 404, NotFoundError],
    ['upload', 500, InternalError],
    ['pinContent', 500, InternalError],
    ['unpinContent', 500, InternalError],
    ['getNodeInfo', 500, InternalError],
  ])('routes operation=%s to status=%d and %s', (operation, expectedStatus, Cls) => {
    const err = createIpfsError(`op ${operation}`, operation);
    const mapped = mapIpfsError(err);
    expect(mapped).toBeInstanceOf(Cls);
    expect(mapped.statusCode).toBe(expectedStatus);
  });

  it('falls back to 500 / InternalError when both httpStatus and operation are unknown', () => {
    const err = createIpfsError('mystery', 'something-novel');
    const mapped = mapIpfsError(err);
    expect(mapped).toBeInstanceOf(InternalError);
    expect(mapped.statusCode).toBe(500);
  });
});

describe('OPERATION_STATUS_MAP — exposes the routing table', () => {
  it('is frozen and non-empty', () => {
    expect(Object.isFrozen(OPERATION_STATUS_MAP)).toBe(true);
    expect(Object.keys(OPERATION_STATUS_MAP).length).toBeGreaterThan(0);
  });

  it.each(Object.entries(OPERATION_STATUS_MAP))(
    'maps operation %s → %d',
    (op, status) => {
      expect(typeof status).toBe('number');
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(600);
    },
  );
});

describe('mapIpfsError — defensive behaviour for non-IPFS errors', () => {
  it('returns an AuthError for unknown thrown values (preserves prior auth-handler semantics)', () => {
    const mapped = mapIpfsError(new Error('random'));
    expect(mapped).toBeInstanceOf(AuthError);
    expect(mapped.statusCode).toBe(401);
    expect(mapped.message).toBe('Authentication failed');
  });

  it('returns an AuthError for null/undefined input', () => {
    expect(mapIpfsError(null).statusCode).toBe(401);
    expect(mapIpfsError(undefined).statusCode).toBe(401);
  });

  it('does not propagate non-ipfs Error.subtypes', () => {
    const mapped = mapIpfsError({ foo: 'bar', isIpfsError: false });
    expect(mapped).toBeInstanceOf(AuthError);
  });
});
