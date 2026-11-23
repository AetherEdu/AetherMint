import { Router, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { WebhookSubscription, IWebhookSubscription } from '../models/WebhookSubscription';
import { WebhookDelivery } from '../models/WebhookDelivery';
import * as webhookService from '../services/webhookService';
import {
  createWebhookSubscriptionSchema,
  updateWebhookSubscriptionSchema,
  webhookDeliveryQuerySchema,
} from '../utils/schemas';

const router = Router();

/**
 * Admin/RBAC middleware.
 * Reuses the existing auth middleware attached upstream in index.ts.
 * This guard ensures only admins can manage webhooks.
 */
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  const role = user.role || (user.user && user.user.role);
  if (role !== 'admin' && role !== 'superadmin') {
    res.status(403).json({ success: false, error: 'Admin privileges required' });
    return;
  }
  next();
}

router.use(requireAdmin);

function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

function serializeSubscription(sub: IWebhookSubscription) {
  return {
    id: sub._id,
    url: sub.url,
    events: sub.events,
    active: sub.active,
    description: sub.description,
    createdAt: sub.createdAt,
    updatedAt: sub.updatedAt,
    lastDeliveryAt: sub.lastDeliveryAt,
    lastDeliveryStatus: sub.lastDeliveryStatus,
    failureCount: sub.failureCount,
    // Never expose the secret after creation
  };
}

/**
 * POST /
 * Create a new webhook subscription. Generates a secret if omitted.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createWebhookSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.issues,
      });
      return;
    }

    const { url, events, description, active } = parsed.data;
    const secret = parsed.data.secret || webhookService.generateWebhookSecret();

    const subscription = await WebhookSubscription.create({
      url,
      events,
      description,
      active: active !== undefined ? active : true,
      secret,
      createdBy: (req as any).user?.id || (req as any).user?._id,
    });

    res.status(201).json({
      success: true,
      data: {
        ...serializeSubscription(subscription),
        // Secret returned only once at creation time
        secret,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /
 * List all webhook subscriptions (admin view).
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (req.query.active !== undefined) {
      filter.active = String(req.query.active) === 'true';
    }
    if (req.query.event) {
      filter.events = String(req.query.event);
    }

    const [subscriptions, total] = await Promise.all([
      WebhookSubscription.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      WebhookSubscription.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: subscriptions.map((s) => serializeSubscription(s as unknown as IWebhookSubscription)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /deliveries
 * List delivery history with filters and pagination.
 * NOTE: registered before /:id so it is not shadowed.
 */
router.get('/deliveries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = webhookDeliveryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.issues,
      });
      return;
    }

    const { subscriptionId, status, eventType, page, limit } = parsed.data;
    const filter: Record<string, any> = {};
    if (subscriptionId) filter.subscriptionId = subscriptionId;
    if (status) filter.status = status;
    if (eventType) filter.eventType = eventType;

    const skip = (page - 1) * limit;

    const [deliveries, total] = await Promise.all([
      WebhookDelivery.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      WebhookDelivery.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: deliveries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /dead-letter
 * List permanently failed deliveries (dead-letter queue).
 */
router.get('/dead-letter', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = { status: 'dead_letter' };
    if (req.query.subscriptionId && isValidObjectId(String(req.query.subscriptionId))) {
      filter.subscriptionId = String(req.query.subscriptionId);
    }
    if (req.query.eventType) {
      filter.eventType = String(req.query.eventType);
    }

    const [deliveries, total] = await Promise.all([
      WebhookDelivery.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      WebhookDelivery.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: deliveries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /deliveries/:id
 * Fetch a single delivery record.
 */
router.get('/deliveries/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, error: 'Invalid delivery id' });
      return;
    }

    const delivery = await WebhookDelivery.findById(id).lean();
    if (!delivery) {
      res.status(404).json({ success: false, error: 'Delivery not found' });
      return;
    }

    res.json({ success: true, data: delivery });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /deliveries/:id/retry
 * Manually retry a delivery.
 */
router.post('/deliveries/:id/retry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, error: 'Invalid delivery id' });
      return;
    }

    const delivery = await WebhookDelivery.findById(id);
    if (!delivery) {
      res.status(404).json({ success: false, error: 'Delivery not found' });
      return;
    }

    const result = await webhookService.retryDelivery(id);

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /:id
 * Fetch a single subscription.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, error: 'Invalid subscription id' });
      return;
    }

    const subscription = await WebhookSubscription.findById(id).lean();
    if (!subscription) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    res.json({
      success: true,
      data: serializeSubscription(subscription as unknown as IWebhookSubscription),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /:id
 * Update url / events / active (and optionally description).
 */
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, error: 'Invalid subscription id' });
      return;
    }

    const parsed = updateWebhookSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.issues,
      });
      return;
    }

    const updates: Record<string, any> = {};
    if (parsed.data.url !== undefined) updates.url = parsed.data.url;
    if (parsed.data.events !== undefined) updates.events = parsed.data.events;
    if (parsed.data.active !== undefined) updates.active = parsed.data.active;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, error: 'No valid fields to update' });
      return;
    }

    const subscription = await WebhookSubscription.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!subscription) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    res.json({
      success: true,
      data: serializeSubscription(subscription),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /:id
 * Remove a subscription.
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, error: 'Invalid subscription id' });
      return;
    }

    const subscription = await WebhookSubscription.findByIdAndDelete(id);
    if (!subscription) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

export default router;