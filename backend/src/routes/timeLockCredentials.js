/**
 * Time-Locked Credential Routes
 * Handles time-locked credential issuance and verification
 */

const express = require("express");
const router = express.Router();

/**
 * @openapi
 * /api/time-lock/create:
 *   post:
 *     tags: [Time-Lock Credentials]
 *     summary: Create time-locked credential
 *     responses:
 *       200:
 *         description: Credential created
 */
router.post("/create", (req, res) => {
  res.status(201).json({ success: true, data: { id: "tl_" + Date.now(), locked: true } });
});

/**
 * @openapi
 * /api/time-lock/{credentialId}:
 *   get:
 *     tags: [Time-Lock Credentials]
 *     summary: Get time-locked credential
 *     parameters:
 *       - in: path
 *         name: credentialId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Credential retrieved
 */
router.get("/:credentialId", (req, res) => {
  res.status(200).json({ success: true, data: { id: req.params.credentialId, status: "locked" } });
});

/**
 * @openapi
 * /api/time-lock/{credentialId}/unlock:
 *   post:
 *     tags: [Time-Lock Credentials]
 *     summary: Attempt to unlock credential
 *     parameters:
 *       - in: path
 *         name: credentialId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Unlock attempt result
 */
router.post("/:credentialId/unlock", (req, res) => {
  res.status(200).json({ success: true, data: { unlocked: false, unlockableAt: null } });
});

module.exports = router;
