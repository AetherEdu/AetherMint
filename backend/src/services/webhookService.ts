/**
 * Webhook Service
 *
 * Handles webhook dispatch, HMAC-SHA256 payload signing, retry with
 * exponential backoff, and dead-letter queue management.
 */
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import axios, { AxiosError } from 'axios';
import logger from '../utils/logger';
import {
  WebhookSubscription,
  type IWebhookSubscription,
  type WebhookEventType,
} from '../models/WebhookSubscription';
import {
  WebhookDelivery,
  type IWebhookDelivery,
} from '../models/WebhookDelivery';

// ─── Constants ─────────────────────────────────────────────────────────────────

const SIGNATURE_HEADER = 'X-AetherMint-Signature';
const IDEMPOTENCY_HEADER = 'X-AetherMint-Idempotency-Key';
const EVENT_HEADER = 'X-AetherMint-Event';
const MAX_RETRIES = 3;

/** Exponential backoff delays in milliseconds for retry attempts 0-2 (~15 min total). */
const RETRY_DELAYS_MS = [60_000, 240_000, 600_000]; // 1 min, 4 min, 10 min

/** HTTP timeout for webhook delivery requests. */
const REQUEST_TIMEOUT_MS = 10_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface DispatchResult {
  success: boolean;
  statusCode?: number;
  durationMs: number;
  deliveryId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate HMAC-SHA256 signature for a webhook payload using the shared secret.
 */
export function signPayload(payload: WebhookPayload, secret: string): string {
  const raw = JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
}

/**
 * Verify that a given signature matches the expected HMAC-SHA256 signature.
 */
export function verifySignature(
  payload: WebhookPayload,
  secret: string,
  signature: string,
): boolean {
  const expected = signPayload(payload, secret);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Calculate the next retry delay based on the current attempt number.
 */
function getRetryDelay(attemptNumber: number): number {
  // attemptNumber is 0-indexed
  if (attemptNumber < RETRY_DELAYS_MS.length) {
    return RETRY_DELAYS_MS[attemptNumber];
  }
  return RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
}

// ─── Service ──────────────────────────────────────────────────────────────────

class WebhookService {
  private processInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Build a complete webhook payload.
   */
  buildPayload(
    event: WebhookEventType,
    data: Record<string, unknown>,
  ): WebhookPayload {
    return {
      event,
      timestamp: new Date().toISOString(),
      data,
    };
  }

  /**
   * Dispatch a webhook event to all active subscriptions that are subscribed
   * to the given event type.
   *
   * Returns an array of delivery documents created.
   */
  async dispatchEvent(
    event: WebhookEventType,
    data: Record<string, unknown>,
  ): Promise<IWebhookDelivery[]> {
    const subscriptions = await WebhookSubscription.find({
      status: 'active',
      events: event,
    });

    if (subscriptions.length === 0) {
      logger.debug(`No active webhook subscriptions for event: ${event}`);
      return [];
    }

    const payload = this.buildPayload(event, data);
    const deliveries: IWebhookDelivery[] = [];

    for (const sub of subscriptions) {
      const delivery = await this.deliverToSubscription(sub, payload);
      deliveries.push(delivery);
    }

    return deliveries;
  }

  /**
   * Deliver a webhook payload to a single subscription.
   */
  async deliverToSubscription(
    subscription: IWebhookSubscription,
    payload: WebhookPayload,
  ): Promise<IWebhookDelivery> {
    const idempotencyKey = uuidv4();
    const signature = signPayload(payload, subscription.secret);

    const delivery = await WebhookDelivery.create({
      subscriptionId: subscription._id,
      eventType: payload.event,
      payload: payload as unknown as Record<string, unknown>,
      status: 'pending',
      attemptCount: 0,
      maxAttempts: MAX_RETRIES,
      idempotencyKey,
    });

    // Perform the first attempt immediately
    await this.attemptDelivery(delivery, subscription.url, signature, idempotencyKey, payload);

    return delivery;
  }

  /**
   * Attempt a single delivery. If it fails, schedule a retry or mark as dead.
   */
  private async attemptDelivery(
    delivery: IWebhookDelivery,
    url: string,
    signature: string,
    idempotencyKey: string,
    payload: WebhookPayload,
  ): Promise<void> {
    const start = Date.now();

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          [SIGNATURE_HEADER]: signature,
          [IDEMPOTENCY_HEADER]: idempotencyKey,
          [EVENT_HEADER]: payload.event,
          'User-Agent': 'AetherMint-Webhook/1.0',
        },
        timeout: REQUEST_TIMEOUT_MS,
        validateStatus: () => true, // handle all status codes ourselves
      });

      const durationMs = Date.now() - start;

      // 2xx responses are considered successful
      if (response.status >= 200 && response.status < 300) {
        delivery.status = 'succeeded';
        delivery.lastResponseCode = response.status;
        delivery.durationMs = durationMs;
        delivery.lastAttemptAt = new Date();
        delivery.nextRetryAt = undefined;
        await delivery.save();

        // Update subscription status
        await WebhookSubscription.findByIdAndUpdate(delivery.subscriptionId, {
          $set: {
            lastDeliveryAt: new Date(),
            lastDeliveryStatus: 'success',
            consecutiveFailures: 0,
            status: 'active',
          },
        });

        logger.info(
          `Webhook delivery succeeded: ${delivery._id} for event ${payload.event} (${durationMs}ms)`,
        );
      } else {
        // Non-2xx response → treat as failure
        await this.handleDeliveryFailure(
          delivery,
          url,
          signature,
          idempotencyKey,
          payload,
          durationMs,
          `Received HTTP ${response.status}`,
          response.status,
          typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
        );
      }
    } catch (err: unknown) {
      const durationMs = Date.now() - start;
      const axiosErr = err as AxiosError;
      const errorMessage = axiosErr?.message || (err instanceof Error ? err.message : 'Unknown error');

      await this.handleDeliveryFailure(
        delivery,
        url,
        signature,
        idempotencyKey,
        payload,
        durationMs,
        errorMessage,
      );
    }
  }

  /**
   * Handle a failed delivery attempt: schedule retry or move to dead-letter queue.
   */
  private async handleDeliveryFailure(
    delivery: IWebhookDelivery,
    url: string,
    signature: string,
    idempotencyKey: string,
    payload: WebhookPayload,
    durationMs: number,
    errorMessage: string,
    responseCode?: number,
    responseBody?: string,
  ): Promise<void> {
    delivery.attemptCount += 1;
    delivery.lastError = errorMessage;
    delivery.lastResponseCode = responseCode;
    delivery.lastResponseBody = responseBody;
    delivery.durationMs = durationMs;
    delivery.lastAttemptAt = new Date();

    if (delivery.attemptCount >= delivery.maxAttempts) {
      // All retries exhausted → dead-letter
      delivery.status = 'dead';
      delivery.nextRetryAt = undefined;
      await delivery.save();

      // Update subscription with consecutive failures and auto-pause if threshold exceeded
      const MAX_CONSECUTIVE_FAILURES = 10;
      const updatedSub = await WebhookSubscription.findByIdAndUpdate(
        delivery.subscriptionId,
        {
          $set: {
            lastDeliveryAt: new Date(),
            lastDeliveryStatus: 'failed',
          },
          $inc: { consecutiveFailures: 1 },
        },
        { new: true },
      );

      if (updatedSub && updatedSub.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        updatedSub.status = 'paused';
        await updatedSub.save();
        logger.warn(
          `Webhook subscription ${updatedSub._id} auto-paused after ${MAX_CONSECUTIVE_FAILURES} consecutive failures`,
        );
      }

      logger.error(
        `Webhook delivery dead-lettered: ${delivery._id} for event ${payload.event} after ${delivery.attemptCount} attempts`,
      );
    } else {
      // Schedule next retry
      const delay = getRetryDelay(delivery.attemptCount - 1);
      delivery.status = 'retrying';
      delivery.nextRetryAt = new Date(Date.now() + delay);
      await delivery.save();

      logger.warn(
        `Webhook delivery retry ${delivery.attemptCount}/${delivery.maxAttempts} scheduled for ${delivery._id} (next: ${delivery.nextRetryAt?.toISOString()})`,
      );
    }
  }

  /**
   * Process all pending retries. This should be called periodically (e.g., every 30 seconds).
   */
  async processRetries(): Promise<void> {
    const now = new Date();

    const pendingRetries = await WebhookDelivery.find({
      status: 'retrying',
      nextRetryAt: { $lte: now },
    }).limit(50);

    for (const delivery of pendingRetries) {
      const subscription = await WebhookSubscription.findById(delivery.subscriptionId);
      if (!subscription) {
        // Subscription was deleted → mark delivery as dead
        delivery.status = 'dead';
        delivery.lastError = 'Subscription no longer exists';
        delivery.nextRetryAt = undefined;
        await delivery.save();
        continue;
      }

      const payload = delivery.payload as unknown as WebhookPayload;
      const idempotencyKey = delivery.idempotencyKey;
      const signature = signPayload(payload, subscription.secret);

      // Reset retrying status to pending for the attempt
      delivery.status = 'pending';
      await delivery.save();

      await this.attemptDelivery(delivery, subscription.url, signature, idempotencyKey, payload);
    }
  }

  /**
   * Start the periodic retry processor.
   */
  startRetryProcessor(intervalMs = 30_000): void {
    if (this.processInterval) return;
    this.processInterval = setInterval(() => {
      this.processRetries().catch((err) => {
        logger.error('Error in webhook retry processor', err);
      });
    }, intervalMs);
    logger.info('Webhook retry processor started');
  }

  /**
   * Stop the periodic retry processor.
   */
  stopRetryProcessor(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
      logger.info('Webhook retry processor stopped');
    }
  }

  /**
   * Manually retry a dead-lettered delivery.
   */
  async manuallyRetryDelivery(deliveryId: string): Promise<IWebhookDelivery | null> {
    const delivery = await WebhookDelivery.findById(deliveryId);
    if (!delivery) return null;

    if (delivery.status !== 'dead' && delivery.status !== 'failed') {
      throw new Error(`Delivery ${deliveryId} is not in a retryable state (current: ${delivery.status})`);
    }

    const subscription = await WebhookSubscription.findById(delivery.subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found for delivery ${deliveryId}`);
    }

    // Reset delivery
    delivery.status = 'pending';
    delivery.attemptCount = 0;
    delivery.lastError = undefined;
    delivery.lastResponseCode = undefined;
    delivery.lastResponseBody = undefined;
    delivery.nextRetryAt = undefined;
    await delivery.save();

    const payload = delivery.payload as unknown as WebhookPayload;
    const idempotencyKey = delivery.idempotencyKey;
    const signature = signPayload(payload, subscription.secret);

    await this.attemptDelivery(delivery, subscription.url, signature, idempotencyKey, payload);

    return delivery;
  }

  /**
   * Get delivery history with filtering and pagination.
   */
  async getDeliveryHistory(
    subscriptionId?: string,
    eventType?: string,
    status?: string,
    page = 1,
    limit = 20,
  ): Promise<{ deliveries: IWebhookDelivery[]; total: number; page: number; limit: number }> {
    const filter: Record<string, unknown> = {};
    if (subscriptionId) filter.subscriptionId = subscriptionId;
    if (eventType) filter.eventType = eventType;
    if (status) filter.status = status;

    const total = await WebhookDelivery.countDocuments(filter);
    const deliveries = await WebhookDelivery.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return { deliveries, total, page, limit };
  }

  /**
   * Get subscription status including delivery statistics.
   */
  async getSubscriptionWithStats(
    subscriptionId: string,
  ): Promise<{
    subscription: IWebhookSubscription | null;
    stats: {
      total: number;
      succeeded: number;
      failed: number;
      dead: number;
      retrying: number;
      lastDeliveryAt?: Date;
    };
  }> {
    const subscription = await WebhookSubscription.findById(subscriptionId);
    if (!subscription) return { subscription: null, stats: { total: 0, succeeded: 0, failed: 0, dead: 0, retrying: 0 } };

    const [total, succeeded, failed, dead, retrying] = await Promise.all([
      WebhookDelivery.countDocuments({ subscriptionId }),
      WebhookDelivery.countDocuments({ subscriptionId, status: 'succeeded' }),
      WebhookDelivery.countDocuments({ subscriptionId, status: 'failed' }),
      WebhookDelivery.countDocuments({ subscriptionId, status: 'dead' }),
      WebhookDelivery.countDocuments({ subscriptionId, status: 'retrying' }),
    ]);

    return {
      subscription,
      stats: {
        total,
        succeeded,
        failed,
        dead,
        retrying,
        lastDeliveryAt: subscription.lastDeliveryAt,
      },
    };
  }
}

// Singleton instance
const webhookService = new WebhookService();

export { WebhookService };
export default webhookService;
