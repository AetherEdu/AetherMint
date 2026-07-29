/**
 * Bulk Operation Service
 * Handles business logic for bulk admin operations:
 * - Bulk credential issuance
 * - Bulk course enrollment
 * - Bulk user import (CSV/JSON)
 *
 * Supports async processing with progress tracking and per-item validation/error reporting.
 */

import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

export type BulkOperationType = 'credential_issuance' | 'course_enrollment' | 'user_import';

export type BulkOperationStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'partially_completed';

export interface BulkOperationResult {
  id: string;
  type: BulkOperationType;
  status: BulkOperationStatus;
  totalItems: number;
  processedItems: number;
  succeededItems: number;
  failedItems: number;
  errors: BulkItemError[];
  progress: number; // 0-100
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface BulkItemError {
  index: number;
  identifier: string;
  message: string;
}

export interface BulkCredentialInput {
  recipientId: string;
  credentialType: string;
  credentialHash: string;
  metadata: Record<string, any>;
  releaseTime?: string; // ISO timestamp for time-locked credentials
}

export interface BulkEnrollmentInput {
  userId: string;
  courseId: string;
  paymentMethod?: string;
  metadata?: Record<string, any>;
}

export interface BulkUserImportInput {
  email: string;
  username: string;
  role?: string;
  address?: string;
  metadata?: Record<string, any>;
}

// ---------------------------------------------------------------
// Service
// ---------------------------------------------------------------

export class BulkOperationService {
  private operations: Map<string, BulkOperationResult> = new Map();
  private processingTasks: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Initiate a bulk credential issuance operation.
   * Returns the operation ID for async progress tracking.
   */
  async bulkCredentialIssuance(inputs: BulkCredentialInput[]): Promise<BulkOperationResult> {
    const operation = this.createOperation('credential_issuance', inputs.length);
    this.scheduleProcessing(operation.id, async () => {
      for (let i = 0; i < inputs.length; i++) {
        try {
          await this.processCredentialItem(inputs[i]);
          this.markItemSucceeded(operation.id);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          this.markItemFailed(operation.id, i, inputs[i].recipientId, message);
        }
      }
      this.finalizeOperation(operation.id);
    });
    return operation;
  }

  /**
   * Initiate a bulk course enrollment operation.
   */
  async bulkCourseEnrollment(inputs: BulkEnrollmentInput[]): Promise<BulkOperationResult> {
    const operation = this.createOperation('course_enrollment', inputs.length);
    this.scheduleProcessing(operation.id, async () => {
      for (let i = 0; i < inputs.length; i++) {
        try {
          await this.processEnrollmentItem(inputs[i]);
          this.markItemSucceeded(operation.id);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          this.markItemFailed(operation.id, i, inputs[i].userId, message);
        }
      }
      this.finalizeOperation(operation.id);
    });
    return operation;
  }

  /**
   * Initiate a bulk user import operation.
   */
  async bulkUserImport(inputs: BulkUserImportInput[]): Promise<BulkOperationResult> {
    const operation = this.createOperation('user_import', inputs.length);
    this.scheduleProcessing(operation.id, async () => {
      for (let i = 0; i < inputs.length; i++) {
        try {
          await this.processUserImportItem(inputs[i]);
          this.markItemSucceeded(operation.id);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          this.markItemFailed(operation.id, i, inputs[i].email, message);
        }
      }
      this.finalizeOperation(operation.id);
    });
    return operation;
  }

  /**
   * Get the current status of a bulk operation by its ID.
   */
  getOperationStatus(operationId: string): BulkOperationResult | null {
    return this.operations.get(operationId) ?? null;
  }

  /**
   * List all bulk operations (for admin dashboard).
   */
  listOperations(): BulkOperationResult[] {
    return Array.from(this.operations.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  // ---------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------

  private createOperation(type: BulkOperationType, totalItems: number): BulkOperationResult {
    const op: BulkOperationResult = {
      id: uuidv4(),
      type,
      status: 'queued',
      totalItems,
      processedItems: 0,
      succeededItems: 0,
      failedItems: 0,
      errors: [],
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.operations.set(op.id, op);
    return op;
  }

  private scheduleProcessing(operationId: string, task: () => Promise<void>): void {
    // Defer execution to the next tick so the HTTP response can be sent first.
    const handle = setTimeout(async () => {
      const op = this.operations.get(operationId);
      if (op) {
        op.status = 'processing';
        op.updatedAt = new Date();
      }
      try {
        await task();
      } catch (err) {
        logger.error(`Bulk operation ${operationId} processing error`, err as Error);
        const op2 = this.operations.get(operationId);
        if (op2) {
          op2.status = 'failed';
          op2.updatedAt = new Date();
        }
      }
      this.processingTasks.delete(operationId);
    }, 0);
    this.processingTasks.set(operationId, handle);
  }

  private markItemSucceeded(operationId: string): void {
    const op = this.operations.get(operationId);
    if (!op) return;
    op.succeededItems++;
    op.processedItems++;
    op.progress = Math.round((op.processedItems / op.totalItems) * 100);
    op.updatedAt = new Date();
  }

  private markItemFailed(operationId: string, index: number, identifier: string, message: string): void {
    const op = this.operations.get(operationId);
    if (!op) return;
    op.failedItems++;
    op.processedItems++;
    op.errors.push({ index, identifier, message });
    op.progress = Math.round((op.processedItems / op.totalItems) * 100);
    op.updatedAt = new Date();
  }

  private finalizeOperation(operationId: string): void {
    const op = this.operations.get(operationId);
    if (!op) return;
    op.status = op.failedItems === 0 ? 'completed' : 'partially_completed';
    op.completedAt = new Date();
    op.updatedAt = new Date();
    logger.info(`Bulk operation ${operationId} finished`, {
      type: op.type,
      total: op.totalItems,
      succeeded: op.succeededItems,
      failed: op.failedItems,
    });
  }

  // ---------------------------------------------------------------
  // Per-item processing (stubs – replace with real service calls)
  // ---------------------------------------------------------------

  private async processCredentialItem(input: BulkCredentialInput): Promise<void> {
    // In production:
    //   1. Validate recipient exists
    //   2. Call credential issuance service/time-lock credential service
    //   3. Log event via eventLoggerService

    if (!input.recipientId || !input.credentialType || !input.credentialHash) {
      throw new Error('Missing required credential fields: recipientId, credentialType, credentialHash');
    }

    logger.info('Processing bulk credential item', { recipientId: input.recipientId, type: input.credentialType });

    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  private async processEnrollmentItem(input: BulkEnrollmentInput): Promise<void> {
    if (!input.userId || !input.courseId) {
      throw new Error('Missing required enrollment fields: userId, courseId');
    }

    logger.info('Processing bulk enrollment item', { userId: input.userId, courseId: input.courseId });

    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  private async processUserImportItem(input: BulkUserImportInput): Promise<void> {
    if (!input.email || !input.username) {
      throw new Error('Missing required user import fields: email, username');
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email)) {
      throw new Error(`Invalid email format: ${input.email}`);
    }

    logger.info('Processing bulk user import item', { email: input.email, username: input.username });

    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
