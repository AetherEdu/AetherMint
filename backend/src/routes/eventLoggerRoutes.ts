/**
 * @openapi
 * tags:
 *   - name: Events
 *     description: Event logging and retrieval
 */

import { Router } from "express";
import { eventLoggerController } from "../controllers/eventLoggerController";

const router: Router = Router();

/**
 * @openapi
 * /api/events/course-completion:
 *   post:
 *     tags: [Events]
 *     summary: Log course completion event
 *     responses:
 *       '200':
 *         description: Event logged
 */
router.post("/course-completion", eventLoggerController.logCourseCompletion);

/**
 * @openapi
 * /api/events/credential-issuance:
 *   post:
 *     tags: [Events]
 *     summary: Log credential issuance event
 *     responses:
 *       '200':
 *         description: Event logged
 */
router.post("/credential-issuance", eventLoggerController.logCredentialIssuance);

/**
 * @openapi
 * /api/events/user-achievement:
 *   post:
 *     tags: [Events]
 *     summary: Log user achievement event
 *     responses:
 *       '200':
 *         description: Event logged
 */
router.post("/user-achievement", eventLoggerController.logUserAchievement);

/**
 * @openapi
 * /api/events/profile-update:
 *   post:
 *     tags: [Events]
 *     summary: Log profile update event
 *     responses:
 *       '200':
 *         description: Event logged
 */
router.post("/profile-update", eventLoggerController.logProfileUpdate);

/**
 * @openapi
 * /api/events/course-enrollment:
 *   post:
 *     tags: [Events]
 *     summary: Log course enrollment event
 *     responses:
 *       '200':
 *         description: Event logged
 */
router.post("/course-enrollment", eventLoggerController.logCourseEnrollment);

/**
 * @openapi
 * /api/events/event/{eventId}:
 *   get:
 *     tags: [Events]
 *     summary: Get event by ID
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Event details retrieved
 */
router.get("/event/:eventId", eventLoggerController.getEventById);

/**
 * @openapi
 * /api/events/user/{userId}/events:
 *   get:
 *     tags: [Events]
 *     summary: Get events by user
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Events retrieved
 */
router.get("/user/:userId/events", eventLoggerController.getUserEvents);

/**
 * @openapi
 * /api/events/type/{eventType}:
 *   get:
 *     tags: [Events]
 *     summary: Get events by type
 *     parameters:
 *       - in: path
 *         name: eventType
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Events retrieved
 */
router.get("/type/:eventType", eventLoggerController.getEventsByType);

/**
 * @openapi
 * /api/events/recent:
 *   get:
 *     tags: [Events]
 *     summary: Get recent events
 *     responses:
 *       '200':
 *         description: Recent events retrieved
 */
router.get("/recent", eventLoggerController.getRecentEvents);

/**
 * @openapi
 * /api/events/count:
 *   get:
 *     tags: [Events]
 *     summary: Get event count
 *     responses:
 *       '200':
 *         description: Event count retrieved
 */
router.get("/count", eventLoggerController.getEventCount);

/**
 * @openapi
 * /api/events/search:
 *   get:
 *     tags: [Events]
 *     summary: Search events
 *     responses:
 *       '200':
 *         description: Search results
 */
router.get("/search", eventLoggerController.searchEvents);

/**
 * @openapi
 * /api/events/verify/{eventId}:
 *   get:
 *     tags: [Events]
 *     summary: Verify event
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Event verified
 */
router.get("/verify/:eventId", eventLoggerController.verifyEvent);

/**
 * @openapi
 * /api/events/audit-report/{userId}:
 *   get:
 *     tags: [Events]
 *     summary: Generate user audit report
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Audit report generated
 */
router.get("/audit-report/:userId", eventLoggerController.generateUserAuditReport);

export default router;
