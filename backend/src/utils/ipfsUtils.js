const crypto = require('crypto');
const { ipfsConfig } = require('../config/ipfs');

/**
 * Generate a unique content hash for metadata
 * @param {Object} metadata - The metadata object
 * @returns {string} - The generated hash
 */
const generateContentHash = (metadata) => {
  const metadataString = JSON.stringify(metadata, Object.keys(metadata).sort());
  return crypto.createHash('sha256').update(metadataString).digest('hex');
};

/**
 * Validate file type and size
 * @param {Object} file - The file object
 * @returns {Object} - Validation result
 */
const validateFile = (file) => {
  const errors = [];
  
  // Check file size
  if (file.size > ipfsConfig.maxFileSize) {
    errors.push(`File size ${file.size} exceeds maximum allowed size ${ipfsConfig.maxFileSize}`);
  }
  
  // Check content type
  if (!ipfsConfig.allowedContentTypes.includes(file.mimetype)) {
    errors.push(`Content type ${file.mimetype} is not allowed`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Create metadata for uploaded content
 * @param {Object} file - The file object
 * @param {Object} user - The user object (optional)
 * @param {Object} additionalMetadata - Additional metadata (optional)
 * @returns {Object} - The created metadata
 */
const createMetadata = (file, user = null, additionalMetadata = {}) => {
  const metadata = {
    name: file.originalname,
    size: file.size,
    contentType: file.mimetype,
    uploadedAt: new Date().toISOString(),
    contentHash: generateContentHash({
      name: file.originalname,
      size: file.size,
      contentType: file.mimetype
    })
  };
  
  // Add uploader information if enabled and user is provided
  if (ipfsConfig.metadata.includeUploader && user) {
    metadata.uploader = {
      id: user.id,
      username: user.username,
      address: user.address
    };
  }
  
  // Add additional metadata
  Object.assign(metadata, additionalMetadata);
  
  return metadata;
};

/**
 * Format IPFS hash for gateway access
 * @param {string} hash - The IPFS hash
 * @returns {string} - The formatted gateway URL
 */
const formatGatewayUrl = (hash) => {
  return `${ipfsConfig.gatewayUrl}${hash}`;
};

/**
 * Extract IPFS hash from gateway URL
 * @param {string} gatewayUrl - The gateway URL
 * @returns {string} - The IPFS hash
 */
const extractHashFromGatewayUrl = (gatewayUrl) => {
  const match = gatewayUrl.match(/\/ipfs\/(.+)$/);
  return match ? match[1] : null;
};

/**
 * Create a progress callback for upload/download operations
 * @param {Function} callback - The progress callback function
 * @returns {Function} - The formatted progress callback
 */
const createProgressCallback = (callback) => {
  return (bytesLoaded, bytesTotal) => {
    const progress = bytesTotal > 0 ? (bytesLoaded / bytesTotal) * 100 : 0;
    callback({
      progress: Math.round(progress),
      bytesLoaded,
      bytesTotal,
      isComplete: bytesLoaded >= bytesTotal
    });
  };
};

/**
 * Retry mechanism for IPFS operations
 * @param {Function} operation - The operation to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Delay between retries in milliseconds
 * @returns {Promise} - The operation result
 */
const retryOperation = async (operation, maxRetries = ipfsConfig.maxRetries, delay = ipfsConfig.retryDelay) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw new Error(`Operation failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
};

/**
 * Sanitize filename for IPFS
 * @param {string} filename - The original filename
 * @returns {string} - The sanitized filename
 */
const sanitizeFilename = (filename) => {
  // Remove or replace special characters that might cause issues
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255); // Limit filename length
};

/**
 * Create a cache key for IPFS content
 * @param {string} hash - The IPFS hash
 * @param {string} type - The cache type (metadata, content, etc.)
 * @returns {string} - The cache key
 */
const createCacheKey = (hash, type = 'content') => {
  return `ipfs:${type}:${hash}`;
};

/**
 * Parse IPFS CID to extract information
 * @param {string} cid - The IPFS CID
 * @returns {Object} - Parsed CID information
 */
const parseCid = (cid) => {
  try {
    // Basic CID validation (can be enhanced with proper CID library)
    if (!cid || typeof cid !== 'string') {
      throw new Error('Invalid CID: must be a non-empty string');
    }
    
    // Remove any gateway URL prefix
    const hash = extractHashFromGatewayUrl(cid) || cid;
    
    // Basic format validation
    if (!/^[a-zA-Z0-9]{46,}$/.test(hash)) {
      throw new Error('Invalid CID format');
    }
    
    return {
      hash,
      isValid: true,
      version: hash.startsWith('Qm') ? 'v0' : 'v1',
      gatewayUrl: formatGatewayUrl(hash)
    };
  } catch (error) {
    return {
      hash: cid,
      isValid: false,
      error: error.message
    };
  }
};

/**
 * Create error object with IPFS-specific information.
 *
 * The optional `httpStatus` parameter is the canonical RFC 7807 status
 * the caller wants surfaced on the wire. When omitted, the value is
 * `null` and downstream consumers (e.g. `mapIpfsError`) fall back to a
 * table-driven default derived from `operation`. Setting it explicitly
 * removes any need for message-text heuristics on the consumer side.
 *
 * @param {string} message  - The error message
 * @param {string} operation - The operation that failed
 * @param {Object} [details={}] - Additional error details
 * @param {number|null} [httpStatus=null] - Optional explicit HTTP status
 *   code (400/401/403/404/413/429/500/503). Pass `null` to defer to the
 *   operation-based default.
 * @returns {Error} - The formatted error (plain Error, not AppError)
 */
const createIpfsError = (message, operation, details = {}, httpStatus = null) => {
  const error = new Error(message);
  error.operation = operation;
  error.details = details;
  error.httpStatus = httpStatus;
  error.isIpfsError = true;
  return error;
};

module.exports = {
  generateContentHash,
  validateFile,
  createMetadata,
  formatGatewayUrl,
  extractHashFromGatewayUrl,
  createProgressCallback,
  retryOperation,
  sanitizeFilename,
  createCacheKey,
  parseCid,
  createIpfsError
};
