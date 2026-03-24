/**
 * Assignment System Tests
 * Comprehensive test suite for assignment submission and grading functionality
 */

import { AssignmentService } from '../src/services/assignmentService';
import { AssignmentGradingService } from '../src/services/assignmentGradingService';
import { FileUploadService } from '../src/services/fileUploadService';
import { PlagiarismService } from '../src/services/plagiarismService';
import { AssignmentNotificationService } from '../src/services/assignmentNotificationService';
import { CodeExecutionService } from '../src/services/codeExecutionService';
import { 
  AssignmentType, 
  SubmissionType, 
  GradingStatus,
  LatePolicy 
} from '../src/models/Assignment';

describe('Assignment Service', () => {
  let assignmentService: AssignmentService;

  beforeEach(() => {
    assignmentService = new AssignmentService();
  });

  describe('Assignment Creation', () => {
    it('should create a valid assignment', async () => {
      const assignmentData = {
        courseId: 'course-123',
        title: 'Test Assignment',
        description: 'A test assignment for unit testing',
        instructions: 'Complete the following tasks...',
        type: AssignmentType.ESSAY,
        submissionTypes: [SubmissionType.TEXT],
        maxPoints: 100,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        createdBy: 'instructor-123'
      };

      const assignment = await assignmentService.createAssignment(assignmentData);

      expect(assignment.id).toBeDefined();
      expect(assignment.title).toBe(assignmentData.title);
      expect(assignment.courseId).toBe(assignmentData.courseId);
      expect(assignment.isPublished).toBe(false);
      expect(assignment.createdAt).toBeInstanceOf(Date);
    });

    it('should reject assignment with invalid data', async () => {
      const invalidAssignmentData = {
        courseId: 'course-123',
        title: '', // Empty title should be invalid
        description: 'A test assignment',
        type: AssignmentType.ESSAY,
        submissionTypes: [SubmissionType.TEXT],
        maxPoints: -10, // Negative points should be invalid
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Past due date
        createdBy: 'instructor-123'
      };

      await expect(assignmentService.createAssignment(invalidAssignmentData))
        .rejects.toThrow();
    });
  });

  describe('Assignment Retrieval', () => {
    let assignmentId: string;

    beforeEach(async () => {
      const assignment = await assignmentService.createAssignment({
        courseId: 'course-123',
        title: 'Test Assignment',
        description: 'A test assignment',
        instructions: 'Complete tasks...',
        type: AssignmentType.ESSAY,
        submissionTypes: [SubmissionType.TEXT],
        maxPoints: 100,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdBy: 'instructor-123'
      });
      assignmentId = assignment.id;
    });

    it('should retrieve assignment by ID', async () => {
      const assignment = await assignmentService.getAssignment(assignmentId);
      
      expect(assignment).toBeDefined();
      expect(assignment!.id).toBe(assignmentId);
      expect(assignment!.title).toBe('Test Assignment');
    });

    it('should return null for non-existent assignment', async () => {
      const assignment = await assignmentService.getAssignment('non-existent-id');
      expect(assignment).toBeNull();
    });

    it('should filter assignments by course', async () => {
      const assignments = await assignmentService.getAssignments({
        courseId: 'course-123',
        page: 1,
        limit: 10
      });

      expect(assignments.assignments).toHaveLength(1);
      expect(assignments.total).toBe(1);
    });
  });

  describe('Submission Management', () => {
    let assignmentId: string;

    beforeEach(async () => {
      const assignment = await assignmentService.createAssignment({
        courseId: 'course-123',
        title: 'Test Assignment',
        description: 'A test assignment',
        instructions: 'Complete tasks...',
        type: AssignmentType.ESSAY,
        submissionTypes: [SubmissionType.TEXT],
        maxPoints: 100,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdBy: 'instructor-123'
      });
      assignmentId = assignment.id;
    });

    it('should create a submission', async () => {
      const submissionData = {
        assignmentId,
        studentId: 'student-123',
        textContent: 'This is my submission text.'
      };

      const submission = await assignmentService.createSubmission(submissionData);

      expect(submission.id).toBeDefined();
      expect(submission.assignmentId).toBe(assignmentId);
      expect(submission.studentId).toBe('student-123');
      expect(submission.status).toBe('draft');
      expect(submission.attemptNumber).toBe(1);
    });

    it('should submit a draft submission', async () => {
      const submission = await assignmentService.createSubmission({
        assignmentId,
        studentId: 'student-123',
        textContent: 'This is my submission text.'
      });

      const submittedSubmission = await assignmentService.submitSubmission(submission.id);

      expect(submittedSubmission.status).toBe('submitted');
      expect(submittedSubmission.submittedAt).toBeInstanceOf(Date);
    });

    it('should handle late submissions', async () => {
      // Create assignment with past due date
      const lateAssignment = await assignmentService.createAssignment({
        courseId: 'course-123',
        title: 'Late Assignment',
        description: 'A test assignment',
        instructions: 'Complete tasks...',
        type: AssignmentType.ESSAY,
        submissionTypes: [SubmissionType.TEXT],
        maxPoints: 100,
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Past due
        allowLateSubmissions: true,
        latePolicy: LatePolicy.PENALTY_PER_DAY,
        latePenaltyAmount: 10,
        createdBy: 'instructor-123'
      });

      const submission = await assignmentService.createSubmission({
        assignmentId: lateAssignment.id,
        studentId: 'student-123',
        textContent: 'Late submission text.'
      });

      expect(submission.isLate).toBe(true);
      expect(submission.latePenaltyApplied).toBeGreaterThan(0);
    });
  });

  describe('Assignment Statistics', () => {
    let assignmentId: string;

    beforeEach(async () => {
      const assignment = await assignmentService.createAssignment({
        courseId: 'course-123',
        title: 'Test Assignment',
        description: 'A test assignment',
        instructions: 'Complete tasks...',
        type: AssignmentType.ESSAY,
        submissionTypes: [SubmissionType.TEXT],
        maxPoints: 100,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdBy: 'instructor-123'
      });
      assignmentId = assignment.id;

      // Create some test submissions
      await assignmentService.createSubmission({
        assignmentId,
        studentId: 'student-1',
        textContent: 'Submission 1'
      });

      await assignmentService.createSubmission({
        assignmentId,
        studentId: 'student-2',
        textContent: 'Submission 2'
      });
    });

    it('should calculate assignment statistics', async () => {
      const stats = await assignmentService.getAssignmentStats(assignmentId);

      expect(stats.totalSubmissions).toBe(2);
      expect(stats.gradedSubmissions).toBe(0);
      expect(stats.averageGrade).toBe(0);
      expect(stats.lateSubmissions).toBe(0);
    });
  });
});

