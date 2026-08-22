/**
 * Content Controller
 * Handles HTTP requests for content management
 */

import { Request, Response, NextFunction } from 'express';
import { ContentService } from '../services/contentService';
import { MediaService } from '../services/mediaService';
import { 
  ContentCreateRequest, 
  ContentUpdateRequest, 
  BulkOperation,
  ContentFilter,
  ContentExportOptions 
} from '../models/Content';
import logger from '../utils/logger';
import { NotFoundError, AuthError, ValidationError } from '../utils/errors';

export class ContentController {
  constructor(
    private contentService: ContentService,
    private mediaService: MediaService
  ) {}

  /**
   * Create new content
   */
  async createContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AuthError('Unauthorized');
      }

      const contentRequest: ContentCreateRequest = req.body;
      const content = await this.contentService.createContent(contentRequest, userId);

      res.status(201).json({
        success: true,
        data: content,
        message: 'Content created successfully'
      });
    } catch (error) {
      logger.error('Error in contentController:', error);
      next(error);
    }
  }

  /**
   * Get content by ID
   */
  async getContentById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const content = await this.contentService.getContentById(id);

      if (!content) {
        throw new NotFoundError('Content not found');
      }

      // Increment view count
      content.analytics.views++;
      content.analytics.lastViewed = new Date();

      res.json({
        success: true,
        data: content
      });
    } catch (error) {
      logger.error('Error in contentController:', error);
      next(error);
    }
  }

  /**
   * Get content with filters
   */
  async getContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filter: ContentFilter = {
        courseId: req.query.courseId as string,
        moduleId: req.query.moduleId as string,
        type: req.query.type as any,
        status: req.query.status as any,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        createdBy: req.query.createdBy as string,
        search: req.query.search as string,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20
      };

      // Parse date range if provided
      if (req.query.dateFrom || req.query.dateTo) {
        filter.dateRange = {
          from: new Date(req.query.dateFrom as string),
          to: new Date(req.query.dateTo as string)
        };
      }

      const result = await this.contentService.getContent(filter);

      res.json({
        success: true,
        data: result.content,
        pagination: {
          page: filter.page,
          limit: filter.limit,
          total: result.total,
          pages: Math.ceil(result.total / (filter.limit || 20))
        }
      });
    } catch (error) {
      logger.error('Error in contentController:', error);
      next(error);
    }
  }

  /**
   * Update content
   */
  async updateContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        throw new AuthError('Unauthorized');
      }

      const updateRequest: ContentUpdateRequest = req.body;
      const content = await this.contentService.updateContent(id, updateRequest, userId);

      res.json({
        success: true,
        data: content,
        message: 'Content updated successfully'
      });
    } catch (error) {
      logger.error('Error in contentController:', error);
      next(error);
    }
  }

  /**
   * Delete content
   */
  async deleteContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        throw new AuthError('Unauthorized');
      }

      await this.contentService.deleteContent(id, userId);

      res.json({
        success: true,
        message: 'Content deleted successfully'
      });
    } catch (error) {
      logger.error('Error in contentController:', error);
      next(error);
    }
  }

  /**
   * Publish content
   */
  async publishContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        throw new AuthError('Unauthorized');
      }

      const content = await this.contentService.publishContent(id, userId);

      res.json({
        success: true,
        data: content,
        message: 'Content published successfully'
      });
    } catch (error) {
      logger.error('Error in contentController:', error);
      next(error);
    }
  }

  /**
   * Upload media file
   */
  async uploadMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AuthError('Unauthorized');
      }

      if (!(req as any).file) {
        throw new ValidationError('No file uploaded');
      }

      const options = {
        optimizeImages: req.body.optimizeImages === 'true',
        compressVideos: req.body.compressVideos === 'true',
        generateThumbnails: req.body.generateThumbnails !== 'false',
        watermark: req.body.watermark === 'true',
        maxFileSize: req.body.maxFileSize ? parseInt(req.body.maxFileSize) : undefined,
        allowedFormats: req.body.allowedFormats ? req.body.allowedFormats.split(',') : undefined
      };

      const result = await this.mediaService.uploadMedia(
        (req as any).file.buffer,
        (req as any).file.originalname,
        (req as any).file.mimetype,
        userId,
        options
      );

      res.json({
        success: true,
        data: result,
        message: 'Media uploaded successfully'
      });
    } catch (error) {
      logger.error('Error in contentController:', error);
      next(error);
    }
  }

  /**
   * Get media file
   */
  async getMediaFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const mediaFile = await this.mediaService.getMediaFile(id);

      if (!mediaFile) {
        throw new NotFoundError('Media file not found');
      }

      res.json({
        success: true,
        data: mediaFile
      });
    } catch (error) {
      logger.error('Error in contentController:', error);
      next(error);
    }
  }

  /**
   * Delete media file
   */
  async deleteMediaFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        throw new AuthError('Unauthorized');
      }

      await this.mediaService.deleteMediaFile(id);

      res.json({
        success: true,
        message: 'Media file deleted successfully'
      });
    } catch (error) {
      logger.error('Error in contentController:', error);
      next(error);
    }
  }

  /**
   * Perform bulk operations
   */
  async bulkOperation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        throw new AuthError('Unauthorized');
      }

      const operation: BulkOperation = req.body;
      await this.contentService.performBulkOperation(operation, userId);

      res.json({
        success: true,
        message: `Bulk operation '${operation.operation}' completed successfully`,
        affectedItems: operation.contentIds.length
      });
    } catch (error) {
      logger.error('Error in contentController:', error);
      next(error);
    }
  }

  /**
   * Export content
   */
  async exportContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const options: ContentExportOptions = {
        format: req.query.format as any || 'json',
        includeMedia: req.query.includeMedia === 'true',
        includeVersions: req.query.includeVersions === 'true',
        includeAnalytics: req.query.includeAnalytics === 'true',
        filters: {
          courseId: req.query.courseId as string,
          moduleId: req.query.moduleId as string,
          type: req.query.type as any,
          status: req.query.status as any,
          tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
          createdBy: req.query.createdBy as string,
          search: req.query.search as string
        }
      };

      const exportData = await this.contentService.exportContent(options);

      // Set appropriate headers
      const filename = `content_export_${Date.now()}.${options.format}`;
      const contentType = this.getContentType(options.format);
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(exportData);
    } catch (error) {
      logger.error('Error in contentController:', error);
      next(error);
    }
  }

  /**
   * Import content
   */
  async importContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        throw new AuthError('Unauthorized');
      }

      if (!(req as any).file) {
        throw new ValidationError('No file uploaded');
      }

      const format = req.body.format || 'json';
      const data = (req as any).file.buffer.toString('utf-8');
      
      const result = await this.contentService.importContent(data, format, userId);

      res.json({
        success: result.success,
        data: result,
        message: result.success 
          ? `Imported ${result.imported} items successfully`
          : `Import completed with ${result.failed} errors`
      });
    } catch (error) {
      logger.error('Error in contentController:', error);
      next(error);
    }
  }

  /**
   * Get media statistics
   */
  async getMediaStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await this.mediaService.getMediaStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error in contentController:', error);
      next(error);
    }
  }

  /**
   * Get content type for export
   */
  private getContentType(format: string): string {
    const contentTypes: Record<string, string> = {
      'json': 'application/json',
      'csv': 'text/csv',
      'xml': 'application/xml',
      'zip': 'application/zip'
    };

    return contentTypes[format] || 'application/octet-stream';
  }
}
