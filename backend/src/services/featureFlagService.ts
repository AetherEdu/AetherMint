/**
 * Feature Flag Service
 * Closes Issue #267: Implement feature flag system for gradual rollouts.
 *
 * Supports:
 *   - Global kill switch (`enabled` flag)
 *   - Percentage-based rollouts (deterministic per user)
 *   - A/B testing variants (deterministic per user per flag)
 *   - User allow/block lists for targeted rollouts
 *
 * Persistence: stored in Redis as a single JSON blob keyed by
 * `featureflags:all`; mirrored in an in-process cache so evaluations do not
 * round-trip to Redis on the hot path. Designed to degrade gracefully when
 * Redis is unavailable (the service falls back to the in-memory cache and
 * defaults).
 */

import crypto from 'crypto';
import logger from '../utils/logger';
import redisConfig from '../config/redis';

export type VariantKey = string;

export interface FeatureFlag {
  /** Unique flag name (e.g. "new-quiz-ui"). */
  name: string;
  /** Human-readable description shown in the admin API. */
  description?: string;
  /** Global kill switch. When `false` the flag evaluates to disabled for everyone. */
  enabled: boolean;
  /** Percentage of eligible users the flag is enabled for (0-100). */
  rolloutPercent: number;
  /**
   * Optional A/B variants. When present the flag is treated as a multivariate
   * test: evaluation returns one of the variant keys instead of a boolean.
   * Sum of weights must equal 100.
   */
  variants?: Record<VariantKey, number>;
  /** Explicit allow list — users here always receive the flag regardless of rollout. */
  allowedUserIds?: string[];
  /** Explicit block list — users here never receive the flag. */
  blockedUserIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FlagEvaluationContext {
  /** Stable user identifier used for hashing. Falls back to anonymous bucket. */
  userId?: string;
  /**
   * Optional explicit stable bucket (0-99). Bypasses hashing so callers can
   * run A/B tests against a deterministic bucket outside the userId hash
   * space. Useful for QA / staging.
   */
  bucket?: number;
}

export type FlagValue = boolean | VariantKey;

const STORAGE_KEY = 'featureflags:all';
const CACHE_TTL_MS = 30_000;

class FeatureFlagService {
  private cache: Map<string, FeatureFlag> = new Map();
  private cacheLoaded = false;
  private lastCacheLoad = 0;

  /**
   * Read the full flag set from Redis and refresh the in-memory cache.
   * Safe to call frequently: it short-circuits until the cache TTL elapses.
   */
  public async refresh(force = false): Promise<void> {
    const now = Date.now();
    if (!force && this.cacheLoaded && now - this.lastCacheLoad < CACHE_TTL_MS) {
      return;
    }

    try {
      const client = redisConfig.getRawClient();
      if (!client) {
        logger.warn('Redis unavailable for feature flag refresh — using cached values');
        return;
      }
      const raw = await client.get(STORAGE_KEY);
      const parsed: FeatureFlag[] = raw ? JSON.parse(raw) : [];
      this.cache.clear();
      for (const flag of parsed) {
        this.cache.set(flag.name, flag);
      }
      this.cacheLoaded = true;
      this.lastCacheLoad = now;
    } catch (err) {
      logger.error('Feature flag refresh failed', err as Error);
      // Keep the existing cache; do not throw so the hot path stays up.
    }
  }

  /**
   * Persist the current flag set to Redis. Best-effort — failures are logged
   * but do not throw because the in-memory cache remains consistent.
   */
  private async persist(): Promise<void> {
    try {
      const client = redisConfig.getRawClient();
      if (!client) {
        logger.warn('Redis unavailable — feature flag changes kept in memory only');
        return;
      }
      const payload = JSON.stringify(Array.from(this.cache.values()));
      await client.set(STORAGE_KEY, payload);
    } catch (err) {
      logger.error('Feature flag persistence failed', err as Error);
    }
  }

