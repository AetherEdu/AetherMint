/**
 * Payment Model
 * Defines the structure and interfaces for payment processing data
 */

import { PaymentMethod, PaymentStatus, StellarPayment } from './Enrollment';

export { PaymentMethod, PaymentStatus, type StellarPayment } from './Enrollment';

// Type aliases used across the codebase
export type Payment = PaymentTransaction;
export type RefundRequest = { transactionId: string; reason: string; amount: number; };
export type RefundAnalytics = { totalRefunds: number; totalAmount: number; reasons: Record<string, number>; };

// Unified checkout (Issue #391) — one abstraction over both payment rails.
export type CheckoutMethod = 'stripe' | 'stellar';
export type CheckoutStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'expired';

export interface Checkout {
  id: string;
  enrollmentId: string;
  userId: string;
  courseId?: string;
  amount: number;
  currency: string;
  method: CheckoutMethod;
  status: CheckoutStatus;
  /** PaymentService payment intent id backing this checkout. */
  paymentIntentId?: string;
  /** Local payment record id (set at creation, confirmed once finalized). */
  paymentId?: string;
  /** Gateway reference: Stripe PaymentIntent id or Stellar payment id. */
  gatewayPaymentIntentId?: string;
  gatewayData?: Record<string, any>;
  transactionHash?: string;
  createdAt: Date;
  expiresAt?: Date;
  confirmedAt?: Date;
  failedAt?: Date;
  failureReason?: string;
}

export interface PaymentGateway {
  id: string;
  name: string;
  type: PaymentMethod;
  isActive: boolean;
  config: PaymentGatewayConfig;
  supportedCurrencies: string[];
  fees: PaymentFee[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentGatewayConfig {
  apiKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  merchantId?: string;
  environment: 'sandbox' | 'production';
  stellarNetwork?: 'testnet' | 'mainnet' | 'local';
  stellarIssuer?: string;
  stellarDistributionAccount?: string;
  [key: string]: any;
}

export interface PaymentFee {
  type: 'fixed' | 'percentage' | 'tiered';
  amount: number;
  currency: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface PaymentTransaction {
  id: string;
  enrollmentId: string;
  userId: string;
  courseId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  gateway?: string;
  gatewayTransactionId?: string;
  transactionId?: string;
  stellarTransaction?: StellarPayment;
  stellarTransactionHash?: string;
  createdAt: Date;
  updatedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  expiresAt?: Date;
  failureReason?: string;
  refundAmount?: number;
  refundReason?: string;
  refundedAt?: Date;
  metadata?: Record<string, any>;
}

export interface PaymentIntent {
  id: string;
  userId: string;
  courseId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: 'created' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  clientSecret?: string;
  gatewayData?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: Date;
  expiresAt?: Date;
  confirmedAt?: Date;
}

export interface PaymentWebhook {
  id: string;
  gateway: string;
  eventType: string;
  transactionId?: string;
  payload: Record<string, any>;
  processed: boolean;
  processedAt?: Date;
  error?: string;
  createdAt: Date;
}

export interface PaymentSettings {
  acceptedMethods: PaymentMethod[];
  defaultCurrency: string;
  supportedCurrencies: string[];
  autoRefundEnabled: boolean;
  refundWindowDays: number;
  installmentEnabled: boolean;
  minInstallmentAmount: number;
  maxInstallments: number;
  installmentFeePercentage: number;
  stellarSettings: StellarPaymentSettings;
}

export interface StellarPaymentSettings {
  network: 'testnet' | 'mainnet' | 'local';
  horizonUrl: string;
  distributionAccount: string;
  acceptedAssets: StellarAsset[];
  autoConfirmPayments: boolean;
  confirmationThreshold: number; // confirmations required
  memoPrefix?: string;
}

export interface StellarAsset {
  code: string;
  issuer?: string; // undefined for native XLM
  name: string;
  decimals: number;
  isActive: boolean;
  minAmount: number;
  maxAmount: number;
}

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  source: string;
  timestamp: Date;
}

export interface PaymentAnalytics {
  totalRevenue: number;
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  refundedTransactions: number;
  averageTransactionValue: number;
  revenueByMethod: { method: PaymentMethod; revenue: number; count: number }[];
  revenueByCurrency: { currency: string; revenue: number; count: number }[];
  revenueByMonth: { month: string; revenue: number; count: number }[];
  failureReasons: { reason: string; count: number }[];
  refundReasons: { reason: string; count: number; amount: number }[];
}

export interface PaymentReceipt {
  id: string;
  transactionId: string;
  userId: string;
  courseId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionDate: Date;
  receiptUrl?: string;
  receiptNumber: string;
  billingAddress?: BillingAddress;
  items: ReceiptItem[];
  tax: number;
  total: number;
  metadata?: Record<string, any>;
}

export interface BillingAddress {
  name: string;
  email: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface ReceiptItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  currency: string;
}

export interface PaymentMethodConfig {
  method: PaymentMethod;
  isActive: boolean;
  displayName: string;
  description: string;
  icon: string;
  supportedCurrencies: string[];
  fees: PaymentFee[];
  limits: {
    minAmount: number;
    maxAmount: number;
    dailyLimit?: number;
    monthlyLimit?: number;
  };
  requirements: PaymentRequirement[];
}

export interface PaymentRequirement {
  type: 'email' | 'phone' | 'address' | 'kyc' | 'identity' | 'custom';
  name: string;
  description: string;
  required: boolean;
  validated?: boolean;
}

export interface PaymentValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: Record<string, any>;
}

export interface PaymentNotification {
  id: string;
  userId: string;
  type: 'payment_success' | 'payment_failed' | 'payment_refunded' | 'installment_due' | 'payment_reminder';
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: Date;
  sentAt?: Date;
}
