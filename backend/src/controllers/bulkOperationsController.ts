/**
 * Bulk Operations Controller
 * Handles HTTP requests for bulk admin operations:
 * - Bulk credential issuance
 * - Bulk course enrollment
 * - Bulk user import (CSV/JSON)
 *
 * Issues: #262 (bulk ops), #254 (RFC 7807 error envelopes).
 */

import { Request, Response, NextFunction } from 'express';
import { BulkOperationService, BulkCredentialInput, BulkEnrollmentInput, BulkUserImportInput } from '../services/BulkOperationService';
import logger from '../utils/logger';
import { ValidationError, NotFoundError } from '../utils/errors';

const bulkOperationService = new BulkOperationService();

/**
 * POST /api/admin/bulk/credentials
 * Initiate bulk credential issuance.
 */
export const bulkCredentialIssuance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { credentials } = req.body;

    if (!Array.isArray(credentials) || credentials.length === 0) {
      return next(new ValidationError('credentials array is required and must not be empty'));
    }

    if (credentials.length > 1000) {
      return next(
        new ValidationError('Maximum of 1000 credentials per bulk request', {
          limit: 1000,
          received: credentials.length,
        }),
      );
    }

    // Validate each item
    const validationErrors: { field: string; message: string }[] = [];
    credentials.forEach((item: any, index: number) => {
      if (!item.recipientId) {
        validationErrors.push({ field: `[${index}].recipientId`, message: 'recipientId is required' });
      }
      if (!item.credentialType) {
        validationErrors.push({ field: `[${index}].credentialType`, message: 'credentialType is required' });
      }
      if (!item.credentialHash) {
        validationErrors.push({ field: `[${index}].credentialHash`, message: 'credentialHash is required' });
      }
    });

    if (validationErrors.length > 0) {
      return next(new ValidationError('Bulk credential validation failed', validationErrors));
    }

    const inputs: BulkCredentialInput[] = credentials.map((c: any) => ({
      recipientId: c.recipientId,
      credentialType: c.credentialType,
      credentialHash: c.credentialHash,
      metadata: c.metadata || {},
      releaseTime: c.releaseTime,
    }));

    const operation = await bulkOperationService.bulkCredentialIssuance(inputs);

    res.status(202).json({
      success: true,
      data: {
        operationId: operation.id,
        status: operation.status,
        totalItems: operation.totalItems,
        message: 'Bulk credential issuance queued. Poll /api/admin/bulk/operations/:id for progress.',
      },
    });
  } catch (error) {
    logger.error('Bulk credential issuance error', error as Error);
    next(error);
  }
};

/**
 * POST /api/admin/bulk/enrollments
 * Initiate bulk course enrollment.
 */
export const bulkCourseEnrollment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { enrollments } = req.body;

    if (!Array.isArray(enrollments) || enrollments.length === 0) {
      return next(new ValidationError('enrollments array is required and must not be empty'));
    }

    if (enrollments.length > 1000) {
      return next(
        new ValidationError('Maximum of 1000 enrollments per bulk request', {
          limit: 1000,
          received: enrollments.length,
        }),
      );
    }

    const validationErrors: { field: string; message: string }[] = [];
    enrollments.forEach((item: any, index: number) => {
      if (!item.userId) {
        validationErrors.push({ field: `[${index}].userId`, message: 'userId is required' });
      }
      if (!item.courseId) {
        validationErrors.push({ field: `[${index}].courseId`, message: 'courseId is required' });
      }
    });

    if (validationErrors.length > 0) {
      return next(new ValidationError('Bulk enrollment validation failed', validationErrors));
    }

    const inputs: BulkEnrollmentInput[] = enrollments.map((e: any) => ({
      userId: e.userId,
      courseId: e.courseId,
      paymentMethod: e.paymentMethod,
      metadata: e.metadata,
    }));

    const operation = await bulkOperationService.bulkCourseEnrollment(inputs);

    res.status(202).json({
      success: true,
      data: {
        operationId: operation.id,
        status: operation.status,
        totalItems: operation.totalItems,
        message: 'Bulk enrollment queued. Poll /api/admin/bulk/operations/:id for progress.',
      },
    });
  } catch (error) {
    logger.error('Bulk enrollment error', error as Error);
    next(error);
  }
};

