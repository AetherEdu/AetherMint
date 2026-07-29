/**
 * Payment Service
 * Handles payment processing and management for course enrollments
 */

import { 
  Payment, 
  PaymentIntent, 
  PaymentTransaction, 
  PaymentMethod, 
  PaymentStatus,
  PaymentGateway,
  PaymentSettings,
  PaymentAnalytics,
  PaymentReceipt,
  RefundRequest,
  StellarPaymentSettings,
  PaymentValidation
} from '../models/Payment';
import { StellarPaymentService } from './StellarPaymentService';
import { auditService } from './auditService';
import { AuditAction } from '../models/AuditLog';
import { v4 as uuidv4 } from 'uuid';

export class PaymentService {
  private stellarPaymentService: StellarPaymentService;
  private payments: Map<string, Payment> = new Map();
  private paymentIntents: Map<string, PaymentIntent> = new Map();
  private transactions: Map<string, PaymentTransaction> = new Map();
  private paymentSettings: PaymentSettings;

  constructor() {
    // Initialize Stellar payment service with default settings
    const stellarSettings: StellarPaymentSettings = {
      network: 'testnet',
      horizonUrl: 'https://horizon-testnet.stellar.org',
      distributionAccount: process.env.STELLAR_DISTRIBUTION_ACCOUNT || '',
      acceptedAssets: [
        {
          code: 'XLM',
          name: 'Stellar Lumens',
          decimals: 7,
          isActive: true,
          minAmount: 0.0001,
          maxAmount: 10000
        },
        {
          code: 'USDC',
          issuer: 'GBBD47IF6LWS7RH7U6VX6ER2N4ZAVUEZEHF4D4ZEKJ4BULR56HYU5BAA',
          name: 'USD Coin',
          decimals: 7,
          isActive: true,
          minAmount: 0.01,
          maxAmount: 100000
        }
      ],
      autoConfirmPayments: true,
      confirmationThreshold: 1
    };

    this.stellarPaymentService = new StellarPaymentService(stellarSettings);
    this.paymentSettings = {
      acceptedMethods: [PaymentMethod.STELLAR, PaymentMethod.CREDIT_CARD],
      defaultCurrency: 'USD',
      supportedCurrencies: ['USD', 'EUR', 'XLM'],
      autoRefundEnabled: true,
      refundWindowDays: 30,
      installmentEnabled: true,
      minInstallmentAmount: 50,
      maxInstallments: 12,
      installmentFeePercentage: 5,
      stellarSettings
    };
  }

/**
    * Create payment intent
    */
  async createPaymentIntent(
    enrollmentId: string,
    method: PaymentMethod,
    details: any,
    auditContext?: { actor: string; ipAddress?: string }
  ): Promise<PaymentIntent> {
    const paymentIntent: PaymentIntent = {
      id: uuidv4(),
      userId: details.userId,
      courseId: details.courseId,
      amount: details.amount,
      currency: details.currency,
      method,
      status: 'created',
      metadata: details.metadata,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
    };

    this.paymentIntents.set(paymentIntent.id, paymentIntent);

    // Create payment record
    const payment: Payment = {
      id: uuidv4(),
      enrollmentId,
      userId: details.userId,
      courseId: details.courseId,
      amount: details.amount,
      currency: details.currency,
      method,
      status: PaymentStatus.PENDING,
      createdAt: new Date(),
      metadata: details.metadata
    };

    this.payments.set(payment.id, payment);

    if (auditContext) {
      await auditService.create(
        auditContext.actor,
        AuditAction.PAYMENT_CREATE,
        'payment',
        {
          resourceId: payment.id,
          details: { 
            enrollmentId, 
            courseId: details.courseId, 
            amount: details.amount, 
            currency: details.currency, 
            method 
          },
          ipAddress: auditContext.ipAddress,
        }
      );
    }

    return paymentIntent;
  }

  /**
   * Create Stellar payment intent
   */
  async createStellarPaymentIntent(
    enrollmentId: string,
    details: any
  ): Promise<PaymentIntent> {
    const paymentIntent = await this.createPaymentIntent(enrollmentId, PaymentMethod.STELLAR, details);

    // Create Stellar transaction
    const { transactionXDR, paymentId } = await this.stellarPaymentService.createPaymentTransaction(
      details.fromAddress,
      details.amount.toString(),
      details.assetCode || 'XLM',
      details.assetIssuer
    );

    paymentIntent.gatewayData = {
      transactionXDR,
      paymentId,
      horizonUrl: this.paymentSettings.stellarSettings.horizonUrl
    };

    this.paymentIntents.set(paymentIntent.id, paymentIntent);

    return paymentIntent;
  }

/**
    * Process Stellar payment
    */
  async processStellarPayment(
    paymentIntentId: string,
    signedTransactionXDR: string,
    auditContext?: { actor: string; ipAddress?: string }
  ): Promise<PaymentTransaction> {
    const paymentIntent = this.paymentIntents.get(paymentIntentId);
    if (!paymentIntent) {
      throw new Error('Payment intent not found');
    }

    try {
      // Submit transaction to Stellar network
      const stellarPayment = await this.stellarPaymentService.submitTransaction(signedTransactionXDR);

      // Create payment transaction record
      const transaction: PaymentTransaction = {
        id: uuidv4(),
        enrollmentId: paymentIntent.metadata?.enrollmentId || '',
        userId: paymentIntent.userId,
        courseId: paymentIntent.courseId,
        amount: parseFloat(stellarPayment.amount),
        currency: stellarPayment.assetCode,
        method: PaymentMethod.STELLAR,
        status: PaymentStatus.COMPLETED,
        gateway: 'stellar',
        stellarTransaction: stellarPayment,
        stellarTransactionHash: stellarPayment.transactionHash,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date()
      };

      this.transactions.set(transaction.id, transaction);

      // Update payment status
      const payment = Array.from(this.payments.values())
        .find(p => p.enrollmentId === transaction.enrollmentId);
      
      if (payment) {
        payment.status = PaymentStatus.COMPLETED;
        payment.transactionId = transaction.id;
        payment.stellarTransactionHash = stellarPayment.transactionHash;
        payment.completedAt = new Date();
      }

      // Update payment intent status
      paymentIntent.status = 'succeeded';
      paymentIntent.confirmedAt = new Date();
      this.paymentIntents.set(paymentIntentId, paymentIntent);

      if (auditContext) {
        await auditService.create(
          auditContext.actor,
          AuditAction.PAYMENT_PROCESS,
          'payment',
          {
            resourceId: transaction.id,
            details: { 
              enrollmentId: transaction.enrollmentId,
              courseId: transaction.courseId,
              amount: transaction.amount,
              currency: transaction.currency,
              transactionHash: stellarPayment.transactionHash
            },
            ipAddress: auditContext.ipAddress,
          }
        );
      }

      return transaction;
    } catch (error) {
      // Update payment intent status to failed
      paymentIntent.status = 'failed';
      this.paymentIntents.set(paymentIntentId, paymentIntent);

      if (auditContext) {
        await auditService.createFailure(
          auditContext.actor,
          AuditAction.PAYMENT_PROCESS,
          'payment',
          {
            resourceId: paymentIntent.courseId,
            ipAddress: auditContext.ipAddress,
            errorMessage: error instanceof Error ? error.message : 'Payment processing failed',
          }
        );
      }

      throw error;
    }
  }

/**
    * Process refund
    */
  async processRefund(
    paymentId: string,
    amount: number,
    reason: string,
    auditContext?: { actor: string; ipAddress?: string }
  ): Promise<PaymentTransaction> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new Error('Payment must be completed to process refund');
    }

    if (amount > payment.amount) {
      throw new Error('Refund amount cannot exceed payment amount');
    }

    try {
      let refundTransaction: PaymentTransaction;

      if (payment.method === PaymentMethod.STELLAR && payment.stellarTransactionHash) {
        // Create Stellar refund transaction
        const { transactionXDR, refundId } = await this.stellarPaymentService.createRefundTransaction(
          payment.userId, // In production, this would be the actual user's Stellar address
          amount.toString(),
          payment.currency,
          undefined,
          payment.stellarTransactionHash,
          reason
        );

        // Submit refund transaction (in production, this would be signed and submitted)
        refundTransaction = {
          id: refundId,
          enrollmentId: payment.enrollmentId,
          userId: payment.userId,
          courseId: payment.courseId,
          amount: -amount, // Negative amount for refund
          currency: payment.currency,
          method: payment.method,
          status: PaymentStatus.COMPLETED,
          gateway: 'stellar',
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: new Date(),
          refundAmount: amount,
          refundReason: reason,
          refundedAt: new Date()
        };
      } else {
        // Handle other payment methods
        refundTransaction = {
          id: uuidv4(),
          enrollmentId: payment.enrollmentId,
          userId: payment.userId,
          courseId: payment.courseId,
          amount: -amount,
          currency: payment.currency,
          method: payment.method,
          status: PaymentStatus.COMPLETED,
          gateway: payment.method as string,
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: new Date(),
          refundAmount: amount,
          refundReason: reason,
          refundedAt: new Date()
        };
      }

      this.transactions.set(refundTransaction.id, refundTransaction);

      // Update payment status
      if (amount === payment.amount) {
        payment.status = PaymentStatus.REFUNDED;
      } else {
        payment.status = PaymentStatus.PARTIALLY_REFUNDED;
      }
      payment.refundAmount = amount;
      payment.refundReason = reason;
      payment.refundedAt = new Date();

      if (auditContext) {
        await auditService.create(
          auditContext.actor,
          AuditAction.PAYMENT_REFUND,
          'payment',
          {
            resourceId: refundTransaction.id,
            details: { 
              paymentId, 
              enrollmentId: payment.enrollmentId, 
              amount, 
              reason 
            },
            ipAddress: auditContext.ipAddress,
          }
        );
      }

      return refundTransaction;
    } catch (error) {
      if (auditContext) {
        await auditService.createFailure(
          auditContext.actor,
          AuditAction.PAYMENT_REFUND,
          'payment',
          {
            resourceId: paymentId,
            ipAddress: auditContext.ipAddress,
            errorMessage: error instanceof Error ? error.message : 'Refund processing failed',
          }
        );
      }
      throw new Error(`Failed to process refund: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(id: string): Promise<Payment | null> {
    return this.payments.get(id) || null;
  }

  /**
   * Get payments for enrollment
   */
  async getPaymentsForEnrollment(enrollmentId: string): Promise<Payment[]> {
    return Array.from(this.payments.values())
      .filter(p => p.enrollmentId === enrollmentId);
  }

  /**
   * Get payment history for user
   */
  async getUserPaymentHistory(userId: string): Promise<Payment[]> {
    return Array.from(this.payments.values())
      .filter(p => p.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get payment analytics
   */
  async getPaymentAnalytics(dateRange?: { start: Date; end: Date }): Promise<PaymentAnalytics> {
    let payments = Array.from(this.payments.values());

    if (dateRange) {
      payments = payments.filter(p => 
        p.createdAt >= dateRange.start && p.createdAt <= dateRange.end
      );
    }

    const totalRevenue = payments
      .filter(p => p.status === PaymentStatus.COMPLETED)
      .reduce((sum, p) => sum + p.amount, 0);

    const totalTransactions = payments.length;
    const successfulTransactions = payments.filter(p => p.status === PaymentStatus.COMPLETED).length;
    const failedTransactions = payments.filter(p => p.status === PaymentStatus.FAILED).length;
    const refundedTransactions = payments.filter(p => 
      p.status === PaymentStatus.REFUNDED || p.status === PaymentStatus.PARTIALLY_REFUNDED
    ).length;

    const averageTransactionValue = successfulTransactions > 0 
      ? totalRevenue / successfulTransactions 
      : 0;

    // Revenue by method
    const revenueByMethod = Object.values(PaymentMethod).map(method => {
      const methodPayments = payments.filter(p => p.method === method && p.status === PaymentStatus.COMPLETED);
      return {
        method,
        revenue: methodPayments.reduce((sum, p) => sum + p.amount, 0),
        count: methodPayments.length
      };
    });

    // Revenue by currency
    const revenueByCurrency = payments
      .filter(p => p.status === PaymentStatus.COMPLETED)
      .reduce((acc, p) => {
        const existing = acc.find(item => item.currency === p.currency);
        if (existing) {
          existing.revenue += p.amount;
          existing.count++;
        } else {
          acc.push({
            currency: p.currency,
            revenue: p.amount,
            count: 1
          });
        }
        return acc;
      }, [] as { currency: string; revenue: number; count: number }[]);

    // Mock monthly data - in production, this would be calculated from actual timestamps
    const revenueByMonth = [
      { month: '2024-01', revenue: 15000, count: 150 },
      { month: '2024-02', revenue: 18000, count: 180 },
      { month: '2024-03', revenue: 22000, count: 220 }
    ];

    const enrollmentsByMonth = [
      { month: '2024-01', count: 150 },
      { month: '2024-02', count: 180 },
      { month: '2024-03', count: 220 }
    ];

    // Failure reasons
    const failureReasons = payments
      .filter(p => p.status === PaymentStatus.FAILED && p.failureReason)
      .reduce((acc, p) => {
        const reason = p.failureReason!;
        const existing = acc.find(item => item.reason === reason);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ reason, count: 1 });
        }
        return acc;
      }, [] as { reason: string; count: number }[]);

    // Refund reasons
    const refundReasons = payments
      .filter(p => p.refundReason)
      .reduce((acc, p) => {
        const reason = p.refundReason!;
        const existing = acc.find(item => item.reason === reason);
        if (existing) {
          existing.count++;
          existing.amount += p.refundAmount || 0;
        } else {
          acc.push({ 
            reason, 
            count: 1, 
            amount: p.refundAmount || 0 
          });
        }
        return acc;
      }, [] as { reason: string; count: number; amount: number }[]);

    return {
      totalRevenue,
      totalTransactions,
      successfulTransactions,
      failedTransactions,
      refundedTransactions,
      averageTransactionValue,
      revenueByMethod,
      revenueByCurrency,
      revenueByMonth,
      failureReasons,
      refundReasons,
      enrollmentsByMonth
    } as any;
  }

  /**
   * Get payment settings
   */
  getPaymentSettings(): PaymentSettings {
    return this.paymentSettings;
  }

  /**
   * Update payment settings
   */
  updatePaymentSettings(settings: Partial<PaymentSettings>): PaymentSettings {
    this.paymentSettings = { ...this.paymentSettings, ...settings };
    return this.paymentSettings;
  }

  /**
   * Validate payment parameters
   */
  validatePaymentParameters(
    amount: number,
    currency: string,
    method: PaymentMethod,
    fromAddress?: string
  ): PaymentValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate amount
    if (amount <= 0) {
      errors.push('Payment amount must be greater than 0');
    }

    if (amount > 10000) {
      warnings.push('Large payment amount detected');
    }

    // Validate currency
    if (!this.paymentSettings.supportedCurrencies.includes(currency)) {
      errors.push(`Currency ${currency} is not supported`);
    }

    // Validate method
    if (!this.paymentSettings.acceptedMethods.includes(method)) {
      errors.push(`Payment method ${method} is not supported`);
    }

    // Stellar-specific validation
    if (method === PaymentMethod.STELLAR) {
      if (!fromAddress) {
        errors.push('Stellar address is required for Stellar payments');
      } else {
        const stellarValidation = this.stellarPaymentService.validatePaymentParameters(
          amount.toString(),
          currency,
          fromAddress
        );
        errors.push(...stellarValidation.errors);
        warnings.push(...stellarValidation.warnings);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate payment receipt
   */
  async generatePaymentReceipt(paymentId: string): Promise<PaymentReceipt> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    const transaction = Array.from(this.transactions.values())
      .find(t => t.enrollmentId === payment.enrollmentId);

    const receipt: PaymentReceipt = {
      id: uuidv4(),
      transactionId: transaction?.id || payment.id,
      userId: payment.userId,
      courseId: payment.courseId,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      status: payment.status,
      transactionDate: payment.createdAt,
      receiptNumber: `REC-${Date.now()}-${payment.id.substring(0, 8)}`,
      items: [{
        id: '1',
        description: `Course enrollment - ${payment.courseId}`,
        quantity: 1,
        unitPrice: payment.amount,
        amount: payment.amount,
        currency: payment.currency
      }],
      tax: 0, // No tax for educational content
      total: payment.amount,
      metadata: payment.metadata
    };

    return receipt;
  }

  /**
   * Get supported payment methods
   */
  getSupportedPaymentMethods(): PaymentMethod[] {
    return this.paymentSettings.acceptedMethods;
  }

  /**
   * Check if payment method is available
   */
  isPaymentMethodAvailable(method: PaymentMethod): boolean {
    return this.paymentSettings.acceptedMethods.includes(method);
  }

  /**
   * Get exchange rates
   */
  async getExchangeRates(): Promise<{ [key: string]: number }> {
    // Mock exchange rates - in production, this would call a real exchange rate API
    return {
      'USD-XLM': 4.5,
      'EUR-XLM': 4.9,
      'XLM-USD': 0.22,
      'XLM-EUR': 0.20
    };
  }

  /**
   * Convert currency amount
   */
  async convertCurrency(amount: number, from: string, to: string): Promise<number> {
    if (from === to) {
      return amount;
    }

    const rates = await this.getExchangeRates();
    const rate = rates[`${from}-${to}`];
    
    if (!rate) {
      throw new Error(`Exchange rate not available for ${from} to ${to}`);
    }

    return amount * rate;
  }
}
