/**
 * Feature Flag Controller
 *
 * Thin HTTP layer over `featureFlagService`. Validates request bodies, maps
 * domain errors to HTTP 400s, and is intentionally light so the service
 * stays the unit-testable source of truth.
 */

import { Request, Response, NextFunction } from 'express';
import { FeatureFlag, featureFlagService } from '../services/featureFlagService';
import logger from '../utils/logger';

interface FlagBody {
  name?: string;
  description?: string;
  enabled?: boolean;
  rolloutPercent?: number;
  variants?: Record<string, number>;
  allowedUserIds?: string[];
  blockedUserIds?: string[];
  userId?: string;
}

function normalize(body: FlagBody, fallbackName?: string): FeatureFlag {
  const name = (body.name ?? fallbackName ?? '').trim().toLowerCase();
  return {
    name,
    description: body.description,
    enabled: Boolean(body.enabled),
    rolloutPercent: typeof body.rolloutPercent === 'number' ? body.rolloutPercent : 0,
    variants: body.variants,
    allowedUserIds: body.allowedUserIds,
    blockedUserIds: body.blockedUserIds,
    createdAt: '',
    updatedAt: '',
  };
}

export const listFlags = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const flags = await featureFlagService.listFlags();
    res.json({ success: true, data: flags });
  } catch (err) {
    logger.error('listFlags error', err as Error);
    next(err);
  }
};

export const getFlag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const flag = await featureFlagService.getFlag(req.params.name);
    if (!flag) {
      res.status(404).json({ success: false, error: 'Flag not found' });
      return;
    }
    res.json({ success: true, data: flag });
  } catch (err) {
    logger.error('getFlag error', err as Error);
    next(err);
  }
};

export const createFlag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const flag = normalize(req.body as FlagBody);
    const created = await featureFlagService.upsertFlag(flag);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid flag';
    if (message.startsWith('Feature flag name') || message.includes('rolloutPercent') || message.includes('Variant')) {
      res.status(400).json({ success: false, error: message });
      return;
    }
    logger.error('createFlag error', err as Error);
    next(err);
  }
};

export const updateFlag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const flag = normalize(req.body as FlagBody, req.params.name);
    const updated = await featureFlagService.upsertFlag(flag);
    res.json({ success: true, data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid flag';
    if (message.startsWith('Feature flag name') || message.includes('rolloutPercent') || message.includes('Variant')) {
      res.status(400).json({ success: false, error: message });
      return;
    }
    logger.error('updateFlag error', err as Error);
    next(err);
  }
};

export const toggleFlag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const enabled = Boolean((req.body as FlagBody).enabled);
    const updated = await featureFlagService.setEnabled(req.params.name, enabled);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Flag not found' });
      return;
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error('toggleFlag error', err as Error);
    next(err);
  }
};

export const deleteFlag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const removed = await featureFlagService.deleteFlag(req.params.name);
    if (!removed) {
      res.status(404).json({ success: false, error: 'Flag not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    logger.error('deleteFlag error', err as Error);
    next(err);
  }
};

/**
 * Validate an `?bucket=N` query parameter into a typed result the
 * controller can switch on without juggling parses, regexes, and ranges
 * in the request hot path.
 *
 * Outcomes:
 *   - `{ kind: 'absent' }`     — caller did not supply `?bucket=`; the
 *                                service will hash by userId.
 *   - `{ kind: 'invalid' }`    — caller supplied garbage (non-digits,
 *                                out of range). Surface as 400.
 *   - `{ kind: 'valid', value }` — caller supplied an integer in [0, 99].
 *
 * Pure: no I/O, no logger, no request object. Easy to unit-test.
 */
export type BucketParseResult =
  | { kind: 'absent' }
  | { kind: 'invalid' }
  | { kind: 'valid'; value: number };

export const parseBucketParam = (raw: unknown): BucketParseResult => {
  if (raw === undefined || raw === null) return { kind: 'absent' };
  // Express collapses `?bucket=` to an empty string. Treat as absent.
  if (typeof raw === 'string' && raw.length === 0) return { kind: 'absent' };
  // Reject arrays early — `?bucket=10&bucket=20` shouldn't sneak past.
  if (typeof raw !== 'string') return { kind: 'invalid' };
  // Mandate digits only — closes the `?bucket=5abc` parseInt-truncation hole.
  if (!/^\d+$/.test(raw)) return { kind: 'invalid' };
  const parsed = Number.parseInt(raw, 10);
  if (parsed < 0 || parsed > 99) return { kind: 'invalid' };
  return { kind: 'valid', value: parsed };
};

/**
 * Evaluate endpoint for non-admin clients (e.g. the SPA bootstrapping logic).
 * Trims sensitive fields from the response. Honours `?bucket=N` for QA
 * bucketed rollouts so support engineers can pin themselves into a roll
 * without changing their user identifier.
 *
 * NOTE: `data.userId` echoes the caller's own ID back to them. This is
 * intentional — the value is already known to the caller and the request
 * never crosses trust boundaries — but downstream SPA logging should treat
 * the response as containing the viewer's own identifier, not a third-
 * party attribution.
 */
export const evaluateForUser = async (req: Request, res: Response): Promise<void> => {
  const userId =
    (req as Request & { user?: { id?: string } }).user?.id ??
    (req.header('x-user-id') ?? undefined);
  const flagName = req.params.name;

  // Validate `?bucket=N` via a pure helper so the gate ordering is
  // impossible to invert by mistake. Empty / omitted buckets fall
  // through to `evaluate()` with no bucket, which hashes by userId.
  const validated = parseBucketParam(req.query.bucket);
  if (validated.kind === 'invalid') {
    res.status(400).json({ success: false, error: 'bucket must be an integer in [0, 99]' });
    return;
  }
  // Narrow the discriminated union explicitly so TypeScript can read
  // `.value` after the early-return.
  const bucket = validated.kind === 'valid' ? validated.value : undefined;
  const context = bucket !== undefined
    ? { userId, bucket }
    : { userId };

  try {
    const value = await featureFlagService.evaluate(flagName, context);
    res.json({
      success: true,
      data: { name: flagName, value, userId: userId ?? null },
    });
  } catch (err) {
    logger.error('evaluateForUser error', err as Error);
    res.status(500).json({ success: false, error: 'Evaluation failed' });
  }
};
