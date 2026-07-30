/**
 * Bulk Operations Tests
 * Tests for bulk credential issuance, enrollment, and user import endpoints.
 *
 * Issue: #262
 */

import { BulkOperationService } from '../services/BulkOperationService';

describe('BulkOperationService', () => {
  let service: BulkOperationService;

  beforeEach(() => {
    service = new BulkOperationService();
  });

  describe('bulkCredentialIssuance', () => {
    it('should create a queued operation and return its ID', async () => {
      const inputs = [
        {
          recipientId: 'user-1',
          credentialType: 'course-completion',
          credentialHash: 'abc123hash',
          metadata: { courseId: 'course-1' },
        },
        {
          recipientId: 'user-2',
          credentialType: 'course-completion',
          credentialHash: 'def456hash',
          metadata: { courseId: 'course-2' },
        },
      ];

      const operation = await service.bulkCredentialIssuance(inputs);

      expect(operation.id).toBeDefined();
      expect(operation.type).toBe('credential_issuance');
      expect(operation.totalItems).toBe(2);
      expect(['queued', 'processing']).toContain(operation.status);
    });

    it('should track progress as items are processed', async () => {
      const inputs = Array.from({ length: 5 }, (_, i) => ({
        recipientId: `user-${i}`,
        credentialType: 'test',
        credentialHash: `hash-${i}`,
        metadata: {},
      }));

      const operation = await service.bulkCredentialIssuance(inputs);

      // Wait for async processing to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      const status = service.getOperationStatus(operation.id);
      expect(status).not.toBeNull();
      expect(status!.totalItems).toBe(5);
      expect(['completed', 'partially_completed']).toContain(status!.status);
    });
  });

  describe('bulkCourseEnrollment', () => {
    it('should create a queued operation for enrollments', async () => {
      const inputs = [
        { userId: 'user-1', courseId: 'course-1' },
        { userId: 'user-2', courseId: 'course-2' },
      ];

      const operation = await service.bulkCourseEnrollment(inputs);

      expect(operation.type).toBe('course_enrollment');
      expect(operation.totalItems).toBe(2);
    });

    it('should report errors for invalid inputs gracefully', async () => {
      const inputs = [
        { userId: 'user-valid', courseId: 'course-valid' },
        { userId: '', courseId: '' }, // invalid - will fail during processing
      ];

      const operation = await service.bulkCourseEnrollment(inputs);
      await new Promise(resolve => setTimeout(resolve, 200));

      const status = service.getOperationStatus(operation.id)!;
      expect(status.failedItems).toBeGreaterThanOrEqual(1);
      expect(status.errors.length).toBeGreaterThanOrEqual(1);
      expect(status.errors[0].identifier).toBe('');
    });
  });

  describe('bulkUserImport', () => {
    it('should create a queued operation for user import', async () => {
      const inputs = [
        { email: 'alice@example.com', username: 'alice', metadata: {} },
        { email: 'bob@example.com', username: 'bob', metadata: {} },
      ];

      const operation = await service.bulkUserImport(inputs);

      expect(operation.type).toBe('user_import');
      expect(operation.totalItems).toBe(2);
    });

    it('should fail items with invalid email format', async () => {
      const inputs = [
        { email: 'valid@example.com', username: 'valid-user', metadata: {} },
        { email: 'not-an-email', username: 'bad-email', metadata: {} },
      ];

      const operation = await service.bulkUserImport(inputs);
      await new Promise(resolve => setTimeout(resolve, 200));

      const status = service.getOperationStatus(operation.id)!;
      expect(status.failedItems).toBeGreaterThanOrEqual(1);
    });

    it('should handle large imports', async () => {
      const inputs = Array.from({ length: 50 }, (_, i) => ({
        email: `user${i}@example.com`,
        username: `user${i}`,
        metadata: {},
      }));

      const operation = await service.bulkUserImport(inputs);
      expect(operation.totalItems).toBe(50);
    });
  });

  describe('getOperationStatus', () => {
    it('should return null for unknown operation ID', () => {
      expect(service.getOperationStatus('nonexistent-id')).toBeNull();
    });

    it('should return the operation for a valid ID', async () => {
      const inputs = [{ recipientId: 'u1', credentialType: 't', credentialHash: 'h', metadata: {} }];
      const op = await service.bulkCredentialIssuance(inputs);

      const status = service.getOperationStatus(op.id);
      expect(status).not.toBeNull();
      expect(status!.id).toBe(op.id);
    });
  });

  describe('listOperations', () => {
    it('should return all operations ordered by creation (newest first)', async () => {
      const inputs = [{ recipientId: 'u1', credentialType: 't', credentialHash: 'h', metadata: {} }];
      await service.bulkCredentialIssuance(inputs);
      await service.bulkCourseEnrollment([{ userId: 'u1', courseId: 'c1' }]);

      const ops = service.listOperations();
      expect(ops.length).toBeGreaterThanOrEqual(2);
      expect(new Date(ops[0].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(ops[1].createdAt).getTime()
      );
    });
  });
});
