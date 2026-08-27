/**
 * Admin Audit Log Routes
 * 
 * Exposes searchable, filterable audit log queries, event details,
 * CSV/JSON exports, log statistics, and retention purging controls.
 * Restricted strictly to authorized Admins via RBAC middleware.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { auditService } from '../../services/auditService';
import { AuditAction, AuditResult } from '../../models/AuditLog';

const router = Router();

// Protect all admin audit endpoints
router.use(authenticate, requireAdmin);

/**
 * GET /api/admin/audit
 * Searchable, filterable, paginated audit logs
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { actor, action, resource, result, search, dateFrom, dateTo, page, limit } = req.query;

    const options = {
      actor: actor ? String(actor) : undefined,
      action: action ? (action as AuditAction) : undefined,
      resource: resource ? String(resource) : undefined,
      result: result ? (result as AuditResult) : undefined,
      search: search ? String(search) : undefined,
      dateFrom: dateFrom ? new Date(String(dateFrom)) : undefined,
      dateTo: dateTo ? new Date(String(dateTo)) : undefined,
      page: page ? parseInt(String(page), 10) : 1,
      limit: limit ? parseInt(String(limit), 10) : 20,
    };

    const data = await auditService.query(options);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/audit/stats
 * Aggregate audit statistics for dashboard metrics
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dateFrom, dateTo } = req.query;

    const stats = await auditService.getStatistics(
      dateFrom ? new Date(String(dateFrom)) : undefined,
      dateTo ? new Date(String(dateTo)) : undefined
    );

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/audit/export
 * Export filtered audit logs in CSV or JSON format
 */
router.get('/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { format = 'csv', actor, action, resource, result, search, dateFrom, dateTo } = req.query;

    const exportFormat = String(format).toLowerCase() === 'json' ? 'json' : 'csv';

    const options = {
      actor: actor ? String(actor) : undefined,
      action: action ? (action as AuditAction) : undefined,
      resource: resource ? String(resource) : undefined,
      result: result ? (result as AuditResult) : undefined,
      search: search ? String(search) : undefined,
      dateFrom: dateFrom ? new Date(String(dateFrom)) : undefined,
      dateTo: dateTo ? new Date(String(dateTo)) : undefined,
    };

    const content = await auditService.exportLogs(options, exportFormat);
    const filename = `audit_logs_${new Date().toISOString().split('T')[0]}.${exportFormat}`;

    if (exportFormat === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }

    res.send(content);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/audit/purge
 * Retention & purging control for old audit events
 */
router.post('/purge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { retentionDays = 90 } = req.body;
    const days = parseInt(String(retentionDays), 10);

    if (isNaN(days) || days < 1) {
      res.status(400).json({
        success: false,
        error: 'Invalid retentionDays parameter. Must be a positive number.',
      });
      return;
    }

    const deletedCount = await auditService.purgeOldLogs(days);

    res.json({
      success: true,
      message: `Successfully purged ${deletedCount} audit logs older than ${days} days.`,
      data: {
        deletedCount,
        retentionDays: days,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/audit/:id
 * Retrieve single event details (including before/after state changes)
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await auditService.getById(req.params.id);

    if (!entry) {
      res.status(404).json({
        success: false,
        error: 'Audit log entry not found',
      });
      return;
    }

    res.json({
      success: true,
      data: entry,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
