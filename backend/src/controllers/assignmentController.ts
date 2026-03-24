/**
 * Assignment Controller
 * Handles all assignment-related operations
 */

import { Request, Response } from 'express';
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
import { GradingService } from '../services/gradingService';
import { PlagiarismService } from '../services/plagiarismService';
import { NotificationService } from '../services/notificationService';
import { validateAssignment, validateSubmission } from '../utils/validation';
import { logger } from '../utils/logger';

export class AssignmentController {
  constructor(
    private assignmentService: AssignmentService,
    private fileUploadService: FileUploadService,
    private gradingService: GradingService,
    private plagiarismService: PlagiarismService,
    private notificationService: NotificationService
  ) {}

  // Assignment Management
  async createAssignment(req: Request, res: Response) {
    try {
      const { courseId } = req.params;
      const assignmentData = req.body;
      
      // Validate user is instructor for the course
      if (req.user.role !== UserRole.EDUCATOR && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      // Validate assignment data
      const validation = validateAssignment(assignmentData);
      if (!validation.isValid) {
        return res.status(400).json({ error: validation.error });
      }

      const assignment = await this.assignmentService.createAssignment({
        ...assignmentData,
        courseId,
        createdBy: req.user.id
      });

      // Notify enrolled students
      await this.notificationService.notifyAssignmentCreated(assignment);

      logger.info(`Assignment created: ${assignment.id} by ${req.user.id}`);
      res.status(201).json(assignment);
    } catch (error) {
      logger.error('Error creating assignment:', error);
      res.status(500).json({ error: 'Failed to create assignment' });
    }
  }

  async getAssignments(req: Request, res: Response) {
    try {
      const { courseId } = req.params;
      const { page = 1, limit = 10, status, type } = req.query;

      const assignments = await this.assignmentService.getAssignments({
        courseId,
        page: Number(page),
        limit: Number(limit),
        status: status as string,
        type: type as AssignmentType,
        userId: req.user.id,
        userRole: req.user.role
      });

      res.json(assignments);
    } catch (error) {
      logger.error('Error fetching assignments:', error);
      res.status(500).json({ error: 'Failed to fetch assignments' });
    }
  }

  async getAssignment(req: Request, res: Response) {
    try {
      const { assignmentId } = req.params;
      
      const assignment = await this.assignmentService.getAssignment(
        assignmentId,
        req.user.id,
        req.user.role
      );

      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
      }

      res.json(assignment);
    } catch (error) {
      logger.error('Error fetching assignment:', error);
      res.status(500).json({ error: 'Failed to fetch assignment' });
    }
  }

  async updateAssignment(req: Request, res: Response) {
    try {
      const { assignmentId } = req.params;
      const updateData = req.body;

      // Check permissions
      const assignment = await this.assignmentService.getAssignment(assignmentId);
      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
      }

      if (assignment.createdBy !== req.user.id && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const updatedAssignment = await this.assignmentService.updateAssignment(
        assignmentId,
        updateData
      );

      logger.info(`Assignment updated: ${assignmentId} by ${req.user.id}`);
      res.json(updatedAssignment);
    } catch (error) {
      logger.error('Error updating assignment:', error);
      res.status(500).json({ error: 'Failed to update assignment' });
    }
  }

  async deleteAssignment(req: Request, res: Response) {
    try {
      const { assignmentId } = req.params;

      // Check permissions
      const assignment = await this.assignmentService.getAssignment(assignmentId);
      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
      }

      if (assignment.createdBy !== req.user.id && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      await this.assignmentService.deleteAssignment(assignmentId);

      logger.info(`Assignment deleted: ${assignmentId} by ${req.user.id}`);
      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting assignment:', error);
      res.status(500).json({ error: 'Failed to delete assignment' });
    }
  }

