const redisConfig = require('../config/redis');
const securityConfig = require('../config/security');
const logger = require('../utils/logger');

/**
 * Security Service
 * Handles advanced security logic, automated blocking, and monitoring
 */
class SecurityService {
  constructor() {
    this.botPatterns = [
      'bot', 'spider', 'crawl', 'slurp', 'mediapartners', 'adsbot',
      'python-requests', 'node-fetch', 'curl', 'wget', 'postman',
      'headless', 'phantomjs', 'selenium', 'puppeteer'
    ];
  }

  /**
   * Log a suspicious security event
   * @param {string} ip - IP address of the source
   * @param {string} type - Event type (e.g., 'auth_failure', 'ddos_attempt')
   * @param {Object} details - Additional event details
   */
  async logSecurityEvent(ip, type, details = {}) {
    try {
      const timestamp = new Date().toISOString();
      const eventKey = `security_event:${ip}:${type}:${timestamp}`;
      const eventCountKey = `suspicious_count:${ip}`;

      // Save event to Redis (expire after 7 days)
      await redisConfig.client.setEx(eventKey, 7 * 24 * 60 * 60, JSON.stringify({
        ip,
        type,
        details,
        timestamp
      }));

      // Increment suspicious event count for this IP
      const count = await redisConfig.client.incr(eventCountKey);
      await redisConfig.client.expire(eventCountKey, 24 * 60 * 60); // Reset count after 24h

      logger.warn(`Security event logged: ${type} for IP: ${ip}. Total suspicious events: ${count}`);

      // Check for automated blocking
      if (securityConfig.autoBlock.enabled && count >= securityConfig.autoBlock.threshold) {
        await this.autoBlockIP(ip, `Exceeded suspicious event threshold: ${count}`);
      }

      return true;
    } catch (error) {
      logger.error('Failed to log security event:', error);
      return false;
    }
  }

  /**
   * Automatically block an IP address
   */
  async autoBlockIP(ip, reason) {
    try {
      const blockDuration = securityConfig.autoBlock.durationDays * 24 * 60 * 60;
      await redisConfig.client.setEx(`blacklist:${ip}`, blockDuration, reason);
      logger.error(`IP automatically blocked: ${ip}. Reason: ${reason}`);
      
      // Clear suspicious count after blocking
      await redisConfig.client.del(`suspicious_count:${ip}`);
      
      return true;
    } catch (error) {
      logger.error(`Failed to block IP ${ip}:`, error);
      return false;
    }
  }

  /**
   * Check if an IP is currently blocked
   */
  async isIPBlocked(ip) {
    try {
      const reason = await redisConfig.client.get(`blacklist:${ip}`);
      return reason || securityConfig.blacklist.includes(ip);
    } catch (error) {
       logger.error(`Failed to check if IP ${ip} is blocked:`, error);
       return false;
    }
  }

  /**
   * Get recent security logs summary
   */
  async getSecurityPulse() {
    try {
       // This would ideally query a DB or aggregate Redis keys
       // For now, return basic stats from Redis if tracked
       const blacklistSize = (await redisConfig.client.keys('blacklist:*')).length;
       return {
          timestamp: new Date().toISOString(),
          activeBlocks: blacklistSize,
          systemStatus: 'secure'
       };
    } catch (error) {
       logger.error('Failed to get security pulse:', error);
       return null;
    }
  }

  /**
   * Add IP to manual whitelist
   */
  async addToWhitelist(ip) {
     securityConfig.whitelist.push(ip);
     logger.info(`IP added to whitelist: ${ip}`);
  }

  /**
   * Check Geometric Restrictions
   */
  async checkGeoRestriction(ip) {
      // Stub for geo-blocking implementation (e.g., using geoip-lite)
      const restrictedCountries = securityConfig.geoRestrictions?.blockedCountries || [];
      if (restrictedCountries.length > 0) {
          logger.debug(`Geo-restriction check for IP ${ip} (No-op stub)`);
      }
      return false; // Allow by default
  }

  /**
   * Check Time-based Restrictions
   */
  async checkTimeRestriction() {
      const restrictions = securityConfig.timeRestrictions;
      if (!restrictions || !restrictions.enabled) return false;

      const now = new Date();
      const hour = now.getHours();
      
      const isRestricted = hour >= restrictions.startHour || hour < restrictions.endHour;
      return isRestricted;
  }

  /**
   * Performance impact tracking
   */
  trackMiddlewarePerformance(name, duration) {
      if (securityConfig.logging?.performanceTracking) {
          logger.debug(`Performance: Middleware ${name} took ${duration.toFixed(3)}ms`);
      }
  }
}

// Create singleton instance
const securityService = new SecurityService();

module.exports = securityService;
