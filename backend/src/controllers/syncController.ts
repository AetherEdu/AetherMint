import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import * as syncService from '../services/syncService';
import type { SyncEntityType } from '../models/SyncStatus';
import { ValidationError } from '../utils/errors';

/**
 * Sync API controller
 * Device registration, sync status, and entity sync endpoints
 */

export async function registerDevice(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { deviceId, userId, name, type, userAgent } = req.body;
    if (!deviceId || !userId) {
      throw new ValidationError('Missing deviceId or userId');
    }
    const device = await syncService.registerDevice({
      deviceId,
      userId,
      name,
      type,
      userAgent
    });
    res.status(200).json({
      success: true,
      device: {
        id: device._id,
        deviceId: device.deviceId,
        userId: device.userId,
        name: device.name,
        type: device.type,
        status: device.status,
        lastSeenAt: device.lastSeenAt
      }
    });
  } catch (error) {
    logger.error('registerDevice error', error);
    next(error);
  }
}

export async function unregisterDevice(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { deviceId } = req.params;
    if (!deviceId) {
      throw new ValidationError('Missing deviceId');
    }
    await syncService.unregisterDevice(deviceId);
    res.status(200).json({ success: true, message: 'Device unregistered' });
  } catch (error) {
    logger.error('unregisterDevice error', error);
    next(error);
  }
}

export async function heartbeat(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { deviceId } = req.body;
    if (!deviceId) {
      throw new ValidationError('Missing deviceId');
    }
    await syncService.updateDeviceHeartbeat(deviceId);
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('heartbeat error', error);
    next(error);
  }
}

export async function getDevices(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.params.userId || (req.query.userId as string);
    if (!userId) {
      throw new ValidationError('Missing userId');
    }
    const devices = await syncService.getDevicesForUser(userId);
    res.status(200).json({
      success: true,
      devices: devices.map((d) => ({
        id: d._id,
        deviceId: d.deviceId,
        userId: d.userId,
        name: d.name,
        type: d.type,
        status: d.status,
        lastSeenAt: d.lastSeenAt,
        lastSyncAt: d.lastSyncAt
      }))
    });
  } catch (error) {
    logger.error('getDevices error', error);
    next(error);
  }
}

export async function getSyncStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.params.userId || (req.query.userId as string);
    const entityType = req.query.entityType as SyncEntityType | undefined;
    const entityId = req.query.entityId as string | undefined;
    if (!userId) {
      throw new ValidationError('Missing userId');
    }
    const statuses = await syncService.getSyncStatus(userId, entityType, entityId);
    res.status(200).json({ success: true, status: statuses });
  } catch (error) {
    logger.error('getSyncStatus error', error);
    next(error);
  }
}

export async function syncEntity(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      userId,
      deviceId,
      entityType,
      entityId,
      version,
      updatedAt,
      payload,
      strategy
    } = req.body;
    if (!userId || !deviceId || !entityType || !entityId || version === undefined) {
      throw new ValidationError(
        'Missing required fields: userId, deviceId, entityType, entityId, version'
      );
    }
    const result = await syncService.syncEntity(
      {
        userId,
        deviceId,
        entityType,
        entityId,
        version: Number(version),
        updatedAt: updatedAt ? new Date(updatedAt) : new Date(),
        payload: payload || {}
      },
      strategy
    );
    res.status(200).json({ ...result, success: true });
  } catch (error) {
    logger.error('syncEntity error', error);
    next(error);
  }
}

export async function enqueueSync(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      userId,
      deviceId,
      entityType,
      entityId,
      operation,
      version,
      payload
    } = req.body;
    if (
      !userId ||
      !deviceId ||
      !entityType ||
      !entityId ||
      !operation ||
      version === undefined
    ) {
      throw new ValidationError(
        'Missing required fields: userId, deviceId, entityType, entityId, operation, version'
      );
    }
    const id = syncService.enqueueSync({
      userId,
      deviceId,
      entityType,
      entityId,
      operation: operation as 'create' | 'update' | 'delete',
      version: Number(version),
      payload: payload || {}
    });
    res.status(202).json({ success: true, queueId: id });
  } catch (error) {
    logger.error('enqueueSync error', error);
    next(error);
  }
}

export async function processQueue(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.query.userId as string | undefined;
    const result = userId
      ? await syncService.processSyncQueueForUser(userId)
      : await syncService.processSyncQueue();
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    logger.error('processQueue error', error);
    next(error);
  }
}

export async function getQueueStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const status = syncService.getQueueStatus();
    res.status(200).json({ success: true, ...status });
  } catch (error) {
    logger.error('getQueueStatus error', error);
    next(error);
  }
}
