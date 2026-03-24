const rateLimit = require('express-rate-limit');
const redisConfig = require('../config/redis');
const securityConfig = require('../config/security');
const logger = require('../utils/logger');

/**
 * Custom Simple Redis Store for express-rate-limit
 */
class RedisStore {
  constructor(options = {}) {
    this.prefix = options.prefix || 'rl:';
    this.expiry = options.expiry || 60; // default 60 seconds
  }

  async increment(key) {
    const fullKey = this.prefix + key;
    try {
      // Use multi to ensure atomicity
      const multi = redisConfig.client.multi();
      multi.incrBy(fullKey, 1);
      multi.expire(fullKey, this.expiry);
      const results = await multi.exec();
      
      const currentCount = results[0];
      const ttl = results[1];

      return {
        totalHits: currentCount,
        resetTime: new Date(Date.now() + (ttl * 1000 || this.expiry * 1000))
      };
    } catch (error) {
      logger.error(`RedisStore error for key ${fullKey}:`, error);
      // Fallback
      return { totalHits: 0, resetTime: new Date() };
    }
  }

  async decrement(key) {
    const fullKey = this.prefix + key;
    try {
      await redisConfig.client.decr(fullKey);
    } catch (error) {
      logger.error(`RedisStore decrement error for key ${fullKey}:`, error);
    }
  }

  async resetKey(key) {
    const fullKey = this.prefix + key;
    try {
      await redisConfig.client.del(fullKey);
    } catch (error) {
      logger.error(`RedisStore resetKey error for key ${fullKey}:`, error);
    }
  }
}

/**
 * Factory for creating rate limiters with custom Redis store
 */
const createRateLimiter = (options = {}) => {
  const {
    windowMs = securityConfig.tiers.default.windowMs,
    max = securityConfig.tiers.default.max,
    message = securityConfig.tiers.default.message,
    keyPrefix = 'rl:',
  } = options;

  const securityService = require('../services/securityService');

  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      prefix: keyPrefix,
      expiry: Math.ceil(windowMs / 1000),
    }),
    handler: (req, res, next, options) => {
      logger.warn(`Rate limit exceeded: ${req.ip} - ${req.method} ${req.path}`);
      
      // Log security event for rate limit breach
      securityService.logSecurityEvent(req.ip, 'rate_limit_exceeded', {
        path: req.path,
        method: req.method,
        prefix: keyPrefix,
        user: req.user ? req.user.id : 'anonymous'
      });

      res.status(options.statusCode).send(options.message);
    },
    keyGenerator: (req) => {
      // Use user ID if authenticated, else fallback to IP
      if (req.user && (req.user.id || req.user.sub)) {
        return `${keyPrefix}${req.user.id || req.user.sub}`;
      }
      return req.ip;
    },
    skip: (req) => {
      // Skip whitelisted IPs or in test environment (unless explicitly testing security)
      if (process.env.NODE_ENV === 'test' && req.headers['x-test-security'] === 'true') {
        return false;
      }
      return securityConfig.whitelist.includes(req.ip) || process.env.NODE_ENV === 'test';
    }
  });
};

// Global rate limiter
const globalLimiter = createRateLimiter({
  windowMs: securityConfig.tiers.default.windowMs,
  max: securityConfig.tiers.default.max,
  keyPrefix: 'rl:global:',
});

// Tier-based limiters (to be used after authentication)
const studentLimiter = createRateLimiter({
  windowMs: securityConfig.tiers.student.windowMs,
  max: securityConfig.tiers.student.max,
  message: securityConfig.tiers.student.message,
  keyPrefix: 'rl:student:',
});

const instructorLimiter = createRateLimiter({
  windowMs: securityConfig.tiers.instructor.windowMs,
  max: securityConfig.tiers.instructor.max,
  message: securityConfig.tiers.instructor.message,
  keyPrefix: 'rl:instructor:',
});

const adminLimiter = createRateLimiter({
  windowMs: securityConfig.tiers.admin.windowMs,
  max: securityConfig.tiers.admin.max,
  message: securityConfig.tiers.admin.message,
  keyPrefix: 'rl:admin:',
});

// Endpoint-specific limiters
const authLimiter = createRateLimiter({
  windowMs: securityConfig.endpoints.auth.windowMs,
  max: securityConfig.endpoints.auth.max,
  message: securityConfig.endpoints.auth.message,
  keyPrefix: 'rl:auth:',
});

const transactionLimiter = createRateLimiter({
  windowMs: securityConfig.endpoints.transactions.windowMs,
  max: securityConfig.endpoints.transactions.max,
  message: securityConfig.endpoints.transactions.message,
  keyPrefix: 'rl:tx:',
});

const ipfsLimiter = createRateLimiter({
  windowMs: securityConfig.endpoints.ipfs.windowMs,
  max: securityConfig.endpoints.ipfs.max,
  message: securityConfig.endpoints.ipfs.message,
  keyPrefix: 'rl:ipfs:',
});

/**
 * Middleware to select rate limiter based on user role
 */
const tieredRateLimiter = (req, res, next) => {
  // If not authenticated, use global limiter by IP
  if (!req.user) {
    return globalLimiter(req, res, next);
  }

  // If authenticated, use role-based limiter which now uses UserID in keyGenerator
  const role = req.user.role;
  if (role === 'admin') {
    return adminLimiter(req, res, next);
  } else if (role === 'instructor' || role === 'educator') {
    return instructorLimiter(req, res, next);
  } else if (role === 'student') {
    return studentLimiter(req, res, next);
  } else {
    return globalLimiter(req, res, next);
  }
};

module.exports = {
  globalLimiter,
  tieredRateLimiter,
  authLimiter,
  transactionLimiter,
  ipfsLimiter,
  createRateLimiter
};
