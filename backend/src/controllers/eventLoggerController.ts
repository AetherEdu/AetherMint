import { Request, Response, NextFunction } from 'express';
import { eventLoggerService } from '../services/eventLoggerService';
import logger from '../utils/logger';
import { NotFoundError, ValidationError } from '../utils/errors';

interface EventQuery {
  userId?: string;
  eventType?: string;
  courseId?: string;
  limit?: string;
  offset?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Controller for event logging and audit trail functionality
 */
class EventLoggerController {
  public async logCourseCompletion(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { user, courseId, metadata } = req.body;

      if (!user || !courseId) {
        throw new ValidationError('Missing required fields: user and courseId');
      }

      const eventId = await eventLoggerService.logCourseCompletion(
        user,
        courseId,
        metadata || {}
      );

      res.status(201).json({
        success: true,
        eventId,
        message: 'Course completion event logged successfully'
      });
    } catch (error) {
      logger.error('Error in logCourseCompletion controller:', error);
      next(error);
    }
  }

  public async logCredentialIssuance(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { user, credentialId, courseId, metadata } = req.body;

      if (!user || !credentialId || !courseId) {
        throw new ValidationError(
          'Missing required fields: user, credentialId, and courseId'
        );
      }

      const eventId = await eventLoggerService.logCredentialIssuance(
        user,
        credentialId,
        courseId,
        metadata || {}
      );

      res.status(201).json({
        success: true,
        eventId,
        message: 'Credential issuance event logged successfully'
      });
    } catch (error) {
      logger.error('Error in logCredentialIssuance controller:', error);
      next(error);
    }
  }

  public async logUserAchievement(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { user, achievementType, metadata } = req.body;

      if (!user || !achievementType) {
        throw new ValidationError(
          'Missing required fields: user and achievementType'
        );
      }

      const eventId = await eventLoggerService.logUserAchievement(
        user,
        achievementType,
        metadata || {}
      );

      res.status(201).json({
        success: true,
        eventId,
        message: 'User achievement event logged successfully'
      });
    } catch (error) {
      logger.error('Error in logUserAchievement controller:', error);
      next(error);
    }
  }

  public async logProfileUpdate(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { user, metadata } = req.body;

      if (!user) {
        throw new ValidationError('Missing required field: user');
      }

      const eventId = await eventLoggerService.logProfileUpdate(
        user,
        metadata || {}
      );

      res.status(201).json({
        success: true,
        eventId,
        message: 'Profile update event logged successfully'
      });
    } catch (error) {
      logger.error('Error in logProfileUpdate controller:', error);
      next(error);
    }
  }

  public async logCourseEnrollment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { user, courseId, metadata } = req.body;

      if (!user || !courseId) {
        throw new ValidationError('Missing required fields: user and courseId');
      }

      const eventId = await eventLoggerService.logCourseEnrollment(
        user,
        courseId,
        metadata || {}
      );

      res.status(201).json({
        success: true,
        eventId,
        message: 'Course enrollment event logged successfully'
      });
    } catch (error) {
      logger.error('Error in logCourseEnrollment controller:', error);
      next(error);
    }
  }

  public async getEventById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { eventId } = req.params;
      const eventIdNum = parseInt(eventId, 10);

      if (isNaN(eventIdNum)) {
        throw new ValidationError('Invalid event ID');
      }

      const event = await eventLoggerService.getEvent(eventIdNum);

      if (!event) throw new NotFoundError('Event not found');

      res.status(200).json({ success: true, event });
    } catch (error) {
      logger.error('Error in getEventById controller:', error);
      next(error);
    }
  }

  public async getUserEvents(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { userId } = req.params;
      const query = req.query as EventQuery;

      const filter = {
        userId,
        eventType: query.eventType,
        courseId: query.courseId,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined
      };

      const events = await eventLoggerService.getUserEvents(userId, filter);

      res.status(200).json({ success: true, events, count: events.length });
    } catch (error) {
      logger.error('Error in getUserEvents controller:', error);
      next(error);
    }
  }

  public async getEventsByType(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { eventType } = req.params;
      const query = req.query as EventQuery;

      const filter = {
        eventType,
        userId: query.userId,
        courseId: query.courseId,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined
      };

      const events = await eventLoggerService.getEventsByType(eventType, filter);

      res.status(200).json({ success: true, events, count: events.length });
    } catch (error) {
      logger.error('Error in getEventsByType controller:', error);
      next(error);
    }
  }

  public async getRecentEvents(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = req.query as { limit?: string; offset?: string };
      const limit = query.limit ? parseInt(query.limit, 10) : 50;
      const offset = query.offset ? parseInt(query.offset, 10) : 0;

      const events = await eventLoggerService.getRecentEvents(limit, offset);

      res
        .status(200)
        .json({ success: true, events, count: events.length, limit, offset });
    } catch (error) {
      logger.error('Error in getRecentEvents controller:', error);
      next(error);
    }
  }

  public async getEventCount(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const count = await eventLoggerService.getEventCount();
      res.status(200).json({ success: true, count });
    } catch (error) {
      logger.error('Error in getEventCount controller:', error);
      next(error);
    }
  }

  public async searchEvents(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = req.query as EventQuery;

      const filter = {
        userId: query.userId,
        eventType: query.eventType,
        courseId: query.courseId,
        limit: query.limit ? parseInt(query.limit, 10) : 50,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined
      };

      const { events, totalCount } = await eventLoggerService.searchEvents(filter);

      res.status(200).json({
        success: true,
        events,
        totalCount,
        count: events.length
      });
    } catch (error) {
      logger.error('Error in searchEvents controller:', error);
      next(error);
    }
  }

  public async verifyEvent(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { eventId } = req.params;
      const eventIdNum = parseInt(eventId, 10);

      if (isNaN(eventIdNum)) {
        throw new ValidationError('Invalid event ID');
      }

      const isValid = await eventLoggerService.verifyEvent(eventIdNum);

      res.status(200).json({
        success: true,
        eventId: eventIdNum,
        isValid,
        message: isValid ? 'Event is authentic' : 'Event verification failed'
      });
    } catch (error) {
      logger.error('Error in verifyEvent controller:', error);
      next(error);
    }
  }

  public async generateUserAuditReport(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { userId } = req.params;

      const report = await eventLoggerService.generateUserAuditReport(userId);

      res.status(200).json({ success: true, report });
    } catch (error) {
      logger.error('Error in generateUserAuditReport controller:', error);
      next(error);
    }
  }
}

export const eventLoggerController = new EventLoggerController();
