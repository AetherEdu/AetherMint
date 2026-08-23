/**
 * @openapi
 * tags:
 *   - name: Adaptation
 *     description: Engagement-aware content adaptation (issue #408)
 */

import express, { NextFunction, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { adaptationService } from '../services/adaptation/AdaptationService';
import { authenticateToken } from '../middleware/auth';

const router: express.Router = express.Router();

const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

/**
 * @openapi
 * /api/adaptation/signal:
 *   post:
 *     tags: [Adaptation]
 *     summary: Report a client-derived engagement signal
 *     description: Ingest the derived signal from the frontend emotion hook. Raw video never leaves the client.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               engagementScore:
 *                 type: number
 *               frustrationScore:
 *                 type: number
 *               dominantEmotion:
 *                 type: string
 *               progress:
 *                 type: number
 *     responses:
 *       '200':
 *         description: Signal ingested (stored only if consent is granted)
 */
router.post(
  '/signal',
  authenticateToken,
  [
    body('engagementScore').isNumeric().withMessage('engagementScore must be a number'),
    body('frustrationScore').isNumeric().withMessage('frustrationScore must be a number'),
    body('dominantEmotion').isString().withMessage('dominantEmotion must be a string'),
  ],
  validateRequest,
  (req: Request, res: Response) => {
    const userId = (req as any).user?.id || 'anonymous';
    const { engagementScore, frustrationScore, dominantEmotion, progress } = req.body;
    const result = adaptationService.ingestSignal(userId, {
      engagementScore: Number(engagementScore),
      frustrationScore: Number(frustrationScore),
      dominantEmotion,
      progress: progress !== undefined ? Number(progress) : undefined,
    });
    res.json({ success: true, data: result });
  },
);

/**
 * @openapi
 * /api/adaptation/recommend:
 *   post:
 *     tags: [Adaptation]
 *     summary: Get an explainable, overridable adaptation recommendation
 *     description: Decision based on the current signal (and stored window if consent was given).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               engagementScore:
 *                 type: number
 *               frustrationScore:
 *                 type: number
 *               dominantEmotion:
 *                 type: string
 *               progress:
 *                 type: number
 *     responses:
 *       '200':
 *         description: Adaptation recommendation
 */
router.post(
  '/recommend',
  authenticateToken,
  [
    body('engagementScore').isNumeric().withMessage('engagementScore must be a number'),
    body('frustrationScore').isNumeric().withMessage('frustrationScore must be a number'),
    body('dominantEmotion').isString().withMessage('dominantEmotion must be a string'),
  ],
  validateRequest,
  (req: Request, res: Response) => {
    const userId = (req as any).user?.id || 'anonymous';
    const signal = {
      engagementScore: Number(req.body.engagementScore),
      frustrationScore: Number(req.body.frustrationScore),
      dominantEmotion: req.body.dominantEmotion,
      progress: req.body.progress !== undefined ? Number(req.body.progress) : undefined,
    };
    const recommendation = adaptationService.recommend(userId, signal);
    res.json({ success: true, data: recommendation });
  },
);

/**
 * @openapi
 * /api/adaptation/preferences:
 *   get:
 *     tags: [Adaptation]
 *     summary: Get adaptation preferences for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: User preferences
 */
router.get('/preferences', authenticateToken, (req: Request, res: Response) => {
  const userId = (req as any).user?.id || 'anonymous';
  res.json({ success: true, data: adaptationService.getPreferences(userId) });
});

/**
 * @openapi
 * /api/adaptation/preferences:
 *   put:
 *     tags: [Adaptation]
 *     summary: Update adaptation preferences
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adaptationEnabled:
 *                 type: boolean
 *               pacingEnabled:
 *                 type: boolean
 *               difficultyEnabled:
 *                 type: boolean
 *               hintsEnabled:
 *                 type: boolean
 *               maxPlaybackRate:
 *                 type: number
 *               minPlaybackRate:
 *                 type: number
 *     responses:
 *       '200':
 *         description: Preferences updated
 */
router.put(
  '/preferences',
  authenticateToken,
  [
    body('adaptationEnabled').optional().isBoolean(),
    body('pacingEnabled').optional().isBoolean(),
    body('difficultyEnabled').optional().isBoolean(),
    body('hintsEnabled').optional().isBoolean(),
    body('maxPlaybackRate').optional().isNumeric(),
    body('minPlaybackRate').optional().isNumeric(),
  ],
  validateRequest,
  (req: Request, res: Response) => {
    const userId = (req as any).user?.id || 'anonymous';
    const prefs = adaptationService.setPreferences(userId, req.body);
    res.json({ success: true, data: prefs });
  },
);

/**
 * @openapi
 * /api/adaptation/consent:
 *   get:
 *     tags: [Adaptation]
 *     summary: Get consent state for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Consent state
 */
router.get('/consent', authenticateToken, (req: Request, res: Response) => {
  const userId = (req as any).user?.id || 'anonymous';
  res.json({ success: true, data: adaptationService.getConsent(userId) });
});

/**
 * @openapi
 * /api/adaptation/consent:
 *   put:
 *     tags: [Adaptation]
 *     summary: Update consent state (revocation purges stored signals)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               engagementTrackingConsent:
 *                 type: boolean
 *               biometricConsent:
 *                 type: boolean
 *     responses:
 *       '200':
 *         description: Consent updated
 */
router.put(
  '/consent',
  authenticateToken,
  [
    body('engagementTrackingConsent').optional().isBoolean(),
    body('biometricConsent').optional().isBoolean(),
  ],
  validateRequest,
  (req: Request, res: Response) => {
    const userId = (req as any).user?.id || 'anonymous';
    const consent = adaptationService.setConsent(userId, req.body);
    res.json({ success: true, data: consent });
  },
);

/**
 * @openapi
 * /api/adaptation/outcome:
 *   post:
 *     tags: [Adaptation]
 *     summary: Record learning outcome measured after an adaptation was applied
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               recommendationId:
 *                 type: string
 *               accepted:
 *                 type: boolean
 *               quizScoreAfter:
 *                 type: number
 *               completionDelta:
 *                 type: number
 *     responses:
 *       '200':
 *         description: Outcome recorded
 */
router.post(
  '/outcome',
  authenticateToken,
  [
    body('recommendationId').isString().withMessage('recommendationId is required'),
    body('accepted').isBoolean().withMessage('accepted must be a boolean'),
  ],
  validateRequest,
  (req: Request, res: Response) => {
    const userId = (req as any).user?.id || 'anonymous';
    const outcome = adaptationService.recordOutcome(userId, {
      userId,
      recommendationId: req.body.recommendationId,
      accepted: Boolean(req.body.accepted),
      quizScoreAfter: req.body.quizScoreAfter !== undefined ? Number(req.body.quizScoreAfter) : undefined,
      completionDelta: req.body.completionDelta !== undefined ? Number(req.body.completionDelta) : undefined,
    });
    res.json({ success: true, data: outcome });
  },
);

/**
 * @openapi
 * /api/adaptation/effectiveness:
 *   get:
 *     tags: [Adaptation]
 *     summary: Get adaptation effectiveness metrics for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Effectiveness metrics
 */
router.get('/effectiveness', authenticateToken, (req: Request, res: Response) => {
  const userId = (req as any).user?.id || 'anonymous';
  res.json({ success: true, data: adaptationService.getEffectiveness(userId) });
});

/**
 * @openapi
 * /api/adaptation/recommendations:
 *   get:
 *     tags: [Adaptation]
 *     summary: List past recommendations for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Past recommendations
 */
router.get('/recommendations', authenticateToken, (req: Request, res: Response) => {
  const userId = (req as any).user?.id || 'anonymous';
  res.json({ success: true, data: adaptationService.getRecommendations(userId) });
});

/**
 * @openapi
 * /api/adaptation/purge:
 *   delete:
 *     tags: [Adaptation]
 *     summary: Purge all stored engagement data (GDPR right-to-erasure)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Data purged
 */
router.delete('/purge', authenticateToken, (req: Request, res: Response) => {
  const userId = (req as any).user?.id || 'anonymous';
  adaptationService.purgeUserData(userId);
  res.json({ success: true, message: 'User data purged' });
});

export default router;