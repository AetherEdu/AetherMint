import mongoose, { Document, Schema, Model } from 'mongoose';

export type WebhookEventType =
  | 'credential.issued'
  | 'credential.verified'
  | 'credential.revoked'
  | 'enrollment.created';

export const WEBHOOK_EVENT_TYPES: WebhookEventType[] = [
  'credential.issued',
  'credential.verified',
  'credential.revoked',
  'enrollment.created',
];

export type WebhookSubscriptionStatus = 'active' | 'paused' | 'failed' | 'revoked';

export interface IWebhookSubscription extends Document {
  _id: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  status: WebhookSubscriptionStatus;
  description?: string;
  metadata?: Record<string, unknown>;
  lastDeliveryAt?: Date;
  lastDeliveryStatus?: 'success' | 'failed';
  consecutiveFailures: number;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookSubscriptionSchema: Schema = new Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (v: string) => /^https?:\/\/.+/.test(v),
        message: 'Webhook URL must start with http:// or https://',
      },
    },
    secret: {
      type: String,
      required: true,
      minlength: 16,
    },
    events: {
      type: [String],
      enum: WEBHOOK_EVENT_TYPES,
      default: WEBHOOK_EVENT_TYPES,
      validate: {
        validator: (v: string[]) => v.length > 0,
        message: 'At least one event type must be specified',
      },
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'failed', 'revoked'],
      default: 'active',
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    lastDeliveryAt: {
      type: Date,
    },
    lastDeliveryStatus: {
      type: String,
      enum: ['success', 'failed'],
    },
    consecutiveFailures: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes for common queries
WebhookSubscriptionSchema.index({ status: 1, events: 1 });
WebhookSubscriptionSchema.index({ url: 1 }, { unique: true });

export const WebhookSubscription: Model<IWebhookSubscription> =
  mongoose.model<IWebhookSubscription>('WebhookSubscription', WebhookSubscriptionSchema);
