/**
 * Feature Flag Service Unit Tests
 * Closes Issue #267 — verifies evaluation logic including kill switch,
 * percentage rollout determinism, A/B variants, allow/block lists, CRUD.
 *
 * The service is built to fall back to the in-memory cache when Redis is
 * not configured, so no Redis test fixture is required.
 */

import {
  FeatureFlag,
  featureFlagService,
} from '../../src/services/featureFlagService';

describe('featureFlagService', () => {
  beforeEach(() => {
    // Reset cache between tests so the suite is order-independent.
    // We do this by deleting every flag through the public API.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (featureFlagService as any).cache.clear();
  });

  describe('upsertFlag / listFlags / getFlag', () => {
    it('creates, returns, and lists flags', async () => {
      const created = await featureFlagService.upsertFlag({
        name: 'new-quiz-ui',
        enabled: true,
        rolloutPercent: 100,
        createdAt: '',
        updatedAt: '',
      });
      expect(created.name).toBe('new-quiz-ui');
      expect(created.createdAt).toBeTruthy();
      expect(created.updatedAt).toBeTruthy();

      const fetched = await featureFlagService.getFlag('new-quiz-ui');
      expect(fetched?.name).toBe('new-quiz-ui');

      const all = await featureFlagService.listFlags();
      expect(all.map((f) => f.name)).toContain('new-quiz-ui');
    });

    it('rejects invalid flag names', async () => {
      await expect(
        featureFlagService.upsertFlag({
          name: '!!!',
          enabled: true,
          rolloutPercent: 0,
          createdAt: '',
          updatedAt: '',
        })
      ).rejects.toThrow(/name/i);
    });

    it('rejects rolloutPercent outside [0,100]', async () => {
      await expect(
        featureFlagService.upsertFlag({
          name: 'bad',
          enabled: true,
          rolloutPercent: 150,
          createdAt: '',
          updatedAt: '',
        })
      ).rejects.toThrow(/rolloutPercent/i);
    });

    it('rejects variant weights that do not sum to 100', async () => {
      await expect(
        featureFlagService.upsertFlag({
          name: 'bad-variant',
          enabled: true,
          rolloutPercent: 100,
          variants: { a: 60, b: 30 },
          createdAt: '',
          updatedAt: '',
        })
      ).rejects.toThrow(/Variant/i);
    });
  });

  describe('evaluate', () => {
    let flag: FeatureFlag;
    beforeEach(async () => {
      flag = await featureFlagService.upsertFlag({
        name: 'rollout-test',
        enabled: true,
        rolloutPercent: 50,
        createdAt: '',
        updatedAt: '',
      });
    });

    it('returns false when the flag is disabled (kill switch)', async () => {
      await featureFlagService.setEnabled('rollout-test', false);
      expect(await featureFlagService.isEnabled('rollout-test', { userId: 'u1' })).toBe(false);
    });

    it('returns false when the user is on the block list', async () => {
      await featureFlagService.upsertFlag({
        ...flag,
        blockedUserIds: ['bad-actor'],
        createdAt: '',
        updatedAt: '',
      });
      expect(await featureFlagService.isEnabled('rollout-test', { userId: 'bad-actor' })).toBe(false);
    });

    it('returns true when the user is on the allow list regardless of rollout', async () => {
      await featureFlagService.upsertFlag({
        ...flag,
        rolloutPercent: 0,
        allowedUserIds: ['qa-user'],
        createdAt: '',
        updatedAt: '',
      });
      expect(await featureFlagService.isEnabled('rollout-test', { userId: 'qa-user' })).toBe(true);
    });

    it('rollout is deterministic for the same (flag, userId)', async () => {
      const userId = 'consistent-user';
      const first = await featureFlagService.isEnabled('rollout-test', { userId });
      for (let i = 0; i < 5; i++) {
        expect(await featureFlagService.isEnabled('rollout-test', { userId })).toBe(first);
      }
    });

    it('explicit bucket overrides the hash', async () => {
      // rolloutPercent = 50, so buckets < 50 are inside the rollout.
      expect(await featureFlagService.isEnabled('rollout-test', { bucket: 10 })).toBe(true);
      expect(await featureFlagService.isEnabled('rollout-test', { bucket: 90 })).toBe(false);
    });

    it('returns a variant key when variants are configured', async () => {
      await featureFlagService.upsertFlag({
        name: 'ab-test',
        enabled: true,
        rolloutPercent: 100,
        variants: { control: 50, treatment: 50 },
        createdAt: '',
        updatedAt: '',
      });
      const value = await featureFlagService.evaluate('ab-test', { userId: 'u1' });
      expect(['control', 'treatment']).toContain(value);
    });
  });

  describe('deleteFlag', () => {
    it('returns true when the flag existed', async () => {
      await featureFlagService.upsertFlag({
        name: 'gone',
        enabled: true,
        rolloutPercent: 0,
        createdAt: '',
        updatedAt: '',
      });
      expect(await featureFlagService.deleteFlag('gone')).toBe(true);
      expect(await featureFlagService.getFlag('gone')).toBeUndefined();
    });

    it('returns false when the flag did not exist', async () => {
      expect(await featureFlagService.deleteFlag('never-existed')).toBe(false);
    });
  });
});
