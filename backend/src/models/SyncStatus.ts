/**
 * SyncStatus and Device models
 * Device registration and sync state tracking for cross-device synchronization.
 */

import mongoose, { Document, Model, Schema } from 'mongoose';

// --- Device (registration and management) ---

export type DeviceStatus = 'online' | 'offline' | 'syncing' | 'error';

export interface IDevice extends Document {
  _id: string;
  deviceId: string;
  userId: string;
  name?: string;
  type?: string;
  userAgent?: string;
  status: DeviceStatus;
  lastSeenAt: Date;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceSchema: Schema = new Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    name: { type: String, trim: true },
    type: { type: String, trim: true },
    userAgent: { type: String },
    status: {
      type: String,
      enum: ['online', 'offline', 'syncing', 'error'],
      default: 'offline'
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      required: true
    },
    lastSyncAt: { type: Date }
  },
  {
    timestamps: true
  }
);

DeviceSchema.index({ userId: 1, deviceId: 1 });
DeviceSchema.index({ userId: 1, lastSeenAt: -1 });

export const Device: Model<IDevice> = mongoose.model<IDevice>('Device', DeviceSchema);

// --- Sync status per entity (for conflict detection and status tracking) ---

export type SyncEntityType =
  | 'progress'
  | 'preferences'
  | 'course_state'
  | 'notes'
  | 'generic'
  | 'collaboration_doc'
  | 'whiteboard'
  | 'classroom'
  | 'workspace';

export interface ISyncStatus extends Document {
  _id: string;
  userId: string;
  entityType: SyncEntityType;
  entityId: string;
  version: number;
  lastModifiedAt: Date;
  lastModifiedByDeviceId: string;
  checksum?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const SyncStatusSchema: Schema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    entityType: {
      type: String,
      required: true,
      enum: ['progress', 'preferences', 'course_state', 'notes', 'generic', 'collaboration_doc', 'whiteboard', 'classroom', 'workspace'],
      index: true
    },
    entityId: {
      type: String,
      required: true,
      index: true
    },
    version: {
      type: Number,
      default: 0,
      required: true
    },
    lastModifiedAt: {
      type: Date,
      default: Date.now,
      required: true
    },
    lastModifiedByDeviceId: {
      type: String,
      required: true
    },
    checksum: { type: String },
    metadata: { type: Schema.Types.Mixed }
  },
  {
    timestamps: true
  }
);

SyncStatusSchema.index({ userId: 1, entityType: 1, entityId: 1 }, { unique: true });
SyncStatusSchema.index({ userId: 1, lastModifiedAt: -1 });

export const SyncStatus: Model<ISyncStatus> = mongoose.model<ISyncStatus>('SyncStatus', SyncStatusSchema);

// --- Sync operation log (audit / replay) ---

export type SyncOperationType = 'create' | 'update' | 'delete';

export interface ISyncOperation extends Document {
  _id: string;
  userId: string;
  deviceId: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperationType;
  version: number;
  payload?: Record<string, unknown>;
  resolvedAt?: Date;
  conflictResolved?: boolean;
  createdAt: Date;
}

const SyncOperationSchema: Schema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    deviceId: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, required: true, index: true },
    operation: {
      type: String,
      enum: ['create', 'update', 'delete'],
      required: true
    },
    version: { type: Number, required: true },
    payload: { type: Schema.Types.Mixed },
    resolvedAt: { type: Date },
    conflictResolved: { type: Boolean }
  },
  {
    timestamps: true
  }
);

SyncOperationSchema.index({ userId: 1, createdAt: -1 });

export const SyncOperation: Model<ISyncOperation> = mongoose.model<ISyncOperation>('SyncOperation', SyncOperationSchema);