  // Submission Management
  async createSubmission(req: Request, res: Response) {
    try {
      const { assignmentId } = req.params;
      
      // Validate assignment exists and is accessible
      const assignment = await this.assignmentService.getAssignment(assignmentId);
      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
      }

      // Check if submission is still allowed
      if (!await this.assignmentService.canSubmit(assignmentId, req.user.id)) {
        return res.status(403).json({ error: 'Submission not allowed' });
      }

      const submissionData = req.body;
      
      // Handle file uploads if present
      if (req.files && Array.isArray(req.files)) {
        const uploadedFiles = await this.fileUploadService.uploadFiles(
          req.files,
          `assignments/${assignmentId}/submissions/${req.user.id}`
        );
        submissionData.files = uploadedFiles;
      }

      const submission = await this.assignmentService.createSubmission({
        ...submissionData,
        assignmentId,
        studentId: req.user.id
      });

      // Trigger plagiarism check if enabled
      if (assignment.plagiarismCheck) {
        this.plagiarismService.checkPlagiarism(submission.id).catch(error => {
          logger.error('Plagiarism check failed:', error);
        });
      }

      // Auto-grade if enabled and applicable
      if (assignment.autoGrade) {
        this.gradingService.autoGrade(submission.id).catch(error => {
          logger.error('Auto-grading failed:', error);
        });
      }

      logger.info(`Submission created: ${submission.id} for assignment: ${assignmentId}`);
      res.status(201).json(submission);
    } catch (error) {
      logger.error('Error creating submission:', error);
      res.status(500).json({ error: 'Failed to create submission' });
    }
  }

  async getSubmissions(req: Request, res: Response) {
    try {
      const { assignmentId } = req.params;
      const { page = 1, limit = 10, status, graded } = req.query;

      // Check permissions - instructors can see all submissions, students only their own
      const assignment = await this.assignmentService.getAssignment(assignmentId);
      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
      }

      const isInstructor = assignment.createdBy === req.user.id || req.user.role === UserRole.ADMIN;
      
      const submissions = await this.assignmentService.getSubmissions({
        assignmentId,
        page: Number(page),
        limit: Number(limit),
        status: status as string,
        graded: graded === 'true',
        userId: isInstructor ? undefined : req.user.id,
        isInstructor
      });

      res.json(submissions);
    } catch (error) {
      logger.error('Error fetching submissions:', error);
      res.status(500).json({ error: 'Failed to fetch submissions' });
    }
  }

  async getSubmission(req: Request, res: Response) {
    try {
      const { submissionId } = req.params;
      
      const submission = await this.assignmentService.getSubmission(
        submissionId,
        req.user.id,
        req.user.role
      );

      if (!submission) {
        return res.status(404).json({ error: 'Submission not found' });
      }

      res.json(submission);
    } catch (error) {
      logger.error('Error fetching submission:', error);
      res.status(500).json({ error: 'Failed to fetch submission' });
    }
  }

  async updateSubmission(req: Request, res: Response) {
    try {
      const { submissionId } = req.params;
      const updateData = req.body;

      const submission = await this.assignmentService.getSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ error: 'Submission not found' });
      }

      // Students can only update their own draft submissions
      if (submission.studentId !== req.user.id || submission.status !== 'draft') {
        return res.status(403).json({ error: 'Cannot update submission' });
      }

      // Handle file uploads if present
      if (req.files && Array.isArray(req.files)) {
        const uploadedFiles = await this.fileUploadService.uploadFiles(
          req.files,
          `assignments/${submission.assignmentId}/submissions/${req.user.id}`
        );
        updateData.files = [...(submission.files || []), ...uploadedFiles];
      }

      const updatedSubmission = await this.assignmentService.updateSubmission(
        submissionId,
        updateData
      );

      logger.info(`Submission updated: ${submissionId} by ${req.user.id}`);
      res.json(updatedSubmission);
    } catch (error) {
      logger.error('Error updating submission:', error);
      res.status(500).json({ error: 'Failed to update submission' });
    }
  }

  async submitAssignment(req: Request, res: Response) {
    try {
      const { submissionId } = req.params;

      const submission = await this.assignmentService.getSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ error: 'Submission not found' });
      }

      if (submission.studentId !== req.user.id) {
        return res.status(403).json({ error: 'Cannot submit assignment' });
      }

      const submittedSubmission = await this.assignmentService.submitSubmission(submissionId);

      // Trigger plagiarism check if enabled
      const assignment = await this.assignmentService.getAssignment(submission.assignmentId);
      if (assignment?.plagiarismCheck) {
        this.plagiarismService.checkPlagiarism(submissionId).catch(error => {
          logger.error('Plagiarism check failed:', error);
        });
      }

      // Auto-grade if enabled
      if (assignment?.autoGrade) {
        this.gradingService.autoGrade(submissionId).catch(error => {
          logger.error('Auto-grading failed:', error);
        });
      }

      logger.info(`Assignment submitted: ${submissionId} by ${req.user.id}`);
      res.json(submittedSubmission);
    } catch (error) {
      logger.error('Error submitting assignment:', error);
      res.status(500).json({ error: 'Failed to submit assignment' });
    }
  }

  // Grading Management
  async gradeSubmission(req: Request, res: Response) {
    try {
      const { submissionId } = req.params;
      const gradingData = req.body;

      // Check permissions
      const submission = await this.assignmentService.getSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ error: 'Submission not found' });
      }

      const assignment = await this.assignmentService.getAssignment(submission.assignmentId);
      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
      }

      if (assignment.createdBy !== req.user.id && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const grade = await this.gradingService.gradeSubmission({
        ...gradingData,
        submissionId,
        gradedBy: req.user.id
      });

      // Notify student
      await this.notificationService.notifyGradeCreated(grade);

      logger.info(`Submission graded: ${submissionId} by ${req.user.id}`);
      res.status(201).json(grade);
    } catch (error) {
      logger.error('Error grading submission:', error);
      res.status(500).json({ error: 'Failed to grade submission' });
    }
  }

  async getGrades(req: Request, res: Response) {
    try {
      const { assignmentId } = req.params;
      const { page = 1, limit = 10, status } = req.query;

      // Check permissions
      const assignment = await this.assignmentService.getAssignment(assignmentId);
      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
      }

      if (assignment.createdBy !== req.user.id && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const grades = await this.gradingService.getGrades({
        assignmentId,
        page: Number(page),
        limit: Number(limit),
        status: status as string
      });

      res.json(grades);
    } catch (error) {
      logger.error('Error fetching grades:', error);
      res.status(500).json({ error: 'Failed to fetch grades' });
    }
  }

  // Statistics and Analytics
  async getAssignmentStats(req: Request, res: Response) {
    try {
      const { assignmentId } = req.params;

      // Check permissions
      const assignment = await this.assignmentService.getAssignment(assignmentId);
      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
      }

      if (assignment.createdBy !== req.user.id && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const stats: AssignmentStats = await this.assignmentService.getAssignmentStats(assignmentId);

      res.json(stats);
    } catch (error) {
      logger.error('Error fetching assignment stats:', error);
      res.status(500).json({ error: 'Failed to fetch assignment stats' });
    }
  }

  async getStudentProgress(req: Request, res: Response) {
    try {
      const { courseId } = req.params;

      const progress: StudentAssignmentProgress[] = 
        await this.assignmentService.getStudentProgress(courseId, req.user.id);

      res.json(progress);
    } catch (error) {
      logger.error('Error fetching student progress:', error);
      res.status(500).json({ error: 'Failed to fetch student progress' });
    }
  }

  // Bulk Operations
  async bulkGrade(req: Request, res: Response) {
    try {
      const { assignmentId } = req.params;
      const { operation, criteria, gradingData } = req.body;

      // Check permissions
      const assignment = await this.assignmentService.getAssignment(assignmentId);
      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
      }

      if (assignment.createdBy !== req.user.id && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const operationId = await this.gradingService.startBulkGrading({
        assignmentId,
        operation,
        criteria,
        gradingData,
        instructorId: req.user.id
      });

      logger.info(`Bulk grading started: ${operationId} for assignment: ${assignmentId}`);
      res.status(202).json({ operationId });
    } catch (error) {
      logger.error('Error starting bulk grading:', error);
      res.status(500).json({ error: 'Failed to start bulk grading' });
    }
  }
}
