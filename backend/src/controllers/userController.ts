import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/userService';
import { auditService } from '../services/auditService';
import { AuditAction } from '../models/AuditLog';
import { UserRole } from '../models/User';
import logger from '../utils/logger';

export const userController = {
  getProfile: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { address } = req.params;
      const actor = req.user?.address || 'anonymous';
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      const profile = await userService.getProfile(address);

      if (!profile) {
        await auditService.createFailure(
          actor,
          AuditAction.USER_PROFILE_UPDATE,
          'user_profile',
          {
            resourceId: address,
            details: { operation: 'get_profile' },
            ipAddress,
            errorMessage: 'Profile not found',
          }
        );
        return res.status(404).json({ error: 'Profile not found' });
      }

      await auditService.create(
        actor,
        AuditAction.USER_PROFILE_UPDATE,
        'user_profile',
        {
          resourceId: address,
          details: { operation: 'get_profile' },
          ipAddress,
        }
      );

      res.json(profile);
    } catch (error) {
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      await auditService.createFailure(
        req.user?.address || 'anonymous',
        AuditAction.USER_PROFILE_UPDATE,
        'user_profile',
        {
          ipAddress,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        }
      );
      logger.error('Error in getProfile controller', error);
      next(error);
    }
  },

  updateProfile: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { address } = req.params;
      const updateData = req.body;
      const actor = req.user?.address || 'anonymous';
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      const updatedProfile = await userService.updateProfile(address, updateData);

      await auditService.create(
        actor,
        AuditAction.USER_PROFILE_UPDATE,
        'user_profile',
        {
          resourceId: address,
          details: { operation: 'update_profile', fields: Object.keys(updateData) },
          ipAddress,
        }
      );

      res.json(updatedProfile);
    } catch (error) {
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      await auditService.createFailure(
        req.user?.address || 'anonymous',
        AuditAction.USER_PROFILE_UPDATE,
        'user_profile',
        {
          ipAddress,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        }
      );
      logger.error('Error in updateProfile controller', error);
      next(error);
    }
  },

  getSettings: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const actor = req.user?.address || 'anonymous';
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      const settings = await userService.getSettings(userId);

      await auditService.create(
        actor,
        AuditAction.USER_PROFILE_UPDATE,
        'user_settings',
        {
          resourceId: userId,
          details: { operation: 'get_settings' },
          ipAddress,
        }
      );

      res.json(settings);
    } catch (error) {
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      await auditService.createFailure(
        req.user?.address || 'anonymous',
        AuditAction.USER_PROFILE_UPDATE,
        'user_settings',
        {
          ipAddress,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        }
      );
      logger.error('Error in getSettings controller', error);
      next(error);
    }
  },

  updateSettings: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const settingsData = req.body;
      const actor = req.user?.address || 'anonymous';
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      const updatedSettings = await userService.updateSettings(userId, settingsData);

      await auditService.create(
        actor,
        AuditAction.USER_PROFILE_UPDATE,
        'user_settings',
        {
          resourceId: userId,
          details: { operation: 'update_settings', fields: Object.keys(settingsData) },
          ipAddress,
        }
      );

      res.json(updatedSettings);
    } catch (error) {
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      await auditService.createFailure(
        req.user?.address || 'anonymous',
        AuditAction.USER_PROFILE_UPDATE,
        'user_settings',
        {
          ipAddress,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        }
      );
      logger.error('Error in updateSettings controller', error);
      next(error);
    }
  },

  getAchievements: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { address } = req.params;
      const actor = req.user?.address || 'anonymous';
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      const achievements = await userService.getAchievements(address);

      await auditService.create(
        actor,
        AuditAction.USER_PROFILE_UPDATE,
        'user_achievements',
        {
          resourceId: address,
          details: { operation: 'get_achievements', count: achievements.length },
          ipAddress,
        }
      );

      res.json(achievements);
    } catch (error) {
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      await auditService.createFailure(
        req.user?.address || 'anonymous',
        AuditAction.USER_PROFILE_UPDATE,
        'user_achievements',
        {
          ipAddress,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        }
      );
      logger.error('Error in getAchievements controller', error);
      next(error);
    }
  },

  getStats: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { address } = req.params;
      const actor = req.user?.address || 'anonymous';
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      const stats = await userService.getProfileStats(address);

      await auditService.create(
        actor,
        AuditAction.USER_PROFILE_UPDATE,
        'user_stats',
        {
          resourceId: address,
          details: { operation: 'get_stats' },
          ipAddress,
        }
      );

      res.json(stats);
    } catch (error) {
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      await auditService.createFailure(
        req.user?.address || 'anonymous',
        AuditAction.USER_PROFILE_UPDATE,
        'user_stats',
        {
          ipAddress,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        }
      );
      logger.error('Error in getStats controller', error);
      next(error);
    }
  },

  updateRole: async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      const actor = req.user?.address || 'anonymous';
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      if (!Object.values(UserRole).includes(role)) {
        await auditService.createFailure(
          actor,
          AuditAction.USER_ROLE_CHANGE,
          'user',
          {
            resourceId: userId,
            details: { operation: 'update_role', attemptedRole: role },
            ipAddress,
            errorMessage: 'Invalid role specified',
          }
        );
        return res.status(400).json({ error: 'Invalid role specified' });
      }

      const updatedUser = await userService.updateRole(userId, role);

      await auditService.create(
        actor,
        AuditAction.USER_ROLE_CHANGE,
        'user',
        {
          resourceId: userId,
          details: { operation: 'update_role', newRole: role, previousRole: updatedUser.previousRole },
          ipAddress,
        }
      );

      res.json(updatedUser);
    } catch (error) {
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      await auditService.createFailure(
        req.user?.address || 'anonymous',
        AuditAction.USER_ROLE_CHANGE,
        'user',
        {
          ipAddress,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        }
      );
      logger.error('Error in updateRole controller', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  updatePermissions: async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { permissions } = req.body;
      const actor = req.user?.address || 'anonymous';
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      const updatedUser = await userService.updatePermissions(userId, permissions);

      await auditService.create(
        actor,
        AuditAction.USER_PERMISSION_CHANGE,
        'user',
        {
          resourceId: userId,
          details: { operation: 'update_permissions', permissions },
          ipAddress,
        }
      );

      res.json(updatedUser);
    } catch (error) {
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      await auditService.createFailure(
        req.user?.address || 'anonymous',
        AuditAction.USER_PERMISSION_CHANGE,
        'user',
        {
          ipAddress,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        }
      );
      logger.error('Error in updatePermissions controller', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
};