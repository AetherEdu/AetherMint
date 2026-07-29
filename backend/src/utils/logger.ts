/**
 * Logger Utility
 * Centralized structured logging service using Winston.
 */

import { getRequestContext, runWithRequestContext, type RequestContext } from './requestContext';
import fs from 'fs';
import path from 'path';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'debug';

const levels: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const logDirectory = path.join(process.cwd(), 'logs');
const logLevel = process.env.LOG_LEVEL || 'info';
const isDevelopment = process.env.NODE_ENV !== 'production';
const sensitiveKeyPattern = /(password|passphrase|token|accessToken|refreshToken|secret|apiKey|authorization|cookie|session)/i;

fs.mkdirSync(logDirectory, { recursive: true });

interface SerializedError {
  name: string;
  message: string;
  stack: string | undefined;
  cause: SerializedError | unknown;
}

const serializeError = (error: Error): SerializedError => ({
  name: error.name,
  message: error.message,
  stack: isDevelopment ? error.stack : undefined,
  cause: (error as Error & { cause?: unknown }).cause instanceof Error
    ? serializeError((error as Error & { cause?: Error }).cause as Error)
    : (error as Error & { cause?: unknown }).cause,
});

const redactString = (value: string) => value
  .replace(/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, '$1[REDACTED]')
  .replace(/(["']?(?:password|passphrase|secret|token|accessToken|refreshToken|apiKey|authorization|cookie|session)["']?\s*[:=]\s*["'])([^"']+)(["'])/gi, '$1[REDACTED]$3');

const redactValue = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (typeof value === 'string') {
    return redactString(value);
  }

  if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value;
  }

  if (value instanceof Error) {
    return serializeError(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return `[Buffer length=${value.length}]`;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);

    const output: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      if (sensitiveKeyPattern.test(key)) {
        output[key] = '[REDACTED]';
        continue;
      }

      output[key] = redactValue(nestedValue, seen);
    }

    return output;
  }

  return value;
};

const mergeMeta = (meta: unknown[]): Record<string, unknown> => {
  const normalized: Record<string, unknown> = {};

  meta.forEach((item, index) => {
    if (item === undefined) {
      return;
    }

    if (item instanceof Error) {
      normalized.error = serializeError(item);
      return;
    }

    const redacted = redactValue(item);

    if (redacted && typeof redacted === 'object' && !Array.isArray(redacted)) {
      Object.assign(normalized, redacted);
      return;
    }

    normalized[`meta${index}`] = redacted;
  });

  return normalized;
};

const buildLoggerEntry = (level: LogLevel, message: unknown, meta: unknown[]) => {
  const context = getRequestContext();
  const entry: Record<string, unknown> = {
    level,
    message: redactValue(message),
    ...mergeMeta(meta),
  };

  if (context) {
    Object.assign(entry, redactValue(context));
  }

  return entry;
};

const format = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const transports = [
  new winston.transports.Console(),
  new DailyRotateFile({
    filename: path.join(logDirectory, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '14d',
    zippedArchive: true,
  }),
  new DailyRotateFile({
    filename: path.join(logDirectory, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '14d',
    zippedArchive: true,
    level: 'error',
  }),
];

const baseLogger = winston.createLogger({
  level: logLevel,
  levels,
  format,
  transports,
});

const createLoggerMethod = (level: LogLevel) => (message: unknown, ...meta: unknown[]) => {
  baseLogger.log(buildLoggerEntry(level, message, meta) as winston.LogEntry);
};

const logger = {
  error: createLoggerMethod('error'),
  warn: createLoggerMethod('warn'),
  info: createLoggerMethod('info'),
  http: createLoggerMethod('http'),
  debug: createLoggerMethod('debug'),
  log: (level: LogLevel, message: unknown, ...meta: unknown[]) => {
    baseLogger.log(buildLoggerEntry(level, message, meta) as winston.LogEntry);
  },
};

export { getRequestContext, runWithRequestContext, type RequestContext };

export default logger;
