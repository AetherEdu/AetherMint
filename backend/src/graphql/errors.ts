import { GraphQLError, GraphQLFormattedError } from 'graphql';
import { AppError, AuthError, ForbiddenError } from '../utils/errors';

export function toGraphQLError(error: unknown): GraphQLError {
  if (error instanceof GraphQLError) {
    return error;
  }

  if (error instanceof AppError) {
    return new GraphQLError(error.message, {
      extensions: {
        code: error.errorCode,
        http: { status: error.statusCode },
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    });
  }

  if (error instanceof Error) {
    return new GraphQLError(error.message, {
      extensions: {
        code: 'INTERNAL_ERROR',
        http: { status: 500 },
      },
    });
  }

  return new GraphQLError('An unexpected error occurred', {
    extensions: {
      code: 'INTERNAL_ERROR',
      http: { status: 500 },
    },
  });
}

export function requireAuth(user: { id: string } | null | undefined): asserts user is { id: string } {
  if (!user?.id) {
    throw new AuthError('Authentication required');
  }
}

export function requireSelfOrAdmin(
  user: { id: string; role?: string } | null | undefined,
  targetUserId: string
): void {
  requireAuth(user);
  if (user.id !== targetUserId && user.role !== 'admin') {
    throw new ForbiddenError('Insufficient permissions');
  }
}

export function formatGraphQLError(error: GraphQLError): GraphQLFormattedError {
  const original = error.originalError;
  const baseExtensions = { ...(error.extensions || {}) };

  if (original instanceof AppError && !baseExtensions.code) {
    baseExtensions.code = original.errorCode;
    baseExtensions.http = { status: original.statusCode };
    if (original.details !== undefined) {
      baseExtensions.details = original.details;
    }
  }

  if (process.env.NODE_ENV === 'production') {
    delete (baseExtensions as { exception?: unknown }).exception;
  }

  return {
    message: error.message,
    locations: error.locations,
    path: error.path,
    extensions: baseExtensions,
  };
}
