/**
 * @openapi
 * tags:
 *   - name: Plagiarism Detection
 *     description: Content plagiarism check and analysis
 */

import { Router } from "express";
import * as plagiarismController from "../controllers/plagiarismDetectionController";

const router: Router = Router();

/**
 * @openapi
 * /api/plagiarism-detection/check:
 *   post:
 *     tags: [Plagiarism Detection]
 *     summary: Check content for plagiarism
 *     responses:
 *       '200':
 *         description: Plagiarism check complete
 */
router.post("/check", plagiarismController.checkPlagiarism);

/**
 * @openapi
 * /api/plagiarism-detection/report/{submissionId}:
 *   get:
 *     tags: [Plagiarism Detection]
 *     summary: Get plagiarism report for submission
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Report retrieved
 */
router.get("/report/:submissionId", plagiarismController.getPlagiarismReport);

/**
 * @openapi
 * /api/plagiarism-detection/history/{userId}:
 *   get:
 *     tags: [Plagiarism Detection]
 *     summary: Get plagiarism check history for user
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: History retrieved
 */
router.get("/history/:userId", plagiarismController.getUserHistory);

export default router;
