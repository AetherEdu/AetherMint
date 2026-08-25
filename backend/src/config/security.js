/**
 * Security and Rate Limiting Configuration
 */
const securityConfig = {
  // Rate limiting tiers based on user roles
  tiers: {
    student: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: 'Too many requests from this student account, please try again after 15 minutes',
      burst: 20,
    },
    instructor: {
      windowMs: 15 * 60 * 1000,
      max: 500,
      message: 'Too many requests from this instructor account, please try again after 15 minutes',
      burst: 50,
    },
    admin: {
      windowMs: 15 * 60 * 1000,
      max: 2000,
      message: 'Too many requests from this admin account',
      burst: 100,
    },
    default: {
      windowMs: 15 * 60 * 1000,
      max: 50,
      message: 'Too many requests, please try again after 15 minutes',
      burst: 10,
    }
  },

  // Endpoint-specific limits
  endpoints: {
    auth: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5, // 5 attempts per hour per IP
      message: 'Too many login attempts, please try again after an hour',
    },
    transactions: {
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 10,
      message: 'Transaction rate limit exceeded',
    },
    ipfs: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 20,
      message: 'IPFS upload limit exceeded',
    }
  },

  // DDoS Protection settings
  ddos: {
    burst: 30,
    limit: 15,
    maxExpiry: 120, // seconds
    checkInterval: 1, // seconds
  },

  // Whitelist/Blacklist
  whitelist: (process.env.SECURITY_WHITELIST || '').split(','),
  blacklist: (process.env.SECURITY_BLACKLIST || '').split(','),

  // Monitoring
  logging: {
    enabled: true,
    file: 'logs/security.log',
    level: 'warn',
    performanceTracking: true,
  },

  // Advanced Restrictions
  geoRestrictions: {
    enabled: process.env.GEO_RESTRICTIONS_ENABLED === 'true',
    blockedCountries: (process.env.GEO_BLOCKED_COUNTRIES || '')
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean),
  },

  timeRestrictions: {
    enabled: process.env.TIME_RESTRICTIONS_ENABLED === 'true',
    startHour: parseInt(process.env.TIME_RESTRICTIONS_START_HOUR || '0', 10),
    endHour: parseInt(process.env.TIME_RESTRICTIONS_END_HOUR || '6', 10),
  },

  // Automated blocking
  autoBlock: {
    enabled: true,
    threshold: 10, // suspicious events before blocking
    durationDays: 1,
  }
};

module.exports = securityConfig;
