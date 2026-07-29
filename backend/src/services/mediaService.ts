/**
 * Media Service
 * Handles media file processing, optimization, and IPFS integration
 */

import { MediaFile, MediaFormat } from '../models/Content';
import logger from '../utils/logger';

export interface MediaProcessingOptions {
  optimizeImages?: boolean;
  compressVideos?: boolean;
  generateThumbnails?: boolean;
  watermark?: boolean;
  maxFileSize?: number; // in bytes
  allowedFormats?: MediaFormat[];
}

export interface MediaUploadResult {
  file: MediaFile;
  url: string;
  ipfsHash?: string;
  processingTime: number;
}

export interface MediaStats {
  totalFiles: number;
  totalSize: number;
  formatBreakdown: Record<MediaFormat, number>;
  averageSize: number;
  largestFile: MediaFile | null;
  mostRecentUpload: MediaFile | null;
}

export class MediaService {
  private ipfsClient: any;
  private processingQueue: Map<string, Promise<MediaFile>> = new Map();

  constructor() {
    void this.initializeIpfsClient();
  }

  private async initializeIpfsClient(): Promise<void> {
    if (this.ipfsClient) {
      return;
    }

    try {
      const { create } = await import('ipfs-http-client');
      this.ipfsClient = create({
        host: process.env.IPFS_HOST || 'localhost',
        port: parseInt(process.env.IPFS_PORT || '5001'),
        protocol: process.env.IPFS_PROTOCOL || 'http'
      });
      logger.info('IPFS client initialized');
    } catch (error) {
      logger.warn('Failed to initialize IPFS client:', error);
      this.ipfsClient = null;
    }
  }

  /**
   * Upload and process media file
   */
  async uploadMedia(
    file: Buffer, 
    originalName: string, 
    mimeType: string,
    uploadedBy: string,
    options: MediaProcessingOptions = {}
  ): Promise<MediaUploadResult> {
    const startTime = Date.now();
    const fileId = this.generateFileId();

    try {
      // Check if already processing
      if (this.processingQueue.has(fileId)) {
        const processedFile = await this.processingQueue.get(fileId)!;
        return {
          file: processedFile,
          url: processedFile.url,
          ipfsHash: processedFile.ipfsHash,
          processingTime: Date.now() - startTime
        };
      }

      // Start processing
      const processingPromise = this.processMediaFile(
        file, 
        originalName, 
        mimeType, 
        uploadedBy, 
        options
      );

      this.processingQueue.set(fileId, processingPromise);

      const processedFile = await processingPromise;
      
      // Upload to IPFS if available
      let ipfsHash: string | undefined;
      if (this.ipfsClient) {
        try {
          const ipfsResult = await this.uploadToIPFS(processedFile.url);
          ipfsHash = ipfsResult;
          processedFile.ipfsHash = ipfsHash;
        } catch (error) {
          logger.warn('Failed to upload to IPFS:', error);
        }
      }

      const result: MediaUploadResult = {
        file: processedFile,
        url: processedFile.url,
        ipfsHash,
        processingTime: Date.now() - startTime
      };

      this.processingQueue.delete(fileId);
      logger.info(`Media uploaded successfully: ${processedFile.id}`);
      
      return result;
    } catch (error) {
      this.processingQueue.delete(fileId);
      logger.error('Error uploading media:', error);
      throw error;
    }
  }

