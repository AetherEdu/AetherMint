/**
 * @openapi
 * tags:
 *   - name: Sync
 *     description: Device synchronization and offline queue management
 */

import { Router } from "express";
import * as syncController from "../controllers/syncController";
import { validate } from "../middleware/validate";
import {
  registerDeviceSchema,
  heartbeatSchema,
  deviceIdParamSchema,
  userIdParamSchema,
  syncEntitySchema,
  enqueueSyncSchema,
  queueStatusQuerySchema,
  getSyncStatusQuerySchema,
  processQueueSchema,
} from "../middleware/schemas/syncSchemas";

const router: Router = Router();

/**
 * @openapi
 * /api/sync/devices/register:
 *   post:
 *     tags: [Sync]
 *     summary: Register device for sync
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceId:
 *                 type: string
 *               platform:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Device registered
 */
router.post("/devices/register", validate(registerDeviceSchema), syncController.registerDevice);

/**
 * @openapi
 * /api/sync/devices/heartbeat:
 *   post:
 *     tags: [Sync]
 *     summary: Send device heartbeat
 *     responses:
 *       '200':
 *         description: Heartbeat received
 */
router.post("/devices/heartbeat", validate(heartbeatSchema), syncController.heartbeat);

/**
 * @openapi
 * /api/sync/devices/{deviceId}:
 *   delete:
 *     tags: [Sync]
 *     summary: Unregister device
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Device unregistered
 */
router.delete("/devices/:deviceId", validate(deviceIdParamSchema), syncController.unregisterDevice);

/**
 * @openapi
 * /api/sync/users/{userId}/devices:
 *   get:
 *     tags: [Sync]
 *     summary: Get devices for user
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Devices retrieved
 */
router.get("/users/:userId/devices", validate(userIdParamSchema), syncController.getDevices);

/**
 * @openapi
 * /api/sync/users/{userId}/status:
 *   get:
 *     tags: [Sync]
 *     summary: Get sync status for user
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Sync status retrieved
 */
router.get("/users/:userId/status", validate(getSyncStatusQuerySchema), syncController.getSyncStatus);

/**
 * @openapi
 * /api/sync/sync:
 *   post:
 *     tags: [Sync]
 *     summary: Sync entity data across devices
 *     responses:
 *       '200':
 *         description: Data synced
 */
router.post("/sync", validate(syncEntitySchema), syncController.syncEntity);

/**
 * @openapi
 * /api/sync/queue:
 *   post:
 *     tags: [Sync]
 *     summary: Enqueue sync operation for offline processing
 *     responses:
 *       '200':
 *         description: Operation queued
 */
router.post("/queue", validate(enqueueSyncSchema), syncController.enqueueSync);

/**
 * @openapi
 * /api/sync/queue/process:
 *   post:
 *     tags: [Sync]
 *     summary: Process offline queue
 *     responses:
 *       '200':
 *         description: Queue processed
 */
router.post("/queue/process", validate(processQueueSchema), syncController.processQueue);

/**
 * @openapi
 * /api/sync/queue/status:
 *   get:
 *     tags: [Sync]
 *     summary: Get queue sync status
 *     responses:
 *       '200':
 *         description: Queue status retrieved
 */
router.get("/queue/status", validate(queueStatusQuerySchema), syncController.getQueueStatus);

export default router;