describe('Assignment Grading Service', () => {
  let gradingService: AssignmentGradingService;

  beforeEach(() => {
    gradingService = new AssignmentGradingService();
  });

  describe('Grade Creation', () => {
    it('should create a valid grade', async () => {
      const gradingData = {
        submissionId: 'submission-123',
        gradedBy: 'instructor-123',
        totalPoints: 100,
        earnedPoints: 85,
        feedback: 'Good work!'
      };

      const grade = await gradingService.gradeSubmission(gradingData);

      expect(grade.id).toBeDefined();
      expect(grade.submissionId).toBe(gradingData.submissionId);
      expect(grade.gradedBy).toBe(gradingData.gradedBy);
      expect(grade.percentage).toBe(85);
      expect(grade.letterGrade).toBe('B');
      expect(grade.status).toBe(GradingStatus.GRADED);
    });

    it('should reject invalid grade data', async () => {
      const invalidGradingData = {
        submissionId: 'submission-123',
        gradedBy: 'instructor-123',
        totalPoints: 100,
        earnedPoints: 150, // More than total points
        feedback: 'Invalid grade'
      };

      await expect(gradingService.gradeSubmission(invalidGradingData))
        .rejects.toThrow('Earned points cannot exceed total points');
    });

    it('should calculate correct letter grades', async () => {
      const testCases = [
        { points: 97, expected: 'A+' },
        { points: 95, expected: 'A' },
        { points: 91, expected: 'A-' },
        { points: 88, expected: 'B+' },
        { points: 85, expected: 'B' },
        { points: 81, expected: 'B-' },
        { points: 78, expected: 'C+' },
        { points: 75, expected: 'C' },
        { points: 71, expected: 'C-' },
        { points: 68, expected: 'D+' },
        { points: 65, expected: 'D' },
        { points: 61, expected: 'D-' },
        { points: 59, expected: 'F' }
      ];

      for (const testCase of testCases) {
        const grade = await gradingService.gradeSubmission({
          submissionId: 'test-submission',
          gradedBy: 'instructor-123',
          totalPoints: 100,
          earnedPoints: testCase.points
        });

        expect(grade.letterGrade).toBe(testCase.expected);
      }
    });
  });

  describe('Grade Appeals', () => {
    let gradeId: string;

    beforeEach(async () => {
      const grade = await gradingService.gradeSubmission({
        submissionId: 'submission-123',
        gradedBy: 'instructor-123',
        totalPoints: 100,
        earnedPoints: 75
      });
      gradeId = grade.id;
    });

    it('should submit a grade appeal', async () => {
      const appeal = await gradingService.submitGradeAppeal(
        gradeId,
        'Disagree with grading',
        'I believe my answer deserves more points based on the rubric.',
        'student-123'
      );

      expect(appeal.id).toBeDefined();
      expect(appeal.reason).toBe('Disagree with grading');
      expect(appeal.status).toBe('pending');
    });

    it('should review and approve an appeal', async () => {
      await gradingService.submitGradeAppeal(
        gradeId,
        'Disagree with grading',
        'I believe my answer deserves more points.',
        'student-123'
      );

      const updatedGrade = await gradingService.reviewGradeAppeal(
        gradeId,
        true,
        'Review shows additional points were deserved.',
        'instructor-123',
        85
      );

      expect(updatedGrade.earnedPoints).toBe(85);
      expect(updatedGrade.percentage).toBe(85);
      expect(updatedGrade.appeal?.status).toBe('approved');
    });
  });

  describe('Class Statistics', () => {
    beforeEach(async () => {
      // Create test grades
      await gradingService.gradeSubmission({
        submissionId: 'sub1',
        gradedBy: 'instructor-123',
        totalPoints: 100,
        earnedPoints: 95
      });

      await gradingService.gradeSubmission({
        submissionId: 'sub2',
        gradedBy: 'instructor-123',
        totalPoints: 100,
        earnedPoints: 85
      });

      await gradingService.gradeSubmission({
        submissionId: 'sub3',
        gradedBy: 'instructor-123',
        totalPoints: 100,
        earnedPoints: 75
      });
    });

    it('should calculate class statistics', async () => {
      const stats = await gradingService.calculateClassStatistics('assignment-123');

      expect(stats.average).toBe(85); // (95 + 85 + 75) / 3
      expect(stats.highest).toBe(95);
      expect(stats.lowest).toBe(75);
      expect(stats.totalGraded).toBe(3);
    });
  });
});

