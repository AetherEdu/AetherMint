import { GraphQLScalarType, Kind } from 'graphql';
import searchService from '../services/searchService';
import { userService } from '../services/userService';
import { timeLockCredentialService } from '../services/timeLockCredentialService';
import { AnalyticsService } from '../services/analyticsService';
import { EnrollmentStatus, PaymentMethod, PaymentStatus } from '../models/Enrollment';
import { SearchFilter } from '../models/Course';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import { GraphQLContext } from './context';
import { enrollmentService, userCourseKey } from './dataloaders';
import { requireAuth, requireSelfOrAdmin, toGraphQLError } from './errors';

const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'ISO-8601 DateTime scalar',
  serialize(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'number') return new Date(value).toISOString();
    if (typeof value === 'string') return new Date(value).toISOString();
    throw new ValidationError('DateTime cannot serialize given value');
  },
  parseValue(value: unknown): Date {
    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        throw new ValidationError('Invalid DateTime');
      }
      return date;
    }
    throw new ValidationError('DateTime must be a string or number');
  },
  parseLiteral(ast): Date {
    if (ast.kind === Kind.STRING || ast.kind === Kind.INT) {
      const date = new Date(ast.value);
      if (Number.isNaN(date.getTime())) {
        throw new ValidationError('Invalid DateTime');
      }
      return date;
    }
    throw new ValidationError('DateTime must be a string or int literal');
  },
});

const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'Arbitrary JSON value',
  serialize(value: unknown) {
    return value;
  },
  parseValue(value: unknown) {
    return value;
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      try {
        return JSON.parse(ast.value);
      } catch {
        return ast.value;
      }
    }
    if (ast.kind === Kind.INT) return Number(ast.value);
    if (ast.kind === Kind.FLOAT) return Number(ast.value);
    if (ast.kind === Kind.BOOLEAN) return ast.value;
    if (ast.kind === Kind.NULL) return null;
    return null;
  },
});

function mapSortBy(sortBy?: string | null): SearchFilter['sortBy'] | undefined {
  if (!sortBy) return undefined;
  const map: Record<string, SearchFilter['sortBy']> = {
    relevance: 'relevance',
    rating: 'rating',
    price_low: 'price-low',
    price_high: 'price-high',
    newest: 'newest',
    popular: 'popular',
  };
  return map[sortBy] || 'relevance';
}

function mapCredential(doc: {
  id?: unknown;
  _id?: unknown;
  credentialId: string;
  issuer: string;
  recipient: string;
  credentialHash: string;
  metadata?: string;
  releaseTime: Date;
  createdAt: Date;
  isReleased: boolean;
  isRevoked: boolean;
  revokeReason?: string;
  scheduleId?: string;
}) {
  return {
    id: String(doc.credentialId || doc.id || doc._id || ''),
    credentialId: doc.credentialId,
    issuer: doc.issuer,
    recipient: doc.recipient,
    credentialHash: doc.credentialHash,
    metadata: doc.metadata,
    releaseTime: doc.releaseTime,
    createdAt: doc.createdAt,
    isReleased: doc.isReleased,
    isRevoked: doc.isRevoked,
    revokeReason: doc.revokeReason,
    scheduleId: doc.scheduleId,
  };
}

function mapAchievement(a: {
  id?: number | string;
  _id?: unknown;
  user?: string;
  userId?: string;
  badgeId?: string;
  name?: string;
  title?: string;
  description?: string;
  icon?: string;
  badgeUrl?: string;
  rarity?: string;
  category?: string;
  points?: number;
  earnedAt?: number | Date;
  earnedDate?: Date;
  isEarned?: boolean;
  verified?: boolean;
}) {
  return {
    id: String(a.id ?? a._id ?? ''),
    userId: a.userId || a.user,
    badgeId: a.badgeId,
    name: a.name || a.title || 'Achievement',
    title: a.title || a.name,
    description: a.description || '',
    icon: a.icon,
    badgeUrl: a.badgeUrl,
    rarity: a.rarity,
    category: a.category,
    points: a.points ?? 0,
    earnedAt: a.earnedAt ? new Date(a.earnedAt) : a.earnedDate,
    earnedDate: a.earnedDate,
    isEarned: a.isEarned ?? Boolean(a.verified),
    verified: a.verified,
  };
}

async function wrap<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw toGraphQLError(error);
  }
}

