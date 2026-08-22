/**
 * @openapi
 * tags:
 *   - name: Localization
 *     description: Course-content localization pipeline (multi-locale, workflow, fallback)
 */

import express, { Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { localizationService } from '../services/localization';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import {
  TranslationEntityType,
  TranslationStatus,
  SUPPORTED_LOCALES,
} from '../models/Translation';
import logger from '../utils/logger';

const router: import('express').Router = express.Router();

const ENTITY_TYPES = Object.values(TranslationEntityType);
const STATUSES = Object.values(TranslationStatus);

const validateRequest = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

const userIdOf = (req: Request): string | undefined =>
  (req as AuthenticatedRequest).user?.id;

/**
 * @openapi
 * /api/localization/locales:
 *   get:
 *     tags: [Localization]
 *     summary: List supported locales and the default locale
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Locale registry returned
 */
router.get('/locales', authenticateToken, (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      defaultLocale: localizationService.getDefaultLocale(),
      locales: localizationService.getSupportedLocales(),
    },
  });
});

/**
 * @openapi
 * /api/localization/source:
 *   post:
 *     tags: [Localization]
 *     summary: Upsert canonical default-locale content (advances source revision)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Source content recorded
 */
router.post(
  '/source',
  authenticateToken,
  [
    body('entityType').isIn(ENTITY_TYPES).withMessage('entityType is required'),
    body('entityId').notEmpty().withMessage('entityId is required'),
    body('fields').isObject().withMessage('fields must be an object'),
  ],
  validateRequest,
  (req: Request, res: Response) => {
    const { entityType, entityId, fields } = req.body;
    const revision = localizationService.upsertSourceContent(
      entityType as TranslationEntityType,
      entityId,
      fields,
      userIdOf(req),
    );
    res.json({ success: true, data: { entityType, entityId, revision } });
  },
);

/**
 * @openapi
 * /api/localization/translations:
 *   get:
 *     tags: [Localization]
 *     summary: List translations (optionally filtered)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Translations listed
 */
router.get(
  '/translations',
  authenticateToken,
  [
    query('entityType').optional().isIn(ENTITY_TYPES),
    query('entityId').optional(),
    query('locale').optional().isIn(SUPPORTED_LOCALES),
    query('status').optional().isIn(STATUSES),
  ],
  validateRequest,
  (req: Request, res: Response) => {
    const { entityType, entityId, locale, status } = req.query as Record<string, string>;
    const translations = localizationService.listTranslations({
      entityType: entityType as TranslationEntityType | undefined,
      entityId,
      locale,
      status: status as TranslationStatus | undefined,
    });
    res.json({ success: true, data: { translations, count: translations.length } });
  },
);

/**
 * @openapi
 * /api/localization/translations:
 *   post:
 *     tags: [Localization]
 *     summary: Create a translation request
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Translation created
 */
router.post(
  '/translations',
  authenticateToken,
  [
    body('entityType').isIn(ENTITY_TYPES).withMessage('entityType is required'),
    body('entityId').notEmpty().withMessage('entityId is required'),
    body('locale').isIn(SUPPORTED_LOCALES).withMessage('locale must be supported'),
    body('fields').isObject().withMessage('fields must be an object'),
  ],
  validateRequest,
  (req: Request, res: Response) => {
    const { entityType, entityId, locale, fields } = req.body;
    const translation = localizationService.createTranslation({
      entityType: entityType as TranslationEntityType,
      entityId,
      locale,
      fields,
      createdBy: userIdOf(req),
    });
    res.status(201).json({
      success: true,
      data: translation,
      message: 'Translation request created',
    });
  },
);

/**
 * @openapi
 * /api/localization/translations/stale:
 *   get:
 *     tags: [Localization]
 *     summary: List published translations whose source has since changed
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Stale translations listed
 */
router.get('/translations/stale', authenticateToken, (req: Request, res: Response) => {
  const stale = localizationService.getStaleTranslations();
  res.json({ success: true, data: { translations: stale, count: stale.length } });
});

/**
 * @openapi
 * /api/localization/resolve:
 *   get:
 *     tags: [Localization]
 *     summary: Resolve content for a locale with default-locale fallback
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Resolved content returned
 */
router.get(
  '/resolve',
  authenticateToken,
  [
    query('entityType').isIn(ENTITY_TYPES).withMessage('entityType is required'),
    query('entityId').notEmpty().withMessage('entityId is required'),
    query('locale').isIn(SUPPORTED_LOCALES).withMessage('locale is required'),
    query('field').optional(),
  ],
  validateRequest,
  (req: Request, res: Response) => {
    const { entityType, entityId, locale, field } = req.query as Record<string, string>;
    const resolved = localizationService.resolveTranslation(
      entityType as TranslationEntityType,
      entityId,
      locale,
      field,
    );
    if (!resolved) {
      return res.status(404).json({
        success: false,
        message: `No content found for ${entityType}:${entityId}`,
      });
    }
    res.json({ success: true, data: resolved });
  },
);

/**
 * @openapi
 * /api/localization/translations/{id}:
 *   get:
 *     tags: [Localization]
 *     summary: Get a translation by id
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Translation returned
 */
router.get(
  '/translations/:id',
  authenticateToken,
  [param('id').notEmpty()],
  validateRequest,
  (req: Request, res: Response) => {
    const translation = localizationService.getTranslation(req.params.id);
    if (!translation) {
      return res.status(404).json({ success: false, message: 'Translation not found' });
    }
    res.json({ success: true, data: translation });
  },
);

/**
 * @openapi
 * /api/localization/translations/{id}/assign:
 *   post:
 *     tags: [Localization]
 *     summary: Assign a translation to a translator
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Translation assigned
 */
router.post(
  '/translations/:id/assign',
  authenticateToken,
  [body('assigneeId').notEmpty().withMessage('assigneeId is required')],
  validateRequest,
  (req: Request, res: Response) => {
    const translation = localizationService.assignTranslation(req.params.id, req.body.assigneeId);
    res.json({ success: true, data: translation, message: 'Translation assigned' });
  },
);

/**
 * @openapi
 * /api/localization/translations/{id}/submit:
 *   post:
 *     tags: [Localization]
 *     summary: Submit a translation for review
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Translation submitted
 */
router.post('/translations/:id/submit', authenticateToken, (req: Request, res: Response) => {
  const translation = localizationService.submitTranslation(req.params.id, userIdOf(req) ?? '');
  res.json({ success: true, data: translation, message: 'Translation submitted for review' });
});

/**
 * @openapi
 * /api/localization/translations/{id}/approve:
 *   post:
 *     tags: [Localization]
 *     summary: Approve and publish a translation (rejects stale translations)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Translation published
 */
router.post('/translations/:id/approve', authenticateToken, (req: Request, res: Response) => {
  const translation = localizationService.approveTranslation(
    req.params.id,
    userIdOf(req) ?? '',
  );
  res.json({ success: true, data: translation, message: 'Translation published' });
});

/**
 * @openapi
 * /api/localization/translations/{id}/reject:
 *   post:
 *     tags: [Localization]
 *     summary: Reject a translation under review
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Translation rejected
 */
router.post('/translations/:id/reject', authenticateToken, (req: Request, res: Response) => {
  const translation = localizationService.rejectTranslation(req.params.id, userIdOf(req) ?? '');
  res.json({ success: true, data: translation, message: 'Translation rejected' });
});

export default router;
