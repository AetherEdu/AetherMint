// ─── Webhook validation schemas ───────────────────────────────────────────────

export const WEBHOOK_EVENT_TYPES = [
  'credential.issued',
  'credential.verified',
  'credential.revoked',
  'enrollment.created',
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const webhookCreateSchema = {
  url: { type: 'string', required: true, pattern: '^https?://' },
  secret: { type: 'string', required: true, minLength: 16 },
  events: { type: 'array', required: false, items: { type: 'string', enum: WEBHOOK_EVENT_TYPES } },
  description: { type: 'string', required: false, maxLength: 500 },
  metadata: { type: 'object', required: false },
};

export const webhookUpdateSchema = {
  url: { type: 'string', required: false, pattern: '^https?://' },
  secret: { type: 'string', required: false, minLength: 16 },
  events: { type: 'array', required: false, items: { type: 'string', enum: WEBHOOK_EVENT_TYPES } },
  status: { type: 'string', required: false, enum: ['active', 'paused', 'revoked'] },
  description: { type: 'string', required: false, maxLength: 500 },
  metadata: { type: 'object', required: false },
};

// Stub: route schemas
export const schemas = {
  webhookCreate: webhookCreateSchema,
  webhookUpdate: webhookUpdateSchema,
} as any;
