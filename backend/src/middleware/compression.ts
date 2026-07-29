/**
 * Response Compression Middleware — Issue #269.
 *
 * Wraps the well-tested `compression` package with project-specific
 * defaults: a 1 KB threshold, gzip compression level 6, and a
 * precompressed-content-type skip list covering images, audio, video,
 * font subsets, archives and wasm modules.
 *
 * Behaviour:
 *   - threshold:                1024 bytes (compresses payloads ≥ 1 KB)
 *   - level:                    6       (a sane speed/ratio trade-off)
 *   - skip pre-compressed MIME: image/*, video/*, audio/*, font/*,
 *                               application/zip, application/gzip,
 *                               application/x-gzip, application/x-brotli,
 *                               application/wasm, application/pdf
 *   - skip when:                Cache-Control: no-transform is set, or
 *                               the client did not advertise gzip via
 *                               Accept-Encoding
 *
 * Filter chain:
 *   1. Honour Cache-Control: no-transform                 (project)
 *   2. Honour Client's Accept-Encoding: gzip              (project)
 *   3. Skip our project-specific precompressed list       (project)
 *   4. Otherwise fall through to the npm `compression`
 *      package's built-in compressibility check (which
 *      excludes image/*, video/*, font/* and application/wasm
 *      via the `compressible` regex).
 */

import { NextFunction, Request, Response } from 'express';
import compression from 'compression';

export const COMPRESSION_DEFAULT_THRESHOLD = 1024; // 1 KB
export const COMPRESSION_DEFAULT_LEVEL = 6; // 1 (fastest) … 9 (best ratio)

/**
 * MIME types that are already stored compressed on disk and
 * re-compressing them just wastes CPU.  The list mirrors what nginx
 * considers "precompressed": images, audio, video, archives, font
 * subsets and wasm.
 */
const PRECOMPRESSED_CONTENT_TYPE_PATTERNS: RegExp[] = [
  /^image\//i,
  /^video\//i,
  /^audio\//i,
  /^font\//i,
  /^application\/zip(?:-|[;\s]|$)/i,
  /^application\/gzip(?:-|[;\s]|$)/i,
  /^application\/x-gzip(?:-|[;\s]|$)/i,
  /^application\/x-brotli(?:-|[;\s]|$)/i,
  /^application\/brotli(?:-|[;\s]|$)/i,
  /^application\/wasm(?:-|[;\s]|$)/i,
  /^application\/pdf(?:-|[;\s]|$)/i,
];

/** Returns true when the given Content-Type is already stored compressed. */
export const isPrecompressedContentType = (contentType: string | undefined): boolean => {
  if (!contentType) {
    return false;
  }
  const normalized = contentType.split(';')[0]?.trim() ?? '';
  if (!normalized) {
    return false;
  }
  return PRECOMPRESSED_CONTENT_TYPE_PATTERNS.some((pattern) => pattern.test(normalized));
};

export interface ResponseCompressionOptions {
  /**
   * Minimum response body size (in bytes) before compression kicks
   * in.  Default: 1024.
   */
  threshold?: number;
  /**
   * gzip level (1-9).  Defaults to 6.
   */
  level?: number;
  /**
   * Override the default list of MIME types that are skipped.
   * Pass an empty array to compress every response, or a list of
   * regex patterns to replace the built-in skip list.
   */
  skipPrecompressed?: RegExp[] | null;
}

/**
 * Build a response compression middleware.
 *
 * The project-specific filter runs first (no-transform, Accept-Encoding
 * negotiation, precompressed-content-type skip) and falls back to the
 * npm `compression` package's default compressibility check for any
 * remaining cases.  Callers can substitute the project's precompressed
 * skip list via `skipPrecompressed`.
 */
export const createResponseCompression = (options: ResponseCompressionOptions = {}) => {
  const threshold = options.threshold ?? COMPRESSION_DEFAULT_THRESHOLD;
  const level = options.level ?? COMPRESSION_DEFAULT_LEVEL;
  const skipPatterns =
    options.skipPrecompressed === null
      ? []
      : options.skipPrecompressed ?? PRECOMPRESSED_CONTENT_TYPE_PATTERNS;

  // Default middleware behaviour for branches the user did not
  // explicitly override.  The npm `compression` package exports the
  // original content-type regex via `compression.filter`.
  const defaultFilter = (compression as unknown as {
    filter?: (req: Request, res: Response) => boolean;
  }).filter;

  const filter = (req: Request, res: Response): boolean => {
    // 1. Honour Cache-Control: no-transform (RFC 7234 §5.2.2.3).
    const cacheControl = (res.getHeader('Cache-Control') ?? req.header('cache-control') ?? '')
      .toString()
      .toLowerCase();
    if (cacheControl.includes('no-transform')) {
      return false;
    }

    // 2. Negotiate encoding with the client.
    const ae = (req.header('accept-encoding') || '').toLowerCase();
    if (!ae.includes('gzip')) {
      return false;
    }

    // 3. Skip our project-specific precompressed-content-type list.
    const ct = res.getHeader('Content-Type');
    const ctString = Array.isArray(ct) ? ct.join('; ') : typeof ct === 'string' ? ct : undefined;
    if (ctString) {
      const normalized = ctString.split(';')[0]?.trim() ?? '';
      if (normalized && skipPatterns.some((p) => p.test(normalized))) {
        return false;
      }
    }

    // 4. Fall through to the npm package's compressibility check.
    if (typeof defaultFilter === 'function') {
      return defaultFilter(req, res);
    }
    return true;
  };

  return compression({
    threshold,
    level,
    filter,
  }) as (req: Request, res: Response, next: NextFunction) => void;
};

/**
 * Default middleware instance with project-recommended defaults.
 *  - threshold: 1024 bytes
 *  - level:     6
 *  - skip:      built-in precompressed-content-type list
 */
export const responseCompression = createResponseCompression();

export default responseCompression;

// Re-exporting for tests so they can patch without re-importing from this file.
export const __testing = {
  isPrecompressedContentType,
};
