/**
 * Checkout Service — unified payments orchestration (Issue #391).
 *
 * A single checkout abstracts both rails:
 *
 *   - `stripe`  (fiat): creates a Stripe PaymentIntent server-side, confirms
 *     it with the client-provided payment method, and reconciles the result
 *     through the Stripe webhook.
 *   - `stellar` (crypto): builds an unsigned Stellar transaction the learner
 *     signs in their wallet; confirmation is detected by watching the chain
 *     (reconciliation) or by submitting the signed XDR directly.
 *
 * Every purchase emits typed purchase events (see events/purchaseEvents.ts)
 * on the in-process bus and over Redis so downstream consumers (notifications,
 * analytics, receipts) react to the lifecycle without polling.
 */

import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';
import { PaymentMethod, PaymentStatus } from '../../models/Enrollment';
import type { StellarPayment } from '../../models/Enrollment';
import { Checkout, CheckoutMethod, CheckoutStatus } from '../../models/Payment';
import { PaymentService } from '../PaymentService';
import { StripePaymentService, StripeIntentResult, StripeWebhookOutcome } from './StripePaymentService';
import { PaymentReconciliationService, CryptoPaymentRecord, ReconciliationSummary } from './PaymentReconciliationService';
import {
  PURCHASE_CHANNEL,
  PURCHASE_NODE_ID,
  PurchaseEvent,
  purchaseEventBus,
} from '../../events/purchaseEvents';
import redisConfig from '../../config/redis';

export interface CreateCheckoutInput {
  enrollmentId: string;
  userId: string;
  courseId?: string;
  amount: number;
  currency: string;
  method: CheckoutMethod;
  stellar?: {
    fromAddress: string;
    assetCode?: string;
    assetIssuer?: string;
  };
  metadata?: Record<string, any>;
  receiptEmail?: string;
}

export interface CheckoutConfirmation {
  checkout: Checkout;
  transaction?: any;
}

const CHECKOUT_STATUS_TRANSITIONS: Record<CheckoutStatus, CheckoutStatus[]> = {
  pending: ['processing', 'completed', 'failed', 'expired'],
  processing: ['completed', 'failed'],
  completed: ['refunded'],
  failed: [],
  refunded: [],
  expired: [],
};

export interface CheckoutServiceOptions {
  paymentService?: PaymentService;
  stripePaymentService?: StripePaymentService;
  reconciliation?: PaymentReconciliationService;
}

export class CheckoutService {
  private readonly paymentService: PaymentService;
  private readonly stripePaymentService: StripePaymentService;
  private readonly reconciliation: PaymentReconciliationService;
  private readonly checkouts = new Map<string, Checkout>();

  constructor(options: CheckoutServiceOptions = {}) {
    this.paymentService = options.paymentService ?? new PaymentService();
    this.stripePaymentService = options.stripePaymentService ?? new StripePaymentService();

    this.reconciliation =
      options.reconciliation ??
      new PaymentReconciliationService({
        stellar: this.paymentService.getStellarPaymentService(),
        distributionAddress: this.paymentService.getStellarDistributionAddress(),
        fetchPending: () => this.toCryptoRecords(this.paymentService.getPendingCryptoPayments()),
        onReconciled: (payment, onChain) => this.finalizeReconciledPayment(payment, onChain),
      });
  }

  // ── Checkout lifecycle ─────────────────────────────────────────────────────

