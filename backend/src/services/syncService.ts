/**
 * Data synchronization service
 * Device registration, real-time sync coordination, conflict resolution, and queue processing.
 * GIVEN device change, WHEN detected, THEN data syncs automatically.
 */

import logger from '../utils/logger';
import { Device, SyncStatus, type IDevice, type SyncEntityType } from '../models/SyncStatus';
import { getDefaultStrategy, resolveConflict, type ConflictStrategy, type ConflictInput } from './conflictResolution';
import { getQueueManager, type QueuedItem } from './queueManager';

export interface RegisterDeviceInput {
  deviceId: string;
  userId: string;
  name?: string;
  type?: string;
  userAgent?: string;
}

export interface SyncEntityInput {
  userId: string;
  deviceId: string;
  entityType: SyncEntityType;
  entityId: string;
  version: number;
  updatedAt: Date;
  payload: Record<string, unknown>;
}

export interface SyncEntityResult {
  success: boolean;
  version: number;
  lastModifiedAt: Date;
  payload: Record<string, unknown>;
  conflictResolved?: boolean;
  strategy?: ConflictStrategy;
  message?: string;
}

export interface SyncStatusInfo {
  entityType: SyncEntityType;
  entityId: string;
  version: number;
  lastModifiedAt: Date;
  lastModifiedByDeviceId: string;
  payload?: Record<string, unknown>;
}

let websocketEmit: ((userId: string, event: string, data: unknown) => void) | null = null;

export function setSyncWebsocketEmitter(emit: (userId: string, event: string, data: unknown) => void): void {
  websocketEmit = emit;
}

