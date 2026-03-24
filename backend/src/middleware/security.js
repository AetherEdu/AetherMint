const securityConfig = require('../config/security');
const logger = require('../utils/logger');
const redisConfig = require('../config/redis');
const securityService = require('../services/securityService');

/**
 * DDoS Protection Middleware
 * Uses Redis to track request rates per IP and flags rapid bursts
 */
const ddosProtection = async (req, res, next) => {
  if (process.env.NODE_ENV === 'test' && req.headers['x-test-security'] !== 'true') {
    return next();
  }
  const ip = req.ip;
  const key = `ddos:${ip}`;
  const start = process.hrtime();
  
  try {
    const multi = redisConfig.client.multi();
    multi.incr(key);
    multi.expire(key, securityConfig.ddos.checkInterval);
    const [count] = await multi.exec();

    if (count > securityConfig.ddos.limit) {
      logger.warn(`DDoS protection triggered for IP: ${ip} (Requests: ${count})`);
      
      // If count exceeds burst limit, block for longer
      if (count > securityConfig.ddos.burst) {
          await securityService.autoBlockIP(ip, `DDoS burst detected: ${count} requests`);
          await securityService.logSecurityEvent(ip, 'ddos_burst', { count });
      } else {
          await securityService.logSecurityEvent(ip, 'ddos_attempt', { count });
      }

      return res.status(429).json({
        success: false,
        message: 'Too many requests, please slow down.',
      });
    }

    const duration = process.hrtime(start);
    securityService.trackMiddlewarePerformance('ddosProtection', (duration[0] * 1000) + (duration[1] / 1000000));
    
    next();
  } catch (error) {
    logger.error('DDoS protection middleware error:', error);
    next(); // Fail open for DDoS to ensure availability
  }
};

const botDetection = (req, res, next) => {
  if (process.env.NODE_ENV === 'test' && req.headers['x-test-security'] !== 'true') {
    return next();
  }
  const start = process.hrtime();
  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  const securityService = require('../services/securityService');

  const isBot = securityService.botPatterns.some(pattern => userAgent.includes(pattern));

  if (isBot) {
    const allowedBots = ['googlebot', 'bingbot'];
    const isAllowed = allowedBots.some(pattern => userAgent.includes(pattern));

    if (!isAllowed) {
      logger.info(`Bot detected and blocked: ${userAgent} from IP: ${req.ip}`);
      securityService.logSecurityEvent(req.ip, 'bot_detected', { userAgent });
      return res.status(403).json({
        success: false,
        message: 'Bots are not allowed to access this resource.',
      });
    }
  }

  const duration = process.hrtime(start);
  securityService.trackMiddlewarePerformance('botDetection', (duration[0] * 1000) + (duration[1] / 1000000));
  
  next();
};

/**
 * Request Validation & Sanitization Middleware
 * Enhances existing validation by stripping suspicious HTML/Script tags from input
 */
const requestSanitizer = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'string') {
        const originalValue = obj[key];
        
        // Anti-XSS: Strip script tags and other dangerous HTML
        obj[key] = obj[key]
          .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, '')
          .replace(/on\w+="[^"]*"/gmi, '')
          .replace(/javascript:[^"]*/gmi, '');

        // Basic Anti-SQLi: Detect common patterns (just for logging/flagging, not necessarily stripping to avoid data corruption)
        const sqliPatterns = [/(\%27)|(\')|(\-\-)|(\%23)|(#)/i, /\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION)\b/i];
        const isSqli = sqliPatterns.some(pattern => pattern.test(originalValue));
        
        if (isSqli || obj[key] !== originalValue) {
           securityService.logSecurityEvent(req.ip, 'suspicious_input', { 
             field: key, 
             detected: isSqli ? 'sqli_pattern' : 'html_tags'
           });
        }
      } else if (typeof obj[key] === 'object') {
        sanitize(obj[key]);
      }
    });
  };

  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);

  next();
};

const checkBlacklist = async (req, res, next) => {
  if (process.env.NODE_ENV === 'test' && req.headers['x-test-security'] !== 'true') {
    return next();
  }
  const ip = req.ip;
  const start = process.hrtime();

  try {
    const blockReason = await securityService.isIPBlocked(ip);
    if (blockReason) {
      logger.warn(`Blocked request from blacklisted IP: ${ip} Reason: ${blockReason}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied from this IP.',
      });
    }

    const duration = process.hrtime(start);
    securityService.trackMiddlewarePerformance('checkBlacklist', (duration[0] * 1000) + (duration[1] / 1000000));

    next();
  } catch (error) {
    logger.error('Blacklist checker error:', error);
    next();
  }
};

/**
 * Advanced Restrictions Middleware (Geo & Time)
 */
const advancedRestrictions = async (req, res, next) => {
    if (process.env.NODE_ENV === 'test') return next();

    const ip = req.ip;
    
    // Check Geo
    const isGeoRestricted = await securityService.checkGeoRestriction(ip);
    if (isGeoRestricted) {
        return res.status(403).json({ success: false, message: 'Access denied from your location.' });
    }

    // Check Time
    const isTimeRestricted = await securityService.checkTimeRestriction();
    if (isTimeRestricted) {
        return res.status(403).json({ success: false, message: 'Platform is currently in maintenance window.' });
    }

    next();
};

/**
 * Performance Tracking Middleware
 * Measures total security processing time
 */
const securityPerformanceTracker = (req, res, next) => {
    const start = process.hrtime();
    
    res.on('finish', () => {
        const duration = process.hrtime(start);
        const ms = (duration[0] * 1000) + (duration[1] / 1000000);
        if (ms > 50) { // Log if security processing took more than 50ms
            logger.warn(`High security overhead: ${ms.toFixed(3)}ms for ${req.method} ${req.path}`);
        }
    });
    
    next();
};

module.exports = {
  ddosProtection,
  botDetection,
  requestSanitizer,
  checkBlacklist,
  advancedRestrictions,
  securityPerformanceTracker
};
