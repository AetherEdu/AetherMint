/**
 * File Upload Service
 * Handles file storage, validation, and processing
 */

import { AssignmentFile } from '../models/Assignment';
import { v4 as uuidv4 } from 'uuid';
import AWS from 'aws-sdk';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

export interface UploadOptions {
  maxFileSize?: number;
  allowedTypes?: string[];
  generateThumbnails?: boolean;
  virusScan?: boolean;
}

export interface UploadedFile extends AssignmentFile {
  buffer?: Buffer;
  originalName: string;
}

export class FileUploadService {
  private s3: AWS.S3;
  private bucketName: string;

  constructor() {
    // Initialize AWS S3
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    });
    
    this.bucketName = process.env.AWS_S3_BUCKET || 'starked-education-files';
  }

  async uploadFiles(
    files: Express.Multer.File[], 
    folderPath: string,
    options: UploadOptions = {}
  ): Promise<AssignmentFile[]> {
    const uploadedFiles: AssignmentFile[] = [];

    for (const file of files) {
      try {
        // Validate file
        await this.validateFile(file, options);
        
        // Process file (resize images, generate thumbnails, etc.)
        const processedFile = await this.processFile(file, options);
        
        // Upload to storage
        const uploadedFile = await this.uploadToStorage(processedFile, folderPath);
        
        uploadedFiles.push(uploadedFile);
      } catch (error) {
        console.error(`Error uploading file ${file.originalname}:`, error);
        throw new Error(`Failed to upload file: ${file.originalname}`);
      }
    }

    return uploadedFiles;
  }

  async uploadSingleFile(
    file: Express.Multer.File,
    folderPath: string,
    options: UploadOptions = {}
  ): Promise<AssignmentFile> {
    // Validate file
    await this.validateFile(file, options);
    
    // Process file
    const processedFile = await this.processFile(file, options);
    
    // Upload to storage
    return await this.uploadToStorage(processedFile, folderPath);
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract key from URL
      const key = this.extractKeyFromUrl(fileUrl);
      
      if (key) {
        await this.s3.deleteObject({
          Bucket: this.bucketName,
          Key: key
        }).promise();
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error('Failed to delete file');
    }
  }

  async getFileBuffer(fileUrl: string): Promise<Buffer> {
    try {
      const key = this.extractKeyFromUrl(fileUrl);
      
      if (!key) {
        throw new Error('Invalid file URL');
      }

      const response = await this.s3.getObject({
        Bucket: this.bucketName,
        Key: key
      }).promise();

      return response.Body as Buffer;
    } catch (error) {
      console.error('Error getting file buffer:', error);
      throw new Error('Failed to retrieve file');
    }
  }

  async generateThumbnail(fileUrl: string): Promise<string | null> {
    try {
      const buffer = await this.getFileBuffer(fileUrl);
      
      // Check if file is an image
      const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const fileType = await this.getFileType(buffer);
      
      if (!imageTypes.includes(fileType)) {
        return null;
      }

      // Generate thumbnail
      const thumbnailBuffer = await sharp(buffer)
        .resize(300, 300, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      // Upload thumbnail
      const thumbnailKey = `thumbnails/${uuidv4()}.jpg`;
      
      await this.s3.upload({
        Bucket: this.bucketName,
        Key: thumbnailKey,
        Body: thumbnailBuffer,
        ContentType: 'image/jpeg',
        ACL: 'public-read'
      }).promise();

      return `https://${this.bucketName}.s3.amazonaws.com/${thumbnailKey}`;
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      return null;
    }
  }

  private async validateFile(
    file: Express.Multer.File, 
    options: UploadOptions
  ): Promise<void> {
    // Check file size
    const maxSize = options.maxFileSize || 100 * 1024 * 1024; // 100MB default
    if (file.size > maxSize) {
      throw new Error(`File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`);
    }

    // Check file type
    if (options.allowedTypes && options.allowedTypes.length > 0) {
      if (!options.allowedTypes.includes(file.mimetype)) {
        throw new Error(`File type ${file.mimetype} is not allowed`);
      }
    }

    // Additional validation based on file type
    await this.validateFileContent(file);
  }

  private async validateFileContent(file: Express.Multer.File): Promise<void> {
    // Check for malicious content in code files
    const codeExtensions = ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.php', '.rb'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (codeExtensions.includes(ext)) {
      const content = file.buffer.toString('utf-8');
      
      // Basic security checks for code files
      const dangerousPatterns = [
        /eval\s*\(/,
        /exec\s*\(/,
        /system\s*\(/,
        /shell_exec\s*\(/,
        /require\s*\(\s*["']http/,
        /import\s+.*from\s+["']http/
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(content)) {
          throw new Error('File contains potentially dangerous code');
        }
      }
    }

    // Check for executable files
    const executableSignatures = [
      Buffer.from([0x4D, 0x5A]), // PE executable
      Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF executable
      Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]) // Mach-O executable
    ];

    for (const signature of executableSignatures) {
      if (file.buffer.slice(0, signature.length).equals(signature)) {
        throw new Error('Executable files are not allowed');
      }
    }
  }

  private async processFile(
    file: Express.Multer.File,
    options: UploadOptions
  ): Promise<Express.Multer.File> {
    let processedFile = file;

    // Process images
    if (file.mimetype.startsWith('image/')) {
      processedFile = await this.processImage(file, options);
    }

    // Process documents (if needed)
    if (file.mimetype.includes('pdf') || file.mimetype.includes('document')) {
      processedFile = await this.processDocument(file, options);
    }

    return processedFile;
  }

  private async processImage(
    file: Express.Multer.File,
    options: UploadOptions
  ): Promise<Express.Multer.File> {
    // Validate image integrity
    try {
      await sharp(file.buffer).metadata();
    } catch (error) {
      throw new Error('Invalid or corrupted image file');
    }

    // Optimize image if needed
    if (options.generateThumbnails !== false) {
      // Compress large images
      const metadata = await sharp(file.buffer).metadata();
      
      if (metadata.width && metadata.width > 2000) {
        const optimizedBuffer = await sharp(file.buffer)
          .resize(2000, 2000, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 85 })
          .toBuffer();

        return {
          ...file,
          buffer: optimizedBuffer,
          size: optimizedBuffer.length
        };
      }
    }

    return file;
  }

  private async processDocument(
    file: Express.Multer.File,
    options: UploadOptions
  ): Promise<Express.Multer.File> {
    // For documents, we might want to extract metadata or generate previews
    // For now, just return the original file
    return file;
  }

  private async uploadToStorage(
    file: Express.Multer.File,
    folderPath: string
  ): Promise<AssignmentFile> {
    const fileExtension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;
    const key = `${folderPath}/${fileName}`;

    try {
      const uploadResult = await this.s3.upload({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'private', // Files are private by default
        Metadata: {
          originalName: file.originalname,
          uploadTime: new Date().toISOString()
        }
      }).promise();

      // Generate a signed URL for temporary access
      const signedUrl = this.s3.getSignedUrl('getObject', {
        Bucket: this.bucketName,
        Key: key,
        Expires: 60 * 60 * 24 * 7 // 7 days
      });

      return {
        id: uuidv4(),
        name: file.originalname,
        url: signedUrl,
        size: file.size,
        type: file.mimetype,
        uploadedAt: new Date()
      };
    } catch (error) {
      console.error('Error uploading to S3:', error);
      throw new Error('Failed to upload file to storage');
    }
  }

  private extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.substring(1); // Remove leading slash
    } catch {
      return null;
    }
  }

  private async getFileType(buffer: Buffer): Promise<string> {
    // Simple file type detection based on buffer content
    const signatures: { [key: string]: Buffer } = {
      'image/jpeg': Buffer.from([0xFF, 0xD8, 0xFF]),
      'image/png': Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
      'image/gif': Buffer.from([0x47, 0x49, 0x46, 0x38]),
      'application/pdf': Buffer.from([0x25, 0x50, 0x44, 0x46])
    };

    for (const [type, signature] of Object.entries(signatures)) {
      if (buffer.slice(0, signature.length).equals(signature)) {
        return type;
      }
    }

    return 'application/octet-stream';
  }

  async createPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    return this.s3.getSignedUrl('putObject', {
      Bucket: this.bucketName,
      Key: key,
      Expires: expiresIn
    });
  }

  async getFileInfo(fileUrl: string): Promise<{
    size: number;
    type: string;
    lastModified: Date;
  } | null> {
    try {
      const key = this.extractKeyFromUrl(fileUrl);
      
      if (!key) {
        return null;
      }

      const headObject = await this.s3.headObject({
        Bucket: this.bucketName,
        Key: key
      }).promise();

      return {
        size: headObject.ContentLength || 0,
        type: headObject.ContentType || 'application/octet-stream',
        lastModified: headObject.LastModified || new Date()
      };
    } catch (error) {
      console.error('Error getting file info:', error);
      return null;
    }
  }
}
