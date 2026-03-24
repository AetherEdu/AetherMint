const ApiKey = require('../models/ApiKey');
const logger = require('../utils/logger');
const securityService = require('../services/securityService');

/**
 * API Key Authentication Middleware
 */
const authenticateApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return next(); // Proceed to next middleware (maybe JWT)
  }

  try {
    const keyDoc = await ApiKey.findOne({ key: apiKey, status: 'active' });

    if (!keyDoc) {
       await securityService.logSecurityEvent(req.ip, 'invalid_api_key', { key: apiKey });
       return res.status(401).json({
         success: false,
         message: 'Invalid or revoked API key'
       });
    }

    // Check expiration
    if (keyDoc.expiresAt && keyDoc.expiresAt < new Date()) {
       return res.status(401).json({
         success: false,
         message: 'API key has expired'
       });
    }

    // Update last used
    keyDoc.lastUsedAt = new Date();
    await keyDoc.save();

    req.user = { id: keyDoc.userId, role: 'api_user' }; // Set basic user info
    req.apiKey = keyDoc;
    
    next();
  } catch (error) {
    logger.error('API Key authentication error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { authenticateApiKey };
