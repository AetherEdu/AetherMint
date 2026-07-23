/**
 * Idempotency Middleware
 *
 * Implements Stripe-style idempotency keys for mutation endpoints
 * (POST/PUT/PATCH/DELETE). Clients send `Idempotency-Key: <unique-string>`
 * on the request. The middleware:
 *
 *   1. Validates the key (8-255 chars).
 *   2. On hit: replays the cached response with `Idempotency-Replayed: true`.
 *   3. On miss: acquires a Redis lock with TTL; if a request for the same
 *      key is still in flight, returns 409 with a clear message.
 *   4. On response finish: caches the status + body under the same key
 *      (TTL = same as lock) so a retry returns the identical result.
 *
 * Storage: Redis when available (preferred for multi-instance deploys).
 * Falls back to an in-process Map when Redis is unreachable so dev / CI
 * environments without a Redis instance still get correct behaviour
 * within a single process. Behaviour in fallback mode is documented in
 * the README (recommended TTL 24h).
 */

import { Request, Response, NextFunction } from 'express';
import { connectRedis } from '../utils/redis';
import logger from '../utils/logger';

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
export const IDEMPOTENCY_REPLAY_HEADER = 'Idempotency-Replayed';

export const DEFAULT_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 24h
export const LOCK_TTL_SECONDS = 60; // In-flight lock
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:\-]{8,255}$/;

export interface CachedResponse {
  statusCode: number;
  body: any;
  storedAt: number;
}

export interface IdempotencyOptions {
  /** Override TTL (seconds) for cached responses. */
  ttlSeconds?: number;
  /** Override TTL (seconds) for the in-flight lock. */
  lockTtlSeconds?: number;
}

interface FallbackStore {
  results: Map<string, CachedResponse>;
  locks: Map<string, number>;
}

const fallback: FallbackStore = {
  results: new Map(),
  locks: new Map(),
};

/**
 * Minimal interface we depend on from the Redis client. Keeps us
 * independent of the lib version chosen by `utils/redis.ts`.
 */
interface MinimalRedis {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    options?: { EX?: number; NX?: boolean }
  ): Promise<string | null>;
  del(key: string): Promise<number>;
}

/**
 * Build a per-request identity component used to namespace the key.
 * Authenticated users get a user-scoped key so a key collision across
 * tenants cannot replay another user's response.
 */
function getIdentityComponent(req: Request): string {
  const user = (req as any).user;
  if (user?.id) {
    return `u:${user.id}`;
  }
  return `ip:${req.ip ?? 'unknown'}`;
}

function buildStorageKeys(
  req: Request,
  rawKey: string
): { resultKey: string; lockKey: string } {
  const identity = getIdentityComponent(req);
  const route = `${req.method}:${(req.baseUrl || '') + req.path}`;
  const composite = `${identity}|${route}|${rawKey}`;
  return {
    resultKey: `idem:result:${composite}`,
    lockKey: `idem:lock:${composite}`,
  };
}

async function readCached(
  client: MinimalRedis | null,
  resultKey: string
): Promise<CachedResponse | null> {
  if (client) {
    const raw = await client.get(resultKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CachedResponse;
    } catch {
      return null;
    }
  }
  const entry = fallback.results.get(resultKey);
  if (!entry) return null;
  // Honour TTL even for fallback storage.
  if (Date.now() - entry.storedAt > DEFAULT_IDEMPOTENCY_TTL_SECONDS * 1000) {
    fallback.results.delete(resultKey);
    return null;
  }
  return entry;
}

async function writeCached(
  client: MinimalRedis | null,
  resultKey: string,
  ttlSeconds: number,
  value: CachedResponse
): Promise<void> {
  if (client) {
    await client.set(resultKey, JSON.stringify(value), { EX: ttlSeconds });
    return;
  }
  fallback.results.set(resultKey, value);
}

async function acquireLock(
  client: MinimalRedis | null,
  lockKey: string,
  lockTtl: number
): Promise<boolean> {
  if (client) {
    const res = await client.set(lockKey, '1', { EX: lockTtl, NX: true });
    return res === 'OK';
  }
  const existing = fallback.locks.get(lockKey);
  if (existing && Date.now() - existing < lockTtl * 1000) {
    return false;
  }
  fallback.locks.set(lockKey, Date.now());
  return true;
}

async function isLocked(
  client: MinimalRedis | null,
  lockKey: string,
  lockTtl: number
): Promise<boolean> {
  if (client) {
    const v = await client.get(lockKey);
    return v !== null;
  }
  const ts = fallback.locks.get(lockKey);
  if (!ts) return false;
  if (Date.now() - ts >= lockTtl * 1000) {
    fallback.locks.delete(lockKey);
    return false;
  }
  return true;
}

