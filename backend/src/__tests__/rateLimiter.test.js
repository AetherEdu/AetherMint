jest.mock('../utils/redis', () => ({
  incrementRateLimitCounter: jest.fn(),
  decrementRateLimitCounter: jest.fn(),
  resetRateLimitCounter: jest.fn(),
}));

jest.mock('../services/securityService', () => ({
  logSecurityEvent: jest.fn().mockResolvedValue(undefined),
}));

const {
  incrementRateLimitCounter,
} = require('../utils/redis');
const {
  createRateLimiter,
  tieredRateLimiter,
} = require('../middleware/rateLimiter');

const createResponse = () => {
  const headers = {};
  return {
    headers,
    statusCode: 200,
    body: undefined,
    setHeader: jest.fn((name, value) => {
      headers[name] = value;
    }),
    status: jest.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function json(body) {
      this.body = body;
      return this;
    }),
  };
};

const request = (overrides = {}) => ({
  ip: '127.0.0.1',
  socket: {},
  method: 'GET',
  path: '/resource',
  originalUrl: '/api/resource',
  baseUrl: '/api',
  headers: { 'x-test-security': 'true' },
  ...overrides,
});

describe('tiered Redis rate limiter', () => {
  beforeEach(() => {
    incrementRateLimitCounter.mockReset();
  });

  it('returns the standard rate limit headers for allowed requests', async () => {
    const resetTime = new Date(Date.now() + 60_000);
    incrementRateLimitCounter
      .mockResolvedValueOnce({ totalHits: 1, resetTime })
      .mockResolvedValueOnce({ totalHits: 1, resetTime });

    const limiter = createRateLimiter({
      name: 'test',
      scope: 'ip',
      windowMs: 60_000,
      max: 10,
      burstWindowMs: 10_000,
      burstMax: 5,
    });
    const req = request();
    const res = createResponse();
    const next = jest.fn();

    await limiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.headers['X-RateLimit-Limit']).toBe('10');
    expect(res.headers['X-RateLimit-Remaining']).toBe('9');
    expect(res.headers['X-RateLimit-Reset']).toMatch(/^\d+$/);
  });

  it('returns 429 and Retry-After when the burst allowance is exhausted', async () => {
    const resetTime = new Date(Date.now() + 10_000);
    incrementRateLimitCounter
      .mockResolvedValueOnce({ totalHits: 2, resetTime })
      .mockResolvedValueOnce({ totalHits: 6, resetTime });

    const limiter = createRateLimiter({
      name: 'test',
      scope: 'ip',
      windowMs: 60_000,
      max: 10,
      burstWindowMs: 10_000,
      burstMax: 5,
      message: 'Slow down.',
    });
    const req = request();
    const res = createResponse();
    const next = jest.fn();

    await limiter(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toMatch(/^\d+$/);
    expect(res.body).toEqual(expect.objectContaining({
      error: 'Rate limit exceeded',
      message: 'Slow down.',
    }));
  });

  it('applies global and authenticated-user strategies together', async () => {
    const resetTime = new Date(Date.now() + 60_000);
    incrementRateLimitCounter.mockResolvedValue({ totalHits: 1, resetTime });

    const req = request({
      user: { id: 'user-126', role: 'student' },
    });
    const res = createResponse();
    const next = jest.fn();

    await tieredRateLimiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(incrementRateLimitCounter).toHaveBeenCalledTimes(4);
    const keys = incrementRateLimitCounter.mock.calls.map(([key]) => key);
    expect(keys.some((key) => key.includes('global'))).toBe(true);
    expect(keys.some((key) => key.includes('authenticated'))).toBe(true);
  });
});
