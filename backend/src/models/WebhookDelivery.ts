import mongoose, { Document, Schema, Model } from 'mongoose';
import type { WebhookEventType } from './WebhookSubscription';

export type WebhookDeliveryStatus = 'pending' | 'succeeded' | 'failed' | 'retrying' | 'dead';

export interface IWebhookDelivery extends Document {
  _id: string;
  subscriptionId: string;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  lastResponseCode?: number;
  lastResponseBody?: string;
  lastError?: string;
  durationMs?: number;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookDeliverySchema: Schema = new Schema(
  {
    subscriptionId: {
      type: String,
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'retrying', 'dead'],
      default: 'pending',
      index: true,
    },
    attemptCount: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    lastAttemptAt: {
      type: Date,
    },
    nextRetryAt: {
      type: Date,
      index: true,
    },
    lastResponseCode: {
      type: Number,
    },
    lastResponseBody: {
      type: String,
    },
    lastError: {
      type: String,
    },
    durationMs: {
      type: Number,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes for common queries
WebhookDeliverySchema.index({ subscriptionId: 1, createdAt: -1 });
WebhookDeliverySchema.index({ status: 1, nextRetryAt: 1 });
WebhookDeliverySchema.index({ eventType: 1, status: 1 });
WebhookDeliverySchema.index({ subscriptionId: 1, eventType: 1 });

export const WebhookDelivery: Model<IWebhookDelivery> =
  mongoose.model<IWebhookDelivery>('WebhookDelivery', WebhookDeliverySchema);
