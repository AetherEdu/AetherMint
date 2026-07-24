/**
 * Authentication Middleware
 * Handles user authentication and authorization
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../models/User';
import { AuthError, ForbiddenError } from '../utils/errors';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    username: string;
    address?: string;
  };
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return next(new AuthError('Access denied. No token provided.'));
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined');
    }

    const decoded = jwt.verify(token, jwtSecret) as any;

    (req as any).user = {
      id: decoded.id,
      email: (decoded as any).email || '' as string,
      role: decoded.role,
      username: decoded.username,
      address: (decoded as any).address
    };

    next();
  } catch (error) {
    next(new AuthError('Invalid token.'));
  }
};

export const requireRole = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as { role: UserRole } | undefined;
    if (!user) {
      return next(new AuthError('Authentication required'));
    }

    if (!roles.includes(user.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
};

export const requireInstructor = requireRole([UserRole.EDUCATOR, UserRole.ADMIN]);
export const requireAdmin = requireRole([UserRole.ADMIN]);
export const requireStudent = requireRole([UserRole.STUDENT, UserRole.EDUCATOR, UserRole.ADMIN]);

// Common aliases used across the codebase
export const authenticateToken = authMiddleware;
export const authenticate = authMiddleware;
export const requireEducatorOrAdmin = requireInstructor;

/**
 * Like {@link authMiddleware} but does not reject requests without a token.
 * Used on routes that change behaviour based on the caller's identity if
 * present but are otherwise public (e.g. feature-flag evaluation for an
 * anonymous SPA boot).
 *
 * Invalid tokens fall through as anonymous rather than rejecting the
 * request, so degraded-mode clients can still load.
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      next();
      return;
    }
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      next();
      return;
    }
    const decoded = jwt.verify(token, jwtSecret) as any;
    (req as any).user = {
      id: decoded.id,
      email: (decoded as any).email || '',
      role: decoded.role,
      username: decoded.username,
      address: (decoded as any).address,
    };
    next();
  } catch {
    // Treat invalid tokens as anonymous so a partially degraded client
    // can still proceed.
    next();
  }
};
