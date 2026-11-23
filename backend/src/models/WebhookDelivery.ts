import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed' | 'dead_letter';

export interface IWebhookDelivery extends Document {
  subscriptionId: Types.ObjectId;
  eventType: string;
  payload: Record<string, any>;
  signature: string;
  status: WebhookDeliveryStatus;
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date | null;
  lastResponseCode?: number | null;
  lastError?: string | null;
  deliveredAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookDeliverySchema: Schema<IWebhookDelivery> = new Schema(
  {
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'WebhookSubscription',
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    signature: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'dead_letter'],
      default: 'pending',
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
      min: 1,
    },
    nextRetryAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastResponseCode: {
      type: Number,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to support retry scheduling and dead-letter queries
WebhookDeliverySchema.index({ status: 1, nextRetryAt: 1 });
// Index to support querying delivery history per subscription ordered by time
WebhookDeliverySchema.index({ subscriptionId: 1, createdAt: -1 });

const WebhookDelivery: Model<IWebhookDelivery> =
  mongoose.models.WebhookDelivery ||
  mongoose.model<IWebhookDelivery>('WebhookDelivery', WebhookDeliverySchema);

export default WebhookDelivery;