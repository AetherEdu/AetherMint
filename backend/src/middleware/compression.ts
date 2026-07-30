/**
 * Response Compression Middleware — Issue #269.
 *
 * Provides gzip and brotli compression for API responses.
 *
 * Wraps the well-tested `compression` package with project-specific
 * defaults: a 1 KB threshold, gzip compression level 6 / brotli quality 4,
 * and a precompressed-content-type skip list covering images, audio,
 * video, font subsets, archives and wasm modules.
 *
 * Behaviour:
 *   - Prefers brotli (br) when the client advertises it in Accept-Encoding.
 *   - Falls back to gzip when brotli is not supported.
 *   - threshold:                1024 bytes (compresses payloads ≥ 1 KB)
 *   - gzip level:               6       (a sane speed/ratio trade-off)
 *   - brotli quality:           4       (good compression at reasonable speed)
 *   - skip pre-compressed MIME: image/*, video/*, audio/*, font/*,
 *                               application/zip, application/gzip,
 *                               application/x-gzip, application/x-brotli,
 *                               application/wasm, application/pdf
 *   - skip when:                Cache-Control: no-transform is set, or
 *                               the client did not advertise any supported
 *                               encoding via Accept-Encoding
 *
 * Filter chain:
 *   1. Honour Cache-Control: no-transform                 (project)
 *   2. Honour Client's Accept-Encoding: br → brotli, gzip → gzip
 *   3. Skip our project-specific precompressed list       (project)
 *   4. Otherwise fall through to the npm `compression`
 *      package's built-in compressibility check (which
 *      excludes image/*, video/*, font/* and application/wasm
 *      via the `compressible` regex).
 */

import { NextFunction, Request, Response } from 'express';
import zlib from 'zlib';
import compression from 'compression';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const COMPRESSION_DEFAULT_THRESHOLD = 1024; // 1 KB

/**
 * gzip level (1-9).  Default: 6.
 * @deprecated Use COMPRESSION_DEFAULT_GZIP_LEVEL instead.
 */
export const COMPRESSION_DEFAULT_LEVEL = 6;
export const COMPRESSION_DEFAULT_GZIP_LEVEL = COMPRESSION_DEFAULT_LEVEL;
export const COMPRESSION_DEFAULT_BROTLI_QUALITY = 4; // 0 (fastest) … 11 (best ratio)

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when the given Content-Type is already stored compressed. */
export const isPrecompressedContentType = (contentType: string | undefined): boolean => {
  if (!contentType) return false;
  const normalized = contentType.split(';')[0]?.trim() ?? '';
  if (!normalized) return false;
  return PRECOMPRESSED_CONTENT_TYPE_PATTERNS.some((pattern) => pattern.test(normalized));
};

/** Returns true when the request's Accept-Encoding header advertises brotli (br) support. */
export const acceptsBrotli = (req: Request): boolean => {
  const ae = (req.header('accept-encoding') || '').toLowerCase();
  return ae.includes('br');
};

/** Returns true when the request's Accept-Encoding header advertises gzip support. */
export const acceptsGzip = (req: Request): boolean => {
  const ae = (req.header('accept-encoding') || '').toLowerCase();
  return ae.includes('gzip');
};

/** Returns true when the response has Cache-Control: no-transform (RFC 7234 §5.2.2.3). */
const hasNoTransform = (req: Request, res: Response): boolean => {
  const cacheControl = (res.getHeader('Cache-Control') ?? req.header('cache-control') ?? '')
    .toString()
    .toLowerCase();
  return cacheControl.includes('no-transform');
};

/** Extract the MIME type (without charset params) from the response. */
const getNormalizedContentType = (res: Response): string | undefined => {
  const ct = res.getHeader('Content-Type');
  if (!ct) return undefined;
  const ctString = Array.isArray(ct) ? ct.join('; ') : typeof ct === 'string' ? ct : undefined;
  return ctString?.split(';')[0]?.trim() || undefined;
};

/**
 * Safely access the `compression` package's built-in content-type filter.
 * This is an undocumented internal, so we wrap in try/catch to degrade gracefully.
 */
const tryGetCompressionDefaultFilter = (): ((req: Request, res: Response) => boolean) | undefined => {
  try {
    const filter = (compression as unknown as { filter?: (req: Request, res: Response) => boolean }).filter;
    if (typeof filter === 'function') return filter;
  } catch {
    // Silently ignore — we'll just use our own filter
  }
  return undefined;
};

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ResponseCompressionOptions {
  /**
   * Minimum response body size (in bytes) before compression kicks in. Default: 1024.
   */
  threshold?: number;
  /**
   * gzip level (1-9). Defaults to 6.
   * Also accepts `level` for backward compatibility.
   */
  level?: number;
  /**
   * gzip level (1-9). Preferred name. Defaults to 6.
   * Takes precedence over `level` if both are provided.
   */
  gzipLevel?: number;
  /**
   * brotli quality (0-11). Defaults to 4.
   */
  brotliQuality?: number;
  /**
   * Override the default list of MIME types that are skipped.
   * Pass an empty array to compress every response, or a list of
   * regex patterns to replace the built-in skip list.
   */
  skipPrecompressed?: RegExp[] | null;
}

