/**
 * Enrollment Routes
 * API endpoints for course enrollment management
 */

import express, { Router } from "express";
import { EnrollmentController } from "../controllers/EnrollmentController";
import { authenticateToken, requireRole } from "../middleware/auth";
import {
  validateEnrollment,
  validateEnrollmentUpdate,
} from "../middleware/validation";
import { rateLimit } from "express-rate-limit";
import { idempotencyMiddleware } from "../middleware/idempotency";

const router: Router = express.Router();

// Rate limiting for enrollment endpoints
const enrollmentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 enrollment requests per windowMs
  message: "Too many enrollment attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 payment requests per windowMs
  message: "Too many payment attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @route GET /api/enrollments
 * @desc Get user's enrollments with filtering and pagination
 * @access Private
 */
router.get("/", authenticateToken, EnrollmentController.getUserEnrollments);

/**
 * @route GET /api/enrollments/:id
 * @desc Get specific enrollment details
 * @access Private
 */
router.get("/:id", authenticateToken, EnrollmentController.getEnrollmentById);

/**
 * @route POST /api/enrollments
 * @desc Create new enrollment (enroll in course)
 * @access Private
 */
router.post(
  "/",
  authenticateToken,
  enrollmentLimiter,
  idempotencyMiddleware(),
  validateEnrollment,
  EnrollmentController.createEnrollment,
);

/**
 * @route PUT /api/enrollments/:id
 * @desc Update enrollment details
 * @access Private
 */
router.put(
  "/:id",
  authenticateToken,
  validateEnrollmentUpdate,
  EnrollmentController.updateEnrollment,
);

/**
 * @route DELETE /api/enrollments/:id
 * @desc Cancel enrollment
 * @access Private
 */
router.delete("/:id", authenticateToken, EnrollmentController.cancelEnrollment);

/**
 * @route POST /api/enrollments/:id/complete
 * @desc Mark enrollment as completed
 * @access Private
 */
router.post(
  "/:id/complete",
  authenticateToken,
  EnrollmentController.completeEnrollment,
);

/**
 * @route GET /api/enrollments/:id/progress
 * @desc Get enrollment progress
 * @access Private
 */
router.get(
  "/:id/progress",
  authenticateToken,
  EnrollmentController.getEnrollmentProgress,
);

/**
 * @route PUT /api/enrollments/:id/progress
 * @desc Update enrollment progress
 * @access Private
 */
router.put(
  "/:id/progress",
  authenticateToken,
  EnrollmentController.updateEnrollmentProgress,
);

/**
 * @route GET /api/enrollments/course/:courseId
 * @desc Get all enrollments for a specific course
 * @access Private (Educator/Admin only)
 */
router.get(
  "/course/:courseId",
  authenticateToken,
  requireRole(["educator", "admin"]),
  EnrollmentController.getCourseEnrollments,
);

/**
 * @route POST /api/enrollments/:id/certificate
 * @desc Issue certificate for completed enrollment
 * @access Private (Educator/Admin only)
 */
router.post(
  "/:id/certificate",
  authenticateToken,
  requireRole(["educator", "admin"]),
  idempotencyMiddleware(),
  EnrollmentController.issueCertificate,
);

/**
 * @route GET /api/enrollments/waitlist/:courseId
 * @desc Get waitlist for a course
 * @access Private (Educator/Admin only)
 */
router.get(
  "/waitlist/:courseId",
  authenticateToken,
  requireRole(["educator", "admin"]),
  EnrollmentController.getCourseWaitlist,
);

/**
 * @route POST /api/enrollments/waitlist/:courseId
 * @desc Add user to course waitlist
 * @access Private
 */
router.post(
  "/waitlist/:courseId",
  authenticateToken,
  enrollmentLimiter,
  EnrollmentController.addToWaitlist,
);

/**
 * @route DELETE /api/enrollments/waitlist/:courseId
 * @desc Remove user from course waitlist
 * @access Private
 */
router.delete(
  "/waitlist/:courseId",
  authenticateToken,
  EnrollmentController.removeFromWaitlist,
);

/**
 * @route GET /api/enrollments/analytics/user
 * @desc Get user enrollment analytics
 * @access Private
 */
router.get(
  "/analytics/user",
  authenticateToken,
  EnrollmentController.getUserEnrollmentAnalytics,
);

/**
 * @route GET /api/enrollments/analytics/course/:courseId
 * @desc Get course enrollment analytics
 * @access Private (Educator/Admin only)
 */
router.get(
  "/analytics/course/:courseId",
  authenticateToken,
  requireRole(["educator", "admin"]),
  EnrollmentController.getCourseEnrollmentAnalytics,
);

/**
 * @route GET /api/enrollments/analytics/global
 * @desc Get global enrollment analytics
 * @access Private (Admin only)
 */
router.get(
  "/analytics/global",
  authenticateToken,
  requireRole(["admin"]),
  EnrollmentController.getGlobalEnrollmentAnalytics,
);

/**
 * @route POST /api/enrollments/bulk
 * @desc Bulk enrollment operations
 * @access Private (Admin only)
 */
router.post(
  "/bulk",
  authenticateToken,
  requireRole(["admin"]),
  EnrollmentController.bulkEnrollmentOperations,
);

/**
 * @route GET /api/enrollments/capacity/:courseId
 * @desc Get course capacity information
 * @access Private
 */
router.get(
  "/capacity/:courseId",
  authenticateToken,
  EnrollmentController.getCourseCapacity,
);

/**
 * @route POST /api/enrollments/validate-prerequisites
 * @desc Validate course prerequisites
 * @access Private
 */
router.post(
  "/validate-prerequisites",
  authenticateToken,
  EnrollmentController.validatePrerequisites,
);

/**
 * @route GET /api/enrollments/history/:userId
 * @desc Get user enrollment history
 * @access Private
 */
router.get(
  "/history/:userId",
  authenticateToken,
  EnrollmentController.getUserEnrollmentHistory,
);

/**
 * @route POST /api/enrollments/:id/renew
 * @desc Renew expired enrollment
 * @access Private
 */
router.post(
  "/:id/renew",
  authenticateToken,
  paymentLimiter,
  idempotencyMiddleware(),
  EnrollmentController.renewEnrollment,
);

/**
 * @route GET /api/enrollments/export/:courseId
 * @desc Export course enrollments
 * @access Private (Educator/Admin only)
 */
router.get(
  "/export/:courseId",
  authenticateToken,
  requireRole(["educator", "admin"]),
  EnrollmentController.exportCourseEnrollments,
);

export default router;
