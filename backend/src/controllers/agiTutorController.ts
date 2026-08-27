import { Request, Response } from 'express';
import { AGITutorService } from '../services/agiTutorService';
import { UniversalKnowledgeService } from '../services/universalKnowledgeService';
import { StudentAdaptationService } from '../services/studentAdaptationService';
import { EmotionalIntelligenceService } from '../services/emotionalIntelligenceService';
import { CrossDomainIntegrationService } from '../services/crossDomainIntegrationService';
import { ragPipeline } from '../services/tutor';
import logger from '../utils/logger';

export class AGITutorController {
  private agiTutorService: AGITutorService;
  private knowledgeService: UniversalKnowledgeService;
  private adaptationService: StudentAdaptationService;
  private emotionalService: EmotionalIntelligenceService;
  private integrationService: CrossDomainIntegrationService;

  constructor() {
    this.agiTutorService = new AGITutorService();
    this.knowledgeService = new UniversalKnowledgeService();
    this.adaptationService = new StudentAdaptationService();
    this.emotionalService = new EmotionalIntelligenceService();
    this.integrationService = new CrossDomainIntegrationService();
  }

  /**
   * Generate personalized learning session for any subject
   */
  async generateLearningSession(req: Request, res: Response) {
    try {
      const { studentId, subject, topic, learningGoals, currentKnowledge, emotionalState } = req.body;

      // Analyze student's current state and adapt teaching approach
      const studentProfile = await this.adaptationService.analyzeStudent(studentId, {
        currentKnowledge,
        learningGoals,
        emotionalState
      });

      // Get comprehensive knowledge graph for the subject
      const knowledgeGraph = await this.knowledgeService.getSubjectKnowledge(subject, topic);

      // Integrate cross-domain knowledge connections
      const crossDomainConnections = await this.integrationService.findConnections(subject, topic);

      // Generate emotionally intelligent teaching approach
      const emotionalProfile = await this.emotionalService.analyzeEmotionalState(emotionalState);

      // Create personalized learning session
      const learningSession = await this.agiTutorService.createLearningSession({
        studentProfile,
        knowledgeGraph,
        crossDomainConnections,
        emotionalProfile,
        subject,
        topic
      });

      res.json({
        success: true,
        data: {
          session: learningSession,
          adaptations: studentProfile.adaptations,
          emotionalSupport: (emotionalProfile as any).supportStrategies,
          crossDomainInsights: crossDomainConnections
        }
      });
    } catch (error) {
      logger.error('Error generating learning session:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate learning session'
      });
    }
  }

  /**
   * Process student response and provide adaptive feedback
   */
  async processStudentResponse(req: Request, res: Response) {
    try {
      const { sessionId, studentResponse, confidenceLevel, responseTime } = req.body;

      // Analyze response with AGI reasoning
      const responseAnalysis = await this.agiTutorService.analyzeResponse({
        sessionId,
        studentResponse,
        confidenceLevel,
        responseTime
      });

      // Update student model based on response
      const updatedProfile = await this.adaptationService.updateStudentModel(
        responseAnalysis.studentId,
        responseAnalysis
      );

      // Generate next teaching action
      const nextAction = await this.agiTutorService.generateNextAction({
        sessionId,
        responseAnalysis,
        updatedProfile
      });

      res.json({
        success: true,
        data: {
          analysis: responseAnalysis,
          nextAction,
          profileUpdate: updatedProfile
        }
      });
    } catch (error) {
      logger.error('Error processing student response:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process student response'
      });
    }
  }

  /**
   * Generate comprehensive assessment for any subject
   */
  async generateAssessment(req: Request, res: Response) {
    try {
      const { studentId, subject, topics, assessmentType, difficulty } = req.body;

      // Get student's current knowledge state
      const studentProfile = await this.adaptationService.getStudentProfile(studentId);

      // Generate adaptive assessment
      const assessment = await this.agiTutorService.generateAssessment({
        studentProfile,
        subject,
        topics,
        assessmentType,
        difficulty
      });

      res.json({
        success: true,
        data: assessment
      });
    } catch (error) {
      logger.error('Error generating assessment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate assessment'
      });
    }
  }

  /**
   * Get real-time teaching guidance for instructors
   */
  async getTeachingGuidance(req: Request, res: Response) {
    try {
      const { classId, subject, currentTopic, studentStates } = req.body;

      // Analyze entire class state
      const classAnalysis = await this.agiTutorService.analyzeClassState({
        classId,
        subject,
        currentTopic,
        studentStates
      });

      // Generate teaching strategies
      const guidance = await this.agiTutorService.generateTeachingGuidance(classAnalysis);

      res.json({
        success: true,
        data: guidance
      });
    } catch (error) {
      logger.error('Error generating teaching guidance:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate teaching guidance'
      });
    }
  }

  /**
   * Get knowledge visualization and connections
   */
  async getKnowledgeVisualization(req: Request, res: Response) {
    try {
      const { subject, topic, depth } = req.query;

      const visualization = await this.knowledgeService.generateKnowledgeVisualization({
        subject: subject as string,
        topic: topic as string,
        depth: parseInt(depth as string) || 3
      });

      res.json({
        success: true,
        data: visualization
      });
    } catch (error) {
      logger.error('Error generating knowledge visualization:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate knowledge visualization'
      });
    }
  }

  /**
   * Track learning progress and predict outcomes
   */
  async trackLearningProgress(req: Request, res: Response) {
    try {
      const { studentId, sessionId, learningData } = req.body;

      const progressAnalysis = await this.agiTutorService.analyzeLearningProgress({
        studentId,
        sessionId,
        learningData
      });

      const predictions = await this.agiTutorService.predictLearningOutcomes(progressAnalysis);

      res.json({
        success: true,
        data: {
          progress: progressAnalysis,
          predictions
        }
      });
    } catch (error) {
      logger.error('Error tracking learning progress:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to track learning progress'
      });
    }
  }

  /**
   * Get personalized learning recommendations
   */
  async getLearningRecommendations(req: Request, res: Response) {
    try {
      const { studentId, interests, goals, currentLevel } = req.body;

      const recommendations = await this.agiTutorService.generateRecommendations({
        studentId,
        interests,
        goals,
        currentLevel
      });

      res.json({
        success: true,
        data: recommendations
      });
    } catch (error) {
      logger.error('Error generating recommendations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate recommendations'
      });
    }
  }

  /**
   * Handle emotional support and motivation
   */
  async provideEmotionalSupport(req: Request, res: Response) {
    try {
      const { studentId, emotionalState, context } = req.body;

      const support = await this.emotionalService.provideSupport({
        studentId,
        emotionalState,
        context
      });

      res.json({
        success: true,
        data: support
      });
    } catch (error) {
      logger.error('Error providing emotional support:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to provide emotional support'
      });
    }
  }

  /**
   * Answer a question using the RAG pipeline over indexed course content
   */
  async askRagQuestion(req: Request, res: Response) {
    try {
      const { question, topK } = req.body;

      if (!question || typeof question !== 'string' || question.trim() === '') {
        res.status(400).json({
          success: false,
          error: 'question is required'
        });
        return;
      }

      const answer = await ragPipeline.answer(question, {
        topK: typeof topK === 'number' && topK > 0 ? topK : undefined
      });

      res.json({
        success: true,
        data: answer
      });
    } catch (error) {
      logger.error('Error answering RAG question:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to answer question'
      });
    }
  }

  /**
   * Trigger indexing of course content into the vector store
   */
  async triggerRagIndexing(req: Request, res: Response) {
    try {
      const result = await ragPipeline.indexContent();

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error indexing course content:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to index course content'
      });
    }
  }

  /**
   * Get RAG pipeline indexing status
   */
  async getRagStatus(req: Request, res: Response) {
    try {
      const status = await ragPipeline.getStatus();

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Error getting RAG status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get RAG status'
      });
    }
  }
}
