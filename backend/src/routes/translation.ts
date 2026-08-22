/**
 * @openapi
 * tags:
 *   - name: Translation
 *     description: Real-time multi-language translation services
 */

import express, { Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { realTimeTranslationService } from '../services/realTimeTranslationService';
import { authenticateToken } from '../middleware/auth';
import logger from '../utils/logger';

const router: import('express').Router = express.Router();

const validateRequest = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array() 
    });
  }
  next();
};

/**
 * @openapi
 * /api/translate/text:
 *   post:
 *     tags: [Translation]
 *     summary: Translate text content
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *               - sourceLanguage
 *               - targetLanguage
 *             properties:
 *               text:
 *                 type: string
 *               sourceLanguage:
 *                 type: string
 *               targetLanguage:
 *                 type: string
 *               context:
 *                 type: string
 *               contentType:
 *                 type: string
 *                 enum: [course, subtitle, interaction, general]
 *     responses:
 *       '200':
 *         description: Translation completed
 */
router.post(
  '/text',
  authenticateToken,
  [
    body('text').notEmpty().withMessage('Text is required'),
    body('sourceLanguage').notEmpty().withMessage('Source language is required'),
    body('targetLanguage').notEmpty().withMessage('Target language is required'),
    body('context').optional(),
    body('contentType').optional().isIn(['course', 'subtitle', 'interaction', 'general']),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { text, sourceLanguage, targetLanguage, context, contentType } = req.body;

      const result = await realTimeTranslationService.translate({
        text,
        sourceLanguage,
        targetLanguage,
        context,
        contentType,
      });

      res.json({
        success: true,
        data: result,
        message: `Translation completed in ${result.translationTime}ms`,
      });
    } catch (error: any) {
      logger.error('Translation error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Translation failed',
      });
    }
  }
);

/**
 * @openapi
 * /api/translate/batch:
 *   post:
 *     tags: [Translation]
 *     summary: Batch translate multiple texts
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - requests
 *             properties:
 *               requests:
 *                 type: array
 *     responses:
 *       '200':
 *         description: Batch translation completed
 */
router.post(
  '/batch',
  authenticateToken,
  [
    body('requests').isArray({ min: 1 }).withMessage('Requests must be an array'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { requests } = req.body;

      const results = await realTimeTranslationService.batchTranslate(requests);

      res.json({
        success: true,
        data: {
          translations: results,
          count: results.length,
        },
        message: `Batch translation completed: ${results.length} items`,
      });
    } catch (error: any) {
      logger.error('Batch translation error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Batch translation failed',
      });
    }
  }
);

/**
 * @openapi
 * /api/translate/subtitles:
 *   post:
 *     tags: [Translation]
 *     summary: Translate and synchronize subtitles
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - segments
 *               - targetLanguage
 *             properties:
 *               segments:
 *                 type: array
 *               targetLanguage:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Subtitle translation completed
 */
router.post(
  '/subtitles',
  authenticateToken,
  [
    body('segments').isArray({ min: 1 }).withMessage('Segments are required'),
    body('targetLanguage').notEmpty().withMessage('Target language is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { segments, targetLanguage } = req.body;

      const translatedSegments = await realTimeTranslationService.translateSubtitles(
        segments,
        targetLanguage
      );

      res.json({
        success: true,
        data: {
          segments: translatedSegments,
          count: translatedSegments.length,
        },
        message: 'Subtitle translation completed',
      });
    } catch (error: any) {
      logger.error('Subtitle translation error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Subtitle translation failed',
      });
    }
  }
);

/**
 * @openapi
 * /api/translate/correction:
 *   post:
 *     tags: [Translation]
 *     summary: Submit translation correction
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - originalText
 *               - translation
 *               - correctedTranslation
 *             properties:
 *               originalText:
 *                 type: string
 *               translation:
 *                 type: string
 *               correctedTranslation:
 *                 type: string
 *               context:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Correction submitted
 */
router.post(
  '/correction',
  authenticateToken,
  [
    body('originalText').notEmpty().withMessage('Original text is required'),
    body('translation').notEmpty().withMessage('Translation is required'),
    body('correctedTranslation').notEmpty().withMessage('Corrected translation is required'),
    body('context').optional(),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { originalText, translation, correctedTranslation, context } = req.body;

      await realTimeTranslationService.submitCorrection(
        originalText,
        translation,
        correctedTranslation,
        context
      );

      res.json({
        success: true,
        message: 'Correction submitted successfully. Quality will be improved.',
      });
    } catch (error: any) {
      logger.error('Correction submission error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to submit correction',
      });
    }
  }
);

/**
 * @openapi
 * /api/translate/quality/{contentType}:
 *   get:
 *     tags: [Translation]
 *     summary: Get translation quality metrics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contentType
 *         required: false
 *         schema:
 *           type: string
 *           enum: [course, subtitle, interaction, general]
 *     responses:
 *       '200':
 *         description: Quality metrics retrieved
 */
router.get(
  '/quality/:contentType?',
  authenticateToken,
  [
    param('contentType').optional().isIn(['course', 'subtitle', 'interaction', 'general']),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { contentType } = req.params;

      const metrics = await realTimeTranslationService.getQualityMetrics(contentType);

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error: any) {
      logger.error('Quality metrics error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get quality metrics',
      });
    }
  }
);

export default router;
