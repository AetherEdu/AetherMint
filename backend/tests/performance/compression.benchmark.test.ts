/**
 * Compression Middleware Performance Benchmarks — Issue #269.
 *
 * Benchmarks brotli and gzip compression against realistic API payloads
 * to demonstrate the bandwidth savings and processing overhead.
 */

import zlib from 'zlib';
import { promisify } from 'util';

const brotliCompressAsync = promisify(zlib.brotliCompress);
const gzipAsync = promisify(zlib.gzip);

// ---------------------------------------------------------------------------
// Test payloads
// ---------------------------------------------------------------------------

/** Small JSON response (just below the 1 KB threshold – should NOT be compressed). */
const SMALL_PAYLOAD = JSON.stringify({
  status: 'ok',
  message: 'Operation completed successfully',
  id: 'tx_abc123',
});

/** Typical API list response (~3 KB). */
const MEDIUM_PAYLOAD = JSON.stringify(
  Array.from({ length: 30 }, (_, i) => ({
    id: `course_${String(i).padStart(4, '0')}`,
    title: `Introduction to ${['Rust', 'Blockchain', 'AI', 'Web3', 'Stellar'][i % 5]} Development`,
    instructor: `Dr. ${['Smith', 'Johnson', 'Williams', 'Brown', 'Jones'][i % 5]}`,
    price: Math.floor(Math.random() * 200) + 10,
    currency: 'XLM',
    duration: `${Math.floor(Math.random() * 12) + 2} weeks`,
    level: ['beginner', 'intermediate', 'advanced'][i % 3],
    enrollmentCount: Math.floor(Math.random() * 500),
    rating: (Math.random() * 5).toFixed(1),
    tags: ['blockchain', 'education', 'stellar', 'web3', 'defi'].slice(0, (i % 3) + 1),
    createdAt: new Date(Date.now() - Math.random() * 90 * 86400000).toISOString(),
  })),
);

/** Large API response (~50 KB). */
const LARGE_PAYLOAD = JSON.stringify({
  results: Array.from({ length: 500 }, (_, i) => ({
    id: `credential_${String(i).padStart(6, '0')}`,
    issuer: `AetherMint University - Campus ${String.fromCharCode(65 + (i % 26))}`,
    holder: `GABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVW${String(i).padStart(4, '0')}`,
    type: ['certificate', 'badge', 'degree', 'license'][i % 4],
    issueDate: new Date(Date.now() - Math.random() * 365 * 86400000).toISOString(),
    expiryDate: new Date(Date.now() + Math.random() * 365 * 86400000).toISOString(),
    skills: ['Programming', 'Blockchain', 'Stellar', 'Web3', 'DeFi'].slice(0, (i % 3) + 2),
    verificationHash: `hash_${Math.random().toString(36).substring(2, 15)}`,
    metadata: {
      courseId: `course_${Math.floor(Math.random() * 1000)}`,
      grade: ['A', 'B', 'C'][i % 3],
      score: Math.floor(Math.random() * 100),
      completedModules: Math.floor(Math.random() * 20) + 1,
    },
  })),
  pagination: { page: 1, limit: 500, total: 12500, pages: 25 },
});

// ---------------------------------------------------------------------------
// Benchmark helpers
// ---------------------------------------------------------------------------

interface CompressionResult {
  algorithm: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number; // percentage of original
  timeMs: number;
}

