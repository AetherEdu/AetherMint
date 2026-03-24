import {
  Quiz,
  QuizSubmission,
  QuizResult,
  QuizFilter,
  CreateQuizRequest,
  UpdateQuizRequest,
  SubmitQuizRequest,
  QuizAnswer,
  QuizResponse,
  QuizListResponse,
  QuizSubmissionResponse,
  QuizResultResponse,
  QuizResultsResponse,
  Question
} from '../models/Quiz';

/**
 * Quiz Service
 * Handles CRUD operations for quizzes, submissions, and results
 */
class QuizService {
  private quizzes: Map<string, Quiz> = new Map();
  private submissions: Map<string, QuizSubmission> = new Map();
  private results: Map<string, QuizResult> = new Map();

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  /**
   * Create a new quiz
   */
  async createQuiz(createRequest: CreateQuizRequest, instructorId: string): Promise<QuizResponse> {
    try {
      const quiz: Quiz = {
        id: this.generateId(),
        title: createRequest.title,
        description: createRequest.description,
        courseId: createRequest.courseId,
        instructorId,
        questions: createRequest.questions.map((q, index) => ({
          ...q,
          id: this.generateId(),
          order: index
        })),
        settings: {
          timeLimit: createRequest.settings.timeLimit,
          attemptsAllowed: createRequest.settings.attemptsAllowed || 1,
          shuffleQuestions: createRequest.settings.shuffleQuestions || false,
          shuffleOptions: createRequest.settings.shuffleOptions || false,
          showCorrectAnswers: createRequest.settings.showCorrectAnswers || false,
          showResults: createRequest.settings.showResults || true,
          passingScore: createRequest.settings.passingScore || 70,
          allowReview: createRequest.settings.allowReview || true,
          autoSubmit: createRequest.settings.autoSubmit || false
        },
        metadata: {
          difficulty: createRequest.metadata.difficulty || 'medium',
          estimatedDuration: createRequest.metadata.estimatedDuration || 30,
          tags: createRequest.metadata.tags || [],
          instructions: createRequest.metadata.instructions || '',
          createdAt: new Date(),
          updatedAt: new Date(),
          isPublished: false
        }
      };

      this.quizzes.set(quiz.id, quiz);

      return {
        success: true,
        data: quiz
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create quiz: ${(error as Error).message}`
      };
    }
  }

  /**
   * Get quiz by ID
   */
  async getQuizById(quizId: string): Promise<QuizResponse> {
    try {
      const quiz = this.quizzes.get(quizId);
      
      if (!quiz) {
        return {
          success: false,
          message: 'Quiz not found'
        };
      }

      return {
        success: true,
        data: quiz
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get quiz: ${(error as Error).message}`
      };
    }
  }

