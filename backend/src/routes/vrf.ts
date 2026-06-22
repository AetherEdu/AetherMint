/**
 * @openapi
 * tags:
 *   - name: VRF
 *     description: Verifiable Random Function for secure randomness
 */

import { Router } from "express";
import * as vrfController from "../controllers/vrfController";

const router: Router = Router();

/**
 * @openapi
 * /api/vrf/generate:
 *   post:
 *     tags: [VRF]
 *     summary: Generate verifiable random value
 *     responses:
 *       '200':
 *         description: Random value generated
 */
router.post("/generate", vrfController.generateRandom);

/**
 * @openapi
 * /api/vrf/verify:
 *   post:
 *     tags: [VRF]
 *     summary: Verify random value proof
 *     responses:
 *       '200':
 *         description: Proof verified
 */
router.post("/verify", vrfController.verifyProof);

/**
 * @openapi
 * /api/vrf/{seed}:
 *   get:
 *     tags: [VRF]
 *     summary: Get VRF output for seed
 *     parameters:
 *       - in: path
 *         name: seed
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: VRF output retrieved
 */
router.get("/:seed", vrfController.getVRFOutput);

export default router;
