import { Router, Request, Response } from 'express';
import logger from '../utils/logger';

const router = Router();

/**
 * CSP Violation Reporting Endpoint
 * 
 * Accepts CSP violation reports from browsers via:
 * - POST with Content-Security-Policy-Report-Only / Content-Security-Policy report-uri
 * - Supports both JSON body and application/csp-report content types
 * 
 * Logs violations for monitoring and analysis without blocking the request
 */
router.post('/', (req: Request, res: Response) => {
  // Extract the CSP report from various possible formats
  const report = req.body?.['csp-report'] || req.body;

  // Log the violation with structured data
  logger.warn('CSP Violation Report', {
    'csp-report': report,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  // Always return 204 No Content to acknowledge receipt
  res.status(204).send();
});

/**
 * GET handler for CSP violation check (for health/status checks)
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    endpoint: 'CSP Violation Reporting',
    description: 'Accepts CSP violation reports via POST',
  });
});

export default router;