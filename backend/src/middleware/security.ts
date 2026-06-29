import { Request, Response, NextFunction } from 'express';
import securityConfig from '../config/security';
import logger from '../utils/logger';
import redisConfig from '../config/redis';
import * as securityService from '../services/securityService';
import { sanitizeInput } from './sanitizer';

/**
 * Content Security Policy (CSP) Middleware
 */
export const cspMiddleware = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' wss: ws:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
  );
  next();
};

/**
 * Additional Security Headers Middleware
 */
export const securityHeadersMiddleware = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
};

/**
 * DDoS Protection Middleware
 * Uses Redis to track request rates per IP and flags rapid bursts
 */
export const ddosProtection = async (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'test' && req.headers['x-test-security'] !== 'true') {
    return next();
  }
  const ip = req.ip;
  const key = `ddos:${ip}`;
  const start = process.hrtime();
  
  try {
    const multi = (redisConfig as any).client.multi();
    multi.incr(key);
    multi.expire(key, securityConfig.ddos.checkInterval);
    const results = await multi.exec();
    const count = results ? (results[0] as number) : 0;

    if (count > securityConfig.ddos.limit) {
      logger.warn(`DDoS protection triggered for IP: ${ip} (Requests: ${count})`);
      
      // If count exceeds burst limit, block for longer
      if (count > securityConfig.ddos.burst) {
          await (securityService as any).autoBlockIP(ip, `DDoS burst detected: ${count} requests`);
          await (securityService as any).logSecurityEvent(ip, 'ddos_burst', { count });
      } else {
          await (securityService as any).logSecurityEvent(ip, 'ddos_attempt', { count });
      }

      return res.status(429).json({
        success: false,
        message: 'Too many requests, please slow down.',
      });
    }

    const duration = process.hrtime(start);
    (securityService as any).trackMiddlewarePerformance('ddosProtection', (duration[0] * 1000) + (duration[1] / 1000000));
    
    next();
  } catch (error) {
    logger.error('DDoS protection middleware error:', error);
    next(); // Fail open for DDoS to ensure availability
  }
};

export const botDetection = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'test' && req.headers['x-test-security'] !== 'true') {
    return next();
  }
  const start = process.hrtime();
  const userAgent = (req.headers['user-agent'] || '').toLowerCase();

  const isBot = (securityService as any).botPatterns.some((pattern: string) => userAgent.includes(pattern));

  if (isBot) {
    const allowedBots = ['googlebot', 'bingbot'];
    const isAllowed = allowedBots.some(pattern => userAgent.includes(pattern));

    if (!isAllowed) {
      logger.info(`Bot detected and blocked: ${userAgent} from IP: ${req.ip}`);
      (securityService as any).logSecurityEvent(req.ip, 'bot_detected', { userAgent });
      return res.status(403).json({
        success: false,
        message: 'Bots are not allowed to access this resource.',
      });
    }
  }

  const duration = process.hrtime(start);
  (securityService as any).trackMiddlewarePerformance('botDetection', (duration[0] * 1000) + (duration[1] / 1000000));
  
  next();
};

/**
 * Request Validation & Sanitization Middleware
 * Now delegates to the comprehensive sanitizer in sanitizer.ts
 */
export const requestSanitizer = (req: Request, res: Response, next: NextFunction) => {
  return sanitizeInput(req, res, next);
};

export const checkBlacklist = async (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'test' && req.headers['x-test-security'] !== 'true') {
    return next();
  }
  const ip = req.ip;
  const start = process.hrtime();

  try {
    const blockReason = await (securityService as any).isIPBlocked(ip);
    if (blockReason) {
      logger.warn(`Blocked request from blacklisted IP: ${ip} Reason: ${blockReason}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied from this IP.',
      });
    }

    const duration = process.hrtime(start);
    (securityService as any).trackMiddlewarePerformance('checkBlacklist', (duration[0] * 1000) + (duration[1] / 1000000));

    next();
  } catch (error) {
    logger.error('Blacklist checker error:', error);
    next();
  }
};

/**
 * Advanced Restrictions Middleware (Geo & Time)
 */
export const advancedRestrictions = async (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === 'test') return next();

    const ip = req.ip;
    
    // Check Geo
    const isGeoRestricted = await (securityService as any).checkGeoRestriction(ip);
    if (isGeoRestricted) {
        return res.status(403).json({ success: false, message: 'Access denied from your location.' });
    }

    // Check Time
    const isTimeRestricted = await (securityService as any).checkTimeRestriction();
    if (isTimeRestricted) {
        return res.status(403).json({ success: false, message: 'Platform is currently in maintenance window.' });
    }

    next();
};

/**
 * Performance Tracking Middleware
 * Measures total security processing time
 */
export const securityPerformanceTracker = (req: Request, res: Response, next: NextFunction) => {
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