/**
 * POST /api/admin/bulk/users
 * Initiate bulk user import (CSV or JSON payload).
 *
 * Supports both CSV text and JSON array formats.
 */
export const bulkUserImport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { users, csvData } = req.body;
    let inputs: BulkUserImportInput[] = [];

    if (csvData && typeof csvData === 'string') {
      // Parse CSV
      inputs = parseCSV(csvData);
    } else if (Array.isArray(users)) {
      inputs = users.map((u: any) => ({
        email: u.email,
        username: u.username,
        role: u.role,
        address: u.address,
        metadata: u.metadata || {},
      }));
    } else {
      return next(
        new ValidationError('Either users (JSON array) or csvData (CSV string) is required'),
      );
    }

    if (inputs.length === 0) {
      return next(new ValidationError('No users to import'));
    }

    if (inputs.length > 10000) {
      return next(
        new ValidationError('Maximum of 10000 users per bulk import', {
          limit: 10000,
          received: inputs.length,
        }),
      );
    }

    // Validate each item
    const validationErrors: { field: string; message: string }[] = [];
    inputs.forEach((item, index) => {
      if (!item.email) {
        validationErrors.push({ field: `[${index}].email`, message: 'email is required' });
      }
      if (!item.username) {
        validationErrors.push({ field: `[${index}].username`, message: 'username is required' });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (item.email && !emailRegex.test(item.email)) {
        validationErrors.push({ field: `[${index}].email`, message: `invalid email format "${item.email}"` });
      }
    });

    if (validationErrors.length > 0) {
      return next(new ValidationError('Bulk user import validation failed', validationErrors));
    }

    const operation = await bulkOperationService.bulkUserImport(inputs);

    res.status(202).json({
      success: true,
      data: {
        operationId: operation.id,
        status: operation.status,
        totalItems: operation.totalItems,
        message: 'Bulk user import queued. Poll /api/admin/bulk/operations/:id for progress.',
      },
    });
  } catch (error) {
    logger.error('Bulk user import error', error as Error);
    next(error);
  }
};

/**
 * GET /api/admin/bulk/operations/:id
 * Get status of a bulk operation by its ID.
 */
export const getOperationStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const operation = bulkOperationService.getOperationStatus(id);

    if (!operation) {
      return next(new NotFoundError('Bulk operation not found'));
    }

    res.json({ success: true, data: operation });
  } catch (error) {
    logger.error('Get bulk operation error', error as Error);
    next(error);
  }
};

/**
 * GET /api/admin/bulk/operations
 * List all bulk operations.
 */
export const listOperations = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const operations = bulkOperationService.listOperations();
    res.json({ success: true, data: operations });
  } catch (error) {
    logger.error('List bulk operations error', error as Error);
    next(error);
  }
};

/**
 * CSV parser for admin bulk import.
 * Expects header row: email,username,role,address
 * Handles quoted fields, Windows line endings, and empty lines.
 */
function parseCSV(csvData: string): BulkUserImportInput[] {
  // Normalize line endings (handle \r\n and \r)
  const normalized = csvData.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const emailIndex = headers.indexOf('email');
  const usernameIndex = headers.indexOf('username');
  const roleIndex = headers.indexOf('role');
  const addressIndex = headers.indexOf('address');

  if (emailIndex === -1 || usernameIndex === -1) {
    throw new Error('CSV must contain at least "email" and "username" columns');
  }

  const results: BulkUserImportInput[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < Math.max(emailIndex, usernameIndex) + 1) continue;

    results.push({
      email: cols[emailIndex]?.trim() || '',
      username: cols[usernameIndex]?.trim() || '',
      role: roleIndex >= 0 ? cols[roleIndex]?.trim() || undefined : undefined,
      address: addressIndex >= 0 ? cols[addressIndex]?.trim() || undefined : undefined,
      metadata: {},
    });
  }
  return results;
}

/**
 * Parse a single CSV line handling quoted fields.
 * e.g., "Smith, John",jane@test.com,admin -> ['Smith, John', 'jane@test.com', 'admin']
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}
