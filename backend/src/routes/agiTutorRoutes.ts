/**
 * @openapi
 * tags:
 *   - name: AGITutor
 *     description: AGI tutor for personalized learning
 */

import { Router } from 'express';
import { AGITutorController } from '../controllers/agiTutorController';

const router: Router = Router();
const agiTutorController = new AGITutorController();

/**
 * @openapi
 * /api/agi-tutor/session:
 *   post:
 *     tags: [AGITutor]
 *     summary: Generate personalized learning session
 *     responses:
 *       '200':
 *         description: Session generated
 */
router.post('/session', async (req, res) => {
  await agiTutorController.generateLearningSession(req, res);
});

/**
 * @openapi
 * /api/agi-tutor/response:
 *   post:
 *     tags: [AGITutor]
 *     summary: Process student response and provide adaptive feedback
 *     responses:
 *       '200':
 *         description: Response processed
 */
router.post('/response', async (req, res) => {
  await agiTutorController.processStudentResponse(req, res);
});

/**
 * @openapi
 * /api/agi-tutor/assessment:
 *   post:
 *     tags: [AGITutor]
 *     summary: Generate comprehensive assessment
 *     responses:
 *       '200':
 *         description: Assessment generated
 */
router.post('/assessment', async (req, res) => {
  await agiTutorController.generateAssessment(req, res);
});

/**
 * @openapi
 * /api/agi-tutor/guidance:
 *   post:
 *     tags: [AGITutor]
 *     summary: Get real-time teaching guidance
 *     responses:
 *       '200':
 *         description: Guidance provided
 */
router.post('/guidance', async (req, res) => {
  await agiTutorController.getTeachingGuidance(req, res);
});

/**
 * @openapi
 * /api/agi-tutor/visualization:
 *   get:
 *     tags: [AGITutor]
 *     summary: Get knowledge visualization
 *     responses:
 *       '200':
 *         description: Visualization retrieved
 */
router.get('/visualization', async (req, res) => {
  await agiTutorController.getKnowledgeVisualization(req, res);
});

/**
 * @openapi
 * /api/agi-tutor/progress:
 *   post:
 *     tags: [AGITutor]
 *     summary: Track learning progress and predict outcomes
 *     responses:
 *       '200':
 *         description: Progress tracked
 */
router.post('/progress', async (req, res) => {
  await agiTutorController.trackLearningProgress(req, res);
});

/**
 * @openapi
 * /api/agi-tutor/recommendations:
 *   post:
 *     tags: [AGITutor]
 *     summary: Get personalized learning recommendations
 *     responses:
 *       '200':
 *         description: Recommendations provided
 */
router.post('/recommendations', async (req, res) => {
  await agiTutorController.getLearningRecommendations(req, res);
});

/**
 * @openapi
 * /api/agi-tutor/emotional-support:
 *   post:
 *     tags: [AGITutor]
 *     summary: Provide emotional support and motivation
 *     responses:
 *       '200':
 *         description: Emotional support provided
 */
router.post('/emotional-support', async (req, res) => {
  await agiTutorController.provideEmotionalSupport(req, res);
});

export default router;
