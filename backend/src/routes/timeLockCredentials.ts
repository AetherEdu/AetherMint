/**
 * @openapi
 * tags:
 *   - name: Time Lock Credentials
 *     description: Time-based credential release system
 */

import { Router } from "express";
import * as timeLockController from "../controllers/timeLockController";

const router: Router = Router();

/**
 * @openapi
 * /api/time-lock-credentials/create:
 *   post:
 *     tags: [Time Lock Credentials]
 *     summary: Create time-locked credential
 *     responses:
 *       '200':
 *         description: Credential created
 */
router.post("/create", timeLockController.createTimeLockCredential);

/**
 * @openapi
 * /api/time-lock-credentials/release:
 *   post:
 *     tags: [Time Lock Credentials]
 *     summary: Release time-locked credential
 *     responses:
 *       '200':
 *         description: Credential released
 */
router.post("/release", timeLockController.releaseCredential);

/**
 * @openapi
 * /api/time-lock-credentials/{credentialId}:
 *   get:
 *     tags: [Time Lock Credentials]
 *     summary: Get time-locked credential details
 *     parameters:
 *       - in: path
 *         name: credentialId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Credential details retrieved
 */
router.get("/:credentialId", timeLockController.getCredential);

/**
 * @openapi
 * /api/time-lock-credentials/{credentialId}/status:
 *   get:
 *     tags: [Time Lock Credentials]
 *     summary: Get credential release status
 *     parameters:
 *       - in: path
 *         name: credentialId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Status retrieved
 */
router.get("/:credentialId/status", timeLockController.getStatus);

export default router;
