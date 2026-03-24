import { Request, Response } from 'express';
import quizService from '../services/quizService';
import gradingService from '../services/gradingService';
import {
  CreateQuizRequest,
  UpdateQuizRequest,
  SubmitQuizRequest,
  QuizFilter,
  QuizResponse,
  QuizListResponse,
  QuizSubmissionResponse,
  QuizResultResponse,
  QuizResultsResponse
} from '../models/Quiz';

/**
 * Quiz Controller
 * Handles HTTP requests for quiz management and grading
 */
class QuizController {
  /**
   * Create a new quiz
   * POST /api/quizzes
   */
  async createQuiz(req: Request, res: Response): Promise<void> {
    try {
      const instructorId = (req as any).user?.id || 'default-instructor'; // Get from auth middleware
      const createRequest: CreateQuizRequest = req.body;

      // Validate required fields
      if (!createRequest.title || !createRequest.courseId || !createRequest.questions) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: title, courseId, questions'
        });
        return;
      }

      // Validate questions
      if (createRequest.questions.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Quiz must have at least one question'
        });
        return;
      }

      const response = await quizService.createQuiz(createRequest, instructorId);

      if (response.success) {
        res.status(201).json(response);
      } else {
        res.status(400).json(response);
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Internal server error: ${(error as Error).message}`
      });
    }
  }

  /**
   * Get quiz by ID
   * GET /api/quizzes/:id
   */
  async getQuizById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const response = await quizService.getQuizById(id);

      if (response.success) {
        res.status(200).json(response);
      } else {
        res.status(404).json(response);
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Internal server error: ${(error as Error).message}`
      });
    }
  }

  /**
   * Get quizzes with filtering
   * GET /api/quizzes
   */
  async getQuizzes(req: Request, res: Response): Promise<void> {
    try {
      const filter: QuizFilter = {
        courseId: req.query.courseId as string,
        instructorId: req.query.instructorId as string,
        difficulty: req.query.difficulty as 'easy' | 'medium' | 'hard',
        isPublished: req.query.isPublished === 'true' ? true : 
                   req.query.isPublished === 'false' ? false : undefined,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
      };

      const response = await quizService.getQuizzes(filter);

      if (response.success) {
        res.status(200).json(response);
      } else {
        res.status(400).json(response);
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Internal server error: ${(error as Error).message}`
      });
    }
  }

  /**
   * Update quiz
   * PUT /api/quizzes/:id
   */
  async updateQuiz(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateRequest: UpdateQuizRequest = req.body;

      const response = await quizService.updateQuiz(id, updateRequest);

      if (response.success) {
        res.status(200).json(response);
      } else {
        res.status(404).json(response);
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Internal server error: ${(error as Error).message}`
      });
    }
  }

  /**
   * Delete quiz
   * DELETE /api/quizzes/:id
   */
  async deleteQuiz(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const response = await quizService.deleteQuiz(id);

      if (response.success) {
        res.status(200).json(response);
      } else {
        res.status(404).json(response);
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Internal server error: ${(error as Error).message}`
      });
    }
  }

  /**
   * Publish/Unpublish quiz
   * POST /api/quizzes/:id/publish
   */
  async toggleQuizPublish(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const response = await quizService.toggleQuizPublish(id);

      if (response.success) {
        res.status(200).json(response);
      } else {
        res.status(404).json(response);
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Internal server error: ${(error as Error).message}`
      });
    }
  }

  /**
   * Submit quiz answers
   * POST /api/quizzes/:id/submit
   */
  async submitQuiz(req: Request, res: Response): Promise<void> {
    try {
      const { id: quizId } = req.params;
      const userId = (req as any).user?.id || 'default-user'; // Get from auth middleware
      const submitRequest: SubmitQuizRequest = {
        quizId,
        answers: req.body.answers,
        timeSpent: req.body.timeSpent
      };

      // Validate request
      if (!submitRequest.answers || !Array.isArray(submitRequest.answers)) {
        res.status(400).json({
          success: false,
          message: 'Answers array is required'
        });
        return;
      }

      if (typeof submitRequest.timeSpent !== 'number' || submitRequest.timeSpent < 0) {
        res.status(400).json({
          success: false,
          message: 'Valid timeSpent is required'
        });
        return;
      }

      const response = await quizService.submitQuiz(submitRequest, userId);

      if (response.success) {
        // Automatically grade the submission
        try {
          const result = await gradingService.gradeSubmission(response.data!);
          res.status(201).json({
            success: true,
            data: {
              submission: response.data,
              result
            }
          });
        } catch (gradeError) {
          // If grading fails, still return the submission
          res.status(201).json({
            success: true,
            data: response.data,
            warning: 'Quiz submitted but grading failed'
          });
        }
      } else {
        res.status(400).json(response);
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Internal server error: ${(error as Error).message}`
      });
    }
  }

  /**
   * Get quiz submission by ID
   * GET /api/quizzes/submissions/:id
   */
  async getSubmissionById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const response = await quizService.getSubmissionById(id);

      if (response.success) {
        res.status(200).json(response);
      } else {
        res.status(404).json(response);
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Internal server error: ${(error as Error).message}`
      });
    }
  }

  /**
   * Get user's submission for a quiz
   * GET /api/quizzes/:id/submission
   */
  async getUserSubmission(req: Request, res: Response): Promise<void> {
    try {
      const { id: quizId } = req.params;
      const userId = (req as any).user?.id || req.query.userId as string;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
        return;
      }

      const response = await quizService.getUserSubmissions(quizId, userId);

      if (response.success) {
        res.status(200).json(response);
      } else {
        res.status(404).json(response);
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Internal server error: ${(error as Error).message}`
      });
    }
  }

  /**
   * Get quiz results
   * GET /api/quizzes/:id/results
   */
  async getQuizResults(req: Request, res: Response): Promise<void> {
    try {
      const { id: quizId } = req.params;
      const userId = req.query.userId as string;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      const response = await quizService.getQuizResults(quizId, userId, page, limit);

      if (response.success) {
        res.status(200).json(response);
      } else {
        res.status(400).json(response);
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Internal server error: ${(error as Error).message}`
      });
    }
  }

  /**
   * Get quiz statistics
   * GET /api/quizzes/:id/statistics
   */
  async getQuizStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { id: quizId } = req.params;
      const response = await quizService.getQuizStatistics(quizId);

      if (response.success) {
        res.status(200).json(response);
      } else {
        res.status(404).json(response);
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Internal server error: ${(error as Error).message}`
      });
    }
  }

  /**
   * Get grading statistics for a quiz
   * GET /api/quizzes/:id/grading-statistics
   */
  async getGradingStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { id: quizId } = req.params;
      const statistics = await gradingService.getGradingStatistics(quizId);

      res.status(200).json({
        success: true,
        data: statistics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Internal server error: ${(error as Error).message}`
      });
    }
  }

  /**
   * Re-grade a submission
   * POST /api/quizzes/submissions/:id/regrade
   */
  async regradeSubmission(req: Request, res: Response): Promise<void> {
    try {
      const { id: submissionId } = req.params;
      const result = await gradingService.regradeSubmission(submissionId);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Internal server error: ${(error as Error).message}`
      });
    }
  }

  /**
   * Health check for quiz service
   * GET /api/quizzes/health
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        message: 'Quiz service is healthy',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Health check failed: ${(error as Error).message}`
      });
    }
  }
}

export default new QuizController();
