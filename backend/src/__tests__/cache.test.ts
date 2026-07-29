// Isolate test from index.ts compilation errors
jest.mock('../utils/migrate', () => ({
  Migrator: jest.fn(),
}));

import * as cache from '../utils/cache';
import { CacheKeys, CacheTTL } from '../utils/cache';

// Mock redis config
jest.mock('../config/redis');
jest.mock('../utils/logger', () => {
  const mock = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  return { default: mock, ...mock };
});

import * as cache from '../utils/cache';
import { CacheKeys, CacheTTL } from '../utils/cache';
import redisConfig from '../config/redis';

const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
};

beforeAll(() => {
  (redisConfig.getRawClient as jest.Mock).mockReturnValue(mockRedisClient);
});

describe('Cache Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get()', () => {
    it('returns parsed value on cache hit', async () => {
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ id: '1', name: 'Test' }));

      const result = await cache.get<{ id: string; name: string }>('test:key');

      expect(result).toEqual({ id: '1', name: 'Test' });
      expect(mockRedisClient.get).toHaveBeenCalledWith('test:key');
    });

    it('returns null on cache miss', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await cache.get('test:missing');

      expect(result).toBeNull();
    });

    it('returns null when bypass is true', async () => {
      const result = await cache.get('test:key', true);

      expect(result).toBeNull();
      expect(mockRedisClient.get).not.toHaveBeenCalled();
    });

    it('returns null when redis is unavailable', async () => {
      jest.spyOn(require('../config/redis').default, 'getRawClient').mockReturnValueOnce(null);

      const result = await cache.get('test:key');
      expect(result).toBeNull();
    });

    it('returns null on redis error', async () => {
      mockRedisClient.get.mockRejectedValueOnce(new Error('Connection error'));

      const result = await cache.get('test:key');
      expect(result).toBeNull();
    });
  });

  describe('set()', () => {
    it('sets value with default TTL', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK');

      await cache.set('test:key', { data: 'value' });

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'test:key',
        JSON.stringify({ data: 'value' }),
        'EX',
        300,
      );
    });

    it('sets value with custom TTL', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK');

      await cache.set('test:key', { data: 'value' }, 3600);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'test:key',
        JSON.stringify({ data: 'value' }),
        'EX',
        3600,
      );
    });

    it('handles redis error gracefully', async () => {
      mockRedisClient.set.mockRejectedValueOnce(new Error('Redis error'));

      await expect(cache.set('test:key', 'value')).resolves.not.toThrow();
    });
  });

  describe('del()', () => {
    it('deletes a cache key', async () => {
      mockRedisClient.del.mockResolvedValueOnce(1);

      await cache.del('test:key');

      expect(mockRedisClient.del).toHaveBeenCalledWith('test:key');
    });

    it('handles redis error gracefully', async () => {
      mockRedisClient.del.mockRejectedValueOnce(new Error('Redis error'));

      await expect(cache.del('test:key')).resolves.not.toThrow();
    });
  });

  describe('invalidatePattern()', () => {
    it('deletes all keys matching pattern', async () => {
      mockRedisClient.keys.mockResolvedValueOnce(['course:1', 'course:2', 'course:3']);
      mockRedisClient.del.mockResolvedValueOnce(3);

      await cache.invalidatePattern('course:*');

      expect(mockRedisClient.keys).toHaveBeenCalledWith('course:*');
      expect(mockRedisClient.del).toHaveBeenCalledWith('course:1', 'course:2', 'course:3');
    });

    it('does nothing when no keys match', async () => {
      mockRedisClient.keys.mockResolvedValueOnce([]);

      await cache.invalidatePattern('empty:*');

      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('handles redis error gracefully', async () => {
      mockRedisClient.keys.mockRejectedValueOnce(new Error('Redis error'));

      await expect(cache.invalidatePattern('test:*')).resolves.not.toThrow();
    });
  });

  describe('getOrSet()', () => {
    it('returns cached value without calling loader', async () => {
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ cached: true }));
      const loader = jest.fn();

      const result = await cache.getOrSet('test:key', loader);

      expect(result).toEqual({ cached: true });
      expect(loader).not.toHaveBeenCalled();
    });

    it('calls loader and caches result on miss', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockRedisClient.set.mockResolvedValueOnce('OK');
      const loader = jest.fn().mockResolvedValueOnce({ fresh: true });

      const result = await cache.getOrSet('test:key', loader, 600);

      expect(result).toEqual({ fresh: true });
      expect(loader).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'test:key',
        JSON.stringify({ fresh: true }),
        'EX',
        600,
      );
    });

    it('bypasses cache and calls loader when bypass=true', async () => {
      const loader = jest.fn().mockResolvedValueOnce({ bypass: true });
      mockRedisClient.set.mockResolvedValueOnce('OK');

      const result = await cache.getOrSet('test:key', loader, 300, true);

      expect(result).toEqual({ bypass: true });
      expect(loader).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.get).not.toHaveBeenCalled();
    });
  });

  describe('CacheKeys', () => {
    it('generates correct course key', () => {
      expect(CacheKeys.course('123')).toBe('course:listing:123');
    });

    it('generates correct user key', () => {
      expect(CacheKeys.user('user-1')).toBe('user:profile:user-1');
    });

    it('generates correct recommendation key', () => {
      expect(CacheKeys.recommendation('user-1')).toBe('recommendation:user:user-1');
    });

    it('generates correct search key', () => {
      const key = CacheKeys.search('machine learning');
      expect(key).toContain('search:results:');
    });
  });

  describe('CacheTTL', () => {
    it('has correct TTL values', () => {
      expect(CacheTTL.SHORT).toBe(60);
      expect(CacheTTL.MEDIUM).toBe(300);
      expect(CacheTTL.LONG).toBe(3600);
      expect(CacheTTL.DAY).toBe(86400);
    });
  });
});