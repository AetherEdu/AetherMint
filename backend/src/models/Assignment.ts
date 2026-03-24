/**
 * Assignment Model
 * Defines the structure and interfaces for assignment data
 */

import { User } from './User';

export enum AssignmentType {
  QUIZ = 'quiz',
  ESSAY = 'essay',
  CODE = 'code',
  PROJECT = 'project',
  VIDEO = 'video',
  FILE_UPLOAD = 'file_upload',
  TEXT_SUBMISSION = 'text_submission'
}

export enum SubmissionType {
  TEXT = 'text',
  FILE = 'file',
  CODE = 'code',
  VIDEO = 'video',
  AUDIO = 'audio',
  MULTIPLE_FILES = 'multiple_files'
}

export enum GradingStatus {
  NOT_GRADED = 'not_graded',
  GRADING_IN_PROGRESS = 'grading_in_progress',
  GRADED = 'graded',
  NEEDS_REVIEW = 'needs_review',
  APPEALED = 'appealed'
}

export enum LatePolicy {
  NO_LATE_SUBMISSIONS = 'no_late_submissions',
  PENALTY_PER_HOUR = 'penalty_per_hour',
  PENALTY_PER_DAY = 'penalty_per_day',
  NO_PENALTY = 'no_penalty'
}

export interface AssignmentFile {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: Date;
}

export interface RubricCriterion {
  id: string;
  title: string;
  description: string;
  maxPoints: number;
  weight: number; // Percentage weight in total grade
  levels: RubricLevel[];
}

export interface RubricLevel {
  id: string;
  name: string;
  description: string;
  points: number;
}

export interface Rubric {
  id: string;
  title: string;
  description?: string;
  totalPoints: number;
  criteria: RubricCriterion[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  description: string;
  instructions: string;
  type: AssignmentType;
  submissionTypes: SubmissionType[];
  maxPoints: number;
  rubric?: Rubric;
  dueDate: Date;
  allowLateSubmissions: boolean;
  latePolicy?: LatePolicy;
  latePenaltyAmount?: number; // Penalty percentage
  maxAttempts?: number;
  timeLimit?: number; // in minutes
  allowedFileTypes?: string[];
  maxFileSize?: number; // in MB
  maxFiles?: number;
  isPublished: boolean;
  showSolutions?: Date;
  autoGrade?: boolean;
  plagiarismCheck: boolean;
  groupAssignment?: boolean;
  maxGroupSize?: number;
  resources: AssignmentResource[];
  createdBy: string; // Instructor ID
  createdAt: Date;
  updatedAt: Date;
}

export interface AssignmentResource {
  id: string;
  title: string;
  description?: string;
  type: 'file' | 'link' | 'video' | 'text';
  url?: string;
  content?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  groupId?: string;
  attemptNumber: number;
  status: 'draft' | 'submitted' | 'returned' | 'graded';
  submittedAt?: Date;
  isLate: boolean;
  latePenaltyApplied?: number;
  textContent?: string;
  files: AssignmentFile[];
  codeSubmission?: CodeSubmission;
  videoSubmission?: VideoSubmission;
  audioSubmission?: AudioSubmission;
  plagiarismScore?: number;
  plagiarismReport?: PlagiarismReport;
  lastSavedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CodeSubmission {
  id: string;
  language: string;
  code: string;
  fileName?: string;
  testResults?: CodeTestResult[];
  compiledSuccessfully?: boolean;
  compilationError?: string;
  executionOutput?: string;
}

export interface CodeTestResult {
  id: string;
  testName: string;
  passed: boolean;
  input?: string;
  expectedOutput?: string;
  actualOutput?: string;
  executionTime?: number;
  errorMessage?: string;
}

export interface VideoSubmission {
  id: string;
  url: string;
  duration: number; // in seconds
  thumbnail?: string;
  fileSize: number;
  format: string;
}

export interface AudioSubmission {
  id: string;
  url: string;
  duration: number; // in seconds
  fileSize: number;
  format: string;
  transcription?: string;
}

export interface PlagiarismReport {
  id: string;
  overallScore: number;
  sources: PlagiarismSource[];
  generatedAt: Date;
  status: 'pending' | 'completed' | 'failed';
}

export interface PlagiarismSource {
  id: string;
  url: string;
  title: string;
  similarityScore: number;
  matchedText: string;
}

export interface Grade {
  id: string;
  submissionId: string;
  assignmentId: string;
  studentId: string;
  gradedBy: string; // Instructor ID
  status: GradingStatus;
  totalPoints: number;
  earnedPoints: number;
  percentage: number;
  letterGrade?: string;
  rubricGrades: RubricGrade[];
  feedback?: string;
  privateFeedback?: string;
  annotations: Annotation[];
  gradedAt?: Date;
  returnedAt?: Date;
  lastModifiedBy?: string;
  lastModifiedAt?: Date;
  appeal?: GradeAppeal;
  createdAt: Date;
  updatedAt: Date;
}

export interface RubricGrade {
  criterionId: string;
  levelId: string;
  points: number;
  feedback?: string;
}

export interface Annotation {
  id: string;
  type: 'text' | 'drawing' | 'highlight' | 'comment';
  content: string;
  position: {
    x: number;
    y: number;
    page?: number;
    selection?: {
      start: number;
      end: number;
    };
  };
  author: string;
  createdAt: Date;
}

export interface GradeAppeal {
  id: string;
  reason: string;
  description: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewComments?: string;
  originalGrade?: number;
  newGrade?: number;
}

export interface AssignmentStats {
  totalSubmissions: number;
  gradedSubmissions: number;
  averageGrade: number;
  averageTimeToGrade: number; // in hours
  lateSubmissions: number;
  plagiarismFlags: number;
}

export interface StudentAssignmentProgress {
  assignmentId: string;
  status: 'not_started' | 'in_progress' | 'submitted' | 'graded';
  lastAccessedAt: Date;
  timeSpent: number; // in minutes
  attempts: number;
  currentGrade?: number;
  feedbackRead: boolean;
}

export interface GroupAssignment {
  id: string;
  assignmentId: string;
  name: string;
  members: string[]; // Student IDs
  leaderId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssignmentNotification {
  id: string;
  type: 'assigned' | 'reminder' | 'graded' | 'returned' | 'overdue';
  assignmentId: string;
  recipientId: string;
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: Date;
  readAt?: Date;
}

export interface BulkGradingOperation {
  id: string;
  assignmentId: string;
  instructorId: string;
  operation: 'apply_rubric' | 'apply_late_penalty' | 'bulk_feedback' | 'auto_grade';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  totalSubmissions: number;
  processedSubmissions: number;
  errors: string[];
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}
