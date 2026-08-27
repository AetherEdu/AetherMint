/**
 * Payment Controller
 * Handles payment-related operations and business logic
 */

import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services/PaymentService';
import { StellarPaymentService } from '../services/StellarPaymentService';
import { StripePaymentService, StripeWebhookOutcome } from '../services/payments/StripePaymentService';
import { CheckoutService } from '../services/payments/CheckoutService';
import { NotificationService } from '../services/NotificationService';
import logger from '../utils/logger';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';
import { 
  Payment, 
  PaymentIntent, 
  PaymentMethod, 
  PaymentStatus,
  PaymentValidation,
  PaymentSettings
} from '../models/Payment';
import { UserRole } from '../models/User';

export class PaymentController {
  private paymentService: PaymentService;
  private stellarPaymentService: StellarPaymentService;
  private stripePaymentService: StripePaymentService;
  private checkoutService: CheckoutService;
  private notificationService: any;

  constructor() {
    this.paymentService = new PaymentService();
    this.stellarPaymentService = this.paymentService.getStellarPaymentService();
    this.stripePaymentService = new StripePaymentService();
    this.checkoutService = new CheckoutService({ paymentService: this.paymentService });
    this.notificationService = new NotificationService();
  }

  /**
   * Create payment intent
   */
  async createPaymentIntent(req: Request, res: Response, next: NextFunction) {
    try {
      const { enrollmentId, method, amount, currency, metadata } = req.body;
      const userId = req.user!.id;

      // Validate payment parameters
      const validation = this.paymentService.validatePaymentParameters(amount, currency, method);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment parameters',
          errors: validation.errors,
          warnings: validation.warnings
        });
      }

      const paymentIntent = await this.paymentService.createPaymentIntent(enrollmentId, method, {
        userId,
        courseId: metadata?.courseId,
        amount,
        currency,
        metadata
      });

      res.status(201).json({
        success: true,
        data: paymentIntent
      });
    } catch (error) {
      logger.error('', error);
      next(error);
    }
  }

  /**
   * Create Stellar payment
   */
  async createStellarPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { enrollmentId, fromAddress, amount, assetCode, assetIssuer, memo } = req.body;
      const userId = req.user!.id;

      // Validate Stellar address
      const validation = this.stellarPaymentService.validatePaymentParameters(
        amount.toString(),
        assetCode || 'XLM',
        fromAddress
      );

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid Stellar payment parameters',
          errors: validation.errors,
          warnings: validation.warnings
        });
      }

      const paymentIntent = await this.paymentService.createStellarPaymentIntent(enrollmentId, {
        userId,
        fromAddress,
        amount,
        assetCode: assetCode || 'XLM',
        assetIssuer,
        memo,
        courseId: req.body.courseId
      });

      res.status(201).json({
        success: true,
        data: {
          ...paymentIntent,
          // The frontend submits this id back to /stellar/submit.
          paymentId: paymentIntent.id
        }
      });
    } catch (error) {
      logger.error('', error);
      next(error);
    }
  }

  /**
   * Submit Stellar payment
   */
  async submitStellarPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { paymentIntentId, signedTransactionXDR } = req.body;

      const transaction = await this.paymentService.processStellarPayment(
        paymentIntentId,
        signedTransactionXDR
      );

      // Send payment confirmation notification
      await this.notificationService.sendPaymentConfirmationNotification(
        transaction.userId,
        transaction
      );

      res.json({
        success: true,
        data: {
          transaction,
          message: 'Payment processed successfully'
        }
      });
    } catch (error) {
      logger.error('', error);
      next(error);
    }
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(req: Request, res: Response, next: NextFunction) {
    try {
      const { paymentId, id } = req.params;
      const paymentLookupId = paymentId || id;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const payment = await this.paymentService.getPaymentById(paymentLookupId);
      if (!payment) {
        throw new NotFoundError('Payment not found');
      }

      // Check if user has permission to view this payment
      if (payment.userId !== userId && userRole !== UserRole.ADMIN) {
        throw new ForbiddenError('Access denied');
      }

      res.json({
        success: true,
        data: payment
      });
    } catch (error) {
      logger.error('', error);
      next(error);
    }
  }

  /**
   * Get enrollment payments
   */
  async getEnrollmentPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const { enrollmentId } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      // In production, verify user has permission to view enrollment payments
      const payments = await this.paymentService.getPaymentsForEnrollment(enrollmentId);

      res.json({
        success: true,
        data: payments
      });
    } catch (error) {
      logger.error('', error);
      next(error);
    }
  }

  /**
   * Get user payment history
   */
  async getUserPaymentHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { page = '1', limit = '20', status } = req.query;

      const payments = await this.paymentService.getUserPaymentHistory(userId);

      // Filter by status if provided
      let filteredPayments = payments;
      if (status) {
        filteredPayments = payments.filter(p => p.status === status);
      }

      // Apply pagination
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;

      res.json({
        success: true,
        data: filteredPayments.slice(startIndex, endIndex),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: filteredPayments.length,
          pages: Math.ceil(filteredPayments.length / limitNum)
        }
      });
    } catch (error) {
      logger.error('', error);
      next(error);
    }
  }

  /**
   * Process refund
   */
  async processRefund(req: Request, res: Response, next: NextFunction) {
    try {
      const { paymentId, id } = req.params;
      const paymentLookupId = paymentId || id;
      const { amount, reason } = req.body;

      const refundTransaction = await this.checkoutService.processRefund(paymentLookupId, amount, reason, {
        actor: req.user!.id
      });

      // Send refund notification
      await this.notificationService.sendRefundNotification(
        refundTransaction.userId,
        refundTransaction
      );

      res.json({
        success: true,
        data: refundTransaction,
        message: 'Refund processed successfully'
      });
    } catch (error) {
      logger.error('', error);
      next(error);
    }
  }

  /**
   * Generate receipt
   */
  async generateReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const { paymentId } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const payment = await this.paymentService.getPaymentById(paymentId);
      if (!payment) {
        throw new NotFoundError('Payment not found');
      }

      // Check permissions
      if (payment.userId !== userId && userRole !== UserRole.ADMIN) {
        throw new ForbiddenError('Access denied');
      }

      const receipt = await this.paymentService.generatePaymentReceipt(paymentId);

      res.json({
        success: true,
        data: receipt
      });
    } catch (error) {
      logger.error('', error);
      next(error);
    }
  }

  /**
   * Get payment settings
   */
  async getPaymentSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = this.paymentService.getPaymentSettings();

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      logger.error('', error);
      next(error);
    }
  }

  /**
   * Update payment settings
   */
  async updatePaymentSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const updates = req.body;

      const updatedSettings = this.paymentService.updatePaymentSettings(updates);

      res.json({
        success: true,
        data: updatedSettings,
        message: 'Payment settings updated successfully'
      });
    } catch (error) {
      logger.error('', error);
      next(error);
    }
  }

  /**
   * Get supported payment methods
   */
  async getSupportedPaymentMethods(req: Request, res: Response, next: NextFunction) {
    try {
      const methods = this.paymentService.getSupportedPaymentMethods();

      res.json({
        success: true,
        data: methods
      });
    } catch (error) {
      logger.error('', error);
      next(error);
    }
  }

  /**
   * Validate payment parameters
   */
  async validatePaymentParameters(req: Request, res: Response, next: NextFunction) {
    try {
      const { amount, currency, method, fromAddress } = req.body;

      const validation = this.paymentService.validatePaymentParameters(
        amount,
        currency,
        method,
        fromAddress
      );

      res.json({
        success: true,
        data: validation
      });
    } catch (error) {
      logger.error('', error);
      next(error);
    }
  }

  /**
   * Get payment analytics
   */
  async getPaymentAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      
      let dateRange;
      if (startDate && endDate) {
        dateRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        };
      }

      const analytics = await this.paymentService.getPaymentAnalytics(dateRange);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('', error);
      next(error);
    }
  }

  /**
   * Get exchange rates
   */
  async getExchangeRates(req: Request, res: Response, next: NextFunction) {
    try {
      const rates = await this.paymentService.getExchangeRates();

      res.json({
        success: true,
        data: rates
      });
    } catch (error) {
      logger.error('', error);
      next(error);
    }
  }

  /**
   * Convert currency
   */
  async convertCurrency(req: Request, res: Response, next: NextFunction) {
    try {
      const { amount, from, to } = req.body;

      const convertedAmount = await this.paymentService.convertCurrency(amount, from, to);

      res.json({
        success: true,
        data: {
          originalAmount: amount,
          from,
          to,
          convertedAmount,
          rate: convertedAmount / amount
        }
      });
    } catch (error) {
      logger.error('', error);
      next(error);
    }
  }

  /**
   * Get Stellar balance
   */
  async getStellarBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const { address } = req.params;

      const balance = await this.stellarPaymentService.getAccountBalance(address);

      res.json({
        success: true,
        data: balance
      });
    } catch (error) {
      logger.error('', error);
      next(error);
    }
  }

  /**
   * Get Stellar transaction history
   */
  async getStellarTransactionHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { address } = req.params;
      const { limit = '50', cursor } = req.query;

      const history = await this.stellarPaymentService.getPaymentHistory(
        address,
        parseInt(limit as string),
        cursor as string
      );

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      logger.error('', error);
      next(error);
    }
  }

  /**
   * Create a unified checkout (Issue #391). Accepts either payment rail and
   * returns gateway-specific data (Stripe client secret, or Stellar XDR).
   */
  async createCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const { enrollmentId, method, amount, currency, courseId, stellar, metadata, receiptEmail } = req.body;

      const checkout = await this.checkoutService.createCheckout({
        enrollmentId,
        method,
        amount,
        currency,
        courseId: courseId || metadata?.courseId,
        stellar,
        metadata,
        receiptEmail,
        userId: req.user!.id
      });

      res.status(201).json({
        success: true,
        data: checkout
      });
    } catch (error) {
      logger.error('', error);
      next(error);
    }
  }

  /**
   * Confirm a unified checkout: submit the signed Stellar XDR, or confirm the
   * Stripe PaymentIntent with the client's payment method.
   */
  async confirmCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const { checkoutId } = req.params;
      const { paymentIntentId, paymentMethodId, signedTransactionXDR } = req.body;

      const result = await this.checkoutService.confirmCheckout(
        checkoutId,
        { paymentIntentId, paymentMethodId, signedTransactionXDR },
        { actor: req.user!.id }
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('', error);
      next(error);
    }
  }

  /**
   * Get checkout details (ownership-checked).
   */
  async getCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const { checkoutId } = req.params;
      const checkout = this.checkoutService.getCheckout(checkoutId);
      if (!checkout) {
        throw new NotFoundError('Checkout not found');
      }

      if (checkout.userId !== req.user!.id && req.user!.role !== UserRole.ADMIN) {
        throw new ForbiddenError('Access denied');
      }

      res.json({
        success: true,
        data: checkout
      });
    } catch (error) {
      logger.error('', error);
      next(error);
    }
  }

  /**
   * Trigger a reconciliation sweep of pending crypto payments against the
   * Stellar network (admin).
   */
  async reconcilePayments(req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await this.checkoutService.reconcilePendingPayments();

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('', error);
      next(error);
    }
  }

  /**
   * Handle Stripe webhook (raw body, signature verified).
   */
  async handleStripeWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = req.headers['stripe-signature'] as string;
      if (!signature) {
        throw new ValidationError('Missing stripe-signature header');
      }

      const rawBody = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
      const event = this.stripePaymentService.constructEvent(rawBody, signature);
      const outcome = this.stripePaymentService.normalizeWebhookEvent(event);

      await this.checkoutService.handleStripeWebhookOutcome(outcome);

      res.json({ received: true });
    } catch (error) {
      logger.error('', error);
      next(error);
    }
  }

  /**
   * Handle Stellar webhook
   */
  async handleStellarWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const { transaction, type } = req.body;

      // Process webhook based on type
      switch (type) {
        case 'payment':
          // Trigger on-chain reconciliation for pending crypto payments
          await this.checkoutService.handleStellarWebhook(transaction, type);
          break;
        case 'refund':
          // Handle refund confirmation
          await this.processStellarWebhookRefund(transaction);
          break;
        default:
          logger.warn('Unknown webhook type', { type });
      }

      res.json({
        success: true,
        message: 'Webhook processed successfully'
      });
    } catch (error) {
      logger.error('', error);
      next(error);
    }
  }

  /**
   * Handle payment gateway webhook
   */
  async handlePaymentGatewayWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const { gateway, event, data } = req.body;

      // Process webhook based on gateway and event
      switch (gateway) {
        case 'stripe':
          await this.processStripeWebhook(event, data);
          break;
        case 'paypal':
          await this.processPayPalWebhook(event, data);
          break;
        default:
          logger.warn('Unknown payment gateway', { gateway });
      }

      res.json({
        success: true,
        message: 'Webhook processed successfully'
      });
    } catch (error) {
      logger.error('', error);
      next(error);
    }
  }

  /**
   * Process Stellar webhook payment
   */
  private async processStellarWebhookPayment(transaction: any) {
    // Find payment intent by transaction hash
    // Update payment status
    // Send notifications
    logger.info('Processing Stellar webhook payment', { transaction });
  }

  /**
   * Process Stellar webhook refund
   */
  private async processStellarWebhookRefund(transaction: any) {
    // Find refund by transaction hash
    // Update refund status
    // Send notifications
    logger.info('Processing Stellar webhook refund', { transaction });
  }

  /**
   * Process Stripe webhook
   */
  private async processStripeWebhook(event: string, data: any) {
    let status: StripeWebhookOutcome['status'] = 'unknown';
    if (event === 'payment_intent.succeeded') {
      status = 'succeeded';
    } else if (event === 'payment_intent.payment_failed' || event === 'payment_intent.canceled') {
      status = 'failed';
    } else if (event === 'charge.refunded') {
      status = 'refunded';
    }

    const outcome: StripeWebhookOutcome = {
      eventType: event,
      paymentIntentId: data?.payment_intent || data?.id,
      status,
      error: data?.last_payment_error?.message
    };

    await this.checkoutService.handleStripeWebhookOutcome(outcome);
  }

  /**
   * Process PayPal webhook
   */
  private async processPayPalWebhook(event: string, data: any) {
    // Handle PayPal webhook events
    logger.info('Processing PayPal webhook', { event, data });
  }
}