async function releaseLock(
  client: MinimalRedis | null,
  lockKey: string
): Promise<void> {
  try {
    if (client) {
      await client.del(lockKey);
    } else {
      fallback.locks.delete(lockKey);
    }
  } catch (err) {
    logger.warn(`Idempotency: failed to release lock ${lockKey}: ${err}`);
  }
}

/**
 * Express middleware factory.
 * Pass `{ ttlSeconds, lockTtlSeconds }` to override defaults.
 */
export const idempotencyMiddleware = (options: IdempotencyOptions = {}) => {
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_IDEMPOTENCY_TTL_SECONDS;
  const lockTtlSeconds = options.lockTtlSeconds ?? LOCK_TTL_SECONDS;

  return async function idempotency(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (
      req.method !== 'POST' &&
      req.method !== 'PUT' &&
      req.method !== 'PATCH' &&
      req.method !== 'DELETE'
    ) {
      return next();
    }

    const rawHeader =
      (req.header(IDEMPOTENCY_HEADER) as string | undefined) ||
      (req.header('idempotency-key') as string | undefined);

    if (!rawHeader) {
      return next();
    }

    if (!IDEMPOTENCY_KEY_PATTERN.test(rawHeader)) {
      res.status(400).json({
        success: false,
        message:
          'Invalid Idempotency-Key. Must be 8-255 chars, alphanumeric plus . _ : -',
      });
      return;
    }

    let client: MinimalRedis | null = null;
    try {
      client = (await connectRedis()) as unknown as MinimalRedis | null;
    } catch (err) {
      logger.warn(`Idempotency: redis unavailable, using in-process fallback: ${err}`);
    }

    const { resultKey, lockKey } = buildStorageKeys(req, rawHeader);

    try {
      // 1. Replay cached response if present.
      const cached = await readCached(client, resultKey);
      if (cached) {
        res.setHeader(IDEMPOTENCY_HEADER, rawHeader);
        res.setHeader(IDEMPOTENCY_REPLAY_HEADER, 'true');
        res.status(cached.statusCode).json(cached.body);
        return;
      }

      // 2. If still processing the same key, return 409.
      const locked = await isLocked(client, lockKey, lockTtlSeconds);
      if (locked) {
        res.status(409).json({
          success: false,
          message:
            'A request with this Idempotency-Key is currently in progress. Retry once it completes.',
          retryAfterSeconds: lockTtlSeconds,
        });
        return;
      }

      // 3. Acquire lock for this request.
      const acquired = await acquireLock(client, lockKey, lockTtlSeconds);
      if (!acquired) {
        // Lost the race against another concurrent request.
        res.status(409).json({
          success: false,
          message:
            'A request with this Idempotency-Key is concurrently being processed.',
        });
        return;
      }

      res.setHeader(IDEMPOTENCY_HEADER, rawHeader);
      res.setHeader(IDEMPOTENCY_REPLAY_HEADER, 'false');

      // 4. Capture response on finish and write to cache (skipped on 5xx).
      let capturedBody: any = undefined;
      let capturedStatus = 200;
      let settled = false;

      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        capturedBody = body;
        capturedStatus = res.statusCode;
        return originalJson(body);
      };

      const releaseLockSafely = (): void => {
        if (settled) return;
        settled = true;
        void releaseLock(client, lockKey);
      };

      res.on('finish', () => {
        if (settled) return;
        const finalStatus = res.statusCode;
        // Do NOT cache server errors so the client can retry safely.
        if (finalStatus >= 500) {
          releaseLockSafely();
          return;
        }

        if (capturedBody === undefined) {
          // No JSON body was written; safe to release without caching.
          releaseLockSafely();
          return;
        }

        settled = true;
        void writeCached(client, resultKey, ttlSeconds, {
          statusCode: finalStatus,
          body: capturedBody,
          storedAt: Date.now(),
        })
          .catch((err) =>
            logger.error(
              `Idempotency: failed to persist cached response for ${resultKey}: ${err}`
            )
          )
          .finally(() => releaseLock(client, lockKey));
      });

      // If the client disconnects before 'finish' fires, still release
      // the in-flight lock so retries aren't blocked for the lock TTL.
      res.on('close', () => {
        // 'finish' will still be observed in the normal path; the
        // settled flag prevents double-release.
        releaseLockSafely();
      });

      next();
    } catch (err) {
      logger.error(`Idempotency middleware error: ${err}`);
      // Fail open: do not block the request on idempotency infrastructure failures.
      next();
    }
  };
};

/**
 * Test-only helper for resetting the in-process fallback state.
 * Not exported from the public surface; useful for unit tests.
 */
export const __resetIdempotencyFallbackForTests = (): void => {
  fallback.results.clear();
  fallback.locks.clear();
};