  /**
   * Create a unified checkout for a course purchase. The payment method is
   * chosen by the caller; the underlying rail is abstracted behind the
   * checkout's `gatewayData` (Stripe client secret, or Stellar XDR + memo).
   */
  async createCheckout(input: CreateCheckoutInput): Promise<Checkout> {
    if (input.method !== 'stripe' && input.method !== 'stellar') {
      throw new Error(`Unsupported checkout method: ${input.method}`);
    }

    const paymentMethod = input.method === 'stripe' ? PaymentMethod.STRIPE : PaymentMethod.STELLAR;
    const validation = this.paymentService.validatePaymentParameters(
      input.amount,
      input.currency,
      paymentMethod,
      input.stellar?.fromAddress,
    );
    if (!validation.isValid) {
      throw new Error(`Invalid payment parameters: ${validation.errors.join(', ')}`);
    }

    let paymentIntentId: string;
    let gatewayPaymentIntentId: string | undefined;
    let paymentId: string | undefined;
    let gatewayData: Record<string, any> = {};

    if (input.method === 'stripe') {
      const paymentIntent = await this.paymentService.createPaymentIntent(
        input.enrollmentId,
        PaymentMethod.STRIPE,
        {
          userId: input.userId,
          courseId: input.courseId,
          amount: input.amount,
          currency: input.currency,
          metadata: input.metadata,
        },
      );
      paymentIntentId = paymentIntent.id;
      paymentId = paymentIntent.metadata?.paymentId as string | undefined;

      const stripeIntent = await this.stripePaymentService.createPaymentIntent({
        amount: input.amount,
        currency: input.currency,
        receiptEmail: input.receiptEmail,
        metadata: {
          checkout: '',
          enrollmentId: input.enrollmentId,
          courseId: input.courseId ?? '',
          userId: input.userId,
          paymentIntentId: paymentIntent.id,
        },
      });
      gatewayPaymentIntentId = stripeIntent.paymentIntentId;
      gatewayData = {
        paymentIntentId: stripeIntent.paymentIntentId,
        clientSecret: stripeIntent.clientSecret,
        status: stripeIntent.status,
        publishableKey: this.stripePaymentService.getPublishableKey(),
      };

      this.paymentService.attachStripeIntent(paymentIntent.id, stripeIntent.paymentIntentId);
    } else {
      const paymentIntent = await this.paymentService.createStellarPaymentIntent(input.enrollmentId, {
        userId: input.userId,
        courseId: input.courseId,
        amount: input.amount,
        currency: input.currency,
        fromAddress: input.stellar?.fromAddress,
        assetCode: input.stellar?.assetCode ?? 'XLM',
        assetIssuer: input.stellar?.assetIssuer,
        metadata: input.metadata,
      });
      paymentIntentId = paymentIntent.id;
      paymentId = paymentIntent.metadata?.paymentId as string | undefined;
      gatewayPaymentIntentId = paymentIntent.gatewayData?.paymentId;
      gatewayData = paymentIntent.gatewayData ?? {};
    }

    const checkout: Checkout = {
      id: uuidv4(),
      enrollmentId: input.enrollmentId,
      userId: input.userId,
      courseId: input.courseId,
      amount: input.amount,
      currency: input.currency,
      method: input.method,
      status: 'pending',
      paymentIntentId,
      paymentId,
      gatewayPaymentIntentId,
      gatewayData,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };

    this.checkouts.set(checkout.id, checkout);

    this.dispatch({
      type: 'PURCHASE_INITIATED',
      checkoutId: checkout.id,
      paymentId,
      userId: checkout.userId,
      enrollmentId: checkout.enrollmentId,
      courseId: checkout.courseId,
      amount: checkout.amount,
      currency: checkout.currency,
      method: paymentMethod,
      status: PaymentStatus.PENDING,
      gatewayTransactionId: gatewayPaymentIntentId,
    });

    return checkout;
  }

