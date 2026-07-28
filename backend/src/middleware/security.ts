import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import securityConfig from '../config/security';
import logger from '../utils/logger';
import redisConfig from '../config/redis';
import * as securityService from '../services/securityService';
import { sanitizeInput } from './sanitizer';
import { RateLimitError, ForbiddenError } from '../utils/errors';

/**
 * Generate a random nonce for CSP
 */
export const generateNonce = (): string => {
  return crypto.randomBytes(16).toString('base64');
};

/**
 * Extend the Express Request type to include nonce
 */
declare global {
  namespace Express {
    interface Request {
      cspNonce?: string;
    }
  }
}

/**
 * CSP Configuration
 * Strict directives with NO unsafe-inline or unsafe-eval
 * Uses nonce-based script execution
 * Report-only mode for initial rollout
 */
const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'"], // Nonce will be added dynamically
  'style-src': ["'self'"], // Strict: no unsafe-inline
  'img-src': ["'self'", 'data:', 'https:', 'blob:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': ["'self'", 'wss:', 'ws:', 'https:'],
  'object-src': ["'none'"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-src': ["'none'"],
  'manifest-src': ["'self'"],
  'media-src': ["'self'"],
  'worker-src': ["'self'", 'blob:'],
};

/**
 * Build a CSP header string from directives
 */
const buildCSPString = (directives: Record<string, string[]>, nonce?: string): string => {
  return Object.entries(directives)
    .map(([key, values]) => {
      let resolvedValues = [...values];
      // Add nonce to script-src if provided
      if (key === 'script-src' && nonce) {
        resolvedValues.push(`'nonce-${nonce}'`);
      }
      return `${key} ${resolvedValues.join(' ')}`;
    })
    .join('; ');
};

/**
 * Determine if report-only mode is enabled
 * Controlled by CSP_REPORT_ONLY env var (defaults to true for safe rollout)
 */
const isReportOnly = (): boolean => {
  return process.env.CSP_REPORT_ONLY !== 'false';
};

/**
 * Get the CSP report URI
 */
const getReportUri = (): string => {
  return process.env.CSP_REPORT_URI || '/api/csp-violation';
};

/**
 * Content Security Policy (CSP) Middleware
 * 
 * Features:
 * - Strict directives with NO unsafe-inline or unsafe-eval for scripts
 * - Nonce-based script execution for inline scripts
 * - frame-ancestors 'none' to prevent clickjacking
 * - Report-only mode for initial rollout (controlled by CSP_REPORT_ONLY env var)
 * - CSP violation reporting via report-uri/report-to
 */
export const cspMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Generate a unique nonce for this request
  const nonce = generateNonce();
  req.cspNonce = nonce;

  const reportOnly = isReportOnly();
  const reportUri = getReportUri();

  const cspValue = buildCSPString(CSP_DIRECTIVES, nonce);

  // Add report-uri for violation reporting
  const cspWithReporting = `${cspValue}; report-uri ${reportUri}`;

  if (reportOnly) {
    // Report-only mode: log violations but don't enforce
    res.setHeader('Content-Security-Policy-Report-Only', cspWithReporting);
    logger.info(`CSP report-only header set for ${req.method} ${req.path}`, {
      nonce: nonce.substring(0, 8) + '...',
      reportUri,
    });
  } else {
    // Enforce mode
    res.setHeader('Content-Security-Policy', cspWithReporting);
  }

  // Expose nonce to templates via res.locals
  res.locals.cspNonce = nonce;

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

      return next(new RateLimitError('Too many requests, please slow down.'));
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
      return next(new ForbiddenError('Bots are not allowed to access this resource.'));
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
      const err = new ForbiddenError('Access denied from this IP.', { reason: blockReason });
      return next(err);
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
        return next(new ForbiddenError('Access denied from your location.'));
    }

    // Check Time
    const isTimeRestricted = await (securityService as any).checkTimeRestriction();
    if (isTimeRestricted) {
        return next(new ForbiddenError('Platform is currently in maintenance window.'));
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