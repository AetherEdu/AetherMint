/**
 * Payment state machine — Issue #391.
 *
 * The unified checkout drives every payment through the same lifecycle:
 *
 *   pending ──► processing ──► completed   (confirmed on the payment rail)
 *      │             │
 *      └──────┬──────┘
 *             ▼
 *          failed        (terminal — a new checkout/payment must be created)
 *
 *   completed ──► refunded
 *   completed ──► partially_refunded ──► refunded
 *
 * `completed` is the canonical "confirmed" state; the two names are used
 * interchangeably across the codebase.
 */

import { PaymentStatus } from '../../models/Enrollment';

/** Valid transitions keyed by the current status. */
export const PAYMENT_STATUS_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.PENDING]: [PaymentStatus.PROCESSING, PaymentStatus.FAILED],
  [PaymentStatus.PROCESSING]: [PaymentStatus.COMPLETED, PaymentStatus.FAILED],
  [PaymentStatus.COMPLETED]: [PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED],
  [PaymentStatus.FAILED]: [],
  [PaymentStatus.REFUNDED]: [],
  [PaymentStatus.PARTIALLY_REFUNDED]: [PaymentStatus.REFUNDED],
};

/**
 * Throws unless the `from → to` transition is permitted by the state machine.
 * Used by the checkout orchestration before mutating any payment record so
 * that a stale webhook or a duplicate confirm can never move a payment into
 * an invalid state.
 */
export function assertValidPaymentTransition(
  from: PaymentStatus,
  to: PaymentStatus,
): void {
  if (from === to) {
    return;
  }

  const allowed = PAYMENT_STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid payment state transition: ${from} → ${to}`);
  }
}

/** True when the target status is reachable from the current one. */
export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) {
    return true;
  }
  return (PAYMENT_STATUS_TRANSITIONS[from] ?? []).includes(to);
}
