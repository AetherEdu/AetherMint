/**
 * Assignment Controller
 * Handles all assignment-related operations
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  Assignment,
  AssignmentType,
  SubmissionType,
  LatePolicy,
  AssignmentStats,
  StudentAssignmentProgress
} from '../models/Assignment';
import { UserRole } from '../models/User';
import { AssignmentService } from '../services/assignmentService';
import { FileUploadService } from '../services/fileUploadService';
import GradingService from '../services/gradingService';
import { PlagiarismService } from '../services/plagiarismService';
import { NotificationService } from '../services/NotificationService';
import { validateAssignment, validateSubmission } from '../utils/validation';
import logger from '../utils/logger';
import {
  AuthError,
  ForbiddenError,
  NotFoundError,
  ValidationError
} from '../utils/errors';

export class AssignmentController {
  constructor(
    private assignmentService: AssignmentService,
    private fileUploadService: FileUploadService,
    private gradingService: any,
    private plagiarismService: PlagiarismService,
    private notificationService: NotificationService
  ) {}

  private getAuthenticatedUser(
    req: AuthenticatedRequest
  ): { id: string; role: UserRole } {
    if (!req.user) throw new AuthError('Authentication required');
    return { id: req.user.id, role: req.user.role };
  }

  // ── Assignment Management ─────────────────────────────────────────────────

  async createAssignment(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { courseId } = req.params;
      const assignmentData = req.body;

      const user = this.getAuthenticatedUser(req);

      if (user.role !== UserRole.EDUCATOR && user.role !== UserRole.ADMIN) {
        throw new ForbiddenError('Insufficient permissions');
      }

      const validation = validateAssignment(assignmentData);
      if (!validation.isValid) {
        const validationError =
          Array.isArray(validation.errors) && validation.errors.length > 0
            ? (validation.errors[0] as any).message
            : undefined;
        throw new ValidationError(
          (validation as any).error || validationError || 'Validation failed'
        );
      }

      const assignment = await this.assignmentService.createAssignment({
        ...assignmentData,
        courseId,
        createdBy: user.id
      });

      await (this.notificationService as any).notifyAssignmentCreated(assignment);

      logger.info(`Assignment created: ${assignment.id} by ${user.id}`);
      res.status(201).json(assignment);
    } catch (error) {
      next(error);
    }
  }

  async getAssignments(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { courseId } = req.params;
      const { page = 1, limit = 10, status, type } = req.query;

      const user = this.getAuthenticatedUser(req);

      const assignments = await this.assignmentService.getAssignments({
        courseId,
        page: Number(page),
        limit: Number(limit),
        status: status as string,
        type: type as AssignmentType,
        userId: user.id,
        userRole: user.role
      });

      res.json(assignments);
    } catch (error) {
      next(error);
    }
  }

  async getAssignment(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { assignmentId } = req.params;

      const user = this.getAuthenticatedUser(req);

      const assignment = await this.assignmentService.getAssignment(
        assignmentId,
        user.id,
        user.role
      );

      if (!assignment) throw new NotFoundError('Assignment not found');

      res.json(assignment);
    } catch (error) {
      next(error);
    }
  }

  async updateAssignment(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { assignmentId } = req.params;
      const updateData = req.body;

      const assignment = await this.assignmentService.getAssignment(assignmentId);
      if (!assignment) throw new NotFoundError('Assignment not found');

      const user = this.getAuthenticatedUser(req);

      if (assignment.createdBy !== user.id && user.role !== UserRole.ADMIN) {
        throw new ForbiddenError('Insufficient permissions');
      }

      const updatedAssignment = await this.assignmentService.updateAssignment(
        assignmentId,
        updateData
      );

      logger.info(`Assignment updated: ${assignmentId} by ${user.id}`);
      res.json(updatedAssignment);
    } catch (error) {
      next(error);
    }
  }

  async deleteAssignment(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { assignmentId } = req.params;

      const assignment = await this.assignmentService.getAssignment(assignmentId);
      if (!assignment) throw new NotFoundError('Assignment not found');

      const user = this.getAuthenticatedUser(req);

      if (assignment.createdBy !== user.id && user.role !== UserRole.ADMIN) {
        throw new ForbiddenError('Insufficient permissions');
      }

      await this.assignmentService.deleteAssignment(assignmentId);

      logger.info(`Assignment deleted: ${assignmentId} by ${user.id}`);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  // ── Submission Management ─────────────────────────────────────────────────

  async createSubmission(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { assignmentId } = req.params;

      const assignment = await this.assignmentService.getAssignment(assignmentId);
      if (!assignment) throw new NotFoundError('Assignment not found');

      const user = this.getAuthenticatedUser(req);

      if (!await this.assignmentService.canSubmit(assignmentId, user.id)) {
        throw new ForbiddenError('Submission not allowed');
      }

      const submissionData = req.body;

      if ((req as any).files && Array.isArray((req as any).files)) {
        const uploadedFiles = await this.fileUploadService.uploadFiles(
          (req as any).files,
          `assignments/${assignmentId}/submissions/${user.id}`
        );
        submissionData.files = uploadedFiles;
      }

      const submission = await this.assignmentService.createSubmission({
        ...submissionData,
        assignmentId,
        studentId: user.id
      });

      if (assignment.plagiarismCheck) {
        this.plagiarismService.checkPlagiarism(submission.id).catch((err: unknown) => {
          logger.error('Plagiarism check failed:', err);
        });
      }

      if (assignment.autoGrade) {
        this.gradingService.autoGrade(submission.id).catch((err: unknown) => {
          logger.error('Auto-grading failed:', err);
        });
      }

      logger.info(
        `Submission created: ${submission.id} for assignment: ${assignmentId}`
      );
      res.status(201).json(submission);
    } catch (error) {
      next(error);
    }
  }

  async getSubmissions(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { assignmentId } = req.params;
      const { page = 1, limit = 10, status, graded } = req.query;

      const assignment = await this.assignmentService.getAssignment(assignmentId);
      if (!assignment) throw new NotFoundError('Assignment not found');

      const user = this.getAuthenticatedUser(req);
      const isInstructor =
        assignment.createdBy === user.id || user.role === UserRole.ADMIN;

      const submissions = await this.assignmentService.getSubmissions({
        assignmentId,
        page: Number(page),
        limit: Number(limit),
        status: status as string,
        graded: graded === 'true',
        userId: isInstructor ? undefined : user.id,
        isInstructor
      });

      res.json(submissions);
    } catch (error) {
      next(error);
    }
  }

  async getSubmission(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { submissionId } = req.params;

      const user = this.getAuthenticatedUser(req);

      const submission = await this.assignmentService.getSubmission(
        submissionId,
        user.id,
        user.role
      );

      if (!submission) throw new NotFoundError('Submission not found');

      res.json(submission);
    } catch (error) {
      next(error);
    }
  }

  async updateSubmission(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { submissionId } = req.params;
      const updateData = req.body;

      const submission = await this.assignmentService.getSubmission(submissionId);
      if (!submission) throw new NotFoundError('Submission not found');

      const user = this.getAuthenticatedUser(req);

      if (submission.studentId !== user.id || submission.status !== 'draft') {
        throw new ForbiddenError('Cannot update submission');
      }

      if ((req as any).files && Array.isArray((req as any).files)) {
        const uploadedFiles = await this.fileUploadService.uploadFiles(
          (req as any).files,
          `assignments/${submission.assignmentId}/submissions/${user.id}`
        );
        updateData.files = [...(submission.files || []), ...uploadedFiles];
      }

      const updatedSubmission = await this.assignmentService.updateSubmission(
        submissionId,
        updateData
      );

      logger.info(`Submission updated: ${submissionId} by ${user.id}`);
      res.json(updatedSubmission);
    } catch (error) {
      next(error);
    }
  }

  async submitAssignment(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { submissionId } = req.params;

      const submission = await this.assignmentService.getSubmission(submissionId);
      if (!submission) throw new NotFoundError('Submission not found');

      const user = this.getAuthenticatedUser(req);

      if (submission.studentId !== user.id) {
        throw new ForbiddenError('Cannot submit assignment');
      }

      const submittedSubmission = await this.assignmentService.submitSubmission(
        submissionId
      );

      const assignment = await this.assignmentService.getAssignment(
        submission.assignmentId
      );

      if (assignment?.plagiarismCheck) {
        this.plagiarismService.checkPlagiarism(submissionId).catch((err: unknown) => {
          logger.error('Plagiarism check failed:', err);
        });
      }

      if (assignment?.autoGrade) {
        this.gradingService.autoGrade(submissionId).catch((err: unknown) => {
          logger.error('Auto-grading failed:', err);
        });
      }

      logger.info(`Assignment submitted: ${submissionId} by ${user.id}`);
      res.json(submittedSubmission);
    } catch (error) {
      next(error);
    }
  }

  // ── Grading Management ────────────────────────────────────────────────────

  async gradeSubmission(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { submissionId } = req.params;
      const gradingData = req.body;

      const submission = await this.assignmentService.getSubmission(submissionId);
      if (!submission) throw new NotFoundError('Submission not found');

      const assignment = await this.assignmentService.getAssignment(
        submission.assignmentId
      );
      if (!assignment) throw new NotFoundError('Assignment not found');

      const user = this.getAuthenticatedUser(req);

      if (assignment.createdBy !== user.id && user.role !== UserRole.ADMIN) {
        throw new ForbiddenError('Insufficient permissions');
      }

      const grade = await this.gradingService.gradeSubmission({
        ...gradingData,
        submissionId,
        gradedBy: user.id
      });

      await (this.notificationService as any).notifyGradeCreated(grade);

      logger.info(`Submission graded: ${submissionId} by ${user.id}`);
      res.status(201).json(grade);
    } catch (error) {
      next(error);
    }
  }

  async getGrades(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { assignmentId } = req.params;
      const { page = 1, limit = 10, status } = req.query;

      const assignment = await this.assignmentService.getAssignment(assignmentId);
      if (!assignment) throw new NotFoundError('Assignment not found');

      const user = this.getAuthenticatedUser(req);

      if (assignment.createdBy !== user.id && user.role !== UserRole.ADMIN) {
        throw new ForbiddenError('Insufficient permissions');
      }

      const grades = await this.gradingService.getGrades({
        assignmentId,
        page: Number(page),
        limit: Number(limit),
        status: status as string
      });

      res.json(grades);
    } catch (error) {
      next(error);
    }
  }

  // ── Statistics & Analytics ────────────────────────────────────────────────

  async getAssignmentStats(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { assignmentId } = req.params;

      const assignment = await this.assignmentService.getAssignment(assignmentId);
      if (!assignment) throw new NotFoundError('Assignment not found');

      const user = this.getAuthenticatedUser(req);

      if (assignment.createdBy !== user.id && user.role !== UserRole.ADMIN) {
        throw new ForbiddenError('Insufficient permissions');
      }

      const stats: AssignmentStats = await this.assignmentService.getAssignmentStats(
        assignmentId
      );

      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  async getStudentProgress(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { courseId } = req.params;

      const user = this.getAuthenticatedUser(req);

      const progress: StudentAssignmentProgress[] =
        await this.assignmentService.getStudentProgress(courseId, user.id);

      res.json(progress);
    } catch (error) {
      next(error);
    }
  }

  // ── Bulk Operations ───────────────────────────────────────────────────────

  async bulkGrade(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { assignmentId } = req.params;
      const { operation, criteria, gradingData } = req.body;

      const assignment = await this.assignmentService.getAssignment(assignmentId);
      if (!assignment) throw new NotFoundError('Assignment not found');

      const user = this.getAuthenticatedUser(req);

      if (assignment.createdBy !== user.id && user.role !== UserRole.ADMIN) {
        throw new ForbiddenError('Insufficient permissions');
      }

      const operationId = await this.gradingService.startBulkGrading({
        assignmentId,
        operation,
        criteria,
        gradingData,
        instructorId: user.id
      });

      logger.info(
        `Bulk grading started: ${operationId} for assignment: ${assignmentId}`
      );
      res.status(202).json({ operationId });
    } catch (error) {
      next(error);
    }
  }
}
