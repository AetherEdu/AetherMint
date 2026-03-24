const express = require('express');
const multer = require('multer');
const router = express.Router();
const ipfsService = require('../services/ipfs');
const { requirePermission } = require('../middleware/rbac');
const { PERMISSIONS } = require('../utils/roles');
const { ipfsAuth, optionalIpfsAuth, validateContentAccess, validateFileSize } = require('../middleware/ipfsAuth');
const { createIpfsError } = require('../utils/ipfsUtils');
const { ipfsLimiter } = require('../middleware/rateLimiter');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.IPFS_MAX_FILE_SIZE) || 100 * 1024 * 1024, // 100MB
    files: 10 // Maximum 10 files at once
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for now, validation will be done in service
    cb(null, true);
  }
});

/**
 * Upload a single file to IPFS
 * POST /api/content/upload
 */
router.post('/upload', 
  requirePermission(PERMISSIONS.CONTENT_CREATE),
  ipfsLimiter,
  ipfsAuth('upload'),
  upload.single('file'),
  validateFileSize,
  async (req, res) => {
    try {
      if (!req.file) {
        throw createIpfsError('No file provided', 'upload');
      }

      // Extract options from request body
      const options = {
        metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {},
        includeMetadata: req.body.includeMetadata !== 'false',
        wrapWithDirectory: req.body.wrapWithDirectory === 'true',
        progressCallback: (progress) => {
          // Emit progress via WebSocket if available
          if (req.io && req.user) {
            req.io.emit(`upload_progress_${req.user.id}`, progress);
          }
        }
      };

      const result = await ipfsService.uploadFile(req.file, req.user, options);

      res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          cid: result.cid,
          metadataCid: result.metadataCid,
          metadata: result.metadata,
          size: result.size,
          gatewayUrl: result.gatewayUrl
        }
      });
    } catch (error) {
      console.error('Upload error:', error);
      
      if (error.isIpfsError) {
        return res.status(400).json({
          success: false,
          message: error.message,
          operation: error.operation,
          details: error.details
        });
      }

      res.status(500).json({
        success: false,
        message: 'Upload failed',
        error: error.message
      });
    }
  }
);

/**
 * Upload multiple files to IPFS
 * POST /api/content/upload/batch
 */
router.post('/upload/batch',
  requirePermission(PERMISSIONS.CONTENT_CREATE),
  ipfsLimiter,
  ipfsAuth('upload'),
  upload.array('files', 10),
  validateFileSize,
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        throw createIpfsError('No files provided', 'upload');
      }

      // Extract options from request body
      const options = {
        metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {},
        includeMetadata: req.body.includeMetadata !== 'false',
        wrapWithDirectory: req.body.wrapWithDirectory === 'true',
        progressCallback: (progress) => {
          // Emit progress via WebSocket if available
          if (req.io && req.user) {
            req.io.emit(`batch_upload_progress_${req.user.id}`, progress);
          }
        }
      };

      const results = await ipfsService.uploadMultipleFiles(req.files, req.user, options);

      // Count successful and failed uploads
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      res.status(201).json({
        success: true,
        message: `Uploaded ${successful.length} of ${results.length} files successfully`,
        data: {
          results,
          summary: {
            total: results.length,
            successful: successful.length,
            failed: failed.length
          }
        }
      });
    } catch (error) {
      console.error('Batch upload error:', error);
      
      if (error.isIpfsError) {
        return res.status(400).json({
          success: false,
          message: error.message,
          operation: error.operation,
          details: error.details
        });
      }

      res.status(500).json({
        success: false,
        message: 'Batch upload failed',
        error: error.message
      });
    }
  }
);

/**
 * Retrieve content from IPFS
 * GET /api/content/:cid
 */
router.get('/:cid',
  requirePermission(PERMISSIONS.CONTENT_READ),
  validateContentAccess,
  async (req, res) => {
    try {
      const { cid } = req.params;
      const { format = 'buffer' } = req.query;

      const content = await ipfsService.getContent(cid, {
        bypassCache: req.query.bypassCache === 'true'
      });

      // Handle different response formats
      if (format === 'base64') {
        res.json({
          success: true,
          data: {
            cid,
            content: content.toString('base64'),
            size: content.length
          }
        });
      } else if (format === 'stream') {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('X-IPFS-CID', cid);
        res.send(content);
      } else {
        // Default: buffer response
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('X-IPFS-CID', cid);
        res.send(content);
      }
    } catch (error) {
      console.error('Content retrieval error:', error);
      
      if (error.isIpfsError) {
        return res.status(404).json({
          success: false,
          message: error.message,
          operation: error.operation,
          details: error.details
        });
      }

      res.status(500).json({
        success: false,
        message: 'Content retrieval failed',
        error: error.message
      });
    }
  }
);

