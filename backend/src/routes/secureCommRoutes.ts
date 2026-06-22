/**
 * @openapi
 * tags:
 *   - name: Secure Communications
 *     description: End-to-end encrypted communications
 */

import express, { Request, Response } from "express";
import { secureCommController } from "../controllers/secureCommController";

const router = express.Router();

/**
 * @openapi
 * /api/secure-comm/init:
 *   post:
 *     tags: [Secure Communications]
 *     summary: Initialize secure communication session
 *     responses:
 *       '200':
 *         description: Session initialized
 */
router.post("/init", (req: Request, res: Response) => {
  secureCommController.initializeSession(req, res);
});

/**
 * @openapi
 * /api/secure-comm/send:
 *   post:
 *     tags: [Secure Communications]
 *     summary: Send encrypted message
 *     responses:
 *       '200':
 *         description: Message sent
 */
router.post("/send", (req: Request, res: Response) => {
  secureCommController.sendMessage(req, res);
});

/**
 * @openapi
 * /api/secure-comm/receive/{sessionId}:
 *   get:
 *     tags: [Secure Communications]
 *     summary: Receive encrypted messages for session
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Messages retrieved
 */
router.get("/receive/:sessionId", (req: Request, res: Response) => {
  secureCommController.receiveMessages(req, res);
});

/**
 * @openapi
 * /api/secure-comm/end:
 *   post:
 *     tags: [Secure Communications]
 *     summary: End secure communication session
 *     responses:
 *       '200':
 *         description: Session ended
 */
router.post("/end", (req: Request, res: Response) => {
  secureCommController.endSession(req, res);
});

export default router;
