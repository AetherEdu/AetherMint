/**
 * Pagination Middleware — Issue #257
 *
 * Express middleware that parses and validates cursor-based pagination,
 * sorting, and filtering query parameters on list endpoints.
 *
 * Usage:
 *   import { paginationMiddleware } from '../middleware/pagination';
 *   router.get('/items', paginationMiddleware('courses'), handler);
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { listQuerySchema } from './schemas/paginationSchemas';
import {
  PaginationParams,
  ListFilters,
  parsePaginationParams,
  parseFilters,
} from '../utils/pagination';
import { ValidationError } from '../utils/errors';

/** Augmented request that carries parsed pagination + filter data */
export interface PaginatedRequest extends Request {
  pagination: PaginationParams & { resource: string };
  listFilters: ListFilters;
}

/**
 * Factory that returns a middleware which:
 *   1. Validates query parameters against the standard schema
 *   2. Attaches `req.pagination` and `req.listFilters` for downstream use
 *
 * @param resource - Logical resource name (e.g. 'enrollments', 'courses')
 *                   used to whitelist sort fields.
 */
export function paginationMiddleware(resource: string): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // Validate against Joi schema
    const { error, value } = listQuerySchema.validate(req.query, {
      abortEarly: false,
      allowUnknown: true,
      stripUnknown: false,
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      }));
      return next(new ValidationError('Invalid pagination parameters', details));
    }

    // Parse into typed structures
    const pagination = parsePaginationParams(value);
    const filters = parseFilters(value);

    // Attach to request
    ;(req as PaginatedRequest).pagination = { ...pagination, resource };
    ;(req as PaginatedRequest).listFilters = filters;

    next();
  };
}
