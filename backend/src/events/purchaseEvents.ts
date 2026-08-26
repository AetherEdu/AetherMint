import { EventEmitter } from 'events';
import { PaymentMethod, PaymentStatus } from '../models/Enrollment';

/**
 * Unified payments — shared event contracts.
 *
 * The checkout orchestration (services/payments/CheckoutService.ts) emits
 * these events whenever a course purchase moves through its lifecycle
 * (initiated → pending → confirmed/failed, or refunded). Locally the events
 * are dispatched through {@link purchaseEventBus} so in-process consumers
 * (notifications, analytics, WebSocket fan-out) can react without waiting on
 * a Redis round-trip. The same event is also published to the
 * {@link PURCHASE_CHANNEL} Redis channel for cross-node / external consumers.
 */

/** Redis channel used to fan purchase events out across nodes. */
export const PURCHASE_CHANNEL = 'purchase:events';

/**
 * Stable identifier for this process. Mirrors the presence system: when a
 * node publishes an event it also receives its own echo on the subscriber
 * connection, and the origin marker lets consumers skip that self-echo.
 */
export const PURCHASE_NODE_ID = `${process.pid}-${Math.random().toString(36).slice(2, 10)}`;

/** Every event the unified payments system emits. */
export type PurchaseEventType =
  | 'PURCHASE_INITIATED'
  | 'PURCHASE_PENDING'
  | 'PURCHASE_CONFIRMED'
  | 'PURCHASE_FAILED'
  | 'PURCHASE_REFUNDED'
  | 'PURCHASE_RECONCILED';

/** Normalized, serializable payload published over Redis and to the bus. */
export interface PurchaseEvent {
  type: PurchaseEventType;
  /** Local payment record id (PaymentTransaction / Payment). */
  paymentId?: string;
  /** Unified checkout id that owns this purchase. */
  checkoutId?: string;
  userId: string;
  enrollmentId: string;
  courseId?: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  /** On-chain transaction hash (Stellar) once confirmed. */
  transactionHash?: string;
  /** Gateway reference (Stripe PaymentIntent id, etc.). */
  gatewayTransactionId?: string;
  error?: string;
  refundAmount?: number;
  timestamp: number;
  /** Process that published the event; used to ignore self-echoed events. */
  origin?: string;
}

export type PurchaseListener = (event: PurchaseEvent) => void;

/**
 * In-process event bus for purchases. Consumers subscribe with
 * {@link PurchaseEventBus.onEvent} and may pass `'*'` to receive every event.
 */
class PurchaseEventBus extends EventEmitter {
  /** Dispatch an event to typed listeners and the wildcard channel. */
  dispatch(event: PurchaseEvent): void {
    this.emit(event.type, event);
    this.emit('*', event);
  }

  onEvent(type: PurchaseEventType | '*', listener: PurchaseListener): this {
    return this.on(type, listener);
  }

  offEvent(type: PurchaseEventType | '*', listener: PurchaseListener): this {
    return this.off(type, listener);
  }
}

export const purchaseEventBus = new PurchaseEventBus();
