import { Request, Response } from 'express';
import { auditService, AuditQueryOptions } from '../services/auditService';
import { AuditAction, AuditResult } from '../models/AuditLog';
import logger from '../utils/logger';

export const auditController = {
  getAuditLogs: async (req: Request, res: Response) => {
    try {
      const options: AuditQueryOptions = {
        actor: req.query.actor as string,
        action: req.query.action as AuditAction,
        resource: req.query.resource as string,
        result: req.query.result as AuditResult,
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      };

      const result = await auditService.query(options);

      res.json({
        success: true,
        data: result.entries,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      logger.error('Error in getAuditLogs controller', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getAuditLogById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const entry = await auditService.getById(id);

      if (!entry) {
        return res.status(404).json({ error: 'Audit log not found' });
      }

      res.json({
        success: true,
        data: entry,
      });
    } catch (error) {
      logger.error('Error in getAuditLogById controller', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getStatistics: async (req: Request, res: Response) => {
    try {
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

      const stats = await auditService.getStatistics(
        dateFrom && dateTo ? dateFrom : undefined,
        dateFrom && dateTo ? dateTo : undefined
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error in getStatistics controller', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  archiveOldLogs: async (req: Request, res: Response) => {
    try {
      const days = req.body.days || 90;
      const archivedCount = await auditService.archiveOldLogs(days);

      res.json({
        success: true,
        data: {
          archivedCount,
          archiveBeforeDays: days,
          message: `Archived ${archivedCount} audit log entries older than ${days} days`,
        },
      });
    } catch (error) {
      logger.error('Error in archiveOldLogs controller', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
};