/**
 * Enrollment Model
 * Defines the structure and interfaces for course enrollment data
 */

import mongoose, { Document, Schema } from 'mongoose';

export enum EnrollmentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  SUSPENDED = 'suspended',
  REFUNDED = 'refunded',
  EXPIRED = 'expired'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded'
}

export enum PaymentMethod {
  STELLAR = 'stellar',
  CREDIT_CARD = 'credit_card',
  BANK_TRANSFER = 'bank_transfer',
  CRYPTO = 'crypto',
  INSTALLMENT = 'installment'
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  status: EnrollmentStatus;
  enrolledAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  expiresAt?: Date;
  progress: number; // 0-100
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  totalAmount: number;
  currency: string;
  transactionId?: string;
  stellarTransactionHash?: string;
  refundAmount?: number;
  refundReason?: string;
  refundedAt?: Date;
  certificateIssued: boolean;
  certificateId?: string;
  waitlistPosition?: number;
  prerequisitesMet: boolean;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface Payment {
  id: string;
  enrollmentId: string;
  userId: string;
  courseId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  stellarTransactionHash?: string;
  stellarPayment?: StellarPayment;
  createdAt: Date;
  completedAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  refundAmount?: number;
  refundReason?: string;
  refundedAt?: Date;
  metadata?: Record<string, any>;
}

export interface StellarPayment {
  from: string;
  to: string;
  amount: string;
  assetCode: string;
  assetIssuer?: string;
  transactionHash: string;
  memo?: string;
  horizonUrl?: string;
  network: 'testnet' | 'mainnet' | 'local';
}

export interface WaitlistEntry {
  id: string;
  userId: string;
  courseId: string;
  position: number;
  addedAt: Date;
  notifiedAt?: Date;
  expiresAt?: Date;
  status: 'active' | 'notified' | 'expired' | 'removed';
}

export interface RefundRequest {
  id: string;
  enrollmentId: string;
  userId: string;
  courseId: string;
  reason: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  requestedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  adminNotes?: string;
  processedAt?: Date;
  refundTransactionId?: string;
}

export interface InstallmentPlan {
  id: string;
  enrollmentId: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  installmentCount: number;
  paidInstallments: number;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  nextDueDate: Date;
  status: 'active' | 'completed' | 'defaulted' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export interface Installment {
  id: string;
  planId: string;
  installmentNumber: number;
  amount: number;
  dueDate: Date;
  paidAt?: Date;
  status: 'pending' | 'paid' | 'overdue' | 'failed';
  transactionId?: string;
  lateFee?: number;
}

export interface EnrollmentCapacity {
  courseId: string;
  maxStudents: number;
  currentEnrollments: number;
  waitlistCount: number;
  lastUpdated: Date;
}

export interface EnrollmentAnalytics {
  courseId: string;
  totalEnrollments: number;
  activeEnrollments: number;
  completedEnrollments: number;
  cancelledEnrollments: number;
  refundedEnrollments: number;
  totalRevenue: number;
  averageCompletionTime: number; // in days
  enrollmentRate: number; // enrollments per day
  completionRate: number; // percentage
  refundRate: number; // percentage
  dropoffRate: number; // percentage
  revenueByMonth: { month: string; revenue: number }[];
  enrollmentsByMonth: { month: string; count: number }[];
  completionByMonth: { month: string; count: number }[];
}

export interface EnrollmentFilter {
  userId?: string;
  courseId?: string;
  status?: EnrollmentStatus[];
  paymentStatus?: PaymentStatus[];
  paymentMethod?: PaymentMethod[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  progressRange?: {
    min: number;
    max: number;
  };
  certificateIssued?: boolean;
  waitlisted?: boolean;
  sortBy?: 'enrolledAt' | 'progress' | 'amountPaid' | 'completedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface EnrollmentStats {
  totalEnrollments: number;
  activeEnrollments: number;
  completedEnrollments: number;
  cancelledEnrollments: number;
  pendingEnrollments: number;
  totalRevenue: number;
  averageEnrollmentValue: number;
  completionRate: number;
  refundRate: number;
  waitlistCount: number;
}

export interface CourseEnrollmentSummary {
  courseId: string;
  courseTitle: string;
  totalEnrollments: number;
  activeEnrollments: number;
  completedEnrollments: number;
  waitlistCount: number;
  totalRevenue: number;
  averageRating: number;
  completionRate: number;
  refundRate: number;
  lastEnrollmentDate: Date;
}

export interface UserEnrollmentHistory {
  userId: string;
  totalEnrollments: number;
  activeEnrollments: number;
  completedEnrollments: number;
  totalSpent: number;
  averageCompletionTime: number;
  favoriteCategories: string[];
  completionRate: number;
  lastActivityDate: Date;
  enrollments: Enrollment[];
}

// ── Mongoose Schema ────────────────────────────────────────────────────────

export interface IEnrollmentDocument extends Document {
  userId: string;
  courseId: string;
  status: EnrollmentStatus;
  enrolledAt: Date;
  completedAt?: Date;
  progress: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  totalAmount: number;
  currency: string;
  transactionId?: string;
  certificateIssued: boolean;
  certificateId?: string;
  prerequisitesMet: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EnrollmentSchema = new Schema<IEnrollmentDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    courseId: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(EnrollmentStatus),
      default: EnrollmentStatus.PENDING,
      index: true,
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    transactionId: {
      type: String,
      sparse: true,
    },
    certificateIssued: {
      type: Boolean,
      default: false,
    },
    certificateId: {
      type: String,
      sparse: true,
    },
    prerequisitesMet: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Primary composite: user + course (unique enrollment)
EnrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });

// Composite: course + status for course-level queries
EnrollmentSchema.index({ courseId: 1, status: 1 });

// Composite: user + status for user dashboard
EnrollmentSchema.index({ userId: 1, status: 1 });

// Composite: user + progress for progress tracking
EnrollmentSchema.index({ userId: 1, progress: -1 });

// Composite: course + enrolledAt for analytics
EnrollmentSchema.index({ courseId: 1, enrolledAt: -1 });

// Composite: status + enrolledAt for time-based filtering
EnrollmentSchema.index({ status: 1, enrolledAt: -1 });

// Composite: paymentStatus for billing queries
EnrollmentSchema.index({ paymentStatus: 1, createdAt: -1 });

export const EnrollmentModel = mongoose.model<IEnrollmentDocument>('Enrollment', EnrollmentSchema);
