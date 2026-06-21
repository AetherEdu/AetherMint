import { Router } from 'express';
import { AGITutorController } from '../controllers/agiTutorController';

const router: Router = Router();
const agiTutorController = new AGITutorController();

/**
 * AGI Tutor Routes
 * Implements universal learning capabilities with artificial general intelligence
 */

// Generate personalized learning session
router.post('/session', async (req, res) => {
  await agiTutorController.generateLearningSession(req, res);
});

// Process student response and provide adaptive feedback
router.post('/response', async (req, res) => {
  await agiTutorController.processStudentResponse(req, res);
});

// Generate comprehensive assessment
router.post('/assessment', async (req, res) => {
  await agiTutorController.generateAssessment(req, res);
});

// Get real-time teaching guidance for instructors
router.post('/guidance', async (req, res) => {
  await agiTutorController.getTeachingGuidance(req, res);
});

// Get knowledge visualization and connections
router.get('/visualization', async (req, res) => {
  await agiTutorController.getKnowledgeVisualization(req, res);
});

// Track learning progress and predict outcomes
router.post('/progress', async (req, res) => {
  await agiTutorController.trackLearningProgress(req, res);
});

// Get personalized learning recommendations
router.post('/recommendations', async (req, res) => {
  await agiTutorController.getLearningRecommendations(req, res);
});

// Handle emotional support and motivation
router.post('/emotional-support', async (req, res) => {
  await agiTutorController.provideEmotionalSupport(req, res);
});

export default router;