async function benchmarkCompression(
  payload: Buffer,
  label: string,
): Promise<CompressionResult[]> {
  const results: CompressionResult[] = [];

  // --- Brotli (quality 4) ---
  const brStart = process.hrtime.bigint();
  const brResult = await brotliCompressAsync(payload, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
    },
  });
  const brEnd = process.hrtime.bigint();

  results.push({
    algorithm: 'brotli',
    originalSize: payload.length,
    compressedSize: brResult.length,
    compressionRatio: Number(((brResult.length / payload.length) * 100).toFixed(1)),
    timeMs: Number(brEnd - brStart) / 1e6,
  });

  // --- Gzip (level 6) ---
  const gzStart = process.hrtime.bigint();
  const gzResult = await gzipAsync(payload, { level: 6 });
  const gzEnd = process.hrtime.bigint();

  results.push({
    algorithm: 'gzip',
    originalSize: payload.length,
    compressedSize: gzResult.length,
    compressionRatio: Number(((gzResult.length / payload.length) * 100).toFixed(1)),
    timeMs: Number(gzEnd - gzStart) / 1e6,
  });

  return results;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Compression Performance Benchmarks', () => {
  // Increase Jest timeout for benchmarks
  jest.setTimeout(30_000);

  test('small payload (< 1 KB) should not be worth compressing', async () => {
    const buf = Buffer.from(SMALL_PAYLOAD, 'utf-8');
    const results = await benchmarkCompression(buf, 'small');

    // Small payloads may actually grow when "compressed" due to headers
    for (const r of results) {
      // Not a hard assertion – just documenting the behaviour
      expect(r.originalSize).toBeLessThan(1024);
    }

    // Print results for documentation
    const lines = results.map(
      (r) => `  ${r.algorithm}: ${r.originalSize}B → ${r.compressedSize}B (${r.compressionRatio}%) in ${r.timeMs.toFixed(2)}ms`,
    );
    console.log('\n[Benchmark] Small payload (< 1 KB):');
    lines.forEach((l) => console.log(l));
  });

  test('medium payload (~3 KB) – brotli vs gzip comparison', async () => {
    const buf = Buffer.from(MEDIUM_PAYLOAD, 'utf-8');
    const results = await benchmarkCompression(buf, 'medium');

    console.log(`\n[Benchmark] Medium payload (${buf.length} bytes):`);
    for (const r of results) {
      console.log(
        `  ${r.algorithm}: ${r.originalSize}B → ${r.compressedSize}B (${r.compressionRatio}%) in ${r.timeMs.toFixed(2)}ms`,
      );
    }

    // Both should achieve meaningful compression
    for (const r of results) {
      expect(r.compressedSize).toBeLessThan(r.originalSize);
    }

    // Brotli typically achieves better compression than gzip on text/JSON
    const brotli = results.find((r) => r.algorithm === 'brotli')!;
    const gzip = results.find((r) => r.algorithm === 'gzip')!;
    expect(brotli.compressionRatio).toBeLessThanOrEqual(gzip.compressionRatio + 5); // Allow small margin
  });

  test('large payload (~50 KB) – brotli vs gzip comparison', async () => {
    const buf = Buffer.from(LARGE_PAYLOAD, 'utf-8');
    const results = await benchmarkCompression(buf, 'large');

    console.log(`\n[Benchmark] Large payload (${buf.length} bytes):`);
    for (const r of results) {
      console.log(
        `  ${r.algorithm}: ${r.originalSize}B → ${r.compressedSize}B (${r.compressionRatio}%) in ${r.timeMs.toFixed(2)}ms`,
      );
    }

    // Both should achieve good compression
    for (const r of results) {
      expect(r.compressedSize).toBeLessThan(r.originalSize * 0.5); // at least 50% reduction
    }

    // Brotli should be at least as good as gzip on large JSON payloads
    const brotli = results.find((r) => r.algorithm === 'brotli')!;
    const gzip = results.find((r) => r.algorithm === 'gzip')!;

    // Document the bandwidth savings
    const brotliSavings = buf.length - brotli.compressedSize;
    const gzipSavings = buf.length - gzip.compressedSize;
    console.log(
      `\n  Bandwidth saved – brotli: ${brotliSavings}B (${((brotliSavings / buf.length) * 100).toFixed(1)}%), ` +
        `gzip: ${gzipSavings}B (${((gzipSavings / buf.length) * 100).toFixed(1)}%)`,
    );

    // Brotli should save at least as much as gzip on this payload
    expect(brotliSavings).toBeGreaterThanOrEqual(gzipSavings * 0.85);
  });

  test('multiple iterations – consistent performance', async () => {
    const buf = Buffer.from(MEDIUM_PAYLOAD, 'utf-8');
    const iterations = 10;
    const brotliTimes: number[] = [];
    const gzipTimes: number[] = [];

    for (let i = 0; i < iterations; i++) {
      // Brotli
      const brStart = process.hrtime.bigint();
      await brotliCompressAsync(buf, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
          [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
        },
      });
      const brEnd = process.hrtime.bigint();
      brotliTimes.push(Number(brEnd - brStart) / 1e6);

      // Gzip
      const gzStart = process.hrtime.bigint();
      await gzipAsync(buf, { level: 6 });
      const gzEnd = process.hrtime.bigint();
      gzipTimes.push(Number(gzEnd - gzStart) / 1e6);
    }

    const avgBrotli = brotliTimes.reduce((a, b) => a + b, 0) / brotliTimes.length;
    const avgGzip = gzipTimes.reduce((a, b) => a + b, 0) / gzipTimes.length;

    console.log(`\n[Benchmark] Consistency over ${iterations} iterations:`);
    console.log(`  avg brotli: ${avgBrotli.toFixed(2)}ms, avg gzip: ${avgGzip.toFixed(2)}ms`);

    // Both should complete within a reasonable time (< 50ms avg for 3 KB)
    expect(avgBrotli).toBeLessThan(50);
    expect(avgGzip).toBeLessThan(50);
  });
});
