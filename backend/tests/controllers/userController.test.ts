import { Request, Response, NextFunction } from 'express';
import { userController } from '../../src/controllers/userController';
import { userService } from '../../src/services/userService';
import { auditService } from '../../src/services/auditService';

jest.mock('../../src/services/userService');
jest.mock('../../src/services/auditService');
jest.mock('../../src/utils/logger');

describe('UserController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: {},
      body: {},
      user: { address: 'user-address' },
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('getProfile', () => {
    it('should return profile when found', async () => {
      req.params = { address: 'test-address' };
      const mockProfile = { address: 'test-address', name: 'Test User' };
      (userService.getProfile as jest.Mock).mockResolvedValue(mockProfile);

      await userController.getProfile(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(mockProfile);
      expect(auditService.create).toHaveBeenCalled();
    });

    it('should return 404 when profile not found', async () => {
      req.params = { address: 'not-found' };
      (userService.getProfile as jest.Mock).mockResolvedValue(null);

      await userController.getProfile(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Profile not found' });
      expect(auditService.createFailure).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      req.params = { address: 'test-address' };
      (userService.getProfile as jest.Mock).mockRejectedValue(new Error('Database error'));

      await userController.getProfile(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(auditService.createFailure).toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      req.params = { address: 'test-address' };
      req.body = { name: 'Updated Name' };
      const mockProfile = { address: 'test-address', name: 'Updated Name' };
      (userService.updateProfile as jest.Mock).mockResolvedValue(mockProfile);

      await userController.updateProfile(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(mockProfile);
      expect(auditService.create).toHaveBeenCalled();
    });
  });

  describe('updateRole', () => {
    it('should update role successfully', async () => {
      req.params = { userId: 'user-123' };
      req.body = { role: 'ADMIN' };
      const mockUser = { id: 'user-123', role: 'ADMIN', previousRole: 'USER' };
      (userService.updateRole as jest.Mock).mockResolvedValue(mockUser);

      await userController.updateRole(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(mockUser);
      expect(auditService.create).toHaveBeenCalled();
    });

    it('should reject invalid role', async () => {
      req.params = { userId: 'user-123' };
      req.body = { role: 'INVALID_ROLE' };

      await userController.updateRole(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid role specified' });
      expect(auditService.createFailure).toHaveBeenCalled();
    });
  });
});