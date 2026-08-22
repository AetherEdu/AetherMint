/**
 * Cache Middleware
 * Implements cache-aside pattern for Express endpoints.
 * Integrates with MultiTierCache and CacheAnalytics services.
 */

const MultiTierCache = require('./multiTierCache');
const CacheAnalytics = require('./cacheAnalytics');
const logger = require('../utils/logger');

// ────────────────────────────────────────────────────────────────────────────
// Singleton cache instance
// ────────────────────────────────────────────────────────────────────────────

let cacheInstance = null;
let analyticsInstance = null;

const getCache = () => {
  if (!cacheInstance) {
    cacheInstance = new MultiTierCache({
      l1: {
        maxSize: 1000,
        ttl: 300000, // 5 min default
        cleanupInterval: 60000, // 1 min
      },
      l2: {
        ttl: 3600000, // 1 hour default for Redis
        keyPrefix: 'cache:',
      },
    });

    cacheInstance.on('error', ({ operation, key, error }) => {
      logger.warn(`Cache error [${operation}] key=${key}: ${error.message}`);
    });

    // Initialize analytics
    analyticsInstance = new CacheAnalytics({
      logFile: './cache-analytics.log',
    });
    analyticsInstance.start();
  }
  return cacheInstance;
};

const getAnalytics = () => {
  if (!analyticsInstance) {
    getCache(); // init both
  }
  return analyticsInstance;
};

// ────────────────────────────────────────────────────────────────────────────
// Cache Middleware (Cache-Aside Pattern)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Creates an Express middleware that caches GET responses.
 *
 * @param {Object} options
 * @param {number}  options.ttl        - Time-to-live in seconds
 * @param {string}  options.keyPrefix  - Key prefix for cache isolation
 * @param {string[]} [options.tags]    - Tags for tag-based invalidation
 * @returns {Function} Express middleware
 */
const cacheMiddleware = (options = {}) => {
  const { ttl = 60, keyPrefix = 'cache:', tags = [] } = options;
  const ttlMs = ttl * 1000;

  return async (req, res, next) => {
    if (req.method !== 'GET') return next();

    // Honor Cache-Control: no-cache header
    const cacheControl = req.headers['cache-control'];
    if (cacheControl && cacheControl.includes('no-cache')) {
      res.set('X-Cache', 'BYPASS');
      return next();
    }

    const cache = getCache();

    const cacheKey = buildCacheKey(keyPrefix, req);

    try {
      const cachedValue = await cache.get(cacheKey);
      if (cachedValue !== null && cachedValue !== undefined) {
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Tier', 'L1');
        return res.json(cachedValue);
      }
    } catch (error) {
      // Graceful degradation: log and continue without cache
      logger.warn(`Cache retrieval failed for ${cacheKey}: ${error.message}`);
    }

    res.set('X-Cache', 'MISS');

    // Intercept res.json() to capture and cache the response body
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      res.json = originalJson; // Restore original

      // Fire-and-forget: cache the response asynchronously
      cache.set(cacheKey, body, { ttl: ttlMs, tags }).catch((err) => {
        logger.warn(`Failed to cache response for ${cacheKey}: ${err.message}`);
      });

      return originalJson(body);
    };

    next();
  };
};

// ────────────────────────────────────────────────────────────────────────────
// Cache Invalidation Middleware
// ────────────────────────────────────────────────────────────────────────────

/**
 * Creates an Express middleware that invalidates cached entries by tag
 * after a successful write operation.
 *
 * @param {Object} options
 * @param {string[]} options.tags - Tags to invalidate
 * @returns {Function} Express middleware
 */
const cacheInvalidationMiddleware = (options = {}) => {
  const { tags = [] } = options;

  return (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 400 && tags.length > 0) {
        const cache = getCache();
        Promise.all(tags.map((tag) => cache.invalidateByTag(tag).catch(() => {})))
          .catch(() => {});
      }
    });

    next();
  };
};

// ────────────────────────────────────────────────────────────────────────────
// Cache Metrics
// ────────────────────────────────────────────────────────────────────────────

const getCacheMetrics = () => {
  const cache = getCache();
  const metrics = cache.getMetrics();
  return {
    l1Hits: metrics.l1.hits,
    l1Misses: metrics.l1.misses,
    l1HitRate: metrics.l1HitRate || 0,
    l1Size: metrics.l1Size || 0,
    l1MaxSize: metrics.l1MaxSize || 0,
    l2Hits: metrics.l2.hits,
    l2Misses: metrics.l2.misses,
    l2HitRate: metrics.l2HitRate || 0,
    totalRequests: metrics.totalRequests || 0,
    overallHitRate: metrics.overallHitRate || 0,
    averageResponseTime: metrics.averageResponseTime || 0,
  };
};

// ────────────────────────────────────────────────────────────────────────────
// Cache Management Utilities
// ────────────────────────────────────────────────────────────────────────────

const flushL1Cache = () => {
  const cache = getCache();
  cache.l1Cache.clear();
  cache.l1AccessTimes.clear();
  cache.l1Tags.clear();
};

const flushAllCaches = async () => {
  const cache = getCache();
  cache.l1Cache.clear();
  cache.l1AccessTimes.clear();
  cache.l1Tags.clear();
  try {
    const keys = await cache.redisCluster.keys(`${cache.config.l2.keyPrefix}*`);
    if (keys.length > 0) {
      await cache.redisCluster.del(...keys);
    }
  } catch (err) {
    logger.warn(`Failed to flush Redis cache: ${err.message}`);
  }
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const buildCacheKey = (prefix, req) => {
  const queryParams = req.query || {};
  const sortedQuery = Object.keys(queryParams)
    .sort()
    .map((key) => `${key}=${queryParams[key]}`)
    .join('&');

  const path = req.path || req.originalUrl.split('?')[0];
  return sortedQuery ? `${prefix}${path}?${sortedQuery}` : `${prefix}${path}`;
};

// ────────────────────────────────────────────────────────────────────────────
// Exports
// ────────────────────────────────────────────────────────────────────────────

module.exports = {
  cacheMiddleware,
  cacheInvalidationMiddleware,
  getCacheMetrics,
  flushL1Cache,
  flushAllCaches,
  getCache,
  getAnalytics,
};