  /**
   * Confirm a checkout:
   *  - Stellar: submit the learner-signed transaction XDR.
   *  - Stripe: confirm the PaymentIntent with the client's payment method
   *    (or finalize a client-confirmed intent).
   */
  async confirmCheckout(
    checkoutId: string,
    input: { paymentIntentId?: string; paymentMethodId?: string; signedTransactionXDR?: string },
    auditContext?: { actor: string; ipAddress?: string },
  ): Promise<CheckoutConfirmation> {
    const checkout = this.checkouts.get(checkoutId);
    if (!checkout) {
      throw new Error('Checkout not found');
    }

    if (checkout.status === 'completed') {
      return { checkout };
    }
    if (checkout.status !== 'pending') {
      throw new Error(`Checkout cannot be confirmed from status ${checkout.status}`);
    }

    if (checkout.method === 'stellar') {
      if (!input.signedTransactionXDR) {
        throw new Error('signedTransactionXDR is required to confirm a Stellar checkout');
      }
      const tx = await this.paymentService.processStellarPayment(
        checkout.paymentIntentId!,
        input.signedTransactionXDR,
        auditContext,
      );
      this.transitionCheckout(checkout, 'completed', {
        confirmedAt: new Date(),
        transactionHash: tx.stellarTransactionHash,
        paymentId: tx.id,
      });
      this.dispatch({
        type: 'PURCHASE_CONFIRMED',
        checkoutId,
        paymentId: tx.id,
        userId: checkout.userId,
        enrollmentId: checkout.enrollmentId,
        courseId: checkout.courseId,
        amount: checkout.amount,
        currency: checkout.currency,
        method: PaymentMethod.STELLAR,
        status: PaymentStatus.COMPLETED,
        transactionHash: tx.stellarTransactionHash,
        gatewayTransactionId: tx.gatewayTransactionId,
      });
      return { checkout, transaction: tx };
    }

    // Stripe rail
    const stripeIntentId = input.paymentIntentId || checkout.gatewayPaymentIntentId;
    if (!stripeIntentId) {
      throw new Error('paymentIntentId is required to confirm a Stripe checkout');
    }
    if (checkout.gatewayPaymentIntentId && input.paymentIntentId && input.paymentIntentId !== checkout.gatewayPaymentIntentId) {
      throw new Error('paymentIntentId does not match the checkout');
    }

    const result: StripeIntentResult = input.paymentMethodId
      ? await this.stripePaymentService.confirmPaymentIntent(stripeIntentId, input.paymentMethodId)
      : await this.stripePaymentService.retrievePaymentIntent(stripeIntentId);

    if (result.status === 'succeeded') {
      const tx = await this.paymentService.processStripePayment(checkout.paymentIntentId!, result, auditContext);
      this.transitionCheckout(checkout, 'completed', {
        confirmedAt: new Date(),
        gatewayPaymentIntentId: result.paymentIntentId,
        paymentId: tx.id,
      });
      this.dispatch({
        type: 'PURCHASE_CONFIRMED',
        checkoutId,
        paymentId: tx.id,
        userId: checkout.userId,
        enrollmentId: checkout.enrollmentId,
        courseId: checkout.courseId,
        amount: checkout.amount,
        currency: checkout.currency,
        method: PaymentMethod.STRIPE,
        status: PaymentStatus.COMPLETED,
        gatewayTransactionId: result.paymentIntentId,
      });
      return { checkout, transaction: tx };
    }

    if (result.status === 'requires_payment_method' || result.status === 'requires_action' || result.status === 'processing') {
      // Still actionable by the client; the checkout stays pending.
      return { checkout };
    }

    this.transitionCheckout(checkout, 'failed', {
      failedAt: new Date(),
      failureReason: `Stripe intent ${result.status}`,
    });
    this.dispatch({
      type: 'PURCHASE_FAILED',
      checkoutId,
      paymentId: checkout.paymentId,
      userId: checkout.userId,
      enrollmentId: checkout.enrollmentId,
      courseId: checkout.courseId,
      amount: checkout.amount,
      currency: checkout.currency,
      method: PaymentMethod.STRIPE,
      status: PaymentStatus.FAILED,
      error: `Stripe intent ${result.status}`,
      gatewayTransactionId: stripeIntentId,
    });
    return { checkout };
  }

  /** Refund a completed payment on either rail and emit the purchase event. */
  async processRefund(
    paymentId: string,
    amount: number,
    reason: string,
    auditContext?: { actor: string; ipAddress?: string },
  ): Promise<any> {
    const refundTransaction = await this.paymentService.processRefund(paymentId, amount, reason, auditContext);

    const payment = await this.paymentService.getPaymentById(paymentId)
      || this.paymentService.findPaymentByGatewayTransactionId(paymentId);
    const checkout = payment ? this.findCheckoutByPaymentId(payment.id) : undefined;
    if (checkout && checkout.status === 'completed') {
      this.transitionCheckout(checkout, 'refunded', {});
    }

    this.dispatch({
      type: 'PURCHASE_REFUNDED',
      checkoutId: checkout?.id,
      paymentId: payment?.id ?? paymentId,
      userId: payment?.userId ?? '',
      enrollmentId: payment?.enrollmentId ?? '',
      courseId: payment?.courseId,
      amount: refundTransaction.amount < 0 ? -refundTransaction.amount : refundTransaction.amount,
      currency: refundTransaction.currency,
      method: payment?.method ?? PaymentMethod.STRIPE,
      status: PaymentStatus.REFUNDED,
      refundAmount: amount,
      gatewayTransactionId: refundTransaction.gatewayTransactionId,
    });

    return refundTransaction;
  }

