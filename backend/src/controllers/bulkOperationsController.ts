/**
 * Bulk Operations Controller
 * Handles HTTP requests for bulk admin operations:
 * - Bulk credential issuance
 * - Bulk course enrollment  
 * - Bulk user import (CSV/JSON)
 *
 * Issue: #262
 */

import { Request, Response, NextFunction } from 'express';
import { BulkOperationService, BulkCredentialInput, BulkEnrollmentInput, BulkUserImportInput } from '../services/BulkOperationService';
import logger from '../utils/logger';

const bulkOperationService = new BulkOperationService();

/**
 * POST /api/admin/bulk/credentials
 * Initiate bulk credential issuance.
 */
export const bulkCredentialIssuance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { credentials } = req.body;

    if (!Array.isArray(credentials) || credentials.length === 0) {
      res.status(400).json({ success: false, error: 'credentials array is required and must not be empty' });
      return;
    }

    if (credentials.length > 1000) {
      res.status(400).json({ success: false, error: 'Maximum of 1000 credentials per bulk request' });
      return;
    }

    // Validate each item
    const validationErrors: string[] = [];
    credentials.forEach((item: any, index: number) => {
      if (!item.recipientId) validationErrors.push(`Item ${index}: recipientId is required`);
      if (!item.credentialType) validationErrors.push(`Item ${index}: credentialType is required`);
      if (!item.credentialHash) validationErrors.push(`Item ${index}: credentialHash is required`);
    });

    if (validationErrors.length > 0) {
      res.status(400).json({ success: false, errors: validationErrors });
      return;
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
      res.status(400).json({ success: false, error: 'enrollments array is required and must not be empty' });
      return;
    }

    if (enrollments.length > 1000) {
      res.status(400).json({ success: false, error: 'Maximum of 1000 enrollments per bulk request' });
      return;
    }

    const validationErrors: string[] = [];
    enrollments.forEach((item: any, index: number) => {
      if (!item.userId) validationErrors.push(`Item ${index}: userId is required`);
      if (!item.courseId) validationErrors.push(`Item ${index}: courseId is required`);
    });

    if (validationErrors.length > 0) {
      res.status(400).json({ success: false, errors: validationErrors });
      return;
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
      res.status(400).json({
        success: false,
        error: 'Either users (JSON array) or csvData (CSV string) is required',
      });
      return;
    }

    if (inputs.length === 0) {
      res.status(400).json({ success: false, error: 'No users to import' });
      return;
    }

    if (inputs.length > 10000) {
      res.status(400).json({ success: false, error: 'Maximum of 10000 users per bulk import' });
      return;
    }

    // Validate each item
    const validationErrors: string[] = [];
    inputs.forEach((item, index) => {
      if (!item.email) validationErrors.push(`Item ${index}: email is required`);
      if (!item.username) validationErrors.push(`Item ${index}: username is required`);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (item.email && !emailRegex.test(item.email)) {
        validationErrors.push(`Item ${index}: invalid email format "${item.email}"`);
      }
    });

    if (validationErrors.length > 0) {
      res.status(400).json({ success: false, errors: validationErrors });
      return;
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
      res.status(404).json({ success: false, error: 'Bulk operation not found' });
      return;
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
