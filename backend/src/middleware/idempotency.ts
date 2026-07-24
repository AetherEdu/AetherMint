/**
 * Idempotency Middleware
 *
 * Implements idempotency-key support to prevent duplicate operations on payment
 * and critical mutation endpoints.
 *
 * - Reads the `Idempotency-Key` header
 * - Stores responses in Redis with a TTL
 * - Returns the cached response for duplicate keys
 *
 * Issue: #264
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import redisConfig from '../config/redis';
import logger from '../utils/logger';

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // 24 hours

/** Holds the original response body for replay. */
interface CachedResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  timestamp: number;
}

/**
 * Express middleware that enforces idempotency for a given endpoint.
 *
 * Usage:
 *   import { idempotency } from '../middleware/idempotency';
 *   router.post('/payments', idempotency(), handler);
 */
export function idempotency(options?: { ttlSeconds?: number }) {
  const ttlSeconds = options?.ttlSeconds ?? DEFAULT_TTL_SECONDS;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.header(IDEMPOTENCY_KEY_HEADER);
    if (!key) {
      // No idempotency key provided – proceed without protection
      return next();
    }

    // Sanitise the key to prevent injection into Redis key names
    if (typeof key !== 'string' || key.length > 256) {
      res.status(400).json({
        success: false,
        error: 'Invalid idempotency key',
      });
      return;
    }

    // Include a hash of the request body so that different payloads
    // with the same idempotency key are treated as distinct requests.
    const bodyHash = req.body
      ? crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex').slice(0, 16)
      : 'nobody';
    const safeKey = crypto.createHash('sha256').update(key).digest('hex');
    const redisKey = `idempotency:${req.method}:${req.path}:${bodyHash}:${safeKey}`;

    const client = redisConfig.getRawClient();
    if (!client) {
      logger.warn('Redis unavailable – proceeding without idempotency');
      return next();
    }

    try {
      // Check if we already have a cached response for this key
      const cached = await client.get(redisKey);
      if (cached) {
        const parsed: CachedResponse = JSON.parse(cached);
        logger.info('Idempotent request – returning cached response', { redisKey });

        // Replay the cached response
        res.status(parsed.statusCode);
        for (const [header, value] of Object.entries(parsed.headers)) {
          if (value !== undefined) {
            res.setHeader(header, value as string | string[]);
          }
        }
        res.json(parsed.body);
        return;
      }

      // Intercept res.json() to capture the response body
      const originalJson = res.json.bind(res);
      res.json = function (body: unknown): Response {
        const cachedResponse: CachedResponse = {
          statusCode: res.statusCode,
          headers: res.getHeaders() as Record<string, string | string[] | undefined>,
          body,
          timestamp: Date.now(),
        };

        // Store asynchronously – don't block the response
        client
          .set(redisKey, JSON.stringify(cachedResponse), 'EX', ttlSeconds)
          .catch(err =>
            logger.error(`Failed to cache idempotency response for key ${redisKey}`, err as Error)
          );

        return originalJson(body);
      };

      next();
    } catch (err) {
      logger.error('Idempotency middleware error – proceeding without idempotency', err as Error);
      next();
    }
  };
}

/**
 * Manually clear an idempotency key from Redis (useful in tests or admin ops).
 */
export async function clearIdempotencyKey(method: string, path: string, rawKey: string): Promise<void> {
  const client = redisConfig.getRawClient();
  if (!client) return;

  const safeKey = crypto.createHash('sha256').update(rawKey).digest('hex');
  const redisKey = `idempotency:${method}:${path}:${safeKey}`;
  await client.del(redisKey);
}

export { IDEMPOTENCY_KEY_HEADER };
