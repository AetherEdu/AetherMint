/**
 * @openapi
 * tags:
 *   - name: Payments
 *     description: Payment processing and transaction management
 */

import express, { Router } from "express";
// @ts-ignore - controller module not yet implemented
import { paymentController } from "../controllers/paymentController";
import { authenticateToken, requireRole } from "../middleware/auth";
import { idempotencyMiddleware } from "../middleware/idempotency";

const router: Router = express.Router();

/**
 * @openapi
 * /api/payments/create-payment-intent:
 *   post:
 *     tags: [Payments]
 *     summary: Create payment intent
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Payment intent created (or replayed from idempotency cache)
 *       '400':
 *         description: Invalid Idempotency-Key
 *       '409':
 *         description: A request with this Idempotency-Key is in progress
 */
router.post(
  "/create-payment-intent",
  authenticateToken,
  idempotencyMiddleware(),
  paymentController.createPaymentIntent,
);

/**
 * @openapi
 * /api/payments/webhook:
 *   post:
 *     tags: [Payments]
 *     summary: Handle payment webhook
 *     responses:
 *       '200':
 *         description: Webhook processed
 *
 * Note: payment gateway webhooks are idempotent at the gateway level
 * (they include their own idempotency tokens), so we do NOT wrap them
 * with the application-level Idempotency-Key middleware.
 */
router.post("/webhook", paymentController.handleWebhook);

/**
 * @openapi
 * /api/payments/{paymentId}:
 *   get:
 *     tags: [Payments]
 *     summary: Get payment details
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
router.get("/:paymentId", authenticateToken, paymentController.getPayment);

/**
 * @openapi
 * /api/payments/{paymentId}/refund:
 *   post:
 *     tags: [Payments]
 *     summary: Refund payment
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: Idempotency-Key
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Payment refunded (or replayed from idempotency cache)
 */
router.post(
  "/:paymentId/refund",
  authenticateToken,
  requireRole(["admin"]),
  idempotencyMiddleware(),
  paymentController.refundPayment,
);

/**
 * @openapi
 * /api/payments/history/{userId}:
 *   get:
 *     tags: [Payments]
 *     summary: Get payment history for user
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
router.get(
  "/history/:userId",
  authenticateToken,
  paymentController.getUserPaymentHistory,
);

export default router;