  public async listFlags(): Promise<FeatureFlag[]> {
    await this.refresh();
    return Array.from(this.cache.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  public async getFlag(name: string): Promise<FeatureFlag | undefined> {
    await this.refresh();
    return this.cache.get(name);
  }

  public async upsertFlag(flag: FeatureFlag): Promise<FeatureFlag> {
    this.assertFlagShape(flag);
    await this.refresh();

    const existing = this.cache.get(flag.name);
    const now = new Date().toISOString();
    const next: FeatureFlag = {
      ...flag,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.cache.set(flag.name, next);
    await this.persist();
    return next;
  }

  public async deleteFlag(name: string): Promise<boolean> {
    await this.refresh();
    const had = this.cache.delete(name);
    if (had) {
      await this.persist();
    }
    return had;
  }

  /**
   * Toggle a flag's global kill switch without otherwise mutating its shape.
   * Returns the updated flag, or `undefined` if the flag does not exist.
   */
  public async setEnabled(name: string, enabled: boolean): Promise<FeatureFlag | undefined> {
    await this.refresh();
    const flag = this.cache.get(name);
    if (!flag) return undefined;
    const next: FeatureFlag = { ...flag, enabled, updatedAt: new Date().toISOString() };
    this.cache.set(name, next);
    await this.persist();
    return next;
  }

  /**
   * Evaluate a flag for a given evaluation context. Returns `defaultValue`
   * (or the boolean fallback) if the flag is unknown.
   */
  public async evaluate(
    name: string,
    context: FlagEvaluationContext = {},
    defaultValue: FlagValue = false
  ): Promise<FlagValue> {
    await this.refresh();
    const flag = this.cache.get(name);
    if (!flag) {
      return defaultValue;
    }

    // Kill switch beats everything.
    if (!flag.enabled) {
      return false;
    }

    const userId = context.userId;

    // Block list wins over rollout / allow list / variants.
    if (userId && flag.blockedUserIds?.includes(userId)) {
      return false;
    }

    // Allow list short-circuits to "on" (or first variant when present).
    if (userId && flag.allowedUserIds?.includes(userId)) {
      return pickVariant(flag, userId);
    }

    const bucket = this.bucketFor(name, context);
    if (bucket >= clampPercent(flag.rolloutPercent)) {
      return false;
    }

    return pickVariant(flag, userId ?? 'anonymous');
  }

  /**
   * Convenience helper for boolean-only checks. Mirrors `evaluate` but
   * coerces variant keys to `true` for callers that don't care about the
   * specific bucket.
   */
  public async isEnabled(
    name: string,
    context: FlagEvaluationContext = {}
  ): Promise<boolean> {
    const value = await this.evaluate(name, context, false);
    if (typeof value === 'boolean') return value;
    return value !== '';
  }

  /**
   * Stable bucket in [0, 99] derived from `<flagName>:<userId>`. The flag
   * name is part of the hash so independent flags don't correlate buckets.
   *
   * Callers may pass an explicit `bucket` to bypass the hash for QA.
   */
  public bucketFor(name: string, context: FlagEvaluationContext): number {
    if (typeof context.bucket === 'number') {
      const b = Math.floor(context.bucket);
      if (b >= 0 && b <= 99) return b;
    }
    const subject = `${name}:${context.userId ?? 'anonymous'}`;
    const hash = crypto.createHash('sha1').update(subject).digest();
    // Take the first 4 bytes as an unsigned 32-bit int then mod 100.
    const n = hash.readUInt32BE(0);
    return n % 100;
  }

  /**
   * Validate a flag's shape before accepting it. Throws to surface bad input
   * to API callers.
   */
  private assertFlagShape(flag: FeatureFlag): void {
    if (!flag.name || typeof flag.name !== 'string') {
      throw new Error('Feature flag name is required');
    }
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(flag.name)) {
      throw new Error('Feature flag name must be alphanumeric with dashes/underscores (max 64 chars)');
    }
    const pct = clampPercent(flag.rolloutPercent);
    if (pct !== flag.rolloutPercent) {
      throw new Error('rolloutPercent must be between 0 and 100');
    }
    if (flag.variants) {
      const total = Object.values(flag.variants).reduce((s, w) => s + w, 0);
      if (total !== 100) {
        throw new Error('Variant weights must sum to exactly 100');
      }
      for (const key of Object.keys(flag.variants)) {
        if (!key) throw new Error('Variant keys must be non-empty');
      }
    }
  }
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.floor(value);
}

function pickVariant(flag: FeatureFlag, userKey: string): FlagValue {
  if (!flag.variants || Object.keys(flag.variants).length === 0) {
    return true;
  }
  const keys = Object.keys(flag.variants);
  // Stable per-user variant assignment. Hash input combines the flag name
  // (so flags don't correlate) and the user key (so each user gets a
  // stable, statistically independent bucket). This is the property that
  // makes A/B testing meaningful: different users land in different
  // buckets with a predictable distribution.
  const hash = crypto
    .createHash('sha1')
    .update(`variant:${flag.name}:${userKey}`)
    .digest();
  const n = hash.readUInt32BE(0) % 100;
  let cursor = 0;
  for (const key of keys) {
    cursor += flag.variants[key];
    if (n < cursor) return key;
  }
  return keys[keys.length - 1];
}

export const featureFlagService = new FeatureFlagService();
export default featureFlagService;
