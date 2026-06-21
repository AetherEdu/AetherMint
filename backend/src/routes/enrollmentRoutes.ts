/**
 * Enrollment Routes
 * API endpoints for course enrollment management
 */

import express, { Router, Request, Response } from "express";
import { EnrollmentController } from "../controllers/EnrollmentController";
import { authenticateToken, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createEnrollmentSchema,
  updateEnrollmentSchema,
  enrollmentIdParamSchema,
  courseIdParamSchema,
  updateProgressSchema,
  bulkEnrollmentSchema,
  validatePrerequisitesSchema,
  userIdParamSchema,
  completeEnrollmentSchema,
  getUserEnrollmentsQuerySchema,
  courseEnrollmentsQuerySchema,
  exportEnrollmentsQuerySchema,
  renewEnrollmentSchema,
} from "../middleware/schemas/enrollmentSchemas";
import { rateLimit } from "express-rate-limit";
import { UserRole } from "../models/User";

const router: Router = express.Router();
const controller = new EnrollmentController();

// Rate limiting for enrollment endpoints
const enrollmentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many enrollment attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many payment attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper to wrap async handlers for Express
const wrap = (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response) => fn(req, res);

router.get("/", authenticateToken as any, validate(getUserEnrollmentsQuerySchema) as any, wrap(controller.getUserEnrollments.bind(controller)) as any);
router.get("/:id", authenticateToken as any, validate(enrollmentIdParamSchema) as any, wrap(controller.getEnrollmentById.bind(controller)) as any);
router.post("/", authenticateToken as any, enrollmentLimiter, validate(createEnrollmentSchema) as any, wrap(controller.createEnrollment.bind(controller)) as any);
router.put("/:id", authenticateToken as any, validate(updateEnrollmentSchema) as any, wrap(controller.updateEnrollment.bind(controller)) as any);
router.delete("/:id", authenticateToken as any, validate(enrollmentIdParamSchema) as any, wrap(controller.cancelEnrollment.bind(controller)) as any);
router.post("/:id/complete", authenticateToken as any, validate(completeEnrollmentSchema) as any, wrap(controller.completeEnrollment.bind(controller)) as any);
router.get("/:id/progress", authenticateToken as any, validate(enrollmentIdParamSchema) as any, wrap(controller.getEnrollmentProgress.bind(controller)) as any);
router.put("/:id/progress", authenticateToken as any, validate(updateProgressSchema) as any, wrap(controller.updateEnrollmentProgress.bind(controller)) as any);
router.get("/course/:courseId", authenticateToken as any, requireRole([UserRole.EDUCATOR, UserRole.ADMIN]) as any, validate(courseEnrollmentsQuerySchema) as any, wrap(controller.getCourseEnrollments.bind(controller)) as any);
router.post("/:id/certificate", authenticateToken as any, requireRole([UserRole.EDUCATOR, UserRole.ADMIN]) as any, validate(enrollmentIdParamSchema) as any, wrap(controller.issueCertificate.bind(controller)) as any);
router.get("/waitlist/:courseId", authenticateToken as any, requireRole([UserRole.EDUCATOR, UserRole.ADMIN]) as any, validate(courseIdParamSchema) as any, wrap(controller.getCourseWaitlist.bind(controller)) as any);
router.post("/waitlist/:courseId", authenticateToken as any, enrollmentLimiter, validate(courseIdParamSchema) as any, wrap(controller.addToWaitlist.bind(controller)) as any);
router.delete("/waitlist/:courseId", authenticateToken as any, validate(courseIdParamSchema) as any, wrap(controller.removeFromWaitlist.bind(controller)) as any);
router.get("/analytics/user", authenticateToken as any, validate({}) as any, wrap(controller.getUserEnrollmentAnalytics.bind(controller)) as any);
router.get("/analytics/course/:courseId", authenticateToken as any, requireRole([UserRole.EDUCATOR, UserRole.ADMIN]) as any, validate(courseIdParamSchema) as any, wrap(controller.getCourseEnrollmentAnalytics.bind(controller)) as any);
router.get("/analytics/global", authenticateToken as any, requireRole([UserRole.ADMIN]) as any, validate({}) as any, wrap(controller.getGlobalEnrollmentAnalytics.bind(controller)) as any);
router.post("/bulk", authenticateToken as any, requireRole([UserRole.ADMIN]) as any, validate(bulkEnrollmentSchema) as any, wrap(controller.bulkEnrollmentOperations.bind(controller)) as any);
router.get("/capacity/:courseId", authenticateToken as any, validate(courseIdParamSchema) as any, wrap(controller.getCourseCapacity.bind(controller)) as any);
router.post("/validate-prerequisites", authenticateToken as any, validate(validatePrerequisitesSchema) as any, wrap(controller.validatePrerequisites.bind(controller)) as any);
router.get("/history/:userId", authenticateToken as any, validate(userIdParamSchema) as any, wrap(controller.getUserEnrollmentHistory.bind(controller)) as any);
router.post("/:id/renew", authenticateToken as any, paymentLimiter, validate(renewEnrollmentSchema) as any, wrap(controller.renewEnrollment.bind(controller)) as any);
router.get("/export/:courseId", authenticateToken as any, requireRole([UserRole.EDUCATOR, UserRole.ADMIN]) as any, validate(exportEnrollmentsQuerySchema) as any, wrap(controller.exportCourseEnrollments.bind(controller)) as any);

export default router;
