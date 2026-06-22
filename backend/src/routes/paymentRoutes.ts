/**
 * @openapi
 * tags:
 *   - name: Payments
 *     description: Payment processing and transaction management
 */

import express, { Router } from "express";
import { paymentController } from "../controllers/paymentController";

const router: Router = express.Router();

/**
 * @openapi
 * /api/payments/create-payment-intent:
 *   post:
 *     tags: [Payments]
 *     summary: Create payment intent
 *     responses:
 *       '200':
 *         description: Payment intent created
 */
router.post("/create-payment-intent", paymentController.createPaymentIntent);

/**
 * @openapi
 * /api/payments/webhook:
 *   post:
 *     tags: [Payments]
 *     summary: Handle payment webhook
 *     responses:
 *       '200':
 *         description: Webhook processed
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
router.get("/:paymentId", paymentController.getPayment);

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
 *     responses:
 *       '200':
 *         description: Payment refunded
 */
router.post("/:paymentId/refund", paymentController.refundPayment);

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
router.get("/history/:userId", paymentController.getUserPaymentHistory);

export default router;