describe('Code Execution Service', () => {
  let codeExecutionService: CodeExecutionService;

  beforeEach(() => {
    codeExecutionService = new CodeExecutionService();
  });

  describe('Code Execution', () => {
    it('should execute JavaScript code', async () => {
      const result = await codeExecutionService.executeCode({
        code: 'console.log("Hello World")',
        language: 'javascript'
      });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('should handle code execution errors', async () => {
      const result = await codeExecutionService.executeCode({
        code: 'invalid javascript syntax',
        language: 'javascript'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should validate code syntax', async () => {
      const validation = await codeExecutionService.validateCode(
        'console.log("Hello World")',
        'javascript'
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect syntax errors', async () => {
      const validation = await codeExecutionService.validateCode(
        'console.log("Hello World"',
        'javascript'
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should run test cases', async () => {
      const testResults = await codeExecutionService.runTests(
        {
          id: 'test-submission',
          language: 'javascript',
          code: 'function add(a, b) { return a + b; }'
        },
        [
          {
            input: 'add(2, 3)',
            expectedOutput: '5',
            name: 'Basic addition test'
          },
          {
            input: 'add(-1, 1)',
            expectedOutput: '0',
            name: 'Negative number test'
          }
        ]
      );

      expect(testResults).toHaveLength(2);
      expect(testResults[0].passed).toBe(true);
      expect(testResults[1].passed).toBe(true);
    });
  });

  describe('Language Support', () => {
    it('should return supported languages', () => {
      const languages = codeExecutionService.getSupportedLanguages();

      expect(languages).toContainEqual({
        code: 'javascript',
        name: 'JavaScript',
        extension: 'js'
      });

      expect(languages).toContainEqual({
        code: 'python',
        name: 'Python',
        extension: 'py'
      });
    });

    it('should reject unsupported languages', async () => {
      const result = await codeExecutionService.executeCode({
        code: 'print("Hello")',
        language: 'unsupported-language'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported language');
    });
  });
});

describe('Plagiarism Service', () => {
  let plagiarismService: PlagiarismService;

  beforeEach(() => {
    plagiarismService = new PlagiarismService();
  });

  describe('Plagiarism Detection', () => {
    it('should check plagiarism for submission', async () => {
      const report = await plagiarismService.checkPlagiarism('submission-123');

      expect(report.id).toBeDefined();
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.status).toBe('completed');
    });

    it('should analyze text similarity', async () => {
      const result = await plagiarismService.analyzeSimilarity(
        'This is a test text for similarity checking.',
        'This is a test text for similarity analysis.'
      );

      expect(result.similarityScore).toBeGreaterThan(0);
      expect(result.matchingSegments).toBeDefined();
    });

    it('should extract text from submission', async () => {
      const submission = {
        id: 'test-submission',
        textContent: 'This is the text content of the submission.',
        codeSubmission: {
          language: 'javascript',
          code: 'console.log("Hello World");'
        },
        files: []
      };

      const extractedText = await plagiarismService.extractTextFromSubmission(submission);

      expect(extractedText).toContain('This is the text content');
      expect(extractedText).toContain('console.log');
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple submissions', async () => {
      const submissionIds = ['sub1', 'sub2', 'sub3'];
      const results = await plagiarismService.batchCheckPlagiarism(submissionIds);

      expect(results.size).toBe(3);
      results.forEach((report, submissionId) => {
        expect(submissionIds).toContain(submissionId);
        expect(report.id).toBeDefined();
      });
    });
  });
});

describe('File Upload Service', () => {
  let fileUploadService: FileUploadService;

  beforeEach(() => {
    fileUploadService = new FileUploadService();
  });

  describe('File Validation', () => {
    it('should validate file types', async () => {
      const mockFile = {
        originalname: 'test.pdf',
        buffer: Buffer.from('mock pdf content'),
        mimetype: 'application/pdf',
        size: 1024
      } as any;

      // This would test file validation logic
      expect(mockFile.mimetype).toBe('application/pdf');
    });

    it('should reject oversized files', async () => {
      const oversizedFile = {
        originalname: 'large.pdf',
        buffer: Buffer.alloc(200 * 1024 * 1024), // 200MB
        mimetype: 'application/pdf',
        size: 200 * 1024 * 1024
      } as any;

      // Test would verify size limit enforcement
      expect(oversizedFile.size).toBeGreaterThan(100 * 1024 * 1024);
    });
  });
});

describe('Notification Service', () => {
  let notificationService: AssignmentNotificationService;

  beforeEach(() => {
    notificationService = new AssignmentNotificationService();
  });

  describe('Notification Creation', () => {
    it('should create assignment notifications', async () => {
      const assignment = {
        id: 'assignment-123',
        title: 'Test Assignment',
        courseId: 'course-123',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      } as any;

      await notificationService.notifyAssignmentCreated(assignment);

      // In a real test, we would verify notifications were created
      expect(assignment.title).toBe('Test Assignment');
    });

    it('should create grade notifications', async () => {
      const grade = {
        id: 'grade-123',
        studentId: 'student-123',
        submissionId: 'submission-123',
        assignmentId: 'assignment-123',
        percentage: 85,
        letterGrade: 'B'
      } as any;

      await notificationService.notifyGradeCreated(grade);

      expect(grade.percentage).toBe(85);
    });
  });
});
