/**
 * Stripe Payment Service — fiat rail of the unified checkout (Issue #391).
 *
 * Wraps the official Stripe SDK behind a small, typed surface used by the
 * checkout orchestration. The Stripe client is created lazily so the server
 * can boot without STRIPE_SECRET_KEY configured (development / CI); any
 * operation that actually needs the Stripe API fails with a clear
 * configuration error instead of crashing startup.
 */

import Stripe from 'stripe';
import logger from '../../utils/logger';

export interface StripeIntentResult {
  paymentIntentId: string;
  clientSecret: string | null;
  status: string;
  amount: number;      // major units (e.g. 49.99 USD)
  currency: string;    // lowercase ISO 4217
}

export interface StripeRefundResult {
  refundId: string;
  status: string;
  amount: number;      // major units
  currency: string;
}

/** Normalized webhook outcome consumed by the checkout orchestration. */
export interface StripeWebhookOutcome {
  eventType: string;
  paymentIntentId?: string;
  status: 'succeeded' | 'failed' | 'refunded' | 'partially_refunded' | 'unknown';
  error?: string;
}

export class StripePaymentService {
  private client: Stripe | null = null;
  private readonly webhookSecret: string;
  private readonly publishableKey: string | undefined;

  constructor() {
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    this.publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || undefined;
  }

  /** True when a secret key is available for live Stripe API calls. */
  isConfigured(): boolean {
    return Boolean(process.env.STRIPE_SECRET_KEY);
  }

  getPublishableKey(): string | undefined {
    return this.publishableKey;
  }

  private getClient(): Stripe {
    if (this.client) {
      return this.client;
    }
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('Stripe is not configured: STRIPE_SECRET_KEY is missing');
    }
    this.client = new Stripe(secretKey);
    return this.client;
  }

  /**
   * Create a PaymentIntent for a course purchase. `amount` is in major units
   * (e.g. 49.99); Stripe works in minor units so it is converted internally.
   */
  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    description?: string;
    receiptEmail?: string;
    metadata?: Record<string, string>;
  }): Promise<StripeIntentResult> {
    const client = this.getClient();
    const intent = await client.paymentIntents.create({
      amount: this.toMinorUnits(params.amount),
      currency: params.currency.toLowerCase(),
      payment_method_types: ['card'],
      description: params.description,
      receipt_email: params.receiptEmail,
      metadata: params.metadata,
    });

    return {
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      status: intent.status,
      amount: this.toMajorUnits(intent.amount, intent.currency),
      currency: intent.currency,
    };
  }

  /** Retrieve the current state of a PaymentIntent. */
  async retrievePaymentIntent(paymentIntentId: string): Promise<StripeIntentResult> {
    const client = this.getClient();
    const intent = await client.paymentIntents.retrieve(paymentIntentId);
    return {
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      status: intent.status,
      amount: this.toMajorUnits(intent.amount, intent.currency),
      currency: intent.currency,
    };
  }

  /** Confirm a PaymentIntent with a client-provided payment method. */
  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId: string,
  ): Promise<StripeIntentResult> {
    const client = this.getClient();
    const intent = await client.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
    });
    return {
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      status: intent.status,
      amount: this.toMajorUnits(intent.amount, intent.currency),
      currency: intent.currency,
    };
  }

  /**
   * Refund a completed PaymentIntent. When `amount` is omitted the full
   * payment is refunded; otherwise a partial refund is issued.
   */
  async refund(
    paymentIntentId: string,
    amount?: number,
  ): Promise<StripeRefundResult> {
    const client = this.getClient();
    const refund = await client.refunds.create({
      payment_intent: paymentIntentId,
      ...(amount !== undefined ? { amount: this.toMinorUnits(amount) } : {}),
    });

    return {
      refundId: refund.id,
      status: refund.status ?? 'unknown',
      amount: this.toMajorUnits(refund.amount, refund.currency),
      currency: refund.currency ?? '',
    };
  }

  /**
   * Verify a Stripe webhook signature and return the typed event.
   *
   * When STRIPE_WEBHOOK_SECRET is not configured the signature cannot be
   * verified. In non-production environments the payload is still parsed so
   * local development can exercise the flow; in production an unverified
   * webhook is rejected outright.
   */
  constructEvent(rawBody: string | Buffer, signature: string): Stripe.Event {
    if (!this.webhookSecret) {
      const isProd = process.env.NODE_ENV === 'production';
      logger.warn('Stripe webhook received without STRIPE_WEBHOOK_SECRET configured');
      if (isProd) {
        throw new Error('Stripe webhook secret is not configured');
      }
      // Parse without signature verification (development only).
      return JSON.parse(rawBody.toString()) as Stripe.Event;
    }

    const client = this.getClient();
    return client.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
  }

  /** Normalize a Stripe event into the outcome shape the orchestration needs. */
  normalizeWebhookEvent(event: Stripe.Event): StripeWebhookOutcome {
    const outcome: StripeWebhookOutcome = {
      eventType: event.type,
      status: 'unknown',
    };

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        outcome.paymentIntentId = intent.id;
        outcome.status = 'succeeded';
        break;
      }
      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled': {
        const intent = event.data.object as Stripe.PaymentIntent;
        outcome.paymentIntentId = intent.id;
        outcome.status = 'failed';
        const failureMessage = intent.last_payment_error?.message;
        outcome.error = failureMessage || 'Payment intent failed';
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        outcome.paymentIntentId = charge.payment_intent as string;
        outcome.status = charge.amount_refunded >= charge.amount ? 'refunded' : 'partially_refunded';
        break;
      }
      default:
        break;
    }

    return outcome;
  }

  /** Stripe amounts are minor units (cents); the platform works in major units. */
  private toMinorUnits(amount: number): number {
    return Math.round(amount * 100);
  }

  private toMajorUnits(amount: number | null | undefined, currency: string): number {
    // Zero-decimal currencies (e.g. JPY) are not supported by the checkout
    // settings; every accepted currency uses 2 decimal places. Stripe types
    // refund amounts as nullable, so treat an absent amount as zero.
    void currency;
    return (amount ?? 0) / 100;
  }
}
