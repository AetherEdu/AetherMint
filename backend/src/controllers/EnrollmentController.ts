/**
 * Enrollment Controller
 * Handles enrollment-related operations and business logic
 *
 * Updated for Issue #257: uses cursor-based pagination with standard
 * query parameters (limit, cursor, sort, order, filter).
 */

import { Request, Response, NextFunction } from 'express';
import { EnrollmentService } from '../services/EnrollmentService';
import { PaymentService } from '../services/PaymentService';
import { NotificationService } from '../services/NotificationService';
import { 
  Enrollment, 
  EnrollmentFilter, 
  EnrollmentStatus, 
  PaymentStatus,
  PaymentMethod,
  EnrollmentAnalytics,
  UserEnrollmentHistory,
  CourseEnrollmentSummary,
  EnrollmentCapacity
} from '../models/Enrollment';
import { UserRole } from '../models/User';
import logger from '../utils/logger';
import { NotFoundError, ForbiddenError, ValidationError, ConflictError } from '../utils/errors';
import {
  parsePaginationParams,
  parseFilters,
  buildPaginationMeta,
  buildPaginatedResponse,
  decodeCursor,
  registerSortFields,
  resolveSortField,
} from '../utils/pagination';

// Register allowed sort fields for enrollments
registerSortFields('enrollments', ['enrolledAt', 'status', 'courseId', 'progress', 'createdAt', 'updatedAt']);

export class EnrollmentController {
  private enrollmentService: EnrollmentService;
  private paymentService: PaymentService;
  private notificationService: NotificationService;

  constructor() {
    this.enrollmentService = new EnrollmentService();
    this.paymentService = new PaymentService();
    this.notificationService = new NotificationService();
  }

