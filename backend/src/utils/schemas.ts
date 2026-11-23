// Stub: route schemas
export const schemas = {
  createWebhookSubscription: {
    type: 'object',
    required: ['url', 'events'],
    properties: {
      url: {
        type: 'string',
        format: 'uri',
        pattern: '^https?://',
      },
      events: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'string',
          enum: [
            'credential.issued',
            'credential.verified',
            'credential.revoked',
            'enrollment.created',
          ],
        },
      },
      secret: {
        type: 'string',
        minLength: 8,
      },
      description: {
        type: 'string',
        maxLength: 500,
      },
    },
    additionalProperties: false,
  },
  updateWebhookSubscription: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        format: 'uri',
        pattern: '^https?://',
      },
      events: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'string',
          enum: [
            'credential.issued',
            'credential.verified',
            'credential.revoked',
            'enrollment.created',
          ],
        },
      },
      secret: {
        type: 'string',
        minLength: 8,
      },
      description: {
        type: 'string',
        maxLength: 500,
      },
    },
    additionalProperties: false,
  },
  webhookDeliveryQuery: {
    type: 'object',
    properties: {
      subscriptionId: {
        type: 'string',
        pattern: '^[a-fA-F0-9]{24}$',
      },
      status: {
        type: 'string',
        enum: ['pending', 'success', 'failed', 'dead_letter'],
      },
      eventType: {
        type: 'string',
        enum: [
          'credential.issued',
          'credential.verified',
          'credential.revoked',
          'enrollment.created',
        ],
      },
      page: {
        type: 'integer',
        minimum: 1,
        default: 1,
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 20,
      },
    },
    additionalProperties: false,
  },
  webhookIdParam: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        pattern: '^[a-fA-F0-9]{24}$',
      },
    },
    additionalProperties: false,
  },
} as any;