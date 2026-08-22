/**
 * Shared Pagination Utility — Issue #257
 *
 * Implements cursor-based pagination, filtering, and sorting standards
 * for all AetherMint list endpoints.
 *
 * Standard query parameters: limit, cursor, sort, order, filter
 * Standard response metadata: next_cursor, total_count, has_more
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Standard pagination parameters parsed from query string */
export interface PaginationParams {
  /** Maximum number of items to return (1–100, default 20) */
  limit: number;
  /** Opaque cursor returned by a previous page; omit / null for first page */
  cursor: string | null;
  /** Field to sort by */
  sort: string;
  /** Sort direction */
  order: 'asc' | 'desc';
}

/** Shape of the pagination metadata in every list response */
export interface PaginationMeta {
  /** Opaque cursor to fetch the next page, or null if this is the last page */
  next_cursor: string | null;
  /** Total number of matching records (may be approximate for performance) */
  total_count: number;
  /** Whether additional pages exist after this one */
  has_more: boolean;
}

/** Standardised filter shape accepted by list endpoints */
export interface ListFilters {
  /** Free-text search across indexed fields */
  search?: string;
  /** Filter by resource status (e.g. 'active', 'archived') */
  status?: string | string[];
  /** Records created on or after this ISO-8601 date */
  created_after?: string;
  /** Records created before this ISO-8601 date */
  created_before?: string;
  /** Filter by resource type */
  type?: string | string[];
  /** Arbitrary additional filters keyed by field name */
  [key: string]: unknown;
}

/** Generic paginated response envelope */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const PAGINATION_DEFAULTS = {
  LIMIT_MIN: 1,
  LIMIT_MAX: 100,
  LIMIT_DEFAULT: 20,
  ORDER_DEFAULT: 'desc' as const,
} as const;

export const ALLOWED_SORT_FIELDS: Record<string, string[]> = {
  // Registered per-resource sort fields so the middleware can whitelist.
  // Controllers expand this map at import time.
  default: ['createdAt', 'updatedAt', 'id'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Encode a value into a cursor string.
 *
 * The cursor is opaque to clients; it encodes the sort-field value of the
 * last item on the current page so the next query knows where to resume.
 */
export function encodeCursor(fieldValue: string | number | Date): string {
  const raw = typeof fieldValue === 'string' ? fieldValue : String(fieldValue);
  return Buffer.from(raw, 'utf-8').toString('base64url');
}

/**
 * Decode a cursor string back to its original value.
 * Returns `null` when the cursor is malformed.
 */
export function decodeCursor(cursor: string): string | null {
  try {
    return Buffer.from(cursor, 'base64url').toString('utf-8');
  } catch {
    return null;
  }
}

/**
 * Build a standard {@link PaginationMeta} object from query results.
 *
 * @param items     - The array of items returned for the current page
 * @param totalCount- Total matching records (may be approximate)
 * @param limit     - The page size requested
 * @param sortField - The field used for ordering
 */
export function buildPaginationMeta<T extends Record<string, unknown>>(
  items: T[],
  totalCount: number,
  limit: number,
  sortField: string,
): PaginationMeta {
  const has_more = items.length === limit;
  const next_cursor =
    has_more && items.length > 0
      ? encodeCursor(items[items.length - 1][sortField] as string | number | Date)
      : null;

  return { next_cursor, total_count: totalCount, has_more };
}

/**
 * Build a standard paginated success response body.
 */
export function buildPaginatedResponse<T extends Record<string, unknown>>(
  items: T[],
  meta: PaginationMeta,
): PaginatedResponse<T> {
  return {
    success: true,
    data: items,
    pagination: meta,
  };
}

/**
 * Register allowed sort fields for a resource.
 *
 * @example
 *   registerSortFields('enrollments', ['enrolledAt', 'status', 'courseId']);
 */
export function registerSortFields(resource: string, fields: string[]): void {
  ALLOWED_SORT_FIELDS[resource] = fields;
}

/**
 * Resolve the sort field for a resource, falling back to the default list
 * when the resource has no registered fields.
 */
export function resolveSortField(resource: string, requested: string): string {
  const allowed = ALLOWED_SORT_FIELDS[resource] ?? ALLOWED_SORT_FIELDS.default;
  return allowed.includes(requested) ? requested : allowed[0];
}

/**
 * Parse and normalise pagination query parameters with safe defaults.
 */
export function parsePaginationParams(query: Record<string, unknown>): PaginationParams {
  const limit = clamp(
    Number(query.limit) || PAGINATION_DEFAULTS.LIMIT_DEFAULT,
    PAGINATION_DEFAULTS.LIMIT_MIN,
    PAGINATION_DEFAULTS.LIMIT_MAX,
  );

  return {
    limit,
    cursor: typeof query.cursor === 'string' && query.cursor.length > 0 ? query.cursor : null,
    sort: typeof query.sort === 'string' ? query.sort : 'createdAt',
    order: query.order === 'asc' ? 'asc' : PAGINATION_DEFAULTS.ORDER_DEFAULT,
  };
}

/**
 * Parse filter parameters from query string into a structured filters object.
 */
export function parseFilters(query: Record<string, unknown>): ListFilters {
  const filters: ListFilters = {};

  if (typeof query.search === 'string' && query.search.trim()) {
    filters.search = query.search.trim();
  }
  if (typeof query.status === 'string') {
    filters.status = query.status.includes(',') ? query.status.split(',') : query.status;
  }
  if (typeof query.type === 'string') {
    filters.type = query.type.includes(',') ? query.type.split(',') : query.type;
  }
  if (typeof query.created_after === 'string') {
    filters.created_after = query.created_after;
  }
  if (typeof query.created_before === 'string') {
    filters.created_before = query.created_before;
  }

  return filters;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return PAGINATION_DEFAULTS.LIMIT_DEFAULT;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
