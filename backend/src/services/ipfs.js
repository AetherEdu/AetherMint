const { getClientConfig, ipfsConfig } = require('../config/ipfs');
const {
  validateFile,
  createMetadata,
  createProgressCallback,
  retryOperation,
  createCacheKey,
  parseCid,
  createIpfsError
} = require('../utils/ipfsUtils');

class IpfsService {
  constructor() {
    this.client = null;
    this.cache = new Map(); // Simple in-memory cache
  }

  /**
   * Initialize IPFS client
   */
  async init() {
    try {
      const config = getClientConfig();
      const { create } = await import('ipfs-http-client');
      this.client = create(config);
      
      // Test connection
      await this.client.version();
      console.log('✅ IPFS client initialized successfully');
      return this.client;
    } catch (error) {
      console.error('❌ Failed to initialize IPFS client:', error.message);
      this.client = null;
      return null;
    }
  }

  async ensureClient() {
    if (this.client) {
      return this.client;
    }

    return this.init();
  }

  /**
   * Upload file to IPFS with metadata
   * @param {Object} file - The file object
   * @param {Object} user - The user object (optional)
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} - Upload result with CID and metadata
   */
  async uploadFile(file, user = null, options = {}) {
    try {
      await this.ensureClient();

      // Validate file
      const validation = validateFile(file);
      if (!validation.isValid) {
        throw createIpfsError('File validation failed', 'upload', { errors: validation.errors });
      }

      // Create metadata
      const metadata = createMetadata(file, user, options.metadata);

      // Upload with progress tracking
      const uploadPromise = async () => {
        const { cid } = await this.client.add(file.buffer, {
          pin: ipfsConfig.autoPin,
          progress: options.progressCallback ? 
            createProgressCallback(options.progressCallback) : undefined,
          wrapWithDirectory: options.wrapWithDirectory || false
        });

        // Store metadata separately if enabled
        let metadataCid = null;
        if (options.includeMetadata !== false) {
          const metadataBuffer = Buffer.from(JSON.stringify(metadata));
          const { cid: metaCid } = await this.client.add(metadataBuffer, {
            pin: ipfsConfig.autoPin
          });
          metadataCid = metaCid.toString();
        }

        return {
          cid: cid.toString(),
          metadata,
          metadataCid,
          size: file.size,
          gatewayUrl: `${ipfsConfig.gatewayUrl}${cid.toString()}`
        };
      };

      // Execute with retry mechanism
      const result = await retryOperation(uploadPromise);

      // Cache the result if caching is enabled
      if (ipfsConfig.enableCache) {
        const cacheKey = createCacheKey(result.cid, 'upload');
        this.cache.set(cacheKey, {
          ...result,
          cachedAt: Date.now()
        });
      }

      return result;
    } catch (error) {
      throw createIpfsError('File upload failed', 'upload', { 
        filename: file.originalname,
        error: error.message 
      });
    }
  }

