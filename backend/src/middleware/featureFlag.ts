/**
 * Feature Flag Middleware
 *
 * Express middleware factory that gates a route on a feature flag.
 *
 * Usage:
 *   router.get('/labs/new-quiz', requireFeature('new-quiz-ui'), handler);
 *
 * The authenticated user is taken from `req.user.id` when present. Anonymous
 * callers get the default variant — set the flag's rolloutPercent above 0 to
 * expose routes in pre-launch QA.
 */

import { Request, Response, NextFunction } from 'express';
import {
  FlagValue,
  featureFlagService,
} from '../services/featureFlagService';
import logger from '../utils/logger';

export interface FeatureFlagOptions {
  /** Override the default behaviour when the flag is missing. */
  defaultValue?: FlagValue;
  /**
   * If set, evaluate against an explicit bucket in [0, 99] instead of the
   * userId hash. Useful for QA endpoints (`?bucket=42`).
   */
  bucketQueryParam?: string;
}

export const requireFeature = (
  flagName: string,
  options: FeatureFlagOptions = {}
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId =
        (req as Request & { user?: { id?: string } }).user?.id ??
        (req.header('x-user-id') ?? undefined);

      const context: { userId?: string; bucket?: number } = { userId };
      if (options.bucketQueryParam && typeof req.query[options.bucketQueryParam] === 'string') {
        const raw = Number.parseInt(req.query[options.bucketQueryParam] as string, 10);
        if (Number.isFinite(raw)) {
          context.bucket = raw;
        }
      }

      const value = await featureFlagService.evaluate(
        flagName,
        context,
        options.defaultValue ?? false
      );

      const enabled =
        typeof value === 'boolean' ? value : Boolean(value);

      if (!enabled) {
        res.status(404).json({
          success: false,
          error: 'Feature not available',
          feature: flagName,
        });
        return;
      }

      // Expose the evaluated value to downstream handlers (e.g. for A/B
      // variant tracking). It is *not* authoritative — handlers should not
      // use it for security checks.
      (req as Request & { featureFlag?: { name: string; value: FlagValue } }).featureFlag = {
        name: flagName,
        value,
      };
      next();
    } catch (err) {
      // Do NOT silently fail open — an outage in the flag service must
      // not lift a kill switch invisibly. Surface degraded mode to the
      // caller with X-Feature-Flag-Status, log loudly, and let the route
      // run. Operators can monitor the header metric to catch abuse or
      // outages quickly.
      logger.warn('Feature flag middleware error — defaulting to enabled in degraded mode', err as Error);
      res.setHeader('X-Feature-Flag-Status', 'degraded');
      next();
    }
  };
};

/**
 * Assert a specific A/B variant is being served. Mount AFTER `requireFeature`.
 */
export const requireVariant = (flagName: string, variant: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const stored = (req as Request & { featureFlag?: { name: string; value: FlagValue } })
      .featureFlag;
    if (stored?.name === flagName && stored.value === variant) {
      next();
      return;
    }
    next();
  };
};
