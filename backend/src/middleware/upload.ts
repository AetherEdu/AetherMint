/**
 * File Upload Middleware
 * Handles file uploads with validation and security
 */

import multer from 'multer';
import path from 'path';
import { Request } from 'express';

// Configure multer for file uploads
const storage = multer.memoryStorage();

// File filter for security
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allowed file types
  const allowedTypes = [
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    
    // Code files
    'text/javascript',
    'application/javascript',
    'text/x-python',
    'text/x-java-source',
    'text/x-c++src',
    'text/x-csrc',
    'text/x-php',
    'text/x-ruby',
    'text/x-go',
    'text/x-rust',
    'application/json',
    'text/xml',
    
    // Archives
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/x-tar',
    'application/gzip',
    
    // Video/Audio
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/wmv',
    'audio/mp3',
    'audio/wav',
    'audio/m4a',
    'audio/ogg'
  ];

  // Check file extension as secondary validation
  const allowedExtensions = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.txt', '.csv', '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.js', '.ts', '.py', '.java', '.cpp', '.c', '.php', '.rb',
    '.go', '.rs', '.json', '.xml', '.zip', '.rar', '.7z', '.tar',
    '.gz', '.mp4', '.avi', '.mov', '.wmv', '.mp3', '.wav', '.m4a', '.ogg'
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} or extension ${ext} is not allowed`));
  }
};

// Configure multer
export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
    files: 10, // Max 10 files per request
  }
});

// Single file upload middleware
export const uploadSingle = (fieldName: string) => uploadMiddleware.single(fieldName);

// Multiple files upload middleware
export const uploadMultiple = (fieldName: string, maxCount: number) => 
  uploadMiddleware.array(fieldName, maxCount);

// Custom file upload middleware with additional validation
export const uploadWithValidation = (options: {
  maxFileSize?: number;
  maxFiles?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
}) => {
  return multer({
    storage: multer.memoryStorage(),
    fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
      const allowedTypes = options.allowedTypes || [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'image/jpeg',
        'image/png',
        'application/zip'
      ];
      
      const allowedExtensions = options.allowedExtensions || [
        '.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.zip'
      ];

      const ext = path.extname(file.originalname).toLowerCase();
      
      if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`File type ${file.mimetype} or extension ${ext} is not allowed`));
      }
    },
    limits: {
      fileSize: options.maxFileSize || 50 * 1024 * 1024, // Default 50MB
      files: options.maxFiles || 5, // Default 5 files
    }
  });
};
