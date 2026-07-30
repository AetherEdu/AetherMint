import { AuditAction } from '../models/AuditLog';
import { auditService } from '../services/auditService';

describe('AuditService', () => {
  describe('create', () => {
    it('should create an audit log entry with success result', async () => {
      await auditService.create('test-user', AuditAction.USER_ROLE_CHANGE, 'user', {
        resourceId: 'userId-123',
        details: { role: 'admin' },
        ipAddress: '127.0.0.1',
      });
    });
  });

  describe('query', () => {
    it('should return paginated results structure', async () => {
      const result = await auditService.query({ actor: 'test-user' });
      expect(result).toHaveProperty('entries');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('totalPages');
    });

    it('should filter by date range', async () => {
      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-12-31');

      const result = await auditService.query({ dateFrom, dateTo });
      expect(result).toHaveProperty('entries');
    });
  });

  describe('getStatistics', () => {
    it('should return statistics for audit logs', async () => {
      const result = await auditService.getStatistics();
      
      expect(result).toHaveProperty('totalEntries');
      expect(result).toHaveProperty('successCount');
      expect(result).toHaveProperty('failureCount');
      expect(result).toHaveProperty('actionCounts');
      expect(result).toHaveProperty('topActors');
    });
  });
});