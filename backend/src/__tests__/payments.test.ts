/**
 * Unified payments tests — Issue #391.
 *
 * Covers the payment state machine, unified checkout orchestration (Stripe
 * fiat + Stellar crypto), Stripe webhook handling, on-chain reconciliation,
 * and the purchase events emitted through the lifecycle.
 */

import { PaymentMethod, PaymentStatus } from '../models/Enrollment';
import { PaymentService } from '../services/PaymentService';
import { CheckoutService } from '../services/payments/CheckoutService';
import { PaymentReconciliationService, CryptoPaymentRecord } from '../services/payments/PaymentReconciliationService';
import { StripePaymentService, StripeWebhookOutcome } from '../services/payments/StripePaymentService';
import { assertValidPaymentTransition } from '../services/payments/paymentStateMachine';
import { purchaseEventBus, PurchaseEvent } from '../events/purchaseEvents';

// The real StellarPaymentService talks to Horizon; replace it with a canned
// in-memory double so checkout flows can run end-to-end without a network.
jest.mock('../services/StellarPaymentService', () => {
  class StellarPaymentService {
    constructor(_settings: any) {}
    async createPaymentTransaction(
      _from: string,
      _amount: string,
      _assetCode: string,
      _assetIssuer?: string,
      _memo?: string,
    ) {
      return { transactionXDR: 'xdr_1', paymentId: 'pay_1' };
    }
    async submitTransaction(_signedXDR: string) {
      return {
        from: 'GAAA',
        to: 'GBBB',
        amount: '49.99',
        assetCode: 'XLM',
        transactionHash: 'hash_stellar_1',
        network: 'testnet',
      };
    }
    async verifyPayment() {
      return { isValid: true, errors: [], warnings: [] };
    }
    validatePaymentParameters() {
      return { isValid: true, errors: [], warnings: [] };
    }
    async getPaymentHistory() {
      return { payments: [], cursor: undefined };
    }
    getDistributionAddress() {
      return 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA';
    }
    async createRefundTransaction(_to: string, _amount: string, _assetCode: string) {
      return { transactionXDR: 'xdr_refund_1', refundId: 'refund_1' };
    }
    async getAccountBalance() {
      return [];
    }
    async checkAccountExists() {
      return true;
    }
  }
  return { StellarPaymentService };
});

/** In-memory Stripe double used by the checkout orchestration tests. */
function createFakeStripe(overrides: Partial<Record<string, any>> = {}) {
  return {
    async createPaymentIntent(params: any) {
      return {
        paymentIntentId: 'pi_1',
        clientSecret: 'cs_test_1',
        status: 'requires_payment_method',
        amount: params.amount,
        currency: params.currency.toLowerCase(),
      };
    },
    async retrievePaymentIntent() {
      return { paymentIntentId: 'pi_1', clientSecret: null, status: 'succeeded', amount: 49.99, currency: 'usd' };
    },
    async confirmPaymentIntent() {
      return { paymentIntentId: 'pi_1', clientSecret: null, status: 'succeeded', amount: 49.99, currency: 'usd' };
    },
    async refund() {
      return { refundId: 're_1', status: 'succeeded', amount: 49.99, currency: 'usd' };
    },
    getPublishableKey() {
      return 'pk_test_1';
    },
    ...overrides,
  };
}

describe('payment state machine', () => {
  it('allows the happy path pending → processing → completed', () => {
    expect(() => assertValidPaymentTransition(PaymentStatus.PENDING, PaymentStatus.PROCESSING)).not.toThrow();
    expect(() => assertValidPaymentTransition(PaymentStatus.PROCESSING, PaymentStatus.COMPLETED)).not.toThrow();
  });

  it('allows pending → failed and completed → refunded', () => {
    expect(() => assertValidPaymentTransition(PaymentStatus.PENDING, PaymentStatus.FAILED)).not.toThrow();
    expect(() => assertValidPaymentTransition(PaymentStatus.COMPLETED, PaymentStatus.REFUNDED)).not.toThrow();
  });

  it('rejects invalid transitions', () => {
    expect(() => assertValidPaymentTransition(PaymentStatus.PENDING, PaymentStatus.COMPLETED)).toThrow();
    expect(() => assertValidPaymentTransition(PaymentStatus.COMPLETED, PaymentStatus.FAILED)).toThrow();
    expect(() => assertValidPaymentTransition(PaymentStatus.FAILED, PaymentStatus.COMPLETED)).toThrow();
    expect(() => assertValidPaymentTransition(PaymentStatus.REFUNDED, PaymentStatus.COMPLETED)).toThrow();
  });

  it('treats same-status transitions as valid (idempotent updates)', () => {
    expect(() => assertValidPaymentTransition(PaymentStatus.PENDING, PaymentStatus.PENDING)).not.toThrow();
  });
});

describe('CheckoutService — Stellar (crypto) rail', () => {
  const paymentService = new PaymentService();
  const checkoutService = new CheckoutService({ paymentService });
  let events: PurchaseEvent[] = [];

  beforeEach(() => {
    events = [];
    purchaseEventBus.onEvent('*', (e) => events.push(e));
  });

  afterEach(() => {
    purchaseEventBus.removeAllListeners();
  });

  it('creates a pending checkout with XDR gateway data and stamps a memo', async () => {
    const checkout = await checkoutService.createCheckout({
      enrollmentId: 'enr_1',
      userId: 'u1',
      courseId: 'course_1',
      amount: 49.99,
      currency: 'USD',
      method: 'stellar',
      stellar: { fromAddress: 'GAAA', assetCode: 'XLM' },
    });

    expect(checkout.status).toBe('pending');
    expect(checkout.method).toBe('stellar');
    expect(checkout.gatewayData?.transactionXDR).toBe('xdr_1');
    expect(checkout.gatewayData?.memo).toBeTruthy();
    expect(checkout.gatewayData?.destination).toBeTruthy();
    expect(events.some((e) => e.type === 'PURCHASE_INITIATED')).toBe(true);
  });

  it('confirms a stellar checkout once the signed XDR is submitted', async () => {
    const checkout = await checkoutService.createCheckout({
      enrollmentId: 'enr_2',
      userId: 'u2',
      courseId: 'course_2',
      amount: 25,
      currency: 'USD',
      method: 'stellar',
      stellar: { fromAddress: 'GAAA', assetCode: 'XLM' },
    });

    const { checkout: confirmed, transaction } = await checkoutService.confirmCheckout(checkout.id, {
      signedTransactionXDR: 'signed_xdr_1',
    });

    expect(confirmed.status).toBe('completed');
    expect(confirmed.transactionHash).toBe('hash_stellar_1');
    expect(transaction?.stellarTransactionHash).toBe('hash_stellar_1');
    expect(events.some((e) => e.type === 'PURCHASE_CONFIRMED' && e.checkoutId === checkout.id)).toBe(true);
  });

  it('refuses to confirm a stellar checkout without a signed transaction', async () => {
    const checkout = await checkoutService.createCheckout({
      enrollmentId: 'enr_3',
      userId: 'u3',
      amount: 10,
      currency: 'USD',
      method: 'stellar',
      stellar: { fromAddress: 'GAAA', assetCode: 'XLM' },
    });

    await expect(checkoutService.confirmCheckout(checkout.id, {})).rejects.toThrow(/signedTransactionXDR/);
  });
});

describe('CheckoutService — Stripe (fiat) rail', () => {
  let events: PurchaseEvent[] = [];
  let paymentService: PaymentService;
  let checkoutService: CheckoutService;

  beforeEach(() => {
    events = [];
    purchaseEventBus.onEvent('*', (e) => events.push(e));
    paymentService = new PaymentService();
    checkoutService = new CheckoutService({
      paymentService,
      stripePaymentService: createFakeStripe() as any,
    });
  });

  afterEach(() => {
    purchaseEventBus.removeAllListeners();
  });

  it('creates a pending checkout with a Stripe client secret', async () => {
    const checkout = await checkoutService.createCheckout({
      enrollmentId: 'enr_s1',
      userId: 'u1',
      courseId: 'course_1',
      amount: 49.99,
      currency: 'USD',
      method: 'stripe',
    });

    expect(checkout.status).toBe('pending');
    expect(checkout.gatewayData?.paymentIntentId).toBe('pi_1');
    expect(checkout.gatewayData?.clientSecret).toBe('cs_test_1');
    expect(checkout.gatewayData?.publishableKey).toBe('pk_test_1');
    expect(events.some((e) => e.type === 'PURCHASE_INITIATED' && e.method === PaymentMethod.STRIPE)).toBe(true);
  });

  it('confirms a Stripe checkout with a payment method', async () => {
    const checkout = await checkoutService.createCheckout({
      enrollmentId: 'enr_s2',
      userId: 'u2',
      amount: 49.99,
      currency: 'USD',
      method: 'stripe',
    });

    const { checkout: confirmed, transaction } = await checkoutService.confirmCheckout(checkout.id, {
      paymentIntentId: 'pi_1',
      paymentMethodId: 'pm_card_1',
    });

    expect(confirmed.status).toBe('completed');
    expect(transaction?.gatewayTransactionId).toBe('pi_1');
    expect(events.some((e) => e.type === 'PURCHASE_CONFIRMED' && e.checkoutId === checkout.id)).toBe(true);
  });

  it('marks the checkout failed when the Stripe intent fails', async () => {
    checkoutService = new CheckoutService({
      paymentService,
      stripePaymentService: createFakeStripe({
        confirmPaymentIntent: async () => ({ paymentIntentId: 'pi_1', clientSecret: null, status: 'requires_payment_method', amount: 49.99, currency: 'usd' }),
        retrievePaymentIntent: async () => ({ paymentIntentId: 'pi_1', clientSecret: null, status: 'canceled', amount: 49.99, currency: 'usd' }),
      }) as any,
    });

    const checkout = await checkoutService.createCheckout({
      enrollmentId: 'enr_s3',
      userId: 'u3',
      amount: 49.99,
      currency: 'USD',
      method: 'stripe',
    });

    const { checkout: confirmed } = await checkoutService.confirmCheckout(checkout.id, { paymentIntentId: 'pi_1' });
    expect(confirmed.status).toBe('failed');
    expect(events.some((e) => e.type === 'PURCHASE_FAILED' && e.checkoutId === checkout.id)).toBe(true);
  });
});

describe('Stripe webhook handling', () => {
  let events: PurchaseEvent[] = [];
  let paymentService: PaymentService;
  let checkoutService: CheckoutService;

  beforeEach(() => {
    events = [];
    purchaseEventBus.onEvent('*', (e) => events.push(e));
    paymentService = new PaymentService();
    checkoutService = new CheckoutService({
      paymentService,
      stripePaymentService: createFakeStripe() as any,
    });
  });

  afterEach(() => {
    purchaseEventBus.removeAllListeners();
  });

  it('finalizes a pending Stripe payment on payment_intent.succeeded', async () => {
    const checkout = await checkoutService.createCheckout({
      enrollmentId: 'enr_w1',
      userId: 'u1',
      amount: 49.99,
      currency: 'USD',
      method: 'stripe',
    });

    await checkoutService.handleStripeWebhookOutcome({
      eventType: 'payment_intent.succeeded',
      paymentIntentId: 'pi_1',
      status: 'succeeded',
    } as StripeWebhookOutcome);

    const payment = paymentService.findPaymentByGatewayTransactionId('pi_1');
    expect(payment?.status).toBe(PaymentStatus.COMPLETED);
    expect(checkoutService.getCheckout(checkout.id)?.status).toBe('completed');
    expect(events.some((e) => e.type === 'PURCHASE_CONFIRMED')).toBe(true);
  });

  it('is idempotent when the same succeeded webhook arrives twice', async () => {
    await checkoutService.createCheckout({
      enrollmentId: 'enr_w2',
      userId: 'u2',
      amount: 49.99,
      currency: 'USD',
      method: 'stripe',
    });

    await checkoutService.handleStripeWebhookOutcome({ eventType: 'payment_intent.succeeded', paymentIntentId: 'pi_1', status: 'succeeded' } as StripeWebhookOutcome);
    await expect(
      checkoutService.handleStripeWebhookOutcome({ eventType: 'payment_intent.succeeded', paymentIntentId: 'pi_1', status: 'succeeded' } as StripeWebhookOutcome),
    ).resolves.not.toThrow();
  });

  it('marks a completed payment refunded on charge.refunded', async () => {
    const checkout = await checkoutService.createCheckout({
      enrollmentId: 'enr_w3',
      userId: 'u3',
      amount: 49.99,
      currency: 'USD',
      method: 'stripe',
    });

    await checkoutService.handleStripeWebhookOutcome({ eventType: 'payment_intent.succeeded', paymentIntentId: 'pi_1', status: 'succeeded' } as StripeWebhookOutcome);
    await checkoutService.handleStripeWebhookOutcome({ eventType: 'charge.refunded', paymentIntentId: 'pi_1', status: 'refunded' } as StripeWebhookOutcome);

    const payment = paymentService.findPaymentByGatewayTransactionId('pi_1');
    expect(payment?.status).toBe(PaymentStatus.REFUNDED);
    expect(checkoutService.getCheckout(checkout.id)?.status).toBe('refunded');
    expect(events.some((e) => e.type === 'PURCHASE_REFUNDED')).toBe(true);
  });
});

describe('PaymentReconciliationService', () => {
  const baseRecord: CryptoPaymentRecord = {
    paymentId: 'pay_local_1',
    enrollmentId: 'enr_r1',
    userId: 'u1',
    courseId: 'course_1',
    amount: 49.99,
    currency: 'XLM',
    method: PaymentMethod.STELLAR,
    status: PaymentStatus.PENDING,
    metadata: { paymentReference: 'ref_abc' },
  };

  it('reconciles a pending payment when an on-chain memo matches', async () => {
    const onReconciled = jest.fn();
    const stellar = {
      getDistributionAddress: () => 'GBBB',
      getPaymentHistory: jest.fn().mockResolvedValue({
        payments: [
          { memo: 'other', amount: '5', assetCode: 'XLM', transactionHash: 'h1' },
          { memo: 'ref_abc', amount: '49.99', assetCode: 'XLM', transactionHash: 'h2' },
        ],
        cursor: undefined,
      }),
      verifyPayment: jest.fn().mockResolvedValue({ isValid: true, errors: [], warnings: [] }),
    };

    const service = new PaymentReconciliationService({
      stellar: stellar as any,
      distributionAddress: 'GBBB',
      fetchPending: () => [baseRecord],
      onReconciled,
    });

    const summary = await service.reconcilePendingPayments();
    expect(summary.scanned).toBe(1);
    expect(summary.reconciled).toBe(1);
    expect(onReconciled).toHaveBeenCalledTimes(1);
    expect(onReconciled).toHaveBeenCalledWith(baseRecord, expect.objectContaining({ transactionHash: 'h2' }));
  });

  it('leaves a payment pending when no on-chain payment matches', async () => {
    const onReconciled = jest.fn();
    const stellar = {
      getDistributionAddress: () => 'GBBB',
      getPaymentHistory: jest.fn().mockResolvedValue({
        payments: [{ memo: 'unrelated', amount: '5', assetCode: 'XLM', transactionHash: 'h1' }],
        cursor: undefined,
      }),
      verifyPayment: jest.fn().mockResolvedValue({ isValid: true, errors: [], warnings: [] }),
    };

    const service = new PaymentReconciliationService({
      stellar: stellar as any,
      distributionAddress: 'GBBB',
      fetchPending: () => [baseRecord],
      onReconciled,
    });

    const summary = await service.reconcilePendingPayments();
    expect(summary.scanned).toBe(1);
    expect(summary.reconciled).toBe(0);
    expect(onReconciled).not.toHaveBeenCalled();
  });

  it('rejects a memo match that fails on-chain verification', async () => {
    const onReconciled = jest.fn();
    const stellar = {
      getDistributionAddress: () => 'GBBB',
      getPaymentHistory: jest.fn().mockResolvedValue({
        payments: [{ memo: 'ref_abc', amount: '49.99', assetCode: 'XLM', transactionHash: 'h2' }],
        cursor: undefined,
      }),
      verifyPayment: jest.fn().mockResolvedValue({ isValid: false, errors: ['amount mismatch'], warnings: [] }),
    };

    const service = new PaymentReconciliationService({
      stellar: stellar as any,
      distributionAddress: 'GBBB',
      fetchPending: () => [baseRecord],
      onReconciled,
    });

    const summary = await service.reconcilePendingPayments();
    expect(summary.reconciled).toBe(0);
    expect(onReconciled).not.toHaveBeenCalled();
    expect(summary.outcomes[0].errors.join()).toContain('failed verification');
  });
});

describe('StripePaymentService', () => {
  const service = new StripePaymentService();

  it('normalizes payment_intent.succeeded', () => {
    const outcome = service.normalizeWebhookEvent({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_9' } },
    } as any);
    expect(outcome.status).toBe('succeeded');
    expect(outcome.paymentIntentId).toBe('pi_9');
  });

  it('normalizes charge.refunded into a refund outcome', () => {
    const outcome = service.normalizeWebhookEvent({
      type: 'charge.refunded',
      data: { object: { id: 'ch_1', payment_intent: 'pi_9', amount_refunded: 4999, amount: 4999 } },
    } as any);
    expect(outcome.status).toBe('refunded');
    expect(outcome.paymentIntentId).toBe('pi_9');
  });

  it('parses a webhook payload without a secret in development', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const event = service.constructEvent(
        Buffer.from(JSON.stringify({ type: 'payment_intent.succeeded', data: { object: { id: 'pi_1' } } })),
        'sig_whatever',
      );
      expect(event.type).toBe('payment_intent.succeeded');
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
