/**
 * API Versioning Middleware
 *
 * Implements URL-based API versioning (e.g., /api/v1/...) with standard
 * deprecation and sunset HTTP headers to manage the lifecycle of old
 * API versions.
 *
 * Strategy:
 *   - Current stable version: v1
 *   - Non-versioned /api/* routes receive deprecation headers pointing
 *     clients toward the versioned /api/v1/* equivalents.
 *   - A backward-compatibility period is defined below so consumers have
 *     ample time to migrate.
 *
 * Sunset & Deprecation headers follow RFC 8594 conventions:
 *   - Deprecation:  date the endpoint was marked deprecated
 *   - Sunset:       date after which the endpoint may be removed
 *   - Link:         relation pointing to the replacement (versioned) endpoint
 */

import { Request, Response, NextFunction } from 'express';

// ─── Configuration ────────────────────────────────────────────────────────────

export const API_VERSIONS = {
  CURRENT: 'v1',
  SUPPORTED: ['v1'] as string[],
} as const;

/**
 * Backward-compatibility period (calendar dates).
 *
 * - DEPRECATION_DATE:  the date when non-versioned /api/* routes were
 *   formally marked deprecated.
 * - SUNSET_DATE:       the date after which non-versioned /api/* routes
 *   MAY be removed. Clients should migrate to /api/v1/* before this date.
 *
 * These dates are in ISO 8601 (YYYY-MM-DD) format.
 */
export const COMPATIBILITY_PERIOD = {
  DEPRECATION_DATE: '2026-07-28',
  SUNSET_DATE: '2027-01-28', // 6-month backward-compatibility window
} as const;

// ─── Version Resolution ───────────────────────────────────────────────────────

/**
 * Extract the API version from a URL path.
 * Returns the version string (e.g., "v1") or null if the path is not versioned.
 */
export function extractVersionFromPath(path: string): string | null {
  const match = path.match(/^\/api\/(v\d+)\/?/);
  return match ? match[1] : null;
}

/**
 * Check whether a given version string is supported by this server.
 */
export function isVersionSupported(version: string): boolean {
  return API_VERSIONS.SUPPORTED.includes(version);
}

// ─── Version Middleware ───────────────────────────────────────────────────────

/**
 * Middleware that sets the X-API-Version response header.
 * Place this on every route group so responses always indicate which
 * version of the API was used to serve the request.
 */
export function apiVersionHeader(req: Request, res: Response, next: NextFunction): void {
  const version = extractVersionFromPath(req.path);
  res.setHeader('X-API-Version', version || API_VERSIONS.CURRENT);
  next();
}

/**
 * Middleware that attaches deprecation and sunset headers to non-versioned
 * /api/* routes (i.e., routes served under /api/ without a /api/v1/ prefix).
 *
 * Headers set:
 *   - Deprecation: RFC 8594
 *   - Sunset:      RFC 8594
 *   - Link:        relation="deprecation"
 *
 * Place this on the old /api/* route mounts to gently warn consumers.
 */
export function deprecationHeaders(req: Request, res: Response, next: NextFunction): void {
  const version = extractVersionFromPath(req.path);
  if (version) {
    next();
    return;
  }

  res.setHeader('Deprecation', COMPATIBILITY_PERIOD.DEPRECATION_DATE);
  res.setHeader('Sunset', COMPATIBILITY_PERIOD.SUNSET_DATE);

  const versionedPath = req.path.replace(/^\/api/, `/api/${API_VERSIONS.CURRENT}`);
  res.setHeader(
    'Link',
    `<${versionedPath}>; rel="deprecation"; type="application/json"`,
  );

  next();
}

/**
 * Combined middleware applying both version header and deprecation headers.
 */
export function versioningMiddleware(req: Request, res: Response, next: NextFunction): void {
  apiVersionHeader(req, res, () => {
    deprecationHeaders(req, res, next);
  });
}

/**
 * Reject requests to unsupported API versions with a 410 Gone response.
 */
export function rejectUnsupportedVersion(req: Request, res: Response, next: NextFunction): void {
  const version = extractVersionFromPath(req.path);
  if (version && !isVersionSupported(version)) {
    res.status(410).json({
      success: false,
      error: {
        code: 'UNSUPPORTED_API_VERSION',
        message: `API version "${version}" is no longer supported. ` +
          `Please upgrade to "${API_VERSIONS.CURRENT}". ` +
          `See documentation at /api/docs for migration guidance.`,
        supportedVersions: API_VERSIONS.SUPPORTED,
      },
    });
    return;
  }
  next();
}
