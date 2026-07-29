/**
 * Pagination & filter validation schemas — Issue #257
 *
 * Joi schemas for standard query parameters:
 *   limit, cursor, sort, order, filter
 */

import Joi from 'joi';

// ─── Query parameter schemas ──────────────────────────────────────────────────

/** Validates pagination query parameters */
export const paginationQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  cursor: Joi.string().optional().allow(''),
  sort: Joi.string().optional().default('createdAt'),
  order: Joi.string().valid('asc', 'desc').optional().default('desc'),
}).unknown(true); // allow additional filter params to pass through

/** Validates filter-related query parameters */
export const filterQuerySchema = Joi.object({
  search: Joi.string().optional().allow(''),
  status: Joi.string().optional(),
  type: Joi.string().optional(),
  created_after: Joi.date().iso().optional(),
  created_before: Joi.date().iso().optional(),
}).unknown(true);

/** Combined pagination + filter schema for convenience */
export const listQuerySchema = paginationQuerySchema.concat(filterQuerySchema);