// ---------------------------------------------------------------------------
// Brotli middleware (custom – not provided by the `compression` package)
// ---------------------------------------------------------------------------

/**
 * Express middleware that compresses responses using brotli when the
 * client advertises `br` in Accept-Encoding.
 */
export const createBrotliMiddleware = (
  options: ResponseCompressionOptions = {},
): ((req: Request, res: Response, next: NextFunction) => void) => {
  const threshold = options.threshold ?? COMPRESSION_DEFAULT_THRESHOLD;
  const quality = options.brotliQuality ?? COMPRESSION_DEFAULT_BROTLI_QUALITY;
  const skipPatterns =
    options.skipPrecompressed === null
      ? []
      : options.skipPrecompressed ?? PRECOMPRESSED_CONTENT_TYPE_PATTERNS;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!acceptsBrotli(req)) return next();
    if (hasNoTransform(req, res)) return next();

    const normalizedCt = getNormalizedContentType(res);
    if (normalizedCt && skipPatterns.some((p) => p.test(normalizedCt))) return next();

    // Intercept the response
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);
    const chunks: Buffer[] = [];
    let totalSize = 0;

    res.write = function (chunk: any, ..._args: any[]): boolean {
      if (chunk) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        chunks.push(buf);
        totalSize += buf.length;
      }
      return true;
    } as typeof res.write;

    res.end = function (chunk: any, ..._args: any[]): any {
      if (chunk) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        chunks.push(buf);
        totalSize += buf.length;
      }

      if (totalSize < threshold) {
        res.setHeader('Content-Length', totalSize);
        res.write = originalWrite;
        res.end = originalEnd;
        if (chunks.length > 0) {
          res.write(Buffer.concat(chunks));
        }
        return originalEnd();
      }

      const combined = Buffer.concat(chunks);

      zlib.brotliCompress(combined, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: quality,
          [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
        },
      }, (err, result) => {
        if (err) {
          res.write = originalWrite;
          res.end = originalEnd;
          if (chunks.length > 0) res.write(Buffer.concat(chunks));
          return originalEnd();
        }

        res.setHeader('Content-Encoding', 'br');
        res.setHeader('Content-Length', result.length);
        res.removeHeader('Transfer-Encoding');

        res.write = originalWrite;
        res.end = originalEnd;
        res.write(result);
        originalEnd();
      });

      return res;
    } as typeof res.end;

    next();
  };
};

// ---------------------------------------------------------------------------
// Combined middleware (brotli-first, then gzip fallback)
// ---------------------------------------------------------------------------

/**
 * Build a response compression middleware that prefers brotli over gzip.
 */
export const createResponseCompression = (
  options: ResponseCompressionOptions = {},
): ((req: Request, res: Response, next: NextFunction) => void) => {
  const threshold = options.threshold ?? COMPRESSION_DEFAULT_THRESHOLD;
  // Backward compat: `level` is accepted as an alias for `gzipLevel`
  const gzipLevel = options.gzipLevel ?? options.level ?? COMPRESSION_DEFAULT_GZIP_LEVEL;
  const skipPatterns =
    options.skipPrecompressed === null
      ? []
      : options.skipPrecompressed ?? PRECOMPRESSED_CONTENT_TYPE_PATTERNS;

  const brotliMiddleware = createBrotliMiddleware(options);
  const defaultFilter = tryGetCompressionDefaultFilter();

  const gzipFilter = (req: Request, res: Response): boolean => {
    if (hasNoTransform(req, res)) return false;
    if (!acceptsGzip(req)) return false;

    const normalizedCt = getNormalizedContentType(res);
    if (normalizedCt && skipPatterns.some((p) => p.test(normalizedCt))) return false;

    if (typeof defaultFilter === 'function') return defaultFilter(req, res);
    return true;
  };

  const gzipMiddleware = compression({
    threshold,
    level: gzipLevel,
    filter: gzipFilter,
  }) as (req: Request, res: Response, next: NextFunction) => void;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (acceptsBrotli(req)) return brotliMiddleware(req, res, next);
    return gzipMiddleware(req, res, next);
  };
};

/**
 * Default middleware instance with project-recommended defaults.
 *  - Prefers brotli (br) over gzip
 *  - threshold: 1024 bytes
 *  - gzip level: 6
 *  - brotli quality: 4
 *  - skip: built-in precompressed-content-type list
 */
export const responseCompression = createResponseCompression();

export default responseCompression;

// ---------------------------------------------------------------------------
// Testing exports
// ---------------------------------------------------------------------------

export const __testing = {
  isPrecompressedContentType,
  acceptsBrotli,
  acceptsGzip,
  PRECOMPRESSED_CONTENT_TYPE_PATTERNS,
};
