/**
 * Webhook Routes
 *
 * Admin CRUD endpoints for webhook subscription management,
 * delivery history, and manual retry.
 *
 * @openapi
 * tags:
 *   - name: Webhooks
 *     description: Outgoing webhook subscription and delivery management
 */

import express, { Router, Request, Response } from 'express';
import Joi from 'joi';
import { WebhookSubscription, WEBHOOK_EVENT_TYPES } from '../models/WebhookSubscription';
import { WebhookDelivery } from '../models/WebhookDelivery';
import webhookService from '../services/webhookService';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { catchAsync } from '../middleware/errorHandler';
import logger from '../utils/logger';

const router: Router = express.Router();

// ─── Validation Schemas ──────────────────────────────────────────────────────

const createSubscriptionSchema = Joi.object({
  url: Joi.string().uri({ scheme: ['http', 'https'] }).required(),
  secret: Joi.string().min(16).required(),
  events: Joi.array()
    .items(Joi.string().valid(...WEBHOOK_EVENT_TYPES))
    .min(1)
    .default(WEBHOOK_EVENT_TYPES),
  description: Joi.string().max(500).optional().allow(''),
  metadata: Joi.object().optional(),
});

const updateSubscriptionSchema = Joi.object({
  url: Joi.string().uri({ scheme: ['http', 'https'] }).optional(),
  secret: Joi.string().min(16).optional(),
  events: Joi.array()
    .items(Joi.string().valid(...WEBHOOK_EVENT_TYPES))
    .min(1)
    .optional(),
  status: Joi.string().valid('active', 'paused', 'revoked').optional(),
  description: Joi.string().max(500).optional().allow(''),
  metadata: Joi.object().optional(),
}).min(1);

const listQuerySchema = Joi.object({
  status: Joi.string().valid('active', 'paused', 'failed', 'revoked').optional(),
  event: Joi.string().valid(...WEBHOOK_EVENT_TYPES).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const deliveryHistoryQuerySchema = Joi.object({
  subscriptionId: Joi.string().optional(),
  eventType: Joi.string().valid(...WEBHOOK_EVENT_TYPES).optional(),
  status: Joi.string().valid('pending', 'succeeded', 'failed', 'retrying', 'dead').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

// All webhook routes require authentication and admin role
router.use(authMiddleware);
router.use(requireAdmin);

// ─── Subscription CRUD ───────────────────────────────────────────────────────

/**
 * @openapi
 * /api/webhooks/subscriptions:
 *   post:
 *     tags: [Webhooks]
 *     summary: Register a new webhook subscription
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url, secret]
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *               secret:
 *                 type: string
 *                 minLength: 16
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [credential.issued, credential.verified, credential.revoked, enrollment.created]
 *               description:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       '201':
 *         description: Subscription created
 */
router.post(
  '/subscriptions',
  catchAsync(async (req: Request, res: Response) => {
    const { error, value } = createSubscriptionSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      throw new ValidationError('Validation failed', error.details);
    }

    // Check for duplicate URL
    const existing = await WebhookSubscription.findOne({ url: value.url });
    if (existing) {
      throw new ConflictError('A subscription with this URL already exists');
    }

    const subscription = await WebhookSubscription.create(value);
    logger.info(`Webhook subscription created: ${subscription._id} -> ${subscription.url}`);

    res.status(201).json({ success: true, data: subscription });
  }),
);

/**
 * @openapi
 * /api/webhooks/subscriptions:
 *   get:
 *     tags: [Webhooks]
 *     summary: List all webhook subscriptions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, paused, failed, revoked]
 *       - in: query
 *         name: event
 *         schema:
 *           type: string
 *           enum: [credential.issued, credential.verified, credential.revoked, enrollment.created]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       '200':
 *         description: List of subscriptions
 */
router.get(
  '/subscriptions',
  catchAsync(async (req: Request, res: Response) => {
    const { error, value } = listQuerySchema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      throw new ValidationError('Invalid query parameters', error.details);
    }

    const filter: Record<string, unknown> = {};
    if (value.status) filter.status = value.status;
    if (value.event) filter.events = value.event;

    const total = await WebhookSubscription.countDocuments(filter);
    const subscriptions = await WebhookSubscription.find(filter)
      .sort({ createdAt: -1 })
      .skip((value.page - 1) * value.limit)
      .limit(value.limit);

    res.json({
      success: true,
      data: subscriptions,
      pagination: { total, page: value.page, limit: value.limit },
    });
  }),
);

/**
 * @openapi
 * /api/webhooks/subscriptions/{id}:
 *   get:
 *     tags: [Webhooks]
 *     summary: Get a webhook subscription with delivery stats
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Subscription details with stats
 */
router.get(
  '/subscriptions/:id',
  catchAsync(async (req: Request, res: Response) => {
    const result = await webhookService.getSubscriptionWithStats(req.params.id);
    if (!result.subscription) {
      throw new NotFoundError('Webhook subscription not found');
    }

    res.json({ success: true, data: result });
  }),
);

/**
 * @openapi
 * /api/webhooks/subscriptions/{id}:
 *   put:
 *     tags: [Webhooks]
 *     summary: Update a webhook subscription
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *               secret:
 *                 type: string
 *                 minLength: 16
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [credential.issued, credential.verified, credential.revoked, enrollment.created]
 *               status:
 *                 type: string
 *                 enum: [active, paused, revoked]
 *               description:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       '200':
 *         description: Subscription updated
 */
router.put(
  '/subscriptions/:id',
  catchAsync(async (req: Request, res: Response) => {
    const { error, value } = updateSubscriptionSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      throw new ValidationError('Validation failed', error.details);
    }

    const subscription = await WebhookSubscription.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true },
    );

    if (!subscription) {
      throw new NotFoundError('Webhook subscription not found');
    }

    logger.info(`Webhook subscription updated: ${subscription._id}`);
    res.json({ success: true, data: subscription });
  }),
);

