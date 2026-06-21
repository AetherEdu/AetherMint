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
 * @route   POST /api/translate/text
 * @desc    Translate text content
 * @access  Private
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
 * @route   POST /api/translate/batch
 * @desc    Batch translate multiple texts
 * @access  Private
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
 * @route   POST /api/translate/subtitles
 * @desc    Translate and synchronize subtitles
 * @access  Private
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
 * @route   POST /api/translate/correction
 * @desc    Submit a translation correction for quality improvement
 * @access  Private
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
 * @route   GET /api/translate/quality/:contentType?
 * @desc    Get translation quality metrics
 * @access  Private
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
