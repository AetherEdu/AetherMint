process.env.NODE_ENV = 'test';
const securityConfig = require('./src/config/security');
const rateLimiter = require('./src/middleware/rateLimiter');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('securityConfig.whitelist:', securityConfig.whitelist);
// We can't easily check rateLimiter skip function without a req object, but we can log it.