  // ── Webhooks / reconciliation ──────────────────────────────────────────────

  /**
   * Apply a normalized Stripe webhook outcome. Idempotent: state machine
   * transitions reject stale or duplicate events.
   */
  async handleStripeWebhookOutcome(outcome: StripeWebhookOutcome): Promise<void> {
    if (!outcome.paymentIntentId) {
      logger.warn('Stripe webhook ignored: no payment intent id', { eventType: outcome.eventType });
      return;
    }

    const checkout = this.getCheckoutByGatewayPaymentIntentId(outcome.paymentIntentId);
    const payment = this.paymentService.findPaymentByGatewayTransactionId(outcome.paymentIntentId);

    switch (outcome.status) {
      case 'succeeded': {
        if (payment && payment.status === PaymentStatus.PENDING) {
          const result = await this.stripePaymentService
            .retrievePaymentIntent(outcome.paymentIntentId)
            .catch(() => null);
          if (result) {
            const tx = checkout
              ? await this.paymentService.processStripePayment(checkout.paymentIntentId!, result)
              : await this.paymentService.completeStripePaymentByPaymentId(payment.id, result);

            if (checkout && checkout.status === 'pending') {
              this.transitionCheckout(checkout, 'completed', {
                confirmedAt: new Date(),
                gatewayPaymentIntentId: result.paymentIntentId,
                paymentId: tx.id,
              });
            }
            this.dispatch({
              type: 'PURCHASE_CONFIRMED',
              checkoutId: checkout?.id,
              paymentId: tx.id,
              userId: payment.userId,
              enrollmentId: payment.enrollmentId,
              courseId: payment.courseId,
              amount: tx.amount,
              currency: tx.currency,
              method: PaymentMethod.STRIPE,
              status: PaymentStatus.COMPLETED,
              gatewayTransactionId: outcome.paymentIntentId,
            });
          }
        }
        break;
      }

      case 'failed': {
        if (payment && (payment.status === PaymentStatus.PENDING || payment.status === PaymentStatus.PROCESSING)) {
          this.paymentService.transitionPaymentStatus(payment.id, PaymentStatus.FAILED, {
            failedAt: new Date(),
            failureReason: outcome.error,
          });
          if (checkout && checkout.status === 'pending') {
            this.transitionCheckout(checkout, 'failed', { failedAt: new Date(), failureReason: outcome.error });
          }
          this.dispatch({
            type: 'PURCHASE_FAILED',
            checkoutId: checkout?.id,
            paymentId: payment.id,
            userId: payment.userId,
            enrollmentId: payment.enrollmentId,
            courseId: payment.courseId,
            amount: payment.amount,
            currency: payment.currency,
            method: PaymentMethod.STRIPE,
            status: PaymentStatus.FAILED,
            error: outcome.error,
            gatewayTransactionId: outcome.paymentIntentId,
          });
        }
        break;
      }

      case 'refunded':
      case 'partially_refunded': {
        if (payment && payment.status === PaymentStatus.COMPLETED) {
          const fullyRefunded = outcome.status === 'refunded';
          this.paymentService.transitionPaymentStatus(
            payment.id,
            fullyRefunded ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
            { refundedAt: new Date(), refundAmount: fullyRefunded ? payment.amount : undefined },
          );
          if (checkout && checkout.status === 'completed' && fullyRefunded) {
            this.transitionCheckout(checkout, 'refunded', {});
          }
          this.dispatch({
            type: 'PURCHASE_REFUNDED',
            checkoutId: checkout?.id,
            paymentId: payment.id,
            userId: payment.userId,
            enrollmentId: payment.enrollmentId,
            courseId: payment.courseId,
            amount: payment.amount,
            currency: payment.currency,
            method: PaymentMethod.STRIPE,
            status: fullyRefunded ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
            refundAmount: payment.amount,
            gatewayTransactionId: outcome.paymentIntentId,
          });
        }
        break;
      }

      default:
        logger.debug('Stripe webhook outcome not handled', { eventType: outcome.eventType, status: outcome.status });
        break;
    }
  }