  /**
   * Process media file (optimize, compress, generate thumbnails)
   */
  private async processMediaFile(
    file: Buffer,
    originalName: string,
    mimeType: string,
    uploadedBy: string,
    options: MediaProcessingOptions
  ): Promise<MediaFile> {
    const format = this.getFormatFromMimeType(mimeType);
    const size = file.length;

    // Validate file
    this.validateFile(file, format, options);

    let processedFile = file;
    let thumbnailUrl: string | undefined;
    let duration: number | undefined;
    let dimensions: { width: number; height: number } | undefined;

    // Process based on media type
    if (this.isImage(format)) {
      if (options.optimizeImages) {
        processedFile = await this.optimizeImage(file, format);
      }
      if (options.generateThumbnails) {
        thumbnailUrl = await this.generateImageThumbnail(processedFile);
      }
      dimensions = await this.getImageDimensions(processedFile);
    } else if (this.isVideo(format)) {
      if (options.compressVideos) {
        processedFile = await this.compressVideo(file, format);
      }
      if (options.generateThumbnails) {
        thumbnailUrl = await this.generateVideoThumbnail(processedFile);
      }
      duration = await this.getVideoDuration(processedFile);
      dimensions = await this.getVideoDimensions(processedFile);
    } else if (this.isAudio(format)) {
      duration = await this.getAudioDuration(processedFile);
    }

    // Save file to storage (in a real implementation, this would save to cloud storage)
    const url = await this.saveToFileStorage(processedFile, originalName, format);

    const mediaFile: MediaFile = {
      id: this.generateFileId(),
      filename: this.generateFilename(originalName, format),
      originalName,
      mimeType,
      format,
      size: processedFile.length,
      url,
      thumbnailUrl,
      duration,
      dimensions,
      uploadedBy,
      uploadedAt: new Date(),
      isProcessed: true,
      processingStatus: 'completed',
      metadata: {
        originalSize: size,
        compressionRatio: processedFile.length / size,
        processedAt: new Date().toISOString()
      }
    };

    return mediaFile;
  }

  /**
   * Get media file by ID
   */
  async getMediaFile(fileId: string): Promise<MediaFile | null> {
    // In a real implementation, this would query the database
    logger.info(`Fetching media file: ${fileId}`);
    return null;
  }

  /**
   * Delete media file
   */
  async deleteMediaFile(fileId: string): Promise<void> {
    try {
      const mediaFile = await this.getMediaFile(fileId);
      if (!mediaFile) {
        throw new Error(`Media file not found: ${fileId}`);
      }

      // Delete from storage
      await this.deleteFromFileStorage(mediaFile.url);

      // Delete from IPFS if uploaded
      if (mediaFile.ipfsHash && this.ipfsClient) {
        try {
          await this.ipfsClient.pin.rm(mediaFile.ipfsHash);
        } catch (error) {
          logger.warn('Failed to remove from IPFS:', error);
        }
      }

      // Delete thumbnail if exists
      if (mediaFile.thumbnailUrl) {
        await this.deleteFromFileStorage(mediaFile.thumbnailUrl);
      }

      logger.info(`Deleted media file: ${fileId}`);
    } catch (error) {
      logger.error('Error deleting media file:', error);
      throw error;
    }
  }

  /**
   * Get media statistics
   */
  async getMediaStats(): Promise<MediaStats> {
    // In a real implementation, this would query the database
    // For now, return empty stats
    return {
      totalFiles: 0,
      totalSize: 0,
      formatBreakdown: {} as Record<MediaFormat, number>,
      averageSize: 0,
      largestFile: null,
      mostRecentUpload: null
    };
  }

  /**
   * Upload to IPFS
   */
  private async uploadToIPFS(fileUrl: string): Promise<string> {
    if (!this.ipfsClient) {
      throw new Error('IPFS client not available');
    }

    try {
      // In a real implementation, this would read the file and upload to IPFS
      // For now, return a mock hash
      const mockHash = 'Qm' + Math.random().toString(36).substr(2, 44);
      logger.info(`Uploaded to IPFS: ${mockHash}`);
      return mockHash;
    } catch (error) {
      logger.error('Error uploading to IPFS:', error);
      throw error;
    }
  }

  /**
   * Validate file
   */
  private validateFile(file: Buffer, format: MediaFormat, options: MediaProcessingOptions): void {
    // Check file size
    if (options.maxFileSize && file.length > options.maxFileSize) {
      throw new Error(`File size ${file.length} exceeds maximum allowed size ${options.maxFileSize}`);
    }

    // Check format
    if (options.allowedFormats && !options.allowedFormats.includes(format)) {
      throw new Error(`Format ${format} is not allowed`);
    }
  }

