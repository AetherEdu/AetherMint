const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { rateLimitConfig } = require('../config/redis');
const {
  decrementRateLimitCounter,
  incrementRateLimitCounter,
  resetRateLimitCounter,
} = require('../utils/redis');
const securityConfig = require('../config/security');
const logger = require('../utils/logger');
const { RateLimitError, ServiceUnavailableError } = require('../utils/errors');

const getIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

const getAuthenticatedUser = (req) => {
  if (req.user && (req.user.id || req.user.sub)) {
    return {
      id: String(req.user.id || req.user.sub),
      role: String(req.user.role || '').toLowerCase(),
    };
  }

  const authorization = req.headers?.authorization;
  if (!authorization || !authorization.startsWith('Bearer ')) return null;

  try {
    const token = authorization.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const id = decoded.id || decoded.sub;
    if (!id) return null;
    return { id: String(id), role: String(decoded.role || '').toLowerCase() };
  } catch {
    return null;
  }
};

const endpointName = (req) => {
  const routePath = req.route?.path || '';
  const path = `${req.baseUrl || ''}${routePath}` || req.path || 'unknown';
  return `${req.method || 'ALL'}:${path}`;
};

const hashKey = (value) =>
  crypto.createHash('sha256').update(String(value)).digest('hex');

const shouldSkip = (req) => {
  if (!rateLimitConfig.enabled) return true;
  if (process.env.NODE_ENV === 'test') {
    return req.headers['x-test-security'] !== 'true';
  }
  return securityConfig.whitelist.includes(getIp(req));
};

const identityFor = (req, scope) => {
  const user = getAuthenticatedUser(req);
  if (scope === 'user' && user) return `user:${user.id}`;
  if (scope === 'endpoint') {
    const actor = user ? `user:${user.id}` : `ip:${getIp(req)}`;
    return `${endpointName(req)}:${actor}`;
  }
  return `ip:${getIp(req)}`;
};

class RedisStore {
  constructor(options = {}) {
    this.prefix = options.prefix || rateLimitConfig.keyPrefix;
    this.expiry = options.expiry || 60;
  }

  key(key) {
    return `${this.prefix}${hashKey(key)}`;
  }

  async increment(key) {
    return incrementRateLimitCounter(this.key(key), this.expiry * 1000);
  }

  async decrement(key) {
    await decrementRateLimitCounter(this.key(key));
  }

  async resetKey(key) {
    await resetRateLimitCounter(this.key(key));
  }
}

const setHeaders = (res, result) => {
  const resetSeconds = Math.max(
    1,
    Math.ceil((result.resetTime.getTime() - Date.now()) / 1000)
  );
  res.setHeader('X-RateLimit-Limit', String(result.limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, result.remaining)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetTime.getTime() / 1000)));
  return resetSeconds;
};

const consume = async (req, policy) => {
  const identity = identityFor(req, policy.scope);
  const baseKey = `${rateLimitConfig.keyPrefix}${policy.name}:`;
  const mainStore = new RedisStore({
    prefix: `${baseKey}window:`,
    expiry: Math.ceil(policy.windowMs / 1000),
  });
  const burstStore = new RedisStore({
    prefix: `${baseKey}burst:`,
    expiry: Math.ceil(policy.burstWindowMs / 1000),
  });

  const [main, burst] = await Promise.all([
    mainStore.increment(identity),
    burstStore.increment(identity),
  ]);

  if (!main || !burst) {
    return { unavailable: true, policy };
  }

  const mainResult = {
    limit: policy.max,
    remaining: policy.max - main.totalHits,
    resetTime: main.resetTime,
    exceeded: main.totalHits > policy.max,
  };
  const burstResult = {
    limit: policy.burstMax,
    remaining: policy.burstMax - burst.totalHits,
    resetTime: burst.resetTime,
    exceeded: burst.totalHits > policy.burstMax,
  };

  return {
    ...(burstResult.exceeded ? burstResult : mainResult),
    exceeded: mainResult.exceeded || burstResult.exceeded,
    policy,
  };
};

