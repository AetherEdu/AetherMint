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

export function createAssignmentRoutes(controller: AssignmentController): Router {
  const router = Router();

  // Apply authentication to all routes
  router.use(authMiddleware as any);

  // Assignment Management Routes
  router.post(
    '/courses/:courseId/assignments',
    rateLimitMiddleware({ max: 10, windowMs: 15 * 60 * 1000 }) as any,
    validateRequest as any,
    controller.createAssignment.bind(controller) as any
  );

  router.get(
    '/courses/:courseId/assignments',
    rateLimitMiddleware({ max: 100, windowMs: 15 * 60 * 1000 }) as any,
    controller.getAssignments.bind(controller) as any
  );

  router.get(
    '/assignments/:assignmentId',
    rateLimitMiddleware({ max: 200, windowMs: 15 * 60 * 1000 }) as any,
    controller.getAssignment.bind(controller) as any
  );

  router.put(
    '/assignments/:assignmentId',
    rateLimitMiddleware({ max: 20, windowMs: 15 * 60 * 1000 }) as any,
    validateRequest as any,
    controller.updateAssignment.bind(controller) as any
  );

  router.delete(
    '/assignments/:assignmentId',
    rateLimitMiddleware({ max: 10, windowMs: 15 * 60 * 1000 }) as any,
    controller.deleteAssignment.bind(controller) as any
  );

  // Submission Management Routes
  router.post(
    '/assignments/:assignmentId/submissions',
    rateLimitMiddleware({ max: 20, windowMs: 15 * 60 * 1000 }) as any,
    uploadMiddleware.array('files', 10) as any,
    validateRequest as any,
    controller.createSubmission.bind(controller) as any
  );

  router.get(
    '/assignments/:assignmentId/submissions',
    rateLimitMiddleware({ max: 100, windowMs: 15 * 60 * 1000 }) as any,
    controller.getSubmissions.bind(controller) as any
  );

  router.get(
    '/submissions/:submissionId',
    rateLimitMiddleware({ max: 200, windowMs: 15 * 60 * 1000 }) as any,
    controller.getSubmission.bind(controller) as any
  );

  router.put(
    '/submissions/:submissionId',
    rateLimitMiddleware({ max: 30, windowMs: 15 * 60 * 1000 }) as any,
    uploadMiddleware.array('files', 5) as any,
    validateRequest as any,
    controller.updateSubmission.bind(controller) as any
  );

  router.post(
    '/submissions/:submissionId/submit',
    rateLimitMiddleware({ max: 10, windowMs: 15 * 60 * 1000 }) as any,
    controller.submitAssignment.bind(controller) as any
  );

  // Grading Management Routes
  router.post(
    '/submissions/:submissionId/grade',
    rateLimitMiddleware({ max: 50, windowMs: 15 * 60 * 1000 }) as any,
    validateRequest as any,
    controller.gradeSubmission.bind(controller) as any
  );

  router.get(
    '/assignments/:assignmentId/grades',
    rateLimitMiddleware({ max: 100, windowMs: 15 * 60 * 1000 }) as any,
    controller.getGrades.bind(controller) as any
  );

  // Statistics and Analytics Routes
  router.get(
    '/assignments/:assignmentId/stats',
    rateLimitMiddleware({ max: 50, windowMs: 15 * 60 * 1000 }) as any,
    controller.getAssignmentStats.bind(controller) as any
  );

  router.get(
    '/courses/:courseId/progress',
    rateLimitMiddleware({ max: 100, windowMs: 15 * 60 * 1000 }) as any,
    controller.getStudentProgress.bind(controller) as any
  );

  // Bulk Operations Routes
  router.post(
    '/assignments/:assignmentId/bulk-grade',
    rateLimitMiddleware({ max: 5, windowMs: 15 * 60 * 1000 }) as any,
    validateRequest as any,
    controller.bulkGrade.bind(controller) as any
  );

  return router;
}
