/**
 * Payment Routes
 * API endpoints for payment processing and management
 */

import express, { Router } from "express";
import { PaymentController } from "../controllers/PaymentController";
import { authenticateToken, requireRole } from "../middleware/auth";
import { validatePayment } from "../middleware/validation";
import { rateLimit } from "express-rate-limit";
import { idempotencyMiddleware } from "../middleware/idempotency";

const router: Router = express.Router();

// Rate limiting for payment endpoints
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 payment requests per windowMs
  message: "Too many payment attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const refundLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 refund requests per hour
  message: "Too many refund requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @route POST /api/payments/intent
 * @desc Create payment intent
 * @access Private
 */
router.post(
  "/intent",
  authenticateToken,
  paymentLimiter,
  idempotencyMiddleware(),
  validatePayment,
  PaymentController.createPaymentIntent,
);

/**
 * @route POST /api/payments/stellar/create
 * @desc Create Stellar payment transaction
 * @access Private
 */
router.post(
  "/stellar/create",
  authenticateToken,
  paymentLimiter,
  idempotencyMiddleware(),
  PaymentController.createStellarPayment,
);

/**
 * @route POST /api/payments/stellar/submit
 * @desc Submit Stellar payment transaction
 * @access Private
 */
router.post(
  "/stellar/submit",
  authenticateToken,
  paymentLimiter,
  idempotencyMiddleware(),
  PaymentController.submitStellarPayment,
);

/**
 * @route GET /api/payments/:id
 * @desc Get payment details
 * @access Private
 */
router.get("/:id", authenticateToken, PaymentController.getPaymentById);

/**
 * @route GET /api/payments/enrollment/:enrollmentId
 * @desc Get payments for enrollment
 * @access Private
 */
router.get(
  "/enrollment/:enrollmentId",
  authenticateToken,
  PaymentController.getEnrollmentPayments,
);

/**
 * @route GET /api/payments/history
 * @desc Get user payment history
 * @access Private
 */
router.get(
  "/history",
  authenticateToken,
  PaymentController.getUserPaymentHistory,
);

/**
 * @route POST /api/payments/:id/refund
 * @desc Process refund
 * @access Private (Admin only)
 */
router.post(
  "/:id/refund",
  authenticateToken,
  requireRole(["admin"]),
  refundLimiter,
  idempotencyMiddleware(),
  PaymentController.processRefund,
);

/**
 * @route GET /api/payments/receipt/:paymentId
 * @desc Generate payment receipt
 * @access Private
 */
router.get(
  "/receipt/:paymentId",
  authenticateToken,
  PaymentController.generateReceipt,
);

/**
 * @route GET /api/payments/settings
 * @desc Get payment settings
 * @access Public
 */
router.get("/settings", PaymentController.getPaymentSettings);

/**
 * @route PUT /api/payments/settings
 * @desc Update payment settings
 * @access Private (Admin only)
 */
router.put(
  "/settings",
  authenticateToken,
  requireRole(["admin"]),
  PaymentController.updatePaymentSettings,
);

/**
 * @route GET /api/payments/methods
 * @desc Get supported payment methods
 * @access Public
 */
router.get("/methods", PaymentController.getSupportedPaymentMethods);

/**
 * @route POST /api/payments/validate
 * @desc Validate payment parameters
 * @access Private
 */
router.post(
  "/validate",
  authenticateToken,
  PaymentController.validatePaymentParameters,
);

/**
 * @route GET /api/payments/analytics
 * @desc Get payment analytics
 * @access Private (Admin only)
 */
router.get(
  "/analytics",
  authenticateToken,
  requireRole(["admin"]),
  PaymentController.getPaymentAnalytics,
);

/**
 * @route GET /api/payments/exchange-rates
 * @desc Get exchange rates
 * @access Public
 */
router.get("/exchange-rates", PaymentController.getExchangeRates);

/**
 * @route POST /api/payments/convert
 * @desc Convert currency amount
 * @access Private
 */
router.post("/convert", authenticateToken, PaymentController.convertCurrency);

/**
 * @route GET /api/payments/stellar/balance/:address
 * @desc Get Stellar account balance
 * @access Private
 */
router.get(
  "/stellar/balance/:address",
  authenticateToken,
  PaymentController.getStellarBalance,
);

/**
 * @route GET /api/payments/stellar/transactions/:address
 * @desc Get Stellar payment history
 * @access Private
 */
router.get(
  "/stellar/transactions/:address",
  authenticateToken,
  PaymentController.getStellarTransactionHistory,
);

/**
 * @route POST /api/payments/webhook/stellar
 * @desc Handle Stellar webhook
 * @access Public
 */
router.post("/webhook/stellar", PaymentController.handleStellarWebhook);

/**
 * @route POST /api/payments/webhook/payment-gateway
 * @desc Handle payment gateway webhook
 * @access Public
 */
router.post(
  "/webhook/payment-gateway",
  PaymentController.handlePaymentGatewayWebhook,
);

export default router;
