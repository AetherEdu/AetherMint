/**
 * Assignment Grading Service
 * Handles grading workflows, rubric evaluation, and grade management for assignments
 */

import { 
  Grade, 
  GradingStatus, 
  RubricGrade, 
  Annotation, 
  GradeAppeal,
  BulkGradingOperation,
  Submission
} from '../models/Assignment';
import { v4 as uuidv4 } from 'uuid';

export interface GradingData {
  submissionId: string;
  gradedBy: string;
  totalPoints: number;
  earnedPoints: number;
  feedback?: string;
  privateFeedback?: string;
  rubricGrades?: RubricGrade[];
  annotations?: Annotation[];
}

export interface BulkGradingData {
  assignmentId: string;
  operation: 'apply_rubric' | 'apply_late_penalty' | 'bulk_feedback' | 'auto_grade';
  criteria?: any;
  gradingData?: any;
  instructorId: string;
}

export class AssignmentGradingService {
  // Mock database - in real implementation, this would use actual database
  private grades: Map<string, Grade> = new Map();
  private bulkOperations: Map<string, BulkGradingOperation> = new Map();

  async gradeSubmission(gradingData: GradingData): Promise<Grade> {
    // Validate grading data
    if (gradingData.earnedPoints > gradingData.totalPoints) {
      throw new Error('Earned points cannot exceed total points');
    }

    const percentage = (gradingData.earnedPoints / gradingData.totalPoints) * 100;
    const letterGrade = this.calculateLetterGrade(percentage);

    const grade: Grade = {
      id: uuidv4(),
      submissionId: gradingData.submissionId,
      assignmentId: '', // Will be filled from submission
      studentId: '', // Will be filled from submission
      gradedBy: gradingData.gradedBy,
      status: GradingStatus.GRADED,
      totalPoints: gradingData.totalPoints,
      earnedPoints: gradingData.earnedPoints,
      percentage,
      letterGrade,
      rubricGrades: gradingData.rubricGrades || [],
      feedback: gradingData.feedback,
      privateFeedback: gradingData.privateFeedback,
      annotations: gradingData.annotations || [],
      gradedAt: new Date(),
      returnedAt: new Date(),
      lastModifiedBy: gradingData.gradedBy,
      lastModifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.grades.set(grade.id, grade);
    return grade;
  }

  async updateGrade(
    gradeId: string, 
    updateData: Partial<Grade>, 
    modifiedBy: string
  ): Promise<Grade> {
    const existingGrade = this.grades.get(gradeId);
    
    if (!existingGrade) {
      throw new Error('Grade not found');
    }

    // Recalculate percentage and letter grade if points changed
    let percentage = existingGrade.percentage;
    let letterGrade = existingGrade.letterGrade;

    if (updateData.earnedPoints !== undefined || updateData.totalPoints !== undefined) {
      const totalPoints = updateData.totalPoints || existingGrade.totalPoints;
      const earnedPoints = updateData.earnedPoints || existingGrade.earnedPoints;
      
      if (earnedPoints > totalPoints) {
        throw new Error('Earned points cannot exceed total points');
      }

      percentage = (earnedPoints / totalPoints) * 100;
      letterGrade = this.calculateLetterGrade(percentage);
    }

    const updatedGrade: Grade = {
      ...existingGrade,
      ...updateData,
      percentage,
      letterGrade,
      lastModifiedBy: modifiedBy,
      lastModifiedAt: new Date(),
      updatedAt: new Date()
    };

    this.grades.set(gradeId, updatedGrade);
    return updatedGrade;
  }

  async getGrade(gradeId: string): Promise<Grade | null> {
    return this.grades.get(gradeId) || null;
  }

  async getGrades(filters: {
    assignmentId: string;
    page: number;
    limit: number;
    status?: string;
  }): Promise<{
    grades: Grade[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    let grades = Array.from(this.grades.values());

    // Filter by assignment
    grades = grades.filter(g => g.assignmentId === filters.assignmentId);

    // Filter by status
    if (filters.status) {
      grades = grades.filter(g => g.status === filters.status);
    }

    // Sort by graded date (newest first)
    grades.sort((a, b) => {
      const dateA = a.gradedAt || a.createdAt;
      const dateB = b.gradedAt || b.createdAt;
      return dateB.getTime() - dateA.getTime();
    });

    const total = grades.length;
    const startIndex = (filters.page - 1) * filters.limit;
    const endIndex = startIndex + filters.limit;
    const paginatedGrades = grades.slice(startIndex, endIndex);

    return {
      grades: paginatedGrades,
      total,
      page: filters.page,
      limit: filters.limit,
      hasMore: endIndex < total
    };
  }

  async getGradeBySubmission(submissionId: string): Promise<Grade | null> {
    const grades = Array.from(this.grades.values());
    return grades.find(g => g.submissionId === submissionId) || null;
  }

  async applyRubricGrading(
    submissionId: string,
    rubricGrades: RubricGrade[],
    gradedBy: string
  ): Promise<Grade> {
    // Calculate total points from rubric
    let totalEarnedPoints = 0;
    let totalPoints = 0;

    for (const rubricGrade of rubricGrades) {
      totalEarnedPoints += rubricGrade.points;
      // In a real implementation, you'd get max points from the rubric criterion
      totalPoints += rubricGrade.points; // Simplified for demo
    }

    const grade = await this.gradeSubmission({
      submissionId,
      gradedBy,
      totalPoints,
      earnedPoints: totalEarnedPoints,
      rubricGrades
    });

    return grade;
  }

  async applyLatePenalty(
    gradeId: string,
    penaltyPercentage: number,
    reason: string
  ): Promise<Grade> {
    const grade = this.grades.get(gradeId);
    
    if (!grade) {
      throw new Error('Grade not found');
    }

    const penaltyAmount = (grade.earnedPoints * penaltyPercentage) / 100;
    const newEarnedPoints = Math.max(0, grade.earnedPoints - penaltyAmount);
    const newPercentage = (newEarnedPoints / grade.totalPoints) * 100;

    const updatedGrade: Grade = {
      ...grade,
      earnedPoints: newEarnedPoints,
      percentage: newPercentage,
      letterGrade: this.calculateLetterGrade(newPercentage),
      feedback: `${grade.feedback || ''}\n\nLate penalty applied: ${penaltyPercentage}% (${reason})`,
      lastModifiedAt: new Date(),
      updatedAt: new Date()
    };

    this.grades.set(gradeId, updatedGrade);
    return updatedGrade;
  }

  async startBulkGrading(bulkData: BulkGradingData): Promise<string> {
    const operationId = uuidv4();
    
    const operation: BulkGradingOperation = {
      id: operationId,
      assignmentId: bulkData.assignmentId,
      instructorId: bulkData.instructorId,
      operation: bulkData.operation,
      status: 'pending',
      totalSubmissions: 0, // Will be calculated
      processedSubmissions: 0,
      errors: [],
      createdAt: new Date()
    };

    this.bulkOperations.set(operationId, operation);

    // Start bulk grading in background
    this.processBulkGrading(operationId, bulkData).catch(error => {
      console.error('Bulk grading failed:', error);
    });

    return operationId;
  }

  async getBulkGradingStatus(operationId: string): Promise<BulkGradingOperation | null> {
    return this.bulkOperations.get(operationId) || null;
  }

  async submitGradeAppeal(
    gradeId: string,
    reason: string,
    description: string,
    studentId: string
  ): Promise<GradeAppeal> {
    const grade = this.grades.get(gradeId);
    
    if (!grade) {
      throw new Error('Grade not found');
    }

    const appeal: GradeAppeal = {
      id: uuidv4(),
      reason,
      description,
      status: 'pending',
      submittedAt: new Date(),
      originalGrade: grade.earnedPoints
    };

    const updatedGrade: Grade = {
      ...grade,
      status: GradingStatus.APPEALED,
      appeal,
      updatedAt: new Date()
    };

    this.grades.set(gradeId, updatedGrade);
    return appeal;
  }

  async reviewGradeAppeal(
    gradeId: string,
    approved: boolean,
    reviewComments: string,
    reviewedBy: string,
    newGrade?: number
  ): Promise<Grade> {
    const grade = this.grades.get(gradeId);
    
    if (!grade || !grade.appeal) {
      throw new Error('Grade or appeal not found');
    }

    const updatedAppeal: GradeAppeal = {
      ...grade.appeal,
      status: approved ? 'approved' : 'rejected',
      reviewedAt: new Date(),
      reviewedBy,
      reviewComments,
      newGrade: approved && newGrade ? newGrade : undefined
    };

    let updatedGrade: Grade = {
      ...grade,
      appeal: updatedAppeal,
      updatedAt: new Date()
    };

    if (approved && newGrade !== undefined) {
      const newPercentage = (newGrade / grade.totalPoints) * 100;
      updatedGrade = {
        ...updatedGrade,
        earnedPoints: newGrade,
        percentage: newPercentage,
        letterGrade: this.calculateLetterGrade(newPercentage),
        lastModifiedBy: reviewedBy,
        lastModifiedAt: new Date()
      };
    } else {
      updatedGrade.status = GradingStatus.GRADED;
    }

    this.grades.set(gradeId, updatedGrade);
    return updatedGrade;
  }

  async addAnnotation(
    gradeId: string,
    annotation: Omit<Annotation, 'id' | 'createdAt'>,
    author: string
  ): Promise<Grade> {
    const grade = this.grades.get(gradeId);
    
    if (!grade) {
      throw new Error('Grade not found');
    }

    const newAnnotation: Annotation = {
      ...annotation,
      id: uuidv4(),
      createdAt: new Date()
    };

    const updatedGrade: Grade = {
      ...grade,
      annotations: [...grade.annotations, newAnnotation],
      lastModifiedBy: author,
      lastModifiedAt: new Date(),
      updatedAt: new Date()
    };

    this.grades.set(gradeId, updatedGrade);
    return updatedGrade;
  }

  async removeAnnotation(gradeId: string, annotationId: string): Promise<Grade> {
    const grade = this.grades.get(gradeId);
    
    if (!grade) {
      throw new Error('Grade not found');
    }

    const updatedGrade: Grade = {
      ...grade,
      annotations: grade.annotations.filter(a => a.id !== annotationId),
      updatedAt: new Date()
    };

    this.grades.set(gradeId, updatedGrade);
    return updatedGrade;
  }

  async calculateClassStatistics(assignmentId: string): Promise<{
    average: number;
    median: number;
    highest: number;
    lowest: number;
    distribution: { [key: string]: number };
    totalGraded: number;
  }> {
    const grades = Array.from(this.grades.values())
      .filter(g => g.assignmentId === assignmentId && g.status === GradingStatus.GRADED);

    if (grades.length === 0) {
      return {
        average: 0,
        median: 0,
        highest: 0,
        lowest: 0,
        distribution: {},
        totalGraded: 0
      };
    }

    const percentages = grades.map(g => g.percentage).sort((a, b) => a - b);
    const average = percentages.reduce((sum, p) => sum + p, 0) / percentages.length;
    const median = percentages[Math.floor(percentages.length / 2)];
    const highest = Math.max(...percentages);
    const lowest = Math.min(...percentages);

    // Calculate grade distribution
    const distribution = {
      'A (90-100)': percentages.filter(p => p >= 90).length,
      'B (80-89)': percentages.filter(p => p >= 80 && p < 90).length,
      'C (70-79)': percentages.filter(p => p >= 70 && p < 80).length,
      'D (60-69)': percentages.filter(p => p >= 60 && p < 70).length,
      'F (0-59)': percentages.filter(p => p < 60).length
    };

    return {
      average,
      median,
      highest,
      lowest,
      distribution,
      totalGraded: grades.length
    };
  }

  private calculateLetterGrade(percentage: number): string {
    if (percentage >= 97) return 'A+';
    if (percentage >= 93) return 'A';
    if (percentage >= 90) return 'A-';
    if (percentage >= 87) return 'B+';
    if (percentage >= 83) return 'B';
    if (percentage >= 80) return 'B-';
    if (percentage >= 77) return 'C+';
    if (percentage >= 73) return 'C';
    if (percentage >= 70) return 'C-';
    if (percentage >= 67) return 'D+';
    if (percentage >= 63) return 'D';
    if (percentage >= 60) return 'D-';
    return 'F';
  }

  private async processBulkGrading(
    operationId: string, 
    bulkData: BulkGradingData
  ): Promise<void> {
    const operation = this.bulkOperations.get(operationId);
    if (!operation) return;

    try {
      // Update status to in progress
      operation.status = 'in_progress';
      operation.startedAt = new Date();

      // In a real implementation, you would:
      // 1. Get all submissions for the assignment
      // 2. Process each submission based on the operation type
      // 3. Update progress and handle errors

      // Mock processing for demo
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing

      operation.status = 'completed';
      operation.completedAt = new Date();
      operation.processedSubmissions = operation.totalSubmissions;

    } catch (error) {
      operation.status = 'failed';
      operation.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    this.bulkOperations.set(operationId, operation);
  }
}

export default new AssignmentGradingService();
