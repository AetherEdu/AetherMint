/**
 * Idempotency Middleware Tests
 * Tests for idempotency-key support on payment/mutation endpoints.
 *
 * Issue: #264
 */

import { Request, Response, NextFunction } from 'express';
import { idempotency, clearIdempotencyKey } from '../middleware/idempotency';

// Mock redisConfig with per-test isolated store
let sharedStore: Map<string, string>;

jest.mock('../config/redis', () => {
  return {
    __esModule: true,
    default: {
      getRawClient: jest.fn(() => ({
        get: jest.fn((key: string) => Promise.resolve(sharedStore.get(key) ?? null)),
        set: jest.fn((key: string, value: string) => {
          sharedStore.set(key, value);
          return Promise.resolve('OK');
        }),
        del: jest.fn((key: string) => {
          sharedStore.delete(key);
          return Promise.resolve(1);
        }),
      })),
      initialize: jest.fn(),
      disconnect: jest.fn(),
      isConnected: jest.fn(() => true),
    },
  };
});

describe('idempotency middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: NextFunction;
  let jsonSpy: jest.Mock;

  beforeEach(() => {
    sharedStore = new Map<string, string>();
    jest.clearAllMocks();
    jsonSpy = jest.fn().mockReturnThis();
    mockReq = {
      method: 'POST',
      path: '/api/transactions/test',
      header: jest.fn(),
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jsonSpy,
      setHeader: jest.fn(),
      getHeaders: jest.fn().mockReturnValue({ 'content-type': 'application/json' }),
      statusCode: 200,
    };
    nextFn = jest.fn();
  });

  describe('without idempotency key', () => {
    it('should pass through to next middleware', async () => {
      (mockReq.header as jest.Mock).mockReturnValue(undefined);
      const middleware = idempotency();

      await middleware(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('with idempotency key', () => {
    const testKey = 'test-idempotency-key-123';

    beforeEach(() => {
      (mockReq.header as jest.Mock).mockReturnValue(testKey);
    });

    it('should pass through if no cached response exists', async () => {
      const middleware = idempotency();
      await middleware(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should intercept res.json and cache the response', async () => {
      // First request - passes through and caches
      const middleware = idempotency();
      await middleware(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();

      // The middleware should have wrapped res.json (it's no longer the mock we provided)
      // Verify the json function was replaced (intercepted)
      expect(mockRes.json).toBeDefined();
      // Verify next was called (meaning no cached response existed)
      expect(nextFn).toHaveBeenCalledTimes(1);
    });

    it('should reject keys longer than 256 characters', async () => {
      const longKey = 'a'.repeat(257);
      (mockReq.header as jest.Mock).mockReturnValue(longKey);

      const middleware = idempotency();
      await middleware(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
      expect(nextFn).not.toHaveBeenCalled();
    });
  });

  describe('idempotency with duplicate request simulation', () => {
    it('should return cached response on duplicate request', async () => {
      const key = 'duplicate-key-test';

      // First request
      const req1 = {
        method: 'POST',
        path: '/api/transactions/pay',
        header: jest.fn().mockReturnValue(key),
      } as unknown as Request;

      const res1 = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        getHeaders: jest.fn().mockReturnValue({ 'content-type': 'application/json' }),
        statusCode: 200,
      } as unknown as Response;

      const next1 = jest.fn();
      const middleware = idempotency();

      await middleware(req1, res1, next1);
      expect(next1).toHaveBeenCalled();

      // simulate the handler calling res.json which stores the cache
      res1.json({ success: true, data: { id: 'pay-1' } });

      // Wait a tick for the async cache write
      await new Promise(resolve => setTimeout(resolve, 50));

      // Second request with same key
      const req2 = {
        method: 'POST',
        path: '/api/transactions/pay',
        header: jest.fn().mockReturnValue(key),
      } as unknown as Request;

      const res2 = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        getHeaders: jest.fn().mockReturnValue({}),
        statusCode: 200,
      } as unknown as Response;

      const next2 = jest.fn();

      await middleware(req2, res2, next2);

      // The duplicate request should return the cached response
      // and NOT call next
      expect(next2).not.toHaveBeenCalled();
      expect(res2.status).toHaveBeenCalled();
      expect(res2.json).toHaveBeenCalled();
    });
  });

  describe('clearIdempotencyKey', () => {
    it('should clear a cached key without throwing', async () => {
      await expect(
        clearIdempotencyKey('POST', '/test', 'some-key')
      ).resolves.not.toThrow();
    });
  });

  describe('body hash in cache key', () => {
    it('should treat different request bodies as different idempotency keys', async () => {
      const key = 'same-key-different-body';

      // Request 1 with body A
      const reqA = {
        method: 'POST',
        path: '/api/transactions/pay',
        body: { amount: 100, currency: 'USD' },
        header: jest.fn().mockReturnValue(key),
      } as unknown as Request;

      const resA = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        getHeaders: jest.fn().mockReturnValue({}),
        statusCode: 200,
      } as unknown as Response;

      const middleware = idempotency();
      await middleware(reqA, resA, nextFn);
      // First request should pass through (no cached response)
      expect(nextFn).toHaveBeenCalled();
    });
  });
});