  /**
   * Upload multiple files to IPFS
   * @param {Array} files - Array of file objects
   * @param {Object} user - The user object (optional)
   * @param {Object} options - Upload options
   * @returns {Promise<Array>} - Array of upload results
   */
  async uploadMultipleFiles(files, user = null, options = {}) {
    await this.ensureClient();

    const results = [];
    const totalFiles = files.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        // Create progress callback for individual file
        const fileProgressCallback = options.progressCallback ? 
          (progress) => {
            // Calculate overall progress
            const overallProgress = ((i * 100) + progress.progress) / totalFiles;
            options.progressCallback({
              ...progress,
              fileIndex: i,
              totalFiles,
              overallProgress: Math.round(overallProgress)
            });
          } : undefined;

        const result = await this.uploadFile(file, user, {
          ...options,
          progressCallback: fileProgressCallback
        });

        results.push({
          ...result,
          index: i,
          success: true
        });
      } catch (error) {
        results.push({
          index: i,
          filename: file.originalname,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Retrieve content from IPFS
   * @param {string} cid - The IPFS CID or gateway URL
   * @param {Object} options - Retrieval options
   * @returns {Promise<Buffer>} - The content buffer
   */
  async getContent(cid, options = {}) {
    try {
      await this.ensureClient();

      // Parse CID
      const parsedCid = parseCid(cid);
      if (!parsedCid.isValid) {
        throw createIpfsError('Invalid CID format', 'getContent', { cid });
      }

      const hash = parsedCid.hash;

      // Check cache first
      if (ipfsConfig.enableCache && !options.bypassCache) {
        const cacheKey = createCacheKey(hash, 'content');
        const cached = this.cache.get(cacheKey);
        
        if (cached && (Date.now() - cached.cachedAt) < ipfsConfig.cacheTimeout) {
          return cached.content;
        }
      }

      // Retrieve content with retry
      const retrievePromise = async () => {
        const chunks = [];
        
        for await (const chunk of this.client.cat(hash, {
          timeout: options.timeout || ipfsConfig.pinTimeout
        })) {
          chunks.push(chunk);
        }
        
        return Buffer.concat(chunks);
      };

      const content = await retryOperation(retrievePromise);

      // Cache the content if enabled
      if (ipfsConfig.enableCache) {
        const cacheKey = createCacheKey(hash, 'content');
        this.cache.set(cacheKey, {
          content,
          cachedAt: Date.now()
        });
      }

      return content;
    } catch (error) {
      throw createIpfsError('Content retrieval failed', 'getContent', { 
        cid,
        error: error.message 
      });
    }
  }

  /**
   * Retrieve metadata for IPFS content
   * @param {string} metadataCid - The metadata CID
   * @param {Object} options - Retrieval options
   * @returns {Promise<Object>} - The metadata object
   */
  async getMetadata(metadataCid, options = {}) {
    try {
      const content = await this.getContent(metadataCid, options);
      return JSON.parse(content.toString());
    } catch (error) {
      throw createIpfsError('Metadata retrieval failed', 'getMetadata', { 
        metadataCid,
        error: error.message 
      });
    }
  }

  /**
   * Pin content to IPFS
   * @param {string} cid - The IPFS CID
   * @returns {Promise<Object>} - Pin result
   */
  async pinContent(cid) {
    try {
      await this.ensureClient();

      const parsedCid = parseCid(cid);
      if (!parsedCid.isValid) {
        throw createIpfsError('Invalid CID format', 'pinContent', { cid });
      }

      const result = await retryOperation(async () => {
        return await this.client.pin.add(parsedCid.hash);
      });

      return {
        cid: result.toString(),
        pinned: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw createIpfsError('Content pinning failed', 'pinContent', { 
        cid,
        error: error.message 
      });
    }
  }

  /**
   * Unpin content from IPFS
   * @param {string} cid - The IPFS CID
   * @returns {Promise<Object>} - Unpin result
   */
  async unpinContent(cid) {
    try {
      await this.ensureClient();

      const parsedCid = parseCid(cid);
      if (!parsedCid.isValid) {
        throw createIpfsError('Invalid CID format', 'unpinContent', { cid });
      }

      await retryOperation(async () => {
        return await this.client.pin.rm(parsedCid.hash);
      });

      // Clear from cache
      if (ipfsConfig.enableCache) {
        const contentCacheKey = createCacheKey(parsedCid.hash, 'content');
        const uploadCacheKey = createCacheKey(parsedCid.hash, 'upload');
        this.cache.delete(contentCacheKey);
        this.cache.delete(uploadCacheKey);
      }

      return {
        cid: parsedCid.hash,
        unpinned: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw createIpfsError('Content unpinning failed', 'unpinContent', { 
        cid,
        error: error.message 
      });
    }
  }

  /**
   * Get IPFS node information
   * @returns {Promise<Object>} - Node information
   */
  async getNodeInfo() {
    try {
      await this.ensureClient();

      const [version, id, repo] = await Promise.all([
        this.client.version(),
        this.client.id(),
        this.client.repo.stat()
      ]);

      return {
        version,
        id,
        repo: {
          numObjects: repo.numObjects,
          repoSize: repo.repoSize,
          storageMax: repo.storageMax
        },
        config: {
          host: ipfsConfig.host,
          port: ipfsConfig.port,
          protocol: ipfsConfig.protocol
        }
      };
    } catch (error) {
      throw createIpfsError('Failed to get node info', 'getNodeInfo', { 
        error: error.message 
      });
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  getCacheStats() {
    const entries = Array.from(this.cache.entries());
    const now = Date.now();
    
    const validEntries = entries.filter(([key, value]) => 
      (now - value.cachedAt) < ipfsConfig.cacheTimeout
    );

    return {
      totalEntries: entries.length,
      validEntries: validEntries.length,
      expiredEntries: entries.length - validEntries.length,
      cacheSize: JSON.stringify(validEntries).length
    };
  }
}

// Create singleton instance
const ipfsService = new IpfsService();

module.exports = ipfsService;