/**
 * Retrieve metadata for IPFS content
 * GET /api/content/:cid/metadata
 */
router.get('/:cid/metadata',
  requirePermission(PERMISSIONS.CONTENT_READ),
  validateContentAccess,
  async (req, res) => {
    try {
      const { cid } = req.params;
      const { metadataCid } = req.query;

      if (!metadataCid) {
        throw createIpfsError('Metadata CID is required', 'getMetadata');
      }

      const metadata = await ipfsService.getMetadata(metadataCid);

      res.json({
        success: true,
        data: {
          cid,
          metadataCid,
          metadata
        }
      });
    } catch (error) {
      console.error('Metadata retrieval error:', error);
      
      if (error.isIpfsError) {
        return res.status(404).json({
          success: false,
          message: error.message,
          operation: error.operation,
          details: error.details
        });
      }

      res.status(500).json({
        success: false,
        message: 'Metadata retrieval failed',
        error: error.message
      });
    }
  }
);

/**
 * Pin content to IPFS
 * POST /api/content/:cid/pin
 */
router.post('/:cid/pin',
  requirePermission(PERMISSIONS.COURSE_UPDATE), // Pinning requires course update permission
  validateContentAccess,
  async (req, res) => {
    try {
      const { cid } = req.params;

      const result = await ipfsService.pinContent(cid);

      res.json({
        success: true,
        message: 'Content pinned successfully',
        data: result
      });
    } catch (error) {
      console.error('Pin error:', error);
      
      if (error.isIpfsError) {
        return res.status(400).json({
          success: false,
          message: error.message,
          operation: error.operation,
          details: error.details
        });
      }

      res.status(500).json({
        success: false,
        message: 'Pin operation failed',
        error: error.message
      });
    }
  }
);

/**
 * Unpin content from IPFS
 * DELETE /api/content/:cid/pin
 */
router.delete('/:cid/pin',
  requirePermission(PERMISSIONS.COURSE_UPDATE),
  validateContentAccess,
  async (req, res) => {
    try {
      const { cid } = req.params;

      const result = await ipfsService.unpinContent(cid);

      res.json({
        success: true,
        message: 'Content unpinned successfully',
        data: result
      });
    } catch (error) {
      console.error('Unpin error:', error);
      
      if (error.isIpfsError) {
        return res.status(400).json({
          success: false,
          message: error.message,
          operation: error.operation,
          details: error.details
        });
      }

      res.status(500).json({
        success: false,
        message: 'Unpin operation failed',
        error: error.message
      });
    }
  }
);

/**
 * Get IPFS node information
 * GET /api/content/node/info
 */
router.get('/node/info',
  requirePermission(PERMISSIONS.SYSTEM_MANAGE),
  async (req, res) => {
    try {
      const nodeInfo = await ipfsService.getNodeInfo();

      res.json({
        success: true,
        data: nodeInfo
      });
    } catch (error) {
      console.error('Node info error:', error);
      
      if (error.isIpfsError) {
        return res.status(500).json({
          success: false,
          message: error.message,
          operation: error.operation,
          details: error.details
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to get node information',
        error: error.message
      });
    }
  }
);

/**
 * Get cache statistics
 * GET /api/content/cache/stats
 */
router.get('/cache/stats',
  requirePermission(PERMISSIONS.ANALYTICS_READ),
  async (req, res) => {
    try {
      const cacheStats = ipfsService.getCacheStats();

      res.json({
        success: true,
        data: cacheStats
      });
    } catch (error) {
      console.error('Cache stats error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to get cache statistics',
        error: error.message
      });
    }
  }
);

/**
 * Clear cache
 * DELETE /api/content/cache
 */
router.delete('/cache',
  requirePermission(PERMISSIONS.SYSTEM_MANAGE),
  async (req, res) => {
    try {
      ipfsService.clearCache();

      res.json({
        success: true,
        message: 'Cache cleared successfully'
      });
    } catch (error) {
      console.error('Cache clear error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to clear cache',
        error: error.message
      });
    }
  }
);

/**
 * Health check for IPFS service
 * GET /api/content/health
 */
router.get('/health',
  async (req, res) => {
    try {
      const nodeInfo = await ipfsService.getNodeInfo();
      const cacheStats = ipfsService.getCacheStats();

      res.json({
        success: true,
        status: 'healthy',
        data: {
          ipfs: {
            connected: true,
            version: nodeInfo.version.version
          },
          cache: {
            enabled: true,
            ...cacheStats
          }
        }
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        message: 'IPFS service is not available',
        error: error.message
      });
    }
  }
);

module.exports = router;
