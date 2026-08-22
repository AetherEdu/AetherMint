/**
 * @openapi
 * tags:
 *   - name: Translation
 *     description: Multi-language translation services
 */

const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const translationController = require("../controllers/translationController");

/**
 * @openapi
 * /api/translation/translate:
 *   post:
 *     tags: [Translation]
 *     summary: Translate text content
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Text translated
 */
router.post("/translate", authenticate, translationController.translate);

/**
 * @openapi
 * /api/translation/languages:
 *   get:
 *     tags: [Translation]
 *     summary: Get supported languages
 *     responses:
 *       '200':
 *         description: Languages retrieved
 */
router.get("/languages", translationController.getLanguages);

/**
 * @openapi
 * /api/translation/auto-detect:
 *   post:
 *     tags: [Translation]
 *     summary: Auto-detect language
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Language detected
 */
router.post("/auto-detect", authenticate, translationController.detectLanguage);

/**
 * @openapi
 * /api/translation/batch:
 *   post:
 *     tags: [Translation]
 *     summary: Translate content in batch
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Batch translated
 */
router.post("/batch", authenticate, translationController.batchTranslate);

/**
 * @openapi
 * /api/translation/content/{contentId}:
 *   get:
 *     tags: [Translation]
 *     summary: Get translation status for content
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Translation status retrieved
 */
router.get("/content/:contentId", authenticate, translationController.getContentTranslation);

/**
 * @openapi
 * /api/translation/usage:
 *   get:
 *     tags: [Translation]
 *     summary: Get translation usage statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Usage statistics retrieved
 */
router.get("/usage", authenticate, translationController.getUsageStats);

module.exports = router;
