import { Request, Response, NextFunction } from 'express';
import { auditLogger } from '../utils/auditLogger';

export interface RequestWithAudit extends Request {
  auditContext?: {
    actor: string;
    resource?: string;
    action?: string;
    ipAddress?: string;
    userAgent?: string;
  };
}

export const auditMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent');

  (req as RequestWithAudit).auditContext = {
    actor: req.user?.address || 'anonymous',
    ipAddress,
    userAgent,
  };

  next();
};

export const setAuditActor = (actor: string) => {
  const context = auditLogger.getAsyncContext();
  if (context) {
    context.actor = actor;
  }
};

export const setAuditResource = (resource: string, resourceId?: string) => {
  const context = auditLogger.getAsyncContext();
  if (context) {
    context.resource = resource;
    if (resourceId) {
      (context as any).action = resourceId;
    }
  }
};