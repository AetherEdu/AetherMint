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

// Device registration and management
router.post("/devices/register", validate(registerDeviceSchema), syncController.registerDevice);
router.post("/devices/heartbeat", validate(heartbeatSchema), syncController.heartbeat);
router.delete("/devices/:deviceId", validate(deviceIdParamSchema), syncController.unregisterDevice);
router.get("/users/:userId/devices", validate(userIdParamSchema), syncController.getDevices);

// Sync status tracking
router.get("/users/:userId/status", validate(getSyncStatusQuerySchema), syncController.getSyncStatus);

// Entity sync (real-time sync when change is detected)
router.post("/sync", validate(syncEntitySchema), syncController.syncEntity);

// Offline queue
router.post("/queue", validate(enqueueSyncSchema), syncController.enqueueSync);
router.post("/queue/process", validate(processQueueSchema), syncController.processQueue);
router.get("/queue/status", validate(queueStatusQuerySchema), syncController.getQueueStatus);

export default router;
