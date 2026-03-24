/**
 * Assignment Routes
 * Defines all assignment-related API endpoints
 */

import { Router } from 'express';
import { AssignmentController } from '../controllers/assignmentController';
import { authMiddleware } from '../middleware/auth';
import { uploadMiddleware } from '../middleware/upload';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { validateRequest } from '../middleware/validation';
import { 
  createAssignmentSchema,
  updateAssignmentSchema,
  createSubmissionSchema,
  gradeSubmissionSchema,
  bulkGradeSchema
} from '../utils/schemas';

export function createAssignmentRoutes(controller: AssignmentController): Router {
  const router = Router();

  // Apply authentication to all routes
  router.use(authMiddleware);

  // Assignment Management Routes
  router.post(
    '/courses/:courseId/assignments',
    rateLimitMiddleware({ max: 10, windowMs: 15 * 60 * 1000 }), // 10 requests per 15 minutes
    validateRequest(createAssignmentSchema),
    controller.createAssignment.bind(controller)
  );

  router.get(
    '/courses/:courseId/assignments',
    rateLimitMiddleware({ max: 100, windowMs: 15 * 60 * 1000 }),
    controller.getAssignments.bind(controller)
  );

  router.get(
    '/assignments/:assignmentId',
    rateLimitMiddleware({ max: 200, windowMs: 15 * 60 * 1000 }),
    controller.getAssignment.bind(controller)
  );

  router.put(
    '/assignments/:assignmentId',
    rateLimitMiddleware({ max: 20, windowMs: 15 * 60 * 1000 }),
    validateRequest(updateAssignmentSchema),
    controller.updateAssignment.bind(controller)
  );

  router.delete(
    '/assignments/:assignmentId',
    rateLimitMiddleware({ max: 10, windowMs: 15 * 60 * 1000 }),
    controller.deleteAssignment.bind(controller)
  );

  // Submission Management Routes
  router.post(
    '/assignments/:assignmentId/submissions',
    rateLimitMiddleware({ max: 20, windowMs: 15 * 60 * 1000 }),
    uploadMiddleware.array('files', 10), // Max 10 files
    validateRequest(createSubmissionSchema),
    controller.createSubmission.bind(controller)
  );

  router.get(
    '/assignments/:assignmentId/submissions',
    rateLimitMiddleware({ max: 100, windowMs: 15 * 60 * 1000 }),
    controller.getSubmissions.bind(controller)
  );

  router.get(
    '/submissions/:submissionId',
    rateLimitMiddleware({ max: 200, windowMs: 15 * 60 * 1000 }),
    controller.getSubmission.bind(controller)
  );

  router.put(
    '/submissions/:submissionId',
    rateLimitMiddleware({ max: 30, windowMs: 15 * 60 * 1000 }),
    uploadMiddleware.array('files', 5), // Max 5 additional files
    validateRequest(createSubmissionSchema),
    controller.updateSubmission.bind(controller)
  );

  router.post(
    '/submissions/:submissionId/submit',
    rateLimitMiddleware({ max: 10, windowMs: 15 * 60 * 1000 }),
    controller.submitAssignment.bind(controller)
  );

  // Grading Management Routes
  router.post(
    '/submissions/:submissionId/grade',
    rateLimitMiddleware({ max: 50, windowMs: 15 * 60 * 1000 }),
    validateRequest(gradeSubmissionSchema),
    controller.gradeSubmission.bind(controller)
  );

  router.get(
    '/assignments/:assignmentId/grades',
    rateLimitMiddleware({ max: 100, windowMs: 15 * 60 * 1000 }),
    controller.getGrades.bind(controller)
  );

  // Statistics and Analytics Routes
  router.get(
    '/assignments/:assignmentId/stats',
    rateLimitMiddleware({ max: 50, windowMs: 15 * 60 * 1000 }),
    controller.getAssignmentStats.bind(controller)
  );

  router.get(
    '/courses/:courseId/progress',
    rateLimitMiddleware({ max: 100, windowMs: 15 * 60 * 1000 }),
    controller.getStudentProgress.bind(controller)
  );

  // Bulk Operations Routes
  router.post(
    '/assignments/:assignmentId/bulk-grade',
    rateLimitMiddleware({ max: 5, windowMs: 15 * 60 * 1000 }),
    validateRequest(bulkGradeSchema),
    controller.bulkGrade.bind(controller)
  );

  return router;
}