function notifySyncEvent(userId: string, event: string, data: unknown): void {
  try {
    if (websocketEmit) {
      websocketEmit(userId, event, data);
    }
  } catch (error) {
    logger.debug(`Sync websocket emit failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// --- Device registration and management ---

export async function registerDevice(input: RegisterDeviceInput): Promise<IDevice> {
  const now = new Date();
  const device = await Device.findOneAndUpdate(
    { deviceId: input.deviceId },
    {
      $set: {
        userId: input.userId,
        name: input.name,
        type: input.type,
        userAgent: input.userAgent,
        status: 'online',
        lastSeenAt: now
      }
    },
    { new: true, upsert: true }
  );

  logger.info(`Device registered: ${input.deviceId} for user ${input.userId}`);
  await onDeviceOnline(input.userId, input.deviceId);

  return device as IDevice;
}

export async function unregisterDevice(deviceId: string): Promise<void> {
  await Device.findOneAndUpdate(
    { deviceId },
    { $set: { status: 'offline', lastSeenAt: new Date() } }
  );

  logger.info(`Device unregistered: ${deviceId}`);
}

export async function updateDeviceHeartbeat(deviceId: string): Promise<void> {
  await Device.findOneAndUpdate(
    { deviceId },
    { $set: { lastSeenAt: new Date() } }
  );
}

export async function getDevicesForUser(userId: string): Promise<IDevice[]> {
  const devices = await Device.find({ userId }).sort({ lastSeenAt: -1 }).lean();
  return devices as IDevice[];
}

export async function getDevice(deviceId: string): Promise<IDevice | null> {
  const device = await Device.findOne({ deviceId }).lean();
  return device as IDevice | null;
}

// --- Sync status tracking ---

export async function getSyncStatus(
  userId: string,
  entityType?: SyncEntityType,
  entityId?: string
): Promise<SyncStatusInfo[]> {
  const filter: Record<string, string> = { userId };

  if (entityType) {
    filter.entityType = entityType;
  }

  if (entityId) {
    filter.entityId = entityId;
  }

  const statuses = await SyncStatus.find(filter).lean();

  return statuses.map((status: any) => ({
    entityType: status.entityType,
    entityId: status.entityId,
    version: status.version,
    lastModifiedAt: status.lastModifiedAt,
    lastModifiedByDeviceId: status.lastModifiedByDeviceId,
    payload: status.metadata?.currentPayload as Record<string, unknown> | undefined
  }));
}

// --- Core sync: apply client state with conflict resolution ---

export async function syncEntity(
  input: SyncEntityInput,
  strategy?: ConflictStrategy
): Promise<SyncEntityResult> {
  const chosenStrategy = strategy ?? getDefaultStrategy(input.entityType);

  let current = await SyncStatus.findOne({
    userId: input.userId,
    entityType: input.entityType,
    entityId: input.entityId
  });

  const conflictInput: ConflictInput = {
    entityType: input.entityType,
    entityId: input.entityId,
    serverVersion: current?.version ?? 0,
    serverUpdatedAt: (current?.lastModifiedAt as Date) ?? new Date(0),
    serverPayload: (current?.metadata?.currentPayload as Record<string, unknown>) ?? {},
    clientVersion: input.version,
    clientUpdatedAt: new Date(input.updatedAt),
    clientPayload: input.payload,
    deviceId: input.deviceId
  };

  const resolution = resolveConflict(conflictInput, chosenStrategy);
  const nextVersion = current ? current.version + 1 : 1;
  const now = new Date();

  if (!current) {
    current = await SyncStatus.create({
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      version: nextVersion,
      lastModifiedAt: now,
      lastModifiedByDeviceId: input.deviceId,
      metadata: {
        currentPayload: resolution.payload
      }
    });
  } else {
    current.version = nextVersion;
    current.lastModifiedAt = now;
    current.lastModifiedByDeviceId = input.deviceId;
    (current.metadata as any) = current.metadata || {};
    (current.metadata as any).currentPayload = resolution.payload;
    await current.save();
  }

  await Device.findOneAndUpdate(
    { deviceId: input.deviceId },
    { $set: { lastSyncAt: now, status: 'online' } }
  );

  notifySyncEvent(input.userId, 'sync-complete', {
    entityType: input.entityType,
    entityId: input.entityId,
    version: nextVersion,
    conflictResolved: resolution.conflictDetected,
    strategy: chosenStrategy
  });

  return {
    success: true,
    version: nextVersion,
    lastModifiedAt: now,
    payload: resolution.payload,
    conflictResolved: resolution.conflictDetected,
    strategy: chosenStrategy,
    message: resolution.message
  };
}

// --- Offline queue: when online, process queue ---

async function processQueuedItem(item: QueuedItem): Promise<void> {
  await syncEntity({
    userId: item.userId,
    deviceId: item.deviceId,
    entityType: item.entityType,
    entityId: item.entityId,
    version: item.version,
    updatedAt: item.queuedAt,
    payload: item.payload ?? {}
  });
}

function setupQueueHandler(): void {
  const queue = getQueueManager();
  queue.setProcessHandler(processQueuedItem);
}

/**
 * Called when a device comes online: process its queued offline changes.
 */
export async function onDeviceOnline(userId: string, deviceId: string): Promise<{ processed: number; failed: number }> {
  setupQueueHandler();

  const queue = getQueueManager();
  const result = await queue.processQueueForUser(userId);

  if (result.processed > 0) {
    notifySyncEvent(userId, 'queue-processed', {
      deviceId,
      processed: result.processed,
      failed: result.failed
    });
  }

  return result;
}

/**
 * Enqueue a sync operation (e.g. when client is offline or wants deferred sync).
 */
export function enqueueSync(item: Omit<QueuedItem, 'id' | 'queuedAt' | 'retryCount'>): string {
  setupQueueHandler();
  return getQueueManager().enqueue(item);
}

/**
 * Process entire queue (e.g. global "we're online" event).
 */
export async function processSyncQueue(): Promise<{ processed: number; failed: number }> {
  setupQueueHandler();
  return getQueueManager().processQueue();
}

export async function processSyncQueueForUser(userId: string): Promise<{ processed: number; failed: number }> {
  setupQueueHandler();
  return getQueueManager().processQueueForUser(userId);
}

/**
 * Queue status for status tracking.
 */
export function getQueueStatus(): { pendingCount: number; isProcessing: boolean } {
  const queue = getQueueManager();
  return {
    pendingCount: queue.getPendingCount(),
    isProcessing: queue.isProcessing()
  };
}

setupQueueHandler();
