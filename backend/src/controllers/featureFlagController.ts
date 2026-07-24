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
 * Evaluate endpoint for non-admin clients (e.g. the SPA bootstrapping logic).
 * Trims sensitive fields from the response.
 */
export const evaluateForUser = async (req: Request, res: Response): Promise<void> => {
  const userId =
    (req as Request & { user?: { id?: string } }).user?.id ??
    (req.header('x-user-id') ?? undefined);
  const flagName = req.params.name;

  try {
    const value = await featureFlagService.evaluate(flagName, { userId });
    res.json({
      success: true,
      data: { name: flagName, value, userId: userId ?? null },
    });
  } catch (err) {
    logger.error('evaluateForUser error', err as Error);
    res.status(500).json({ success: false, error: 'Evaluation failed' });
  }
};
