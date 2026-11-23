import crypto from 'crypto';
import { WebhookSubscription, IWebhookSubscription } from '../models/WebhookSubscription';
import { WebhookDelivery, IWebhookDelivery } from '../models/WebhookDelivery';
import logger from '../utils/logger';

export type WebhookEventType =
  | 'credential.issued'
  | 'credential.verified'
  | 'credential.revoked'
  | 'enrollment.created';

const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 10000;
// Exponential backoff schedule (in ms): 1m, 5m, 15m
const BACKOFF_SCHEDULE_MS = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000];

function computeSignature(secret: string, body: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body, 'utf8');
  return `sha256=${hmac.digest('hex')}`;
}

function getBackoffDelay(attempts: number): number {
  const index = Math.min(Math.max(attempts - 1, 0), BACKOFF_SCHEDULE_MS.length - 1);
  return BACKOFF_SCHEDULE_MS[index];
}

interface DeliveryResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

async function performDelivery(
  delivery: IWebhookDelivery,
  subscription: IWebhookSubscription
): Promise<DeliveryResult> {
  const body = JSON.stringify(delivery.payload);
  const signature = computeSignature(subscription.secret, body);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(subscription.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': delivery.eventType,
        'X-Webhook-Signature': signature,
        'X-Webhook-Delivery-Id': String(delivery._id),
      },
      body,
      signal: controller.signal,
    });

    if (response.ok) {
      return { success: true, statusCode: response.status };
    }
    return {
      success: false,
      statusCode: response.status,
      error: `Non-2xx response: ${response.status}`,
    };
  } catch (err: any) {
    const message =
      err && err.name === 'AbortError'
        ? `Request timed out after ${REQUEST_TIMEOUT_MS}ms`
        : err?.message || 'Unknown delivery error';
    return { success: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

async function attemptDelivery(
  deliveryId: string
): Promise<{ success: boolean; status?: string }> {
  const delivery = await WebhookDelivery.findById(deliveryId);
  if (!delivery) {
    logger.warn(`[webhook] Delivery ${deliveryId} not found for attempt`);
    return { success: false, status: 'not_found' };
  }

  if (delivery.status === 'success') {
    logger.info(`[webhook] Delivery ${deliveryId} already succeeded; skipping`);
    return { success: true, status: 'success' };
  }

  const subscription = await WebhookSubscription.findById(delivery.subscriptionId);
  if (!subscription) {
    delivery.status = 'dead_letter';
    delivery.lastError = 'Subscription no longer exists';
    delivery.nextRetryAt = undefined;
    await delivery.save();
    logger.warn(
      `[webhook] Delivery ${deliveryId} moved to dead_letter: subscription missing`
    );
    return { success: false, status: 'dead_letter' };
  }

  delivery.attempts = (delivery.attempts || 0) + 1;
  const result = await performDelivery(delivery, subscription);

  if (result.success) {
    delivery.status = 'success';
    delivery.responseCode = result.statusCode;
    delivery.lastError = undefined;
    delivery.nextRetryAt = undefined;
    delivery.deliveredAt = new Date();
    await delivery.save();
    logger.info(
      `[webhook] Delivery ${deliveryId} succeeded (attempt ${delivery.attempts}, status ${result.statusCode})`
    );
    return { success: true, status: 'success' };
  }

  delivery.responseCode = result.statusCode;
  delivery.lastError = result.error;

  if (delivery.attempts >= MAX_ATTEMPTS) {
    delivery.status = 'dead_letter';
    delivery.nextRetryAt = undefined;
    await delivery.save();
    logger.error(
      `[webhook] Delivery ${deliveryId} permanently failed after ${delivery.attempts} attempts: ${result.error}`
    );
    return { success: false, status: 'dead_letter' };
  }

  delivery.status = 'failed';
  delivery.nextRetryAt = new Date(Date.now() + getBackoffDelay(delivery.attempts));
  await delivery.save();
  logger.warn(
    `[webhook] Delivery ${deliveryId} failed (attempt ${delivery.attempts}): ${result.error}; retry scheduled at ${delivery.nextRetryAt.toISOString()}`
  );
  return { success: false, status: 'failed' };
}

/**
 * Emit a webhook event to all active subscriptions that listen for it.
 * Never throws to callers; all errors are caught and logged.
 */
export async function emitWebhookEvent(
  eventType: WebhookEventType | string,
  payload: Record<string, any>
): Promise<void> {
  try {
    const subscriptions = await WebhookSubscription.find({
      active: true,
      events: eventType,
    });

    if (!subscriptions || subscriptions.length === 0) {
      logger.debug(`[webhook] No active subscriptions for event ${eventType}`);
      return;
    }

    logger.info(
      `[webhook] Emitting event ${eventType} to ${subscriptions.length} subscription(s)`
    );

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          const delivery = await WebhookDelivery.create({
            subscriptionId: subscription._id,
            eventType,
            payload,
            status: 'pending',
            attempts: 0,
          });

          await attemptDelivery(String(delivery._id));
        } catch (err: any) {
          logger.error(
            `[webhook] Error dispatching event ${eventType} to subscription ${subscription._id}: ${err?.message || err}`
          );
        }
      })
    );
  } catch (err: any) {
    logger.error(
      `[webhook] Failed to emit event ${eventType}: ${err?.message || err}`
    );
  }
}

/**
 * Manually retry a delivery by id. Never throws to callers.
 */
export async function retryDelivery(
  deliveryId: string
): Promise<{ success: boolean; status?: string }> {
  try {
    const delivery = await WebhookDelivery.findById(deliveryId);
    if (!delivery) {
      logger.warn(`[webhook] Manual retry requested for missing delivery ${deliveryId}`);
      return { success: false, status: 'not_found' };
    }

    // Reset status so a manual retry can proceed even from dead_letter.
    if (delivery.status === 'dead_letter') {
      delivery.status = 'pending';
      delivery.attempts = 0;
      delivery.nextRetryAt = undefined;
      await delivery.save();
    }

    const result = await attemptDelivery(deliveryId);
    logger.info(
      `[webhook] Manual retry for delivery ${deliveryId} completed: ${result.status}`
    );
    return result;
  } catch (err: any) {
    logger.error(
      `[webhook] Manual retry failed for delivery ${deliveryId}: ${err?.message || err}`
    );
    return { success: false, status: 'error' };
  }
}

/**
 * Process all deliveries whose nextRetryAt is due. Intended to be called
 * periodically (e.g. via a cron/scheduler). Never throws to callers.
 */
export async function processPendingRetries(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const summary = { processed: 0, succeeded: 0, failed: 0 };
  try {
    const now = new Date();
    const dueDeliveries = await WebhookDelivery.find({
      status: 'failed',
      nextRetryAt: { $lte: now },
    }).limit(500);

    if (dueDeliveries.length === 0) {
      return summary;
    }

    logger.info(`[webhook] Processing ${dueDeliveries.length} pending retr(ies)`);

    for (const delivery of dueDeliveries) {
      try {
        const result = await attemptDelivery(String(delivery._id));
        summary.processed += 1;
        if (result.success) {
          summary.succeeded += 1;
        } else {
          summary.failed += 1;
        }
      } catch (err: any) {
        summary.processed += 1;
        summary.failed += 1;
        logger.error(
          `[webhook] Error processing retry for delivery ${delivery._id}: ${err?.message || err}`
        );
      }
    }
  } catch (err: any) {
    logger.error(`[webhook] Failed to process pending retries: ${err?.message || err}`);
  }
  return summary;
}

export default {
  emitWebhookEvent,
  retryDelivery,
  processPendingRetries,
};