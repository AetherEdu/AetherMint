/**
 * Crypto payment reconciliation — Issue #391.
 *
 * Stellar payments are submitted by the learner's wallet, so the platform
 * cannot mark a purchase confirmed at intent-creation time. Instead this
 * service watches the distribution account on-chain and matches incoming
 * payments back to local pending records using the memo stamped on every
 * checkout (the payment reference). A match is only accepted once the
 * on-chain transaction verifies (destination, amount, asset, success flag),
 * after which the orchestration layer finalizes the purchase and emits the
 * purchase events.
 */

import logger from '../../utils/logger';
import { PaymentMethod, PaymentStatus } from '../../models/Enrollment';
import type { StellarPaymentService } from '../StellarPaymentService';
import type { StellarPayment } from '../../models/Enrollment';

/** Minimal view of a local payment record needed for reconciliation. */
export interface CryptoPaymentRecord {
  paymentId: string;
  enrollmentId: string;
  userId: string;
  courseId?: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionHash?: string;
  metadata?: Record<string, any>;
}

export interface ReconciliationOutcome {
  paymentId: string;
  reconciled: boolean;
  matched: boolean;
  errors: string[];
}

export interface ReconciliationSummary {
  scanned: number;
  reconciled: number;
  failed: number;
  outcomes: ReconciliationOutcome[];
}

export interface ReconciliationDependencies {
  /** On-chain lookups (StellarPaymentService). */
  stellar: Pick<StellarPaymentService, 'getPaymentHistory' | 'verifyPayment' | 'getDistributionAddress'>;
  /** Distribution account whose incoming payments represent purchases. */
  distributionAddress: string;
  /** Pending crypto payments to sweep. */
  fetchPending: () => CryptoPaymentRecord[];
  /** Called when an on-chain payment matches a local record. */
  onReconciled: (payment: CryptoPaymentRecord, onChain: StellarPayment) => Promise<void> | void;
}

export class PaymentReconciliationService {
  private readonly deps: ReconciliationDependencies;

  constructor(deps: ReconciliationDependencies) {
    this.deps = deps;
  }

  /**
   * Sweep all pending crypto payments and reconcile any that have settled
   * on-chain. Returns a summary suitable for surfacing in an admin endpoint
   * or scheduled job.
   */
  async reconcilePendingPayments(): Promise<ReconciliationSummary> {
    // Without a distribution account there is nothing to watch on-chain; fail
    // open so the server can boot without secrets configured (dev / CI).
    if (!this.deps.distributionAddress) {
      logger.warn('Crypto reconciliation skipped: distribution account not configured');
      return { scanned: 0, reconciled: 0, failed: 0, outcomes: [] };
    }

    const pending = this.deps
      .fetchPending()
      .filter((p) => p.method === PaymentMethod.STELLAR && p.status === PaymentStatus.PENDING);

    const outcomes: ReconciliationOutcome[] = [];
    for (const payment of pending) {
      outcomes.push(await this.reconcilePayment(payment));
    }

    return {
      scanned: pending.length,
      reconciled: outcomes.filter((o) => o.reconciled).length,
      failed: outcomes.filter((o) => !o.reconciled && o.matched).length,
      outcomes,
    };
  }

  /**
   * Reconcile a single pending crypto payment against the Stellar network.
   *
   * Matching strategy:
   *   1. If the record already carries a transaction hash, verify it directly.
   *   2. Otherwise page through payments to the distribution account and look
   *      for one whose memo equals the local payment reference.
   */
  async reconcilePayment(payment: CryptoPaymentRecord): Promise<ReconciliationOutcome> {
    const outcome: ReconciliationOutcome = {
      paymentId: payment.paymentId,
      reconciled: false,
      matched: false,
      errors: [],
    };

    try {
      if (payment.transactionHash) {
        const candidate: StellarPayment = {
          from: '',
          to: this.deps.distributionAddress,
          amount: payment.amount.toString(),
          assetCode: payment.currency,
          transactionHash: payment.transactionHash,
          network: 'testnet',
        };
        const verification = await this.deps.stellar.verifyPayment(candidate);
        if (verification.isValid) {
          outcome.matched = true;
          await this.deps.onReconciled(payment, candidate);
          outcome.reconciled = true;
          return outcome;
        }
        outcome.errors.push(...verification.errors);
        return outcome;
      }

      const reference = payment.metadata?.paymentReference as string | undefined;
      if (!reference) {
        outcome.errors.push('No payment reference or transaction hash available to reconcile');
        return outcome;
      }

      let cursor: string | undefined;
      // Bound the sweep to a few pages so a stuck record cannot scan forever.
      for (let page = 0; page < 5; page += 1) {
        const { payments, cursor: nextCursor } = await this.deps.stellar.getPaymentHistory(
          this.deps.distributionAddress,
          50,
          cursor,
        );
        cursor = nextCursor;

        for (const onChain of payments) {
          if ((onChain.memo ?? '').trim() !== reference) {
            continue;
          }

          const verification = await this.deps.stellar.verifyPayment(onChain);
          if (!verification.isValid) {
            outcome.errors.push(`On-chain match failed verification: ${verification.errors.join(', ')}`);
            continue;
          }

          outcome.matched = true;
          await this.deps.onReconciled(payment, onChain);
          outcome.reconciled = true;
          return outcome;
        }

        if (!cursor) {
          break;
        }
      }

      if (!outcome.matched) {
        outcome.errors.push('No on-chain payment matched the payment reference');
      }
      return outcome;
    } catch (error) {
      logger.error('Error reconciling crypto payment', {
        paymentId: payment.paymentId,
        error: error instanceof Error ? error.message : String(error),
      });
      outcome.errors.push(error instanceof Error ? error.message : 'Reconciliation failed');
      return outcome;
    }
  }
}
