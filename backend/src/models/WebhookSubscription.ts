import mongoose, { Document, Schema, Model, Types } from 'mongoose';

/**
 * Supported outgoing webhook event types.
 */
export const WEBHOOK_EVENT_TYPES = [
  'credential.issued',
  'credential.verified',
  'credential.revoked',
  'enrollment.created',
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

/**
 * WebhookSubscription document interface.
 */
export interface IWebhookSubscription extends Document {
  url: string;
  secret: string;
  events: WebhookEventType[];
  active: boolean;
  owner: Types.ObjectId;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * URL validator: only allow http/https URLs.
 */
const httpUrlValidator = (value: string): boolean => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const webhookSubscriptionSchema = new Schema<IWebhookSubscription>(
  {
    url: {
      type: String,
      required: [true, 'Webhook URL is required'],
      trim: true,
      validate: {
        validator: httpUrlValidator,
        message: 'Webhook URL must be a valid http or https URL',
      },
    },
    secret: {
      type: String,
      required: [true, 'Webhook secret is required'],
      trim: true,
      minlength: [16, 'Webhook secret must be at least 16 characters'],
    },
    events: {
      type: [String],
      required: true,
      default: [],
      validate: {
        validator: (value: string[]): boolean => {
          if (!Array.isArray(value) || value.length === 0) {
            return false;
          }
          return value.every((event) =>
            (WEBHOOK_EVENT_TYPES as readonly string[]).includes(event),
          );
        },
        message: 'events must contain at least one supported webhook event type',
      },
    },
    active: {
      type: Boolean,
      default: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Webhook subscription owner is required'],
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description must be at most 500 characters'],
    },
  },
  {
    timestamps: true,
    collection: 'webhook_subscriptions',
  },
);

// Efficient lookup of active subscriptions for a given event type.
webhookSubscriptionSchema.index({ active: 1, events: 1 });

// Efficient lookup of subscriptions by owner.
webhookSubscriptionSchema.index({ owner: 1, createdAt: -1 });

// Prevent leaking the signing secret when serializing to JSON.
webhookSubscriptionSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, any>) => {
    delete ret.secret;
    return ret;
  },
});

export const WebhookSubscription: Model<IWebhookSubscription> =
  (mongoose.models.WebhookSubscription as Model<IWebhookSubscription>) ||
  mongoose.model<IWebhookSubscription>('WebhookSubscription', webhookSubscriptionSchema);

export default WebhookSubscription;