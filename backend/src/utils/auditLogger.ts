import fs from 'fs';
import path from 'path';
import { AsyncLocalStorage } from 'async_hooks';
import { AuditAction, AuditResult, IAuditLog } from '../models/AuditLog';
import logger from './logger';

const logDirectory = path.join(process.cwd(), 'logs');
const auditLogPath = path.join(logDirectory, 'audit.log');

const sensitiveFields = [
  'password',
  'passphrase',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'authorization',
  'cookie',
  'session',
  'privateKey',
  'private_key',
  'seedPhrase',
  'seed_phrase',
];

interface AuditContext {
  actor: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  result?: AuditResult;
  errorMessage?: string;
}

const auditContextStorage = new AsyncLocalStorage<AuditContext>();

const redactDetails = (details: Record<string, unknown>): Record<string, unknown> => {
  const redacted: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(details)) {
    if (sensitiveFields.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactDetails(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }
  
  return redacted;
};

const formatTimestamp = (): string => {
  return new Date().toISOString();
};

const writeToFile = (entry: AuditLogEntry): void => {
  try {
    fs.mkdirSync(logDirectory, { recursive: true });
    const logLine = JSON.stringify(entry) + '\n';
    fs.appendFileSync(auditLogPath, logLine, { encoding: 'utf8' });
  } catch (error) {
    logger.error('Failed to write audit log to file', error);
  }
};

export interface AuditLogEntry {
  timestamp: string;
  actor: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent?: string;
  result: AuditResult;
  errorMessage?: string;
}

export class AuditLogger {
  write(
    actor: string,
    action: AuditAction,
    resource: string,
    options: {
      resourceId?: string;
      details?: Record<string, unknown>;
      ipAddress?: string;
      userAgent?: string;
      result?: AuditResult;
      errorMessage?: string;
    } = {}
  ): void {
    const entry: AuditLogEntry = {
      timestamp: formatTimestamp(),
      actor,
      action,
      resource,
      resourceId: options.resourceId,
      details: redactDetails(options.details || {}),
      ipAddress: options.ipAddress || 'unknown',
      userAgent: options.userAgent,
      result: options.result || 'success',
      errorMessage: options.errorMessage,
    };

    writeToFile(entry);
    
    logger.info('Audit log entry', {
      action: entry.action,
      actor: entry.actor,
      resource: entry.resource,
      result: entry.result,
    });
  }

  logSuccess(
    actor: string,
    action: AuditAction,
    resource: string,
    options: {
      resourceId?: string;
      details?: Record<string, unknown>;
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): void {
    this.write(actor, action, resource, { ...options, result: 'success' });
  }

  logFailure(
    actor: string,
    action: AuditAction,
    resource: string,
    options: {
      resourceId?: string;
      details?: Record<string, unknown>;
      ipAddress?: string;
      userAgent?: string;
      errorMessage?: string;
    } = {}
  ): void {
    this.write(actor, action, resource, { ...options, result: 'failure' });
  }

  getAsyncContext(): AuditContext | undefined {
    return auditContextStorage.getStore();
  }

  runWithContext<T>(context: AuditContext, callback: () => T): T {
    return auditContextStorage.run(context, callback);
  }
}

export const auditLogger = new AuditLogger();