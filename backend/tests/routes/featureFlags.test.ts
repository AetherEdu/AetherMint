/**
 * Feature Flag Middleware Tests
 *
 * Verifies that the `requireFeature` middleware correctly gates a route.
 */

import express from 'express';
import request from 'supertest';
import { requireFeature } from '../../src/middleware/featureFlag';
import { featureFlagService } from '../../src/services/featureFlagService';
import { evaluateForUser } from '../../src/controllers/featureFlagController';

const buildApp = () => {
  const app = express();
  app.use((req, _res, next) => {
    // Inject a fake user for tests that need one.
    const userId = req.header('x-test-user');
    if (userId) {
      (req as any).user = { id: userId };
    }
    next();
  });
  app.get('/feature/:name', requireFeature('demo'), (_req, res) => {
    res.json({ ok: true });
  });
  // Anonymous endpoint supports ?bucket=N for QA bucketed rollouts.
  app.get(
    '/anonymous-feature',
    requireFeature('demo', { bucketQueryParam: 'bucket' }),
    (_req, res) => {
      res.json({ ok: true });
    }
  );
  return app;
};

describe('requireFeature middleware', () => {
  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (featureFlagService as any).cache.clear();
    await featureFlagService.upsertFlag({
      name: 'demo',
      enabled: true,
      rolloutPercent: 0,
      allowedUserIds: ['vip'],
      blockedUserIds: ['banned'],
      createdAt: '',
      updatedAt: '',
    });
  });

  it('returns 404 when the flag is disabled (kill switch)', async () => {
    await featureFlagService.setEnabled('demo', false);
    const res = await request(buildApp()).get('/anonymous-feature');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 for an explicit allow-listed user', async () => {
    const res = await request(buildApp())
      .get('/anonymous-feature')
      .set('x-test-user', 'vip');
    expect(res.status).toBe(200);
  });

  it('returns 404 for a block-listed user', async () => {
    const res = await request(buildApp())
      .get('/anonymous-feature')
      .set('x-test-user', 'banned');
    expect(res.status).toBe(404);
  });

  it('falls back to defaultValue for unknown users when rolloutPercent=0', async () => {
    const res = await request(buildApp())
      .get('/anonymous-feature')
      .set('x-test-user', 'random');
    expect(res.status).toBe(404);
  });

  it('rolls out at lower bucket but not at higher bucket', async () => {
    await featureFlagService.upsertFlag({
      name: 'demo',
      enabled: true,
      rolloutPercent: 50,
      createdAt: '',
      updatedAt: '',
    });
    const low = await request(buildApp())
      .get('/anonymous-feature?bucket=10')
      .set('x-test-user', 'random');
    const high = await request(buildApp())
      .get('/anonymous-feature?bucket=90')
      .set('x-test-user', 'random');
    expect(low.status).toBe(200);
    expect(high.status).toBe(404);
  });

  it('attaches the evaluated value to req.featureFlag', async () => {
    await featureFlagService.upsertFlag({
      name: 'demo',
      enabled: true,
      rolloutPercent: 100,
      variants: { a: 50, b: 50 },
      createdAt: '',
      updatedAt: '',
    });
    const app = express();
    app.use((req, _res, next) => {
      (req as any).user = { id: 'u1' };
      next();
    });
    app.get('/capture', requireFeature('demo'), (req, res) => {
      res.json({ flag: (req as any).featureFlag });
    });
    const res = await request(app).get('/capture');
    expect(['a', 'b']).toContain(res.body.flag.value);
  });
});

// ── Public evaluation endpoint (mounted at /api/feature-flags/:name/evaluate) ──
describe('evaluateForUser (public evaluation endpoint)', () => {
  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (featureFlagService as any).cache.clear();
  });

  it('returns the evaluated value for an enabled flag', async () => {
    await featureFlagService.upsertFlag({
      name: 'public-eval',
      enabled: true,
      rolloutPercent: 100,
      createdAt: '',
      updatedAt: '',
    });
    const app = express();
    app.get('/api/feature-flags/:name/evaluate', evaluateForUser);
    const res = await request(app).get('/api/feature-flags/public-eval/evaluate');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('public-eval');
  });

  it('returns default false for an unknown flag', async () => {
    const app = express();
    app.get('/api/feature-flags/:name/evaluate', evaluateForUser);
    const res = await request(app).get('/api/feature-flags/missing/evaluate');
    expect(res.status).toBe(200);
    expect(res.body.data.value).toBe(false);
  });

  it('honours ?bucket=N for QA bucketing', async () => {
    await featureFlagService.upsertFlag({
      name: 'qa-bucketed',
      enabled: true,
      rolloutPercent: 50,
      createdAt: '',
      updatedAt: '',
    });
    const app = express();
    app.get('/api/feature-flags/:name/evaluate', evaluateForUser);
    const low = await request(app).get('/api/feature-flags/qa-bucketed/evaluate?bucket=10');
    const high = await request(app).get('/api/feature-flags/qa-bucketed/evaluate?bucket=90');
    expect(low.body.data.value).toBe(true);
    expect(high.body.data.value).toBe(false);
  });

  it('rejects out-of-range, non-numeric, and empty ?bucket per the public contract', async () => {
    await featureFlagService.upsertFlag({
      name: 'bucket-rejection',
      enabled: true,
      rolloutPercent: 100,
      createdAt: '',
      updatedAt: '',
    });
    const app = express();
    app.get('/api/feature-flags/:name/evaluate', evaluateForUser);

    // Out-of-range, negative, and non-numeric values must 400.
    const tooLarge = await request(app).get('/api/feature-flags/bucket-rejection/evaluate?bucket=100');
    const negative = await request(app).get('/api/feature-flags/bucket-rejection/evaluate?bucket=-1');
    const alpha = await request(app).get('/api/feature-flags/bucket-rejection/evaluate?bucket=abc');
    const mixed = await request(app).get('/api/feature-flags/bucket-rejection/evaluate?bucket=5abc');
    expect(tooLarge.status).toBe(400);
    expect(negative.status).toBe(400);
    expect(alpha.status).toBe(400);
    expect(mixed.status).toBe(400); // parseInt('5abc', 10) === 5, but we re-validate
    expect(tooLarge.body.error).toMatch(/\[0, 99\]/);

    // Empty / omitted bucket must NOT reject — it means "fall back to userId hash".
    const omitted = await request(app).get('/api/feature-flags/bucket-rejection/evaluate');
    const empty = await request(app).get('/api/feature-flags/bucket-rejection/evaluate?bucket=');
    expect(omitted.status).toBe(200);
    expect(omitted.body.data.value).toBe(true);
    expect(empty.status).toBe(200);
    expect(empty.body.data.value).toBe(true);
  });
});