const rejectRequest = async (req, res, result) => {
  const retryAfter = setHeaders(res, result);
  res.setHeader('Retry-After', String(retryAfter));

  logger.warn(`Rate limit exceeded: ${getIp(req)} - ${req.method} ${req.path}`);

  try {
    const securityService = require('../services/securityService');
    await Promise.resolve(securityService.logSecurityEvent(
      getIp(req),
      'rate_limit_exceeded',
      {
        path: req.path,
        method: req.method,
        tier: result.policy.name,
        user: getAuthenticatedUser(req)?.id || 'anonymous',
      }
    ));
  } catch (error) {
    logger.error('Failed to record rate limit security event:', error);
  }

  const err = new RateLimitError(result.policy.message || 'Rate limit exceeded');
  err.details = { retryAfter, policy: result.policy.name };
  return next(err);
};

const runPolicies = async (req, res, next, policies) => {
  if (shouldSkip(req)) return next();

  try {
    const results = await Promise.all(policies.map((policy) => consume(req, policy)));
    const unavailable = results.some((result) => result.unavailable);

    if (unavailable && !rateLimitConfig.failOpen) {
      return next(new ServiceUnavailableError('Request protection is temporarily unavailable. Please try again shortly.'));
    }

    const exceeded = results.find((result) => result.exceeded);
    if (exceeded) return rejectRequest(req, res, exceeded);

    const available = results.filter((result) => !result.unavailable);
    if (available.length) {
      const mostConstrained = available.reduce((selected, result) =>
        result.remaining / result.limit < selected.remaining / selected.limit
          ? result
          : selected
      );
      setHeaders(res, mostConstrained);
    }

    return next();
  } catch (error) {
    logger.error('Rate limiter failed:', error);
    if (rateLimitConfig.failOpen) return next();
    return next(new ServiceUnavailableError('Request protection is temporarily unavailable. Please try again shortly.'));
  }
};

const normalizePolicy = (options = {}) => ({
  windowMs: options.windowMs || rateLimitConfig.public.windowMs,
  max: options.max || rateLimitConfig.public.max,
  burstWindowMs: options.burstWindowMs || Math.min(options.windowMs || 60_000, 10_000),
  burstMax: options.burstMax || Math.max(1, Math.ceil((options.max || 100) * 0.2)),
  message: typeof options.message === 'string'
    ? options.message
    : rateLimitConfig.public.message,
  name: options.name || String(options.keyPrefix || 'custom').replace(/[^a-z0-9_-]/gi, ''),
  scope: options.scope || 'ip',
});

const createRateLimiter = (options = {}) => {
  const policy = normalizePolicy(options);
  return (req, res, next) => runPolicies(req, res, next, [policy]);
};

const globalPolicy = { ...rateLimitConfig.global, name: 'global', scope: 'ip' };
const publicPolicy = { ...rateLimitConfig.public, name: 'public', scope: 'ip' };
const authenticatedPolicy = {
  ...rateLimitConfig.authenticated,
  name: 'authenticated',
  scope: 'user',
};
const adminPolicy = { ...rateLimitConfig.admin, name: 'admin', scope: 'user' };

const globalLimiter = (req, res, next) =>
  runPolicies(req, res, next, [globalPolicy]);

const publicLimiter = (req, res, next) =>
  runPolicies(req, res, next, [globalPolicy, publicPolicy]);

const authenticatedLimiter = (req, res, next) =>
  runPolicies(req, res, next, [globalPolicy, authenticatedPolicy]);

const adminLimiter = (req, res, next) =>
  runPolicies(req, res, next, [globalPolicy, adminPolicy]);

const tieredRateLimiter = (req, res, next) => {
  const user = getAuthenticatedUser(req);
  if (!user) return publicLimiter(req, res, next);
  if (user.role === 'admin') return adminLimiter(req, res, next);
  return authenticatedLimiter(req, res, next);
};

const endpointLimiter = (name, config, scope = 'endpoint') =>
  createRateLimiter({ ...config, name, scope });

const authLimiter = endpointLimiter('auth', rateLimitConfig.endpoints.auth, 'endpoint');
const transactionLimiter = endpointLimiter(
  'transactions',
  rateLimitConfig.endpoints.transactions
);
const ipfsLimiter = endpointLimiter('ipfs', rateLimitConfig.endpoints.ipfs);

module.exports = {
  RedisStore,
  globalLimiter,
  publicLimiter,
  authenticatedLimiter,
  adminLimiter,
  tieredRateLimiter,
  authLimiter,
  transactionLimiter,
  ipfsLimiter,
  createRateLimiter,
};