  /**
   * Get format from MIME type
   */
  private getFormatFromMimeType(mimeType: string): MediaFormat {
    const mimeToFormat: Record<string, MediaFormat> = {
      'video/mp4': MediaFormat.MP4,
      'video/webm': MediaFormat.WEBM,
      'audio/mpeg': MediaFormat.MP3,
      'audio/wav': MediaFormat.WAV,
      'application/pdf': MediaFormat.PDF,
      'application/msword': MediaFormat.DOC,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': MediaFormat.DOCX,
      'image/jpeg': MediaFormat.JPG,
      'image/jpg': MediaFormat.JPG,
      'image/png': MediaFormat.PNG,
      'image/gif': MediaFormat.GIF,
      'image/svg+xml': MediaFormat.SVG
    };

    return mimeToFormat[mimeType] || MediaFormat.JPG; // Default to JPG
  }

  /**
   * Check if format is image
   */
  private isImage(format: MediaFormat): boolean {
    return [MediaFormat.JPG, MediaFormat.JPEG, MediaFormat.PNG, MediaFormat.GIF, MediaFormat.SVG].includes(format);
  }

  /**
   * Check if format is video
   */
  private isVideo(format: MediaFormat): boolean {
    return [MediaFormat.MP4, MediaFormat.WEBM].includes(format);
  }

  /**
   * Check if format is audio
   */
  private isAudio(format: MediaFormat): boolean {
    return [MediaFormat.MP3, MediaFormat.WAV].includes(format);
  }

  /**
   * Optimize image
   */
  private async optimizeImage(file: Buffer, format: MediaFormat): Promise<Buffer> {
    // In a real implementation, this would use image processing libraries
    // For now, return the original file
    logger.info(`Optimizing image: ${format}`);
    return file;
  }

  /**
   * Compress video
   */
  private async compressVideo(file: Buffer, format: MediaFormat): Promise<Buffer> {
    // In a real implementation, this would use FFmpeg or similar
    // For now, return the original file
    logger.info(`Compressing video: ${format}`);
    return file;
  }

  /**
   * Generate image thumbnail
   */
  private async generateImageThumbnail(file: Buffer): Promise<string> {
    // In a real implementation, this would generate and save thumbnail
    const thumbnailUrl = `https://cdn.example.com/thumbnails/${this.generateFileId()}.jpg`;
    logger.info(`Generated image thumbnail: ${thumbnailUrl}`);
    return thumbnailUrl;
  }

  /**
   * Generate video thumbnail
   */
  private async generateVideoThumbnail(file: Buffer): Promise<string> {
    // In a real implementation, this would extract frame from video
    const thumbnailUrl = `https://cdn.example.com/thumbnails/${this.generateFileId()}.jpg`;
    logger.info(`Generated video thumbnail: ${thumbnailUrl}`);
    return thumbnailUrl;
  }

  /**
   * Get image dimensions
   */
  private async getImageDimensions(file: Buffer): Promise<{ width: number; height: number }> {
    // In a real implementation, this would use image processing library
    return { width: 1920, height: 1080 };
  }

  /**
   * Get video dimensions
   */
  private async getVideoDimensions(file: Buffer): Promise<{ width: number; height: number }> {
    // In a real implementation, this would use FFprobe or similar
    return { width: 1920, height: 1080 };
  }

  /**
   * Get video duration
   */
  private async getVideoDuration(file: Buffer): Promise<number> {
    // In a real implementation, this would use FFprobe or similar
    return 300; // 5 minutes in seconds
  }

  /**
   * Get audio duration
   */
  private async getAudioDuration(file: Buffer): Promise<number> {
    // In a real implementation, this would use audio processing library
    return 180; // 3 minutes in seconds
  }

  /**
   * Save to file storage
   */
  private async saveToFileStorage(file: Buffer, originalName: string, format: MediaFormat): Promise<string> {
    // In a real implementation, this would save to cloud storage (S3, GCS, etc.)
    const filename = this.generateFilename(originalName, format);
    const url = `https://cdn.example.com/media/${filename}`;
    logger.info(`Saved file to storage: ${url}`);
    return url;
  }

  /**
   * Delete from file storage
   */
  private async deleteFromFileStorage(url: string): Promise<void> {
    // In a real implementation, this would delete from cloud storage
    logger.info(`Deleted file from storage: ${url}`);
  }

  /**
   * Generate unique file ID
   */
  private generateFileId(): string {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate filename
   */
  private generateFilename(originalName: string, format: MediaFormat): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6);
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
    return `${nameWithoutExt}_${timestamp}_${random}.${format}`;
  }
}
