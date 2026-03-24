/**
 * Assignment Service
 * Handles all assignment-related business logic
 */

import { 
  Assignment, 
  AssignmentType, 
  SubmissionType, 
  LatePolicy,
  AssignmentStats,
  StudentAssignmentProgress,
  Submission,
  Grade
} from '../models/Assignment';
import { v4 as uuidv4 } from 'uuid';

export interface AssignmentFilters {
  courseId: string;
  page: number;
  limit: number;
  status?: string;
  type?: AssignmentType;
  userId?: string;
  userRole?: string;
}

export interface SubmissionFilters {
  assignmentId: string;
  page: number;
  limit: number;
  status?: string;
  graded?: boolean;
  userId?: string;
  isInstructor?: boolean;
}

export interface GradeFilters {
  assignmentId: string;
  page: number;
  limit: number;
  status?: string;
}

export class AssignmentService {
  // Mock database - in real implementation, this would use actual database
  private assignments: Map<string, Assignment> = new Map();
  private submissions: Map<string, Submission> = new Map();
  private grades: Map<string, Grade> = new Map();

  async createAssignment(assignmentData: Partial<Assignment>): Promise<Assignment> {
    const assignment: Assignment = {
      id: uuidv4(),
      courseId: assignmentData.courseId!,
      title: assignmentData.title!,
      description: assignmentData.description!,
      instructions: assignmentData.instructions!,
      type: assignmentData.type!,
      submissionTypes: assignmentData.submissionTypes!,
      maxPoints: assignmentData.maxPoints!,
      rubric: assignmentData.rubric,
      dueDate: assignmentData.dueDate!,
      allowLateSubmissions: assignmentData.allowLateSubmissions || false,
      latePolicy: assignmentData.latePolicy,
      latePenaltyAmount: assignmentData.latePenaltyAmount,
      maxAttempts: assignmentData.maxAttempts,
      timeLimit: assignmentData.timeLimit,
      allowedFileTypes: assignmentData.allowedFileTypes,
      maxFileSize: assignmentData.maxFileSize,
      maxFiles: assignmentData.maxFiles,
      isPublished: assignmentData.isPublished || false,
      showSolutions: assignmentData.showSolutions,
      autoGrade: assignmentData.autoGrade,
      plagiarismCheck: assignmentData.plagiarismCheck || true,
      groupAssignment: assignmentData.groupAssignment,
      maxGroupSize: assignmentData.maxGroupSize,
      resources: assignmentData.resources || [],
      createdBy: assignmentData.createdBy!,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.assignments.set(assignment.id, assignment);
    return assignment;
  }

  async getAssignments(filters: AssignmentFilters): Promise<{
    assignments: Assignment[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    let assignments = Array.from(this.assignments.values());

    // Filter by course
    assignments = assignments.filter(a => a.courseId === filters.courseId);

    // Filter by type
    if (filters.type) {
      assignments = assignments.filter(a => a.type === filters.type);
    }

    // Filter by status (published/unpublished)
    if (filters.status === 'published') {
      assignments = assignments.filter(a => a.isPublished);
    } else if (filters.status === 'draft') {
      assignments = assignments.filter(a => !a.isPublished);
    }

    // For students, only show published assignments
    if (filters.userRole === 'student') {
      assignments = assignments.filter(a => a.isPublished);
    }

    // Sort by creation date (newest first)
    assignments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = assignments.length;
    const startIndex = (filters.page - 1) * filters.limit;
    const endIndex = startIndex + filters.limit;
    const paginatedAssignments = assignments.slice(startIndex, endIndex);

    return {
      assignments: paginatedAssignments,
      total,
      page: filters.page,
      limit: filters.limit,
      hasMore: endIndex < total
    };
  }

  async getAssignment(
    assignmentId: string, 
    userId?: string, 
    userRole?: string
  ): Promise<Assignment | null> {
    const assignment = this.assignments.get(assignmentId);
    
    if (!assignment) {
      return null;
    }

    // Students can only access published assignments
    if (userRole === 'student' && !assignment.isPublished) {
      return null;
    }

    return assignment;
  }

  async updateAssignment(
    assignmentId: string, 
    updateData: Partial<Assignment>
  ): Promise<Assignment> {
    const assignment = this.assignments.get(assignmentId);
    
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    const updatedAssignment = {
      ...assignment,
      ...updateData,
      updatedAt: new Date()
    };

    this.assignments.set(assignmentId, updatedAssignment);
    return updatedAssignment;
  }

  async deleteAssignment(assignmentId: string): Promise<void> {
    const assignment = this.assignments.get(assignmentId);
    
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    // Delete related submissions and grades
    const submissions = Array.from(this.submissions.values())
      .filter(s => s.assignmentId === assignmentId);
    
    submissions.forEach(submission => {
      this.submissions.delete(submission.id);
      this.grades.delete(submission.id);
    });

    this.assignments.delete(assignmentId);
  }

  async canSubmit(assignmentId: string, studentId: string): Promise<boolean> {
    const assignment = this.assignments.get(assignmentId);
    
    if (!assignment || !assignment.isPublished) {
      return false;
    }

    // Check if due date has passed and late submissions are not allowed
    if (new Date() > assignment.dueDate && !assignment.allowLateSubmissions) {
      return false;
    }

    // Check max attempts
    if (assignment.maxAttempts) {
      const existingSubmissions = Array.from(this.submissions.values())
        .filter(s => s.assignmentId === assignmentId && s.studentId === studentId && s.status === 'submitted');
      
      if (existingSubmissions.length >= assignment.maxAttempts) {
        return false;
      }
    }

    return true;
  }

  async createSubmission(submissionData: Partial<Submission>): Promise<Submission> {
    const assignment = this.assignments.get(submissionData.assignmentId!);
    
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    const isLate = new Date() > assignment.dueDate;
    let latePenaltyApplied = 0;

    if (isLate && assignment.allowLateSubmissions && assignment.latePolicy && assignment.latePenaltyAmount) {
      // Calculate late penalty based on policy
      const now = new Date();
      const hoursLate = Math.ceil((now.getTime() - assignment.dueDate.getTime()) / (1000 * 60 * 60));
      
      if (assignment.latePolicy === LatePolicy.PENALTY_PER_HOUR) {
        latePenaltyApplied = Math.min(hoursLate * assignment.latePenaltyAmount, 100);
      } else if (assignment.latePolicy === LatePolicy.PENALTY_PER_DAY) {
        const daysLate = Math.ceil(hoursLate / 24);
        latePenaltyApplied = Math.min(daysLate * assignment.latePenaltyAmount, 100);
      }
    }

    const submission: Submission = {
      id: uuidv4(),
      assignmentId: submissionData.assignmentId!,
      studentId: submissionData.studentId!,
      groupId: submissionData.groupId,
      attemptNumber: this.getNextAttemptNumber(submissionData.assignmentId!, submissionData.studentId!),
      status: 'draft',
      submittedAt: undefined,
      isLate,
      latePenaltyApplied: isLate ? latePenaltyApplied : undefined,
      textContent: submissionData.textContent,
      files: submissionData.files || [],
      codeSubmission: submissionData.codeSubmission,
      videoSubmission: submissionData.videoSubmission,
      audioSubmission: submissionData.audioSubmission,
      lastSavedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.submissions.set(submission.id, submission);
    return submission;
  }

  async getSubmissions(filters: SubmissionFilters): Promise<{
    submissions: Submission[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    let submissions = Array.from(this.submissions.values());

    // Filter by assignment
    submissions = submissions.filter(s => s.assignmentId === filters.assignmentId);

    // Filter by user (for students viewing their own submissions)
    if (filters.userId) {
      submissions = submissions.filter(s => s.studentId === filters.userId);
    }

    // Filter by status
    if (filters.status) {
      submissions = submissions.filter(s => s.status === filters.status);
    }

    // Filter by graded status
    if (filters.graded !== undefined) {
      const gradedSubmissionIds = Array.from(this.grades.keys());
      if (filters.graded) {
        submissions = submissions.filter(s => gradedSubmissionIds.includes(s.id));
      } else {
        submissions = submissions.filter(s => !gradedSubmissionIds.includes(s.id));
      }
    }

    // Sort by submission date (newest first)
    submissions.sort((a, b) => {
      const dateA = a.submittedAt || a.updatedAt;
      const dateB = b.submittedAt || b.updatedAt;
      return dateB.getTime() - dateA.getTime();
    });

    const total = submissions.length;
    const startIndex = (filters.page - 1) * filters.limit;
    const endIndex = startIndex + filters.limit;
    const paginatedSubmissions = submissions.slice(startIndex, endIndex);

    return {
      submissions: paginatedSubmissions,
      total,
      page: filters.page,
      limit: filters.limit,
      hasMore: endIndex < total
    };
  }

  async getSubmission(
    submissionId: string, 
    userId?: string, 
    userRole?: string
  ): Promise<Submission | null> {
    const submission = this.submissions.get(submissionId);
    
    if (!submission) {
      return null;
    }

    // Students can only access their own submissions
    if (userRole === 'student' && submission.studentId !== userId) {
      return null;
    }

    return submission;
  }

  async updateSubmission(
    submissionId: string, 
    updateData: Partial<Submission>
  ): Promise<Submission> {
    const submission = this.submissions.get(submissionId);
    
    if (!submission) {
      throw new Error('Submission not found');
    }

    if (submission.status !== 'draft') {
      throw new Error('Cannot update submitted assignment');
    }

    const updatedSubmission = {
      ...submission,
      ...updateData,
      lastSavedAt: new Date(),
      updatedAt: new Date()
    };

    this.submissions.set(submissionId, updatedSubmission);
    return updatedSubmission;
  }

  async submitSubmission(submissionId: string): Promise<Submission> {
    const submission = this.submissions.get(submissionId);
    
    if (!submission) {
      throw new Error('Submission not found');
    }

    if (submission.status !== 'draft') {
      throw new Error('Submission has already been submitted');
    }

    const updatedSubmission = {
      ...submission,
      status: 'submitted' as const,
      submittedAt: new Date(),
      updatedAt: new Date()
    };

    this.submissions.set(submissionId, updatedSubmission);
    return updatedSubmission;
  }

  async getAssignmentStats(assignmentId: string): Promise<AssignmentStats> {
    const submissions = Array.from(this.submissions.values())
      .filter(s => s.assignmentId === assignmentId);
    
    const grades = Array.from(this.grades.values())
      .filter(g => submissions.some(s => s.id === g.submissionId));

    const totalSubmissions = submissions.length;
    const gradedSubmissions = grades.length;
    const averageGrade = gradedSubmissions > 0 
      ? grades.reduce((sum, grade) => sum + grade.percentage, 0) / gradedSubmissions 
      : 0;
    
    // Calculate average time to grade (mock calculation)
    const averageTimeToGrade = gradedSubmissions > 0 ? 24 : 0; // 24 hours average
    
    const lateSubmissions = submissions.filter(s => s.isLate).length;
    const plagiarismFlags = submissions.filter(s => s.plagiarismScore && s.plagiarismScore > 0.3).length;

    return {
      totalSubmissions,
      gradedSubmissions,
      averageGrade,
      averageTimeToGrade,
      lateSubmissions,
      plagiarismFlags
    };
  }

  async getStudentProgress(courseId: string, studentId: string): Promise<StudentAssignmentProgress[]> {
    const courseAssignments = Array.from(this.assignments.values())
      .filter(a => a.courseId === courseId && a.isPublished);

    const progress: StudentAssignmentProgress[] = [];

    for (const assignment of courseAssignments) {
      const submission = Array.from(this.submissions.values())
        .find(s => s.assignmentId === assignment.id && s.studentId === studentId);
      
      const grade = submission ? this.grades.get(submission.id) : undefined;

      progress.push({
        assignmentId: assignment.id,
        status: submission ? (grade ? 'graded' : 'submitted') : 'not_started',
        lastAccessedAt: submission?.updatedAt || new Date(),
        timeSpent: 0, // Would be tracked in real implementation
        attempts: submission ? submission.attemptNumber : 0,
        currentGrade: grade?.percentage,
        feedbackRead: false // Would be tracked in real implementation
      });
    }

    return progress;
  }

  private getNextAttemptNumber(assignmentId: string, studentId: string): number {
    const existingSubmissions = Array.from(this.submissions.values())
      .filter(s => s.assignmentId === assignmentId && s.studentId === studentId && s.status === 'submitted');
    
    return existingSubmissions.length + 1;
  }
}
