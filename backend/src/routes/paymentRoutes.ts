/**
 * Payment Routes
 * API endpoints for payment processing and management
 */

import express, { Router, Request, Response } from "express";
import { PaymentController } from "../controllers/PaymentController";
import { authenticateToken, requireRole } from "../middleware/auth";
import { validatePayment } from "../middleware/validation";
import { rateLimit } from "express-rate-limit";
import { UserRole } from "../models/User";

const router: Router = express.Router();
const controller = new PaymentController();
const wrap = (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response) => fn(req, res);

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many payment attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const refundLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many refund requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/intent", authenticateToken as any, paymentLimiter, validatePayment as any, wrap(controller.createPaymentIntent.bind(controller)) as any);
router.post("/stellar/create", authenticateToken as any, paymentLimiter, wrap(controller.createStellarPayment.bind(controller)) as any);
router.post("/stellar/submit", authenticateToken as any, paymentLimiter, wrap(controller.submitStellarPayment.bind(controller)) as any);
router.get("/:id", authenticateToken as any, wrap(controller.getPaymentById.bind(controller)) as any);
router.get("/enrollment/:enrollmentId", authenticateToken as any, wrap(controller.getEnrollmentPayments.bind(controller)) as any);
router.get("/history", authenticateToken as any, wrap(controller.getUserPaymentHistory.bind(controller)) as any);
router.post("/:id/refund", authenticateToken as any, requireRole([UserRole.ADMIN]) as any, refundLimiter, wrap(controller.processRefund.bind(controller)) as any);
router.get("/receipt/:paymentId", authenticateToken as any, wrap(controller.generateReceipt.bind(controller)) as any);
router.get("/settings", wrap(controller.getPaymentSettings.bind(controller)) as any);
router.put("/settings", authenticateToken as any, requireRole([UserRole.ADMIN]) as any, wrap(controller.updatePaymentSettings.bind(controller)) as any);
router.get("/methods", wrap(controller.getSupportedPaymentMethods.bind(controller)) as any);
router.post("/validate", authenticateToken as any, wrap(controller.validatePaymentParameters.bind(controller)) as any);
router.get("/analytics", authenticateToken as any, requireRole([UserRole.ADMIN]) as any, wrap(controller.getPaymentAnalytics.bind(controller)) as any);
router.get("/exchange-rates", wrap(controller.getExchangeRates.bind(controller)) as any);
router.post("/convert", authenticateToken as any, wrap(controller.convertCurrency.bind(controller)) as any);
router.get("/stellar/balance/:address", authenticateToken as any, wrap(controller.getStellarBalance.bind(controller)) as any);
router.get("/stellar/transactions/:address", authenticateToken as any, wrap(controller.getStellarTransactionHistory.bind(controller)) as any);
router.post("/webhook/stellar", wrap(controller.handleStellarWebhook.bind(controller)) as any);
router.post("/webhook/payment-gateway", wrap(controller.handlePaymentGatewayWebhook.bind(controller)) as any);

export default router;
