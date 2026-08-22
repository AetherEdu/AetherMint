/**
 * @openapi
 * tags:
 *   - name: Payments
 *     description: Unified course purchase checkout (Stripe fiat & Stellar crypto), refunds and webhooks
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import { PaymentController } from '../controllers/PaymentController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router: Router = express.Router();
const paymentController = new PaymentController();

// Preserve `this` on controller methods when passed to Express.
const h = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn.call(paymentController, req, res, next);

/**
 * @openapi
 * /api/payments/checkout:
 *   post:
 *     tags: [Payments]
 *     summary: Create a unified checkout for a course purchase (Stripe or Stellar)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [enrollmentId, method, amount, currency]
 *             properties:
 *               enrollmentId:
 *                 type: string
 *               method:
 *                 type: string
 *                 enum: [stripe, stellar]
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *               stellar:
 *                 type: object
 *                 properties:
 *                   fromAddress:
 *                     type: string
 *                   assetCode:
 *                     type: string
 *     responses:
 *       '201':
 *         description: Checkout created with gateway data (Stripe client secret or Stellar XDR)
 *       '400':
 *         description: Invalid payment parameters
 */
router.post('/checkout', authenticate as any, h(paymentController.createCheckout));

/**
 * @openapi
 * /api/payments/checkout/{checkoutId}/confirm:
 *   post:
 *     tags: [Payments]
 *     summary: Confirm a checkout (submit signed Stellar XDR or confirm Stripe intent)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: checkoutId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               signedTransactionXDR:
 *                 type: string
 *               paymentMethodId:
 *                 type: string
 *               paymentIntentId:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Checkout confirmed
 */
router.post('/checkout/:checkoutId/confirm', authenticate as any, h(paymentController.confirmCheckout));

/**
 * @openapi
 * /api/payments/checkout/{checkoutId}:
 *   get:
 *     tags: [Payments]
 *     summary: Get checkout details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: checkoutId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Checkout details retrieved
 */
router.get('/checkout/:checkoutId', authenticate as any, h(paymentController.getCheckout));

/**
 * @openapi
 * /api/payments/intent:
 *   post:
 *     tags: [Payments]
 *     summary: Create payment intent
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '201':
 *         description: Payment intent created
 */
router.post('/intent', authenticate as any, h(paymentController.createPaymentIntent));

/**
 * @openapi
 * /api/payments/stellar/create:
 *   post:
 *     tags: [Payments]
 *     summary: Create a Stellar payment intent
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '201':
 *         description: Stellar payment intent created with XDR
 */
router.post('/stellar/create', authenticate as any, h(paymentController.createStellarPayment));

/**
 * @openapi
 * /api/payments/stellar/submit:
 *   post:
 *     tags: [Payments]
 *     summary: Submit a signed Stellar transaction
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Payment processed
 */
router.post('/stellar/submit', authenticate as any, h(paymentController.submitStellarPayment));

/**
 * @openapi
 * /api/payments/webhook/stripe:
 *   post:
 *     tags: [Payments]
 *     summary: Stripe webhook (signature verified, raw body)
 *     responses:
 *       '200':
 *         description: Webhook received
 */
router.post('/webhook/stripe', h(paymentController.handleStripeWebhook));

/**
 * @openapi
 * /api/payments/webhook/stellar:
 *   post:
 *     tags: [Payments]
 *     summary: Stellar webhook (triggers on-chain reconciliation)
 *     responses:
 *       '200':
 *         description: Webhook processed
 */
router.post('/webhook/stellar', h(paymentController.handleStellarWebhook));

/**
 * @openapi
 * /api/payments/reconcile:
 *   post:
 *     tags: [Payments]
 *     summary: Trigger reconciliation of pending crypto payments against the Stellar network
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Reconciliation summary
 */
router.post('/reconcile', authenticate as any, requireAdmin as any, h(paymentController.reconcilePayments));

/**
 * @openapi
 * /api/payments/methods:
 *   get:
 *     tags: [Payments]
 *     summary: Get supported payment methods
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Payment methods retrieved
 */
router.get('/methods', authenticate as any, h(paymentController.getSupportedPaymentMethods));

/**
 * @openapi
 * /api/payments/exchange-rates:
 *   get:
 *     tags: [Payments]
 *     summary: Get exchange rates
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Exchange rates retrieved
 */
router.get('/exchange-rates', authenticate as any, h(paymentController.getExchangeRates));

/**
 * @openapi
 * /api/payments/convert:
 *   post:
 *     tags: [Payments]
 *     summary: Convert currency amount
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Converted amount
 */
router.post('/convert', authenticate as any, h(paymentController.convertCurrency));

/**
 * @openapi
 * /api/payments/validate:
 *   post:
 *     tags: [Payments]
 *     summary: Validate payment parameters
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Validation result
 */
router.post('/validate', authenticate as any, h(paymentController.validatePaymentParameters));

/**
 * @openapi
 * /api/payments/analytics:
 *   get:
 *     tags: [Payments]
 *     summary: Get payment analytics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Payment analytics retrieved
 */
router.get('/analytics', authenticate as any, requireAdmin as any, h(paymentController.getPaymentAnalytics));

/**
 * @openapi
 * /api/payments/history/{userId}:
 *   get:
 *     tags: [Payments]
 *     summary: Get payment history for a user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Payment history retrieved
 */
router.get('/history/:userId', authenticate as any, h(paymentController.getUserPaymentHistory));

/**
 * @openapi
 * /api/payments/receipt/{paymentId}:
 *   get:
 *     tags: [Payments]
 *     summary: Generate payment receipt
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Receipt generated
 */
router.get('/receipt/:paymentId', authenticate as any, h(paymentController.generateReceipt));

/**
 * @openapi
 * /api/payments/{paymentId}:
 *   get:
 *     tags: [Payments]
 *     summary: Get payment details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Payment details retrieved
 */
router.get('/:paymentId', authenticate as any, h(paymentController.getPaymentById));

/**
 * @openapi
 * /api/payments/{paymentId}/refund:
 *   post:
 *     tags: [Payments]
 *     summary: Refund a payment (Stripe or Stellar)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               amount:
 *                 type: number
 *               reason:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Payment refunded
 */
router.post('/:paymentId/refund', authenticate as any, h(paymentController.processRefund));

export default router;