export const resolvers = {
  DateTime: DateTimeScalar,
  JSON: JSONScalar,

  Query: {
    user: (_parent: unknown, args: { id: string }, ctx: GraphQLContext) =>
      wrap(async () => {
        const profile = await ctx.loaders.userById.load(args.id);
        if (!profile) return null;
        return {
          id: profile.owner || args.id,
          email: profile.email,
          username: profile.username,
          role: profile.role,
          bio: profile.bio,
          avatarUrl: profile.avatarUrl,
          address: profile.owner,
          reputation: profile.reputation,
          createdAt: profile.createdAt ? new Date(profile.createdAt) : null,
          updatedAt: profile.updatedAt ? new Date(profile.updatedAt) : null,
        };
      }),

    courses: (_parent: unknown, args: { filter?: Record<string, unknown> | null }, ctx: GraphQLContext) =>
      wrap(async () => {
        const filter = args.filter || {};
        const query = typeof filter.query === 'string' ? filter.query : '';
        const page = typeof filter.page === 'number' ? filter.page : 1;
        const limit = typeof filter.limit === 'number' ? filter.limit : 10;

        const searchFilter: SearchFilter = {
          category: filter.category as string | undefined,
          level: filter.level as SearchFilter['level'],
          language: filter.language as string | undefined,
          instructor: filter.instructor as string | undefined,
          tags: filter.tags as string[] | undefined,
          rating: filter.rating as number | undefined,
          sortBy: mapSortBy(filter.sortBy as string | undefined),
          page,
          limit,
        };

        if (typeof filter.minPrice === 'number' || typeof filter.maxPrice === 'number') {
          searchFilter.priceRange = {
            min: typeof filter.minPrice === 'number' ? filter.minPrice : 0,
            max: typeof filter.maxPrice === 'number' ? filter.maxPrice : Number.MAX_SAFE_INTEGER,
          };
        }

        const sessionId =
          (ctx.req.headers['x-session-id'] as string) ||
          `graphql-${ctx.user?.id || ctx.req.ip || 'anon'}`;

        const result = await searchService.searchCourses(
          query,
          searchFilter,
          sessionId,
          ctx.user?.id,
          true
        );

        return {
          courses: result.courses,
          total: result.total,
          page: result.page,
          limit: result.limit,
          hasMore: result.hasMore,
        };
      }),

    course: (_parent: unknown, args: { id: string }, ctx: GraphQLContext) =>
      wrap(async () => ctx.loaders.courseById.load(args.id)),

    credential: (_parent: unknown, args: { hash: string }, ctx: GraphQLContext) =>
      wrap(async () => {
        const doc = await ctx.loaders.credentialByHash.load(args.hash);
        return doc ? mapCredential(doc) : null;
      }),

    enrollment: (_parent: unknown, args: { userId: string; courseId: string }, ctx: GraphQLContext) =>
      wrap(async () => {
        if (ctx.user) {
          requireSelfOrAdmin(ctx.user, args.userId);
        } else {
          requireAuth(ctx.user);
        }
        return ctx.loaders.enrollmentByUserCourse.load(userCourseKey(args.userId, args.courseId));
      }),

    enrollments: (_parent: unknown, args: { userId?: string; courseId?: string; page?: number; limit?: number }, ctx: GraphQLContext) =>
      wrap(async () => {
        requireAuth(ctx.user);
        const userId = args.userId || ctx.user!.id;
        requireSelfOrAdmin(ctx.user, userId);

        const result = await enrollmentService.getEnrollments({
          userId,
          courseId: args.courseId,
          page: args.page || 1,
          limit: args.limit || 20,
        });
        return result.enrollments;
      }),

    achievements: (_parent: unknown, args: { userId: string }, ctx: GraphQLContext) =>
      wrap(async () => {
        const list = await ctx.loaders.achievementsByUserId.load(args.userId);
        return list.map(mapAchievement);
      }),

    analytics: (_parent: unknown, args: { userId?: string; courseId?: string }) =>
      wrap(async () => {
        if (!args.userId && !args.courseId) {
          throw new ValidationError('Provide userId and/or courseId');
        }

        if (args.courseId) {
          const courseAnalytics = await AnalyticsService.getCourseAnalytics(args.courseId);
          return {
            courseId: args.courseId,
            userId: args.userId,
            completionRate: courseAnalytics?.completionRate,
            totalEnrollments: courseAnalytics?.totalEnrollments,
            averageProgress: courseAnalytics?.averageProgress,
            lastUpdated: courseAnalytics?.lastUpdated ? new Date(courseAnalytics.lastUpdated) : new Date(),
            raw: courseAnalytics,
          };
        }

        const insights = await AnalyticsService.getUserInsights(args.userId!);
        return {
          userId: args.userId,
          recentActivity: insights.recentActivity,
          learningTrend: insights.learningTrend,
          lastUpdated: new Date(),
          raw: insights,
        };
      }),
  },

  Mutation: {
    enrollInCourse: (
      _parent: unknown,
      args: {
        input: {
          courseId: string;
          paymentMethod?: string;
          amount?: number;
          currency?: string;
        };
      },
      ctx: GraphQLContext
    ) =>
      wrap(async () => {
        requireAuth(ctx.user);
        const { courseId } = args.input;
        const userId = ctx.user!.id;

        if (!courseId) {
          throw new ValidationError('courseId is required');
        }

        const existing = await enrollmentService.getUserEnrollmentForCourse(userId, courseId);
        if (existing) {
          throw new ConflictError('Already enrolled in this course');
        }

        const prerequisitesMet = await enrollmentService.validatePrerequisites(userId, courseId);
        if (!prerequisitesMet.valid) {
          throw new ValidationError('Prerequisites not met', {
            missingPrerequisites: prerequisitesMet.missing,
          });
        }

        const capacity = await enrollmentService.getCourseCapacity(courseId);
        if (capacity.currentEnrollments >= capacity.maxStudents) {
          const waitlistPosition = await enrollmentService.addToWaitlist(userId, courseId);
          return enrollmentService.createEnrollment({
            userId,
            courseId,
            paymentMethod: (args.input.paymentMethod as PaymentMethod) || PaymentMethod.STELLAR,
            amountPaid: 0,
            totalAmount: args.input.amount ?? 0,
            currency: args.input.currency || 'XLM',
            status: EnrollmentStatus.PENDING,
            paymentStatus: PaymentStatus.PENDING,
            prerequisitesMet: true,
            waitlistPosition,
          } as any);
        }

        const paymentMethod = (args.input.paymentMethod as PaymentMethod) || PaymentMethod.STELLAR;

        return enrollmentService.createEnrollment({
          userId,
          courseId,
          paymentMethod,
          amountPaid: 0,
          totalAmount: args.input.amount ?? 0,
          currency: args.input.currency || 'XLM',
          status: EnrollmentStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          prerequisitesMet: true,
        } as any);
      }),

    issueCredential: (
      _parent: unknown,
      args: {
        input: {
          issuer: string;
          recipient: string;
          credentialHash: string;
          metadata: string;
          releaseTime: Date;
        };
      },
      ctx: GraphQLContext
    ) =>
      wrap(async () => {
        requireAuth(ctx.user);
        const { issuer, recipient, credentialHash, metadata, releaseTime } = args.input;

        if (!issuer || !recipient || !credentialHash || !metadata || !releaseTime) {
          throw new ValidationError('All credential fields are required');
        }

        const release = releaseTime instanceof Date ? releaseTime : new Date(releaseTime);

        const credential = await timeLockCredentialService.issueCredential(
          {
            issuer,
            recipient,
            credentialHash,
            metadata,
            releaseTime: release,
          },
          {
            actor: ctx.user!.id,
            ipAddress: ctx.req.ip,
          }
        );

        return mapCredential(credential);
      }),
  },

  User: {
    achievements: (parent: { id: string }, _args: unknown, ctx: GraphQLContext) =>
      wrap(async () => {
        const list = await ctx.loaders.achievementsByUserId.load(parent.id);
        return list.map(mapAchievement);
      }),

    credentials: (parent: { id: string; address?: string }, _args: unknown, ctx: GraphQLContext) =>
      wrap(async () => {
        const recipient = parent.address || parent.id;
        const list = await ctx.loaders.credentialsByRecipient.load(recipient);
        return list.map(mapCredential);
      }),

    enrollments: (parent: { id: string }, _args: unknown, ctx: GraphQLContext) =>
      wrap(async () => ctx.loaders.enrollmentsByUserId.load(parent.id)),

    stats: (parent: { id: string; address?: string }) =>
      wrap(async () => userService.getProfileStats(parent.address || parent.id)),
  },

  Enrollment: {
    user: (parent: { userId: string }, _args: unknown, ctx: GraphQLContext) =>
      wrap(async () => {
        const profile = await ctx.loaders.userById.load(parent.userId);
        if (!profile) return null;
        return {
          id: profile.owner || parent.userId,
          email: profile.email,
          username: profile.username,
          role: profile.role,
          bio: profile.bio,
          avatarUrl: profile.avatarUrl,
          address: profile.owner,
          reputation: profile.reputation,
          createdAt: profile.createdAt ? new Date(profile.createdAt) : null,
          updatedAt: profile.updatedAt ? new Date(profile.updatedAt) : null,
        };
      }),

    course: (parent: { courseId: string }, _args: unknown, ctx: GraphQLContext) =>
      wrap(async () => {
        const course = await ctx.loaders.courseById.load(parent.courseId);
        if (!course) {
          throw new NotFoundError(`Course not found: ${parent.courseId}`);
        }
        return course;
      }),
  },
};
