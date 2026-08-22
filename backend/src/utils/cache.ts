import redisConfig from '../config/redis';
import logger from './logger';

/**
 * @notice Cache analytics tracker interface
 */
interface CacheAnalyticsTracker {
  recordHit(key: string): void;
  recordMiss(key: string): void;
}

let analyticsTracker: CacheAnalyticsTracker | null = null;

/**
 * @notice Set the analytics tracker instance
 */
export function setCacheAnalyticsTracker(tracker: CacheAnalyticsTracker): void {
  analyticsTracker = tracker;
}

/**
 * @notice Get Redis client
 */
function getClient() {
  return redisConfig.getRawClient();
}

/**
 * @notice Get a cached value by key
 * @param key - Cache key
 * @param bypass - If true, skip cache and return null (debug mode)
 */
export async function get<T>(key: string, bypass = false): Promise<T | null> {
  if (bypass) {
    logger.debug(`[Cache] Bypass for key: ${key}`);
    return null;
  }

  try {
    const client = getClient();
    if (!client) return null;

    const data = await client.get(key);
    if (data) {
      analyticsTracker?.recordHit(key);
      logger.debug(`[Cache] HIT: ${key}`);
      return JSON.parse(data) as T;
    }

    analyticsTracker?.recordMiss(key);
    logger.debug(`[Cache] MISS: ${key}`);
    return null;
  } catch (err) {
    logger.error(`[Cache] Error getting key ${key}: ${err}`);
    return null;
  }
}

/**
 * @notice Set a value in cache with TTL
 * @param key - Cache key
 * @param value - Value to cache
 * @param ttl - Time to live in seconds (default: 300)
 */
export async function set<T>(key: string, value: T, ttl = 300): Promise<void> {
  try {
    const client = getClient();
    if (!client) return;

    await client.set(key, JSON.stringify(value), 'EX', ttl);
    logger.debug(`[Cache] SET: ${key} (TTL: ${ttl}s)`);
  } catch (err) {
    logger.error(`[Cache] Error setting key ${key}: ${err}`);
  }
}

/**
 * @notice Delete a cache entry
 * @param key - Cache key to delete
 */
export async function del(key: string): Promise<void> {
  try {
    const client = getClient();
    if (!client) return;

    await client.del(key);
    logger.debug(`[Cache] DEL: ${key}`);
  } catch (err) {
    logger.error(`[Cache] Error deleting key ${key}: ${err}`);
  }
}

/**
 * @notice Invalidate all keys matching a pattern
 * @param pattern - Redis glob pattern e.g. "course:*"
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  try {
    const client = getClient();
    if (!client) return;

    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
      logger.info(`[Cache] Invalidated ${keys.length} keys matching: ${pattern}`);
    }
  } catch (err) {
    logger.error(`[Cache] Error invalidating pattern ${pattern}: ${err}`);
  }
}

/**
 * @notice Get or set pattern — fetch from cache or load and cache
 * @param key - Cache key
 * @param loader - Async function to load data if not cached
 * @param ttl - Time to live in seconds
 * @param bypass - If true, skip cache
 */
export async function getOrSet<T>(
  key: string,
  loader: () => Promise<T>,
  ttl = 300,
  bypass = false,
): Promise<T> {
  if (!bypass) {
    const cached = await get<T>(key);
    if (cached !== null) return cached;
  }

  const value = await loader();
  await set(key, value, ttl);
  return value;
}

/**
 * @notice Cache key builders following service:entity:id pattern
 */
export const CacheKeys = {
  course: (id: string) => `course:listing:${id}`,
  courseList: (page = 1, limit = 20) => `course:list:${page}:${limit}`,
  user: (id: string) => `user:profile:${id}`,
  search: (query: string) => `search:results:${Buffer.from(query).toString('base64')}`,
  recommendation: (userId: string) => `recommendation:user:${userId}`,
  credential: (id: string) => `credential:verification:${id}`,
};

/**
 * @notice Default TTL values in seconds
 */
export const CacheTTL = {
  SHORT: 60,        // 1 minute
  MEDIUM: 300,      // 5 minutes
  LONG: 3600,       // 1 hour
  DAY: 86400,       // 24 hours
};

/**
 * @notice Warm up cache with hot data on server startup
 * @param warmers - Array of functions that load hot data into cache
 */
export async function warmCache(
  warmers: Array<() => Promise<void>>,
): Promise<void> {
  logger.info('[Cache] Starting cache warm-up...');
  await Promise.allSettled(warmers.map((w) => w()));
  logger.info('[Cache] Cache warm-up complete');
}

