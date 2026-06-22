/**
 * @openapi
 * tags:
 *   - name: Cross-Protocol Bridge
 *     description: Cross-chain and cross-protocol interoperability bridge
 */

import { Router } from "express";
import * as crossProtocolController from "../controllers/crossProtocolController";

const router: Router = Router();

/**
 * @openapi
 * /api/cross-protocol-bridge/bridge:
 *   post:
 *     tags: [Cross-Protocol Bridge]
 *     summary: Bridge assets across protocols
 *     responses:
 *       '200':
 *         description: Bridge operation initiated
 */
router.post("/bridge", crossProtocolController.bridgeAssets);

/**
 * @openapi
 * /api/cross-protocol-bridge/status/{txId}:
 *   get:
 *     tags: [Cross-Protocol Bridge]
 *     summary: Get bridge transaction status
 *     parameters:
 *       - in: path
 *         name: txId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Transaction status retrieved
 */
router.get("/status/:txId", crossProtocolController.getBridgeStatus);

/**
 * @openapi
 * /api/cross-protocol-bridge/protocols:
 *   get:
 *     tags: [Cross-Protocol Bridge]
 *     summary: List supported protocols
 *     responses:
 *       '200':
 *         description: Protocols listed
 */
router.get("/protocols", crossProtocolController.getSupportedProtocols);

/**
 * @openapi
 * /api/cross-protocol-bridge/validate-address:
 *   post:
 *     tags: [Cross-Protocol Bridge]
 *     summary: Validate cross-protocol address
 *     responses:
 *       '200':
 *         description: Address validated
 */
router.post("/validate-address", crossProtocolController.validateAddress);

export default router;