/**
 * @openapi
 * /api/webhooks/subscriptions/{id}:
 *   delete:
 *     tags: [Webhooks]
 *     summary: Delete a webhook subscription
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Subscription deleted
 */
router.delete(
  '/subscriptions/:id',
  catchAsync(async (req: Request, res: Response) => {
    const subscription = await WebhookSubscription.findByIdAndDelete(req.params.id);
    if (!subscription) {
      throw new NotFoundError('Webhook subscription not found');
    }

    // Optionally mark related deliveries as dead
    await WebhookDelivery.updateMany(
      { subscriptionId: req.params.id, status: { $in: ['pending', 'retrying'] } },
      { $set: { status: 'dead', lastError: 'Subscription deleted' } },
    );

    logger.info(`Webhook subscription deleted: ${req.params.id}`);
    res.json({ success: true, message: 'Subscription deleted' });
  }),
);

// ─── Delivery History ────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/webhooks/deliveries:
 *   get:
 *     tags: [Webhooks]
 *     summary: Get webhook delivery history with filtering and pagination
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: subscriptionId
 *         schema:
 *           type: string
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *           enum: [credential.issued, credential.verified, credential.revoked, enrollment.created]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, succeeded, failed, retrying, dead]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       '200':
 *         description: Delivery history
 */
router.get(
  '/deliveries',
  catchAsync(async (req: Request, res: Response) => {
    const { error, value } = deliveryHistoryQuerySchema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      throw new ValidationError('Invalid query parameters', error.details);
    }

    const result = await webhookService.getDeliveryHistory(
      value.subscriptionId,
      value.eventType,
      value.status,
      value.page,
      value.limit,
    );

    res.json({
      success: true,
      data: result.deliveries,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    });
  }),
);

/**
 * @openapi
 * /api/webhooks/deliveries/{id}/retry:
 *   post:
 *     tags: [Webhooks]
 *     summary: Manually retry a dead-lettered or failed webhook delivery
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Delivery retry initiated
 */
router.post(
  '/deliveries/:id/retry',
  catchAsync(async (req: Request, res: Response) => {
    try {
      const delivery = await webhookService.manuallyRetryDelivery(req.params.id);
      if (!delivery) {
        throw new NotFoundError('Delivery not found');
      }

      res.json({ success: true, data: delivery });
    } catch (err: unknown) {
      if (err instanceof NotFoundError) throw err;
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new ValidationError(message);
    }
  }),
);

/**
 * @openapi
 * /api/webhooks/deliveries/{id}:
 *   get:
 *     tags: [Webhooks]
 *     summary: Get a single webhook delivery detail
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Delivery detail
 */
router.get(
  '/deliveries/:id',
  catchAsync(async (req: Request, res: Response) => {
    const delivery = await WebhookDelivery.findById(req.params.id);
    if (!delivery) {
      throw new NotFoundError('Delivery not found');
    }

    res.json({ success: true, data: delivery });
  }),
);

export default router;