  /**
   * Get quizzes with filtering
   */
  async getQuizzes(filter: QuizFilter = {}): Promise<QuizListResponse> {
    try {
      let quizzes = Array.from(this.quizzes.values());

      // Apply filters
      if (filter.courseId) {
        quizzes = quizzes.filter(quiz => quiz.courseId === filter.courseId);
      }

      if (filter.instructorId) {
        quizzes = quizzes.filter(quiz => quiz.instructorId === filter.instructorId);
      }

      if (filter.difficulty) {
        quizzes = quizzes.filter(quiz => quiz.metadata.difficulty === filter.difficulty);
      }

      if (filter.isPublished !== undefined) {
        quizzes = quizzes.filter(quiz => quiz.metadata.isPublished === filter.isPublished);
      }

      if (filter.tags && filter.tags.length > 0) {
        quizzes = quizzes.filter(quiz => 
          filter.tags!.some(tag => quiz.metadata.tags.includes(tag))
        );
      }

      // Sort by creation date (newest first)
      quizzes.sort((a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime());

      // Pagination
      const page = filter.page || 1;
      const limit = filter.limit || 10;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedQuizzes = quizzes.slice(startIndex, endIndex);

      return {
        success: true,
        data: paginatedQuizzes,
        pagination: {
          page,
          limit,
          total: quizzes.length,
          totalPages: Math.ceil(quizzes.length / limit)
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get quizzes: ${(error as Error).message}`
      };
    }
  }

  /**
   * Update quiz
   */
  async updateQuiz(quizId: string, updateRequest: UpdateQuizRequest): Promise<QuizResponse> {
    try {
      const existingQuiz = this.quizzes.get(quizId);
      
      if (!existingQuiz) {
        return {
          success: false,
          message: 'Quiz not found'
        };
      }

      const updatedQuiz: any = {
        ...existingQuiz,
        title: updateRequest.title || existingQuiz.title,
        description: updateRequest.description || existingQuiz.description,
        id: quizId,
        instructorId: existingQuiz.instructorId,
        metadata: {
          ...existingQuiz.metadata,
          ...updateRequest.metadata,
          updatedAt: new Date()
        }
      };

      // Update questions if provided
      if (updateRequest.questions) {
        updatedQuiz.questions = updateRequest.questions.map((q, index) => {
          const question: Question = {
            id: q.id || this.generateId(),
            type: q.type || 'multiple-choice',
            question: q.question || '',
            points: q.points || 1,
            order: index,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation
          };
          return question;
        });
      }

      // Update settings if provided
      if (updateRequest.settings) {
        updatedQuiz.settings = {
          ...existingQuiz.settings,
          ...updateRequest.settings
        };
      }

      this.quizzes.set(quizId, updatedQuiz);

      return {
        success: true,
        data: updatedQuiz
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update quiz: ${(error as Error).message}`
      };
    }
  }

  /**
   * Delete quiz
   */
  async deleteQuiz(quizId: string): Promise<QuizResponse> {
    try {
      const quiz = this.quizzes.get(quizId);
      
      if (!quiz) {
        return {
          success: false,
          message: 'Quiz not found'
        };
      }

      this.quizzes.delete(quizId);

      // Clean up related submissions and results
      for (const [submissionId, submission] of this.submissions) {
        if (submission.quizId === quizId) {
          this.submissions.delete(submissionId);
        }
      }

      for (const [resultId, result] of this.results) {
        if (result.quizId === quizId) {
          this.results.delete(resultId);
        }
      }

      return {
        success: true,
        data: quiz
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete quiz: ${(error as Error).message}`
      };
    }
  }

  /**
   * Publish/Unpublish quiz
   */
  async toggleQuizPublish(quizId: string): Promise<QuizResponse> {
    try {
      const quiz = this.quizzes.get(quizId);
      
      if (!quiz) {
        return {
          success: false,
          message: 'Quiz not found'
        };
      }

      quiz.metadata.isPublished = !quiz.metadata.isPublished;
      quiz.metadata.updatedAt = new Date();

      this.quizzes.set(quizId, quiz);

      return {
        success: true,
        data: quiz
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to toggle quiz publish status: ${(error as Error).message}`
      };
    }
  }

  /**
   * Submit quiz answers
   */
  async submitQuiz(submitRequest: SubmitQuizRequest, userId: string): Promise<QuizSubmissionResponse> {
    try {
      const quiz = this.quizzes.get(submitRequest.quizId);
      
      if (!quiz) {
        return {
          success: false,
          message: 'Quiz not found'
        };
      }

      // Check if user has attempts remaining
      const userSubmissions = Array.from(this.submissions.values())
        .filter(sub => sub.quizId === submitRequest.quizId && sub.userId === userId && sub.status === 'submitted');

      if (userSubmissions.length >= quiz.settings.attemptsAllowed) {
        return {
          success: false,
          message: 'No attempts remaining'
        };
      }

      const submission: QuizSubmission = {
        id: this.generateId(),
        quizId: submitRequest.quizId,
        userId,
        answers: submitRequest.answers.map(answer => ({
          questionId: answer.questionId,
          answer: answer.answer
        })),
        submittedAt: new Date(),
        timeSpent: submitRequest.timeSpent,
        status: 'submitted'
      };

      this.submissions.set(submission.id, submission);

      return {
        success: true,
        data: submission
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to submit quiz: ${(error as Error).message}`
      };
    }
  }

  /**
   * Get quiz submission by ID
   */
  async getSubmissionById(submissionId: string): Promise<QuizSubmissionResponse> {
    try {
      const submission = this.submissions.get(submissionId);
      
      if (!submission) {
        return {
          success: false,
          message: 'Submission not found'
        };
      }

      return {
        success: true,
        data: submission
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get submission: ${(error as Error).message}`
      };
    }
  }

  /**
   * Get user's submissions for a quiz
   */
  async getUserSubmissions(quizId: string, userId: string): Promise<QuizSubmissionResponse> {
    try {
      const submissions = Array.from(this.submissions.values())
        .filter(sub => sub.quizId === quizId && sub.userId === userId)
        .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());

      return {
        success: true,
        data: submissions[0] // Return most recent submission
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get user submissions: ${(error as Error).message}`
      };
    }
  }

  /**
   * Get quiz results
   */
  async getQuizResults(quizId: string, userId?: string, page = 1, limit = 10): Promise<QuizResultsResponse> {
    try {
      let results = Array.from(this.results.values())
        .filter(result => result.quizId === quizId);

      if (userId) {
        results = results.filter(result => result.userId === userId);
      }

      // Sort by graded date (newest first)
      results.sort((a, b) => b.gradedAt.getTime() - a.gradedAt.getTime());

      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedResults = results.slice(startIndex, endIndex);

      return {
        success: true,
        data: paginatedResults,
        pagination: {
          page,
          limit,
          total: results.length,
          totalPages: Math.ceil(results.length / limit)
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get quiz results: ${(error as Error).message}`
      };
    }
  }

  /**
   * Store quiz result (called by grading service)
   */
  async storeQuizResult(result: QuizResult): Promise<QuizResultResponse> {
    try {
      this.results.set(result.id, result);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to store quiz result: ${(error as Error).message}`
      };
    }
  }

  /**
   * Get all questions from a course to act as a question bank
   */
  async getQuestionBank(courseId: string): Promise<Question[]> {
    const courseQuizzes = Array.from(this.quizzes.values()).filter(q => q.courseId === courseId);
    const questions: Question[] = [];
    courseQuizzes.forEach(quiz => {
      quiz.questions.forEach(q => {
        if (!questions.find(existing => existing.question === q.question)) {
          questions.push(q);
        }
      });
    });
    return questions;
  }

  /**
   * Create a quiz with randomized question selection
   */
  async createRandomizedQuiz(courseId: string, instructorId: string, count: number): Promise<QuizResponse> {
    const bank = await this.getQuestionBank(courseId);
    if (bank.length < count) {
      throw new Error(`Not enough questions in the bank. Requested: ${count}, Bank size: ${bank.length}`);
    }

    const shuffled = [...bank].sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffled.slice(0, count);

    return await this.createQuiz({
      title: `Randomized Assessment - ${new Date().toLocaleDateString()}`,
      description: 'Auto-generated quiz from the question bank.',
      courseId,
      questions: selectedQuestions,
      settings: {
        shuffleQuestions: true,
        attemptsAllowed: 1
      },
      metadata: {
        difficulty: 'medium',
        tags: ['randomized', 'auto-generated']
      }
    }, instructorId);
  }

  /**
   * Get quiz statistics
   */
  async getQuizStatistics(quizId: string): Promise<any> {
    try {
      const quiz = this.quizzes.get(quizId);
      
      if (!quiz) {
        return {
          success: false,
          message: 'Quiz not found'
        };
      }

      const submissions = Array.from(this.submissions.values())
        .filter(sub => sub.quizId === quizId && sub.status === 'submitted');

      const results = Array.from(this.results.values())
        .filter(result => result.quizId === quizId);

      const totalSubmissions = submissions.length;
      const averageScore = results.length > 0 
        ? results.reduce((sum, result) => sum + result.percentage, 0) / results.length 
        : 0;
      const passRate = results.length > 0 
        ? (results.filter(result => result.passed).length / results.length) * 100 
        : 0;
      const averageTime = submissions.length > 0 
        ? submissions.reduce((sum, sub) => sum + sub.timeSpent, 0) / submissions.length 
        : 0;

      return {
        success: true,
        data: {
          totalSubmissions,
          averageScore: Math.round(averageScore * 100) / 100,
          passRate: Math.round(passRate * 100) / 100,
          averageTime: Math.round(averageTime),
          totalQuestions: quiz.questions.length,
          totalPoints: quiz.questions.reduce((sum, q) => sum + q.points, 0)
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get quiz statistics: ${(error as Error).message}`
      };
    }
  }
}

export default new QuizService();