  /**
   * Handle an incoming Stellar relay webhook by sweeping pending crypto
   * payments against the chain. Idempotent and cheap when nothing matches.
   */
  async handleStellarWebhook(_transaction: any, _type: string): Promise<ReconciliationSummary> {
    return this.reconcilePendingPayments();
  }

  /** Reconcile pending crypto payments against on-chain transactions. */
  async reconcilePendingPayments(): Promise<ReconciliationSummary> {
    return this.reconciliation.reconcilePendingPayments();
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  getCheckout(checkoutId: string): Checkout | null {
    return this.checkouts.get(checkoutId) ?? null;
  }

  getCheckoutsForUser(userId: string): Checkout[] {
    return Array.from(this.checkouts.values())
      .filter((c) => c.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private toCryptoRecords(payments: any[]): CryptoPaymentRecord[] {
    return payments.map((p) => ({
      paymentId: p.id,
      enrollmentId: p.enrollmentId,
      userId: p.userId,
      courseId: p.courseId,
      amount: p.amount,
      currency: p.currency,
      method: p.method as PaymentMethod,
      status: p.status as PaymentStatus,
      transactionHash: p.stellarTransactionHash,
      metadata: p.metadata,
    }));
  }

  private async finalizeReconciledPayment(payment: CryptoPaymentRecord, onChain: StellarPayment): Promise<void> {
    const tx = await this.paymentService.completeCryptoPayment(payment.paymentId, onChain);
    const checkout = this.findCheckoutByPaymentId(payment.paymentId);
    if (checkout && checkout.status === 'pending') {
      this.transitionCheckout(checkout, 'completed', {
        confirmedAt: new Date(),
        transactionHash: onChain.transactionHash,
        paymentId: tx.id,
      });
    }
    this.dispatch({
      type: 'PURCHASE_CONFIRMED',
      checkoutId: checkout?.id,
      paymentId: payment.paymentId,
      userId: payment.userId,
      enrollmentId: payment.enrollmentId,
      courseId: payment.courseId,
      amount: payment.amount,
      currency: payment.currency,
      method: PaymentMethod.STELLAR,
      status: PaymentStatus.COMPLETED,
      transactionHash: onChain.transactionHash,
    });
  }

  private getCheckoutByGatewayPaymentIntentId(gatewayPaymentIntentId: string): Checkout | undefined {
    return Array.from(this.checkouts.values()).find(
      (c) => c.gatewayPaymentIntentId === gatewayPaymentIntentId,
    );
  }

  private findCheckoutByPaymentId(paymentId: string): Checkout | undefined {
    return Array.from(this.checkouts.values()).find((c) => c.paymentId === paymentId);
  }

  private transitionCheckout(checkout: Checkout, to: CheckoutStatus, fields: Partial<Checkout>): void {
    const allowed = CHECKOUT_STATUS_TRANSITIONS[checkout.status] ?? [];
    if (checkout.status !== to && !allowed.includes(to)) {
      throw new Error(`Invalid checkout state transition: ${checkout.status} → ${to}`);
    }
    checkout.status = to;
    Object.assign(checkout, fields);
    this.checkouts.set(checkout.id, checkout);
  }

  private dispatch(event: Omit<PurchaseEvent, 'timestamp' | 'origin'>): void {
    const full: PurchaseEvent = { ...event, timestamp: Date.now(), origin: PURCHASE_NODE_ID };
    purchaseEventBus.dispatch(full);
    // Fire-and-forget cross-node publish. Failures degrade to single-node
    // behavior rather than breaking the caller.
    void redisConfig.publish(PURCHASE_CHANNEL, full).catch(() => undefined);
  }

}
