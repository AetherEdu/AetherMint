/**
 * Response Compression Middleware — Issue #269.
 *
 * Tests verify the encode/decode *decision contract* of the wrapper
 * around the well-tested npm `compression` package.  We deliberately
 * do NOT round-trip gzip bodies — supertest does not auto-decode
 * Content-Encoding: gzip by default, so res.text after compression
 * contains raw bytes interpreted as UTF-8 garbage and assertions
 * against the original text fail flakily.
 *
 * What we DO verify:
 *   - Content-Encoding: gzip is set when the payload is large enough
 *     and the content type is compressible AND the client advertises
 *     gzip.
 *   - Content-Encoding is absent when:
 *       - payload below the threshold
 *       - the content type matches our precompressed list
 *       - Cache-Control: no-transform is set
 *       - Accept-Encoding does not include gzip
 *       - the custom threshold is larger than the payload
 *   - The body of an uncompressed response matches the original
 *     payload (res.text is auto-parsed when no Content-Encoding
 *     header is present, so the round-trip is deterministic).
 *   - Default constants and the isPrecompressedContentType helper.
 *
 * The compression package itself is well-tested — we only verify the
 * project-specific filter chain forwards correctly to it.
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import request from 'supertest';
import {
  COMPRESSION_DEFAULT_LEVEL,
  COMPRESSION_DEFAULT_THRESHOLD,
  createResponseCompression,
  __testing,
} from '../../src/middleware/compression';
import requestId from '../../src/middleware/requestId';

const SMALL_BODY = 'A'.repeat(512); // 512 B — under the 1 KB threshold
const LARGE_BODY = 'A'.repeat(3 * 1024); // 3 KB — comfortably above threshold

const buildApp = (options: Parameters<typeof createResponseCompression>[0] = {}): Express => {
  const app = express();
  app.use(requestId);
  app.use(createResponseCompression(options));

  app.get('/small', (_req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(SMALL_BODY);
  });

  app.get('/large', (_req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(LARGE_BODY);
  });

  app.get('/large-image', (_req, res) => {
    res.setHeader('Content-Type', 'image/png');
    res.send(LARGE_BODY);
  });

  app.get('/large-video', (_req, res) => {
    res.setHeader('Content-Type', 'video/mp4');
    res.send(LARGE_BODY);
  });

  app.get('/large-audio', (_req, res) => {
    res.setHeader('Content-Type', 'audio/ogg');
    res.send(LARGE_BODY);
  });

  app.get('/large-wasm', (_req, res) => {
    res.setHeader('Content-Type', 'application/wasm');
    res.send(LARGE_BODY);
  });

  app.get('/large-pdf', (_req, res) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.send(LARGE_BODY);
  });

  app.get('/large-zip', (_req, res) => {
    res.setHeader('Content-Type', 'application/zip');
    res.send(LARGE_BODY);
  });

  app.get('/no-transform', (_req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Cache-Control', 'no-transform');
    res.send(LARGE_BODY);
  });

  app.get('/text-html', (_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(LARGE_BODY);
  });

  // Fallback error handler so middleware errors don't crash supertest.
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: err.message });
  });

  return app;
};

describe('response compression middleware — Issue #269', () => {
  it('forwards small (< threshold) responses unchanged and still echoes X-Request-ID', async () => {
    const app = buildApp();
    const res = await request(app).get('/small').set('Accept-Encoding', 'gzip');
    expect(res.status).toBe(200);
    expect(res.headers['content-encoding']).toBeUndefined();
    // res.text is auto-parsed when there's no Content-Encoding
    // header; the round-trip is deterministic.
    expect(res.text).toBe(SMALL_BODY);
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('compresses large text responses with gzip', async () => {
    const app = buildApp();
    const res = await request(app).get('/large').set('Accept-Encoding', 'gzip');
    expect(res.status).toBe(200);
    expect(res.headers['content-encoding']).toBe('gzip');
    expect(res.headers['vary']).toContain('Accept-Encoding');
  });

  it.each([
    ['/large-image', 'image/png'],
    ['/large-video', 'video/mp4'],
    ['/large-audio', 'audio/ogg'],
    ['/large-wasm', 'application/wasm'],
    ['/large-pdf', 'application/pdf'],
    ['/large-zip', 'application/zip'],
  ])('does not compress pre-compressed content type %s (%s)', async (path) => {
    const app = buildApp();
    const res = await request(app).get(path).set('Accept-Encoding', 'gzip');
    expect(res.status).toBe(200);
    // We only assert the encode/decode CONTRACT here. Body
    // round-trip for non-text MIME types is unreliable in supertest
    // (superagent auto-parses text/* and application/json but not
    // image/* etc.) so we leave that to the npm `compression`
    // package's own test suite.
    expect(res.headers['content-encoding']).toBeUndefined();
  });

  it('skips compression when Cache-Control: no-transform is set', async () => {
    const app = buildApp();
    const res = await request(app).get('/no-transform').set('Accept-Encoding', 'gzip');
    expect(res.status).toBe(200);
    expect(res.headers['content-encoding']).toBeUndefined();
    expect(res.text).toBe(LARGE_BODY);
  });

  it('skips compression when the client does not advertise gzip', async () => {
    const app = buildApp();
    const res = await request(app).get('/large').set('Accept-Encoding', 'identity');
    expect(res.status).toBe(200);
    expect(res.headers['content-encoding']).toBeUndefined();
    expect(res.text).toBe(LARGE_BODY);
  });

  it('honours a custom threshold above the payload size', async () => {
    const app = buildApp({ threshold: 10 * 1024 });
    const res = await request(app).get('/large').set('Accept-Encoding', 'gzip');
    expect(res.headers['content-encoding']).toBeUndefined();
    expect(res.text).toBe(LARGE_BODY);
  });

  it('compresses when the payload exceeds the configured threshold', async () => {
    const app = buildApp({ threshold: 1024 });
    const res = await request(app).get('/large').set('Accept-Encoding', 'gzip');
    expect(res.headers['content-encoding']).toBe('gzip');
  });

  it('forwards X-Request-ID through compressed responses', async () => {
    // The requestId middleware assigns a correlation id at the
    // start of the request.  Even when the response is compressed
    // the response headers still carry the upstream id.
    const app = buildApp();
    const id = '00000000-0000-4000-8000-000000000001';
    const res = await request(app)
      .get('/large')
      .set('Accept-Encoding', 'gzip')
      .set('X-Request-ID', id);
    expect(res.headers['x-request-id']).toBe(id);
  });

  it('exports sensible default constants', () => {
    expect(COMPRESSION_DEFAULT_THRESHOLD).toBe(1024);
    expect(COMPRESSION_DEFAULT_LEVEL).toBeGreaterThanOrEqual(1);
    expect(COMPRESSION_DEFAULT_LEVEL).toBeLessThanOrEqual(9);
    expect(COMPRESSION_DEFAULT_LEVEL).toBe(6);
  });

  describe('isPrecompressedContentType (internal helper)', () => {
    it('flags every pre-compressed MIME type the regex list covers', () => {
      // image/svg+xml IS matched by our image/* regex — by design —
      // because svg is technically a structured XML document but
      // ships alongside image/* on the platform's asset pipeline.
      expect(__testing.isPrecompressedContentType('image/png')).toBe(true);
      expect(__testing.isPrecompressedContentType('image/svg+xml')).toBe(true);
      expect(__testing.isPrecompressedContentType('image/jpeg; charset=binary')).toBe(true);
      expect(__testing.isPrecompressedContentType('video/mp4')).toBe(true);
      expect(__testing.isPrecompressedContentType('audio/ogg')).toBe(true);
      expect(__testing.isPrecompressedContentType('font/woff2')).toBe(true);
      expect(__testing.isPrecompressedContentType('application/wasm')).toBe(true);
      expect(__testing.isPrecompressedContentType('application/zip')).toBe(true);
      expect(__testing.isPrecompressedContentType('application/gzip')).toBe(true);
      expect(__testing.isPrecompressedContentType('application/pdf')).toBe(true);
    });

    it('does not flag text/*, application/json, application/problem+json, or undefined', () => {
      expect(__testing.isPrecompressedContentType('text/html')).toBe(false);
      expect(__testing.isPrecompressedContentType('text/plain')).toBe(false);
      expect(__testing.isPrecompressedContentType('application/json')).toBe(false);
      expect(__testing.isPrecompressedContentType('application/problem+json')).toBe(false);
      expect(__testing.isPrecompressedContentType(undefined)).toBe(false);
      expect(__testing.isPrecompressedContentType('')).toBe(false);
    });
  });
});
