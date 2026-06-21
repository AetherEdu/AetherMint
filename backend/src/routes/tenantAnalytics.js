const express = require('express');
const tenantAnalyticsService = require('../services/tenantAnalyticsService');
const { tenantMiddleware, requireTenantPermission } = require('../middleware/tenant');
const { authenticateToken } = require('../middleware/auth');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const reportRequestSchema = Joi.object({
  reportType: Joi.string().valid('cross-tenant', 'tenant-specific', 'performance').default('summary'),
  dateRange: Joi.string().valid('7d', '30d', '90d', '1y').default('30d'),
  format: Joi.string().valid('json', 'csv', 'xlsx', 'pdf').default('json')
});

/**
 * GET /api/analytics/tenants/cross-tenant
 * Get cross-tenant analytics (admin only)
 */
router.get('/cross-tenant',
  authenticateToken,
  requireTenantPermission('analytics', 'read'),
  async (req, res) => {
    try {
      const { dateRange = '30d' } = req.query;
      
      const analytics = await tenantAnalyticsService.getCrossTenantAnalytics(dateRange);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Cross-tenant analytics error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * GET /api/analytics/tenants/:tenantId
 * Get tenant-specific analytics
 */
router.get('/:tenantId',
  tenantMiddleware,
  requireTenantPermission('analytics', 'read'),
  async (req, res) => {
    try {
      const { dateRange = '30d' } = req.query;
      
      const analytics = await tenantAnalyticsService.getTenantAnalytics(
        req.tenantId,
        dateRange
      );

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Tenant analytics error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * GET /api/analytics/tenants/:tenantId/performance
 * Get tenant performance metrics
 */
router.get('/:tenantId/performance',
  tenantMiddleware,
  requireTenantPermission('analytics', 'read'),
  async (req, res) => {
    try {
      const performance = await tenantAnalyticsService.getPerformanceMetrics(req.tenantId);

      res.json({
        success: true,
        data: performance
      });
    } catch (error) {
      console.error('Performance metrics error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * POST /api/analytics/tenants/:tenantId/reports
 * Generate analytics report for tenant
 */
router.post('/:tenantId/reports',
  tenantMiddleware,
  requireTenantPermission('analytics', 'export'),
  async (req, res) => {
    try {
      const { error, value } = reportRequestSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          details: error.details.map(d => d.message)
        });
      }

      const report = await tenantAnalyticsService.generateReport(
        req.tenantId,
        value.reportType,
        value.dateRange
      );

      res.json({
        success: true,
        message: 'Report generated successfully',
        data: report
      });
    } catch (error) {
      console.error('Generate report error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * GET /api/analytics/tenants/:tenantId/export
 * Export analytics data in various formats
 */
router.get('/:tenantId/export',
  tenantMiddleware,
  requireTenantPermission('analytics', 'export'),
  async (req, res) => {
    try {
      const { format = 'json', dateRange = '30d' } = req.query;
      
      if (!['json', 'csv', 'xlsx', 'pdf'].includes(format)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid export format'
        });
      }

      const exportedData = await tenantAnalyticsService.exportData(
        req.tenantId,
        format,
        dateRange
      );

      if (format === 'json') {
        res.json({
          success: true,
          data: exportedData
        });
      } else {
        // For other formats, set appropriate headers and send file
        res.setHeader('Content-Type', this.getContentType(format));
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="tenant-analytics-${req.tenantId}-${dateRange}.${format}"`
        );
        res.send(exportedData);
      }
    } catch (error) {
      console.error('Export data error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * POST /api/analytics/tenants/reports
 * Generate cross-tenant analytics report (admin only)
 */
router.post('/reports',
  authenticateToken,
  requireTenantPermission('analytics', 'export'),
  async (req, res) => {
    try {
      const { error, value } = reportRequestSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          details: error.details.map(d => d.message)
        });
      }

      const report = await tenantAnalyticsService.generateReport(
        null,
        value.reportType,
        value.dateRange
      );

      res.json({
        success: true,
        message: 'Cross-tenant report generated successfully',
        data: report
      });
    } catch (error) {
      console.error('Generate cross-tenant report error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * GET /api/analytics/tenants/export
 * Export cross-tenant analytics data (admin only)
 */
router.get('/export',
  authenticateToken,
  requireTenantPermission('analytics', 'export'),
  async (req, res) => {
    try {
      const { format = 'json', dateRange = '30d' } = req.query;
      
      if (!['json', 'csv', 'xlsx', 'pdf'].includes(format)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid export format'
        });
      }

      const exportedData = await tenantAnalyticsService.exportData(
        null,
        format,
        dateRange
      );

      if (format === 'json') {
        res.json({
          success: true,
          data: exportedData
        });
      } else {
        // For other formats, set appropriate headers and send file
        res.setHeader('Content-Type', this.getContentType(format));
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="cross-tenant-analytics-${dateRange}.${format}"`
        );
        res.send(exportedData);
      }
    } catch (error) {
      console.error('Export cross-tenant data error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * GET /api/analytics/tenants/performance
 * Get system performance metrics (admin only)
 */
router.get('/performance',
  authenticateToken,
  requireTenantPermission('analytics', 'read'),
  async (req, res) => {
    try {
      const performance = await tenantAnalyticsService.getPerformanceMetrics();

      res.json({
        success: true,
        data: performance
      });
    } catch (error) {
      console.error('System performance metrics error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * Helper method to get content type for export formats
 */
function getContentType(format) {
  switch (format) {
    case 'csv':
      return 'text/csv';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/json';
  }
}

module.exports = router;