  /**
   * Get user's enrollments with filtering and pagination
   *
   * Query params: limit, cursor, sort, order, status, paymentStatus, paymentMethod
   */
  async getUserEnrollments(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const pagination = parsePaginationParams(req.query as Record<string, unknown>);
      const filters = parseFilters(req.query as Record<string, unknown>);

      // Resolve the sort field against the allowlist
      const sortField = resolveSortField('enrollments', pagination.sort);

      // Build the enrollment filter with standardised pagination
      const filter: EnrollmentFilter = {
        userId,
        status: filters.status
          ? (Array.isArray(filters.status) ? filters.status as EnrollmentStatus[] : [filters.status as EnrollmentStatus])
          : undefined,
        paymentStatus: req.query.paymentStatus
          ? (Array.isArray(req.query.paymentStatus)
            ? (req.query.paymentStatus as string[]) as PaymentStatus[]
            : [req.query.paymentStatus as string as PaymentStatus])
          : undefined,
        paymentMethod: req.query.paymentMethod
          ? (Array.isArray(req.query.paymentMethod)
            ? (req.query.paymentMethod as string[]) as PaymentMethod[]
            : [req.query.paymentMethod as string as PaymentMethod])
          : undefined,
        sortBy: sortField as any,
        sortOrder: pagination.order,
        // Map cursor to offset for the service layer
        page: 1,
        limit: pagination.limit + 1, // fetch one extra to determine has_more
      };

      // Decode cursor to apply offset if present
      if (pagination.cursor) {
        const decoded = decodeCursor(pagination.cursor);
        if (decoded) {
          (filter as any).cursorValue = decoded;
          (filter as any).cursorField = sortField;
        }
      }

      const result = await this.enrollmentService.getEnrollments(filter);
      const items = result.enrollments.slice(0, pagination.limit);
      const hasMore = result.enrollments.length > pagination.limit;

      const meta = buildPaginationMeta(
        items as unknown as Record<string, unknown>[],
        result.total,
        pagination.limit,
        sortField,
      );
      // Override has_more based on actual count
      meta.has_more = hasMore;

      res.json(buildPaginatedResponse(items as unknown as Record<string, unknown>[], meta));
    } catch (error) {
      logger.error('Error getting user enrollments:', error);
      next(error);
    }
  }

  /**
   * Get specific enrollment details
   */
  async getEnrollmentById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const enrollment = await this.enrollmentService.getEnrollmentById(id);

      if (!enrollment) {
        throw new NotFoundError('Enrollment not found');
      }

      // Check if user has permission to view this enrollment
      if (enrollment.userId !== userId && userRole !== UserRole.ADMIN && userRole !== UserRole.EDUCATOR) {
        throw new ForbiddenError('Access denied');
      }

      res.json({
        success: true,
        data: enrollment
      });
    } catch (error) {
      logger.error('Enrollment error:', error);
      next(error);
    }
  }

  /**
   * Create new enrollment
   */
  async createEnrollment(req: Request, res: Response, next: NextFunction) {
    try {
      const { courseId, paymentMethod, paymentDetails } = req.body;
      const userId = req.user!.id;

      // Check if user is already enrolled
      const existingEnrollment = await this.enrollmentService.getUserEnrollmentForCourse(userId, courseId);
      if (existingEnrollment) {
        throw new ConflictError('Already enrolled in this course');
      }

      // Validate prerequisites
      const prerequisitesMet = await this.enrollmentService.validatePrerequisites(userId, courseId);
      if (!prerequisitesMet.valid) {
        return res.status(400).json({
          success: false,
          message: 'Prerequisites not met',
          missingPrerequisites: prerequisitesMet.missing
        });
      }

      // Check course capacity
      const capacity = await this.enrollmentService.getCourseCapacity(courseId);
      if (capacity.currentEnrollments >= capacity.maxStudents) {
        // Add to waitlist
        const waitlistPosition = await this.enrollmentService.addToWaitlist(userId, courseId);
        return res.status(202).json({
          success: true,
          message: 'Course is full. Added to waitlist',
          data: {
            waitlistPosition,
            status: 'waitlisted'
          }
        });
      }

      // Create enrollment
      const enrollment = await this.enrollmentService.createEnrollment({
        userId,
        courseId,
        paymentMethod,
        amountPaid: 0,
        totalAmount: paymentDetails.amount,
        currency: paymentDetails.currency,
        status: EnrollmentStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        prerequisitesMet: true
      } as any);

      // Process payment
      if (paymentMethod === PaymentMethod.STELLAR) {
        const paymentIntent = await this.paymentService.createStellarPaymentIntent(
          enrollment.id,
          paymentDetails
        );
        
        return res.status(201).json({
          success: true,
          message: 'Enrollment created. Payment required to confirm.',
          data: {
            enrollment,
            paymentIntent
          }
        });
      } else {
        // Handle other payment methods
        const paymentIntent = await this.paymentService.createPaymentIntent(
          enrollment.id,
          paymentMethod,
          paymentDetails
        );

        return res.status(201).json({
          success: true,
          message: 'Enrollment created. Payment required to confirm.',
          data: {
            enrollment,
            paymentIntent
          }
        });
      }
    } catch (error) {
      logger.error('Enrollment error:', error);
      next(error);
    }
  }

  /**
   * Update enrollment details
   */
  async updateEnrollment(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const updates = req.body;

      const enrollment = await this.enrollmentService.getEnrollmentById(id);
      if (!enrollment) {
        throw new NotFoundError('Enrollment not found');
      }

      // Check permissions
      if (enrollment.userId !== userId && userRole !== UserRole.ADMIN) {
        throw new ForbiddenError('Access denied');
      }

      const updatedEnrollment = await this.enrollmentService.updateEnrollment(id, updates);

      res.json({
        success: true,
        data: updatedEnrollment
      });
    } catch (error) {
      logger.error('Enrollment error:', error);
      next(error);
    }
  }

  /**
   * Cancel enrollment
   */
  async cancelEnrollment(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { reason } = req.body;

      const enrollment = await this.enrollmentService.getEnrollmentById(id);
      if (!enrollment) {
        throw new NotFoundError('Enrollment not found');
      }

      if (enrollment.userId !== userId) {
        throw new ForbiddenError('Access denied');
      }

      // Check if cancellation is allowed
      if (enrollment.status === EnrollmentStatus.COMPLETED) {
        throw new ValidationError('Cannot cancel completed enrollment');
      }

      const cancelledEnrollment = await this.enrollmentService.cancelEnrollment(id, reason);

      // Process refund if applicable
      if (enrollment.paymentStatus === PaymentStatus.COMPLETED && enrollment.amountPaid > 0) {
        const refund = await this.paymentService.processRefund(
          enrollment.id,
          enrollment.amountPaid,
          reason
        );
        
        // Send notification
        await this.notificationService.sendRefundNotification(userId, refund);
      }

      // Send cancellation notification
      await this.notificationService.sendEnrollmentCancellationNotification(userId, cancelledEnrollment);

      res.json({
        success: true,
        data: cancelledEnrollment
      });
    } catch (error) {
      logger.error('Enrollment error:', error);
      next(error);
    }
  }

  /**
   * Complete enrollment
   */
  async completeEnrollment(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { issueCertificate = true } = req.body;

      const enrollment = await this.enrollmentService.completeEnrollment(id);

      if (issueCertificate && enrollment.progress === 100) {
        const certificate = await this.enrollmentService.issueCertificate(id);
        
        // Send certificate notification
        await this.notificationService.sendCertificateIssuanceNotification(
          enrollment.userId,
          certificate
        );
      }

      res.json({
        success: true,
        data: enrollment
      });
    } catch (error) {
      logger.error('Enrollment error:', error);
      next(error);
    }
  }

  /**
   * Get enrollment progress
   */
  async getEnrollmentProgress(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const enrollment = await this.enrollmentService.getEnrollmentById(id);
      if (!enrollment) {
        throw new NotFoundError('Enrollment not found');
      }

      if (enrollment.userId !== userId) {
        throw new ForbiddenError('Access denied');
      }

      const progress = await this.enrollmentService.getEnrollmentProgress(id);

      res.json({
        success: true,
        data: progress
      });
    } catch (error) {
      logger.error('Enrollment error:', error);
      next(error);
    }
  }

  /**
   * Update enrollment progress
   */
  async updateEnrollmentProgress(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { progress } = req.body;
      const userId = req.user!.id;

      const enrollment = await this.enrollmentService.getEnrollmentById(id);
      if (!enrollment) {
        throw new NotFoundError('Enrollment not found');
      }

      if (enrollment.userId !== userId) {
        throw new ForbiddenError('Access denied');
      }

      const updatedEnrollment = await this.enrollmentService.updateEnrollmentProgress(id, progress);

      res.json({
        success: true,
        data: updatedEnrollment
      });
    } catch (error) {
      logger.error('Enrollment error:', error);
      next(error);
    }
  }

  /**
   * Get course enrollments (for educators/admins)
   *
   * Query params: limit, cursor, sort, order, status
   */
  async getCourseEnrollments(req: Request, res: Response, next: NextFunction) {
    try {
      const { courseId } = req.params;
      const pagination = parsePaginationParams(req.query as Record<string, unknown>);
      const filters = parseFilters(req.query as Record<string, unknown>);
      const sortField = resolveSortField('enrollments', pagination.sort);

      const filter: EnrollmentFilter = {
        courseId,
        status: filters.status
          ? (Array.isArray(filters.status) ? filters.status as EnrollmentStatus[] : [filters.status as EnrollmentStatus])
          : undefined,
        sortBy: sortField as any,
        sortOrder: pagination.order,
        page: 1,
        limit: pagination.limit + 1,
      };

      if (pagination.cursor) {
        const decoded = decodeCursor(pagination.cursor);
        if (decoded) {
          (filter as any).cursorValue = decoded;
          (filter as any).cursorField = sortField;
        }
      }

      const result = await this.enrollmentService.getEnrollments(filter);
      const items = result.enrollments.slice(0, pagination.limit);
      const hasMore = result.enrollments.length > pagination.limit;

      const meta = buildPaginationMeta(
        items as unknown as Record<string, unknown>[],
        result.total,
        pagination.limit,
        sortField,
      );
      meta.has_more = hasMore;

      res.json(buildPaginatedResponse(items as unknown as Record<string, unknown>[], meta));
    } catch (error) {
      logger.error('Enrollment error:', error);
      next(error);
    }
  }

  /**
   * Issue certificate
   */
  async issueCertificate(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const certificate = await this.enrollmentService.issueCertificate(id);

      res.json({
        success: true,
        data: certificate
      });
    } catch (error) {
      logger.error('Enrollment error:', error);
      next(error);
    }
  }

  /**
   * Get course waitlist
   */
  async getCourseWaitlist(req: Request, res: Response, next: NextFunction) {
    try {
      const { courseId } = req.params;

      const waitlist = await this.enrollmentService.getCourseWaitlist(courseId);

      res.json({
        success: true,
        data: waitlist
      });
    } catch (error) {
      logger.error('Enrollment error:', error);
      next(error);
    }
  }

  /**
   * Add to waitlist
   */
  async addToWaitlist(req: Request, res: Response, next: NextFunction) {
    try {
      const { courseId } = req.params;
      const userId = req.user!.id;

      // Check if already enrolled or on waitlist
      const existingEnrollment = await this.enrollmentService.getUserEnrollmentForCourse(userId, courseId);
      if (existingEnrollment) {
        throw new ConflictError('Already enrolled or on waitlist for this course');
      }

      const waitlistPosition = await this.enrollmentService.addToWaitlist(userId, courseId);

      res.status(201).json({
        success: true,
        data: {
          waitlistPosition,
          message: 'Added to waitlist'
        }
      });
    } catch (error) {
      logger.error('Enrollment error:', error);
      next(error);
    }
  }

  /**
   * Remove from waitlist
   */
  async removeFromWaitlist(req: Request, res: Response, next: NextFunction) {
    try {
      const { courseId } = req.params;
      const userId = req.user!.id;

      await this.enrollmentService.removeFromWaitlist(userId, courseId);

      res.json({
        success: true,
        message: 'Removed from waitlist'
      });
    } catch (error) {
      logger.error('Enrollment error:', error);
      next(error);
    }
  }

  /**
   * Get user enrollment analytics
   */
  async getUserEnrollmentAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      const analytics: UserEnrollmentHistory = await this.enrollmentService.getUserEnrollmentHistory(userId);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Enrollment error:', error);
      next(error);
    }
  }

  /**
   * Get course enrollment analytics
   */
  async getCourseEnrollmentAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const { courseId } = req.params;

      const analytics: CourseEnrollmentSummary = await this.enrollmentService.getCourseEnrollmentSummary(courseId);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Enrollment error:', error);
      next(error);
    }
  }

  /**
   * Get global enrollment analytics
   */
  async getGlobalEnrollmentAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const analytics: EnrollmentAnalytics = await this.enrollmentService.getGlobalEnrollmentAnalytics();

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Enrollment error:', error);
      next(error);
    }
  }

  /**
   * Bulk enrollment operations
   */
  async bulkEnrollmentOperations(req: Request, res: Response, next: NextFunction) {
    try {
      const { operation, enrollments } = req.body;

      const result = await this.enrollmentService.bulkEnrollmentOperations(operation, enrollments);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Enrollment error:', error);
      next(error);
    }
  }

  /**
   * Get course capacity
   */
  async getCourseCapacity(req: Request, res: Response, next: NextFunction) {
    try {
      const { courseId } = req.params;

      const capacity: EnrollmentCapacity = await this.enrollmentService.getCourseCapacity(courseId);

      res.json({
        success: true,
        data: capacity
      });
    } catch (error) {
      logger.error('Enrollment error:', error);
      next(error);
    }
  }

  /**
   * Validate prerequisites
   */
  async validatePrerequisites(req: Request, res: Response, next: NextFunction) {
    try {
      const { courseId } = req.body;
      const userId = req.user!.id;

      const validation = await this.enrollmentService.validatePrerequisites(userId, courseId);

      res.json({
        success: true,
        data: validation
      });
    } catch (error) {
      logger.error('Enrollment error:', error);
      next(error);
    }
  }

  /**
   * Get user enrollment history
   */
  async getUserEnrollmentHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const requestingUserId = req.user!.id;
      const userRole = req.user!.role;

      // Check permissions
      if (userId !== requestingUserId && userRole !== UserRole.ADMIN) {
        throw new ForbiddenError('Access denied');
      }

      const history: UserEnrollmentHistory = await this.enrollmentService.getUserEnrollmentHistory(userId);

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      logger.error('Enrollment error:', error);
      next(error);
    }
  }

  /**
   * Renew enrollment
   */
  async renewEnrollment(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { paymentDetails } = req.body;
      const userId = req.user!.id;

      const enrollment = await this.enrollmentService.getEnrollmentById(id);
      if (!enrollment) {
        throw new NotFoundError('Enrollment not found');
      }

      if (enrollment.userId !== userId) {
        throw new ForbiddenError('Access denied');
      }

      const renewedEnrollment = await this.enrollmentService.renewEnrollment(id, paymentDetails);

      res.json({
        success: true,
        data: renewedEnrollment
      });
    } catch (error) {
      logger.error('Enrollment error:', error);
      next(error);
    }
  }

  /**
   * Export course enrollments
   */
  async exportCourseEnrollments(req: Request, res: Response, next: NextFunction) {
    try {
      const { courseId } = req.params;
      const { format = 'csv' } = req.query;

      const exportData = await this.enrollmentService.exportCourseEnrollments(courseId, format as string);

      res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=enrollments-${courseId}.${format}`);
      
      res.send(exportData);
    } catch (error) {
      logger.error('Enrollment error:', error);
      next(error);
    }
  }
}
