import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../models/User';
import { createDataLoaders, GraphQLDataLoaders } from './dataloaders';

export interface GraphQLUser {
  id: string;
  email: string;
  role: UserRole;
  username: string;
  address?: string;
}

export interface GraphQLContext {
  req: Request;
  user: GraphQLUser | null;
  loaders: GraphQLDataLoaders;
  isAuthenticated: boolean;
}

function extractBearerToken(req: Request): string | null {
  const header = req.header('Authorization') || req.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

export function resolveUserFromRequest(req: Request): GraphQLUser | null {
  const token = extractBearerToken(req);
  if (!token) return null;

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return null;

  try {
    const decoded = jwt.verify(token, jwtSecret) as {
      id?: string;
      sub?: string;
      email?: string;
      role?: UserRole;
      username?: string;
      address?: string;
    };

    const id = decoded.id || decoded.sub;
    if (!id) return null;

    return {
      id: String(id),
      email: decoded.email || '',
      role: decoded.role || UserRole.STUDENT,
      username: decoded.username || '',
      address: decoded.address,
    };
  } catch {
    return null;
  }
}

export function createGraphQLContext({ req }: { req: Request }): GraphQLContext {
  const user = resolveUserFromRequest(req);

  if (user) {
    (req as Request & { user?: GraphQLUser }).user = user;
  }

  return {
    req,
    user,
    loaders: createDataLoaders(),
    isAuthenticated: Boolean(user),
  };
}
