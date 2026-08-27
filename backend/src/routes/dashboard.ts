import express, { Request, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { EnrollmentModel, EnrollmentStatus, IEnrollmentDocument } from '../models/Enrollment';
import { CourseModel, CourseStatus, ICourseDocument } from '../models/Course';
import { TimeLockedCredential } from '../models/TimeLockedCredential';
// The achievement model is CommonJS and does not ship TypeScript declarations.
// @ts-ignore
import AchievementModel from '../models/Achievement';

const router = express.Router();

const DAY_MS = 24 * 60 * 60 * 1000;

type DashboardEnrollment = {
  id: string;
  courseId: string;
  status: string;
  enrolledAt: Date;
  lastAccessed: Date;
  progress: number;
  completedLessons: number;
  totalLessons: number;
  certificateIssued: boolean;
  course: {
    id: string;
    title: string;
    slug: string;
    description: string;
    skills: string[];
    level?: string;
    category?: string;
  } | null;
};

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asDate(value: unknown, fallback = new Date()): Date {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function documentId(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  return String(record._id ?? record.id ?? '');
}

function calculateStreak(dates: Date[]): { current: number; longest: number } {
  const uniqueDays = Array.from(new Set(dates.map(dayKey)))
    .map((value) => new Date(`${value}T00:00:00.000Z`))
    .sort((a, b) => a.getTime() - b.getTime());

  if (uniqueDays.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let index = 1; index < uniqueDays.length; index += 1) {
    if (uniqueDays[index].getTime() - uniqueDays[index - 1].getTime() === DAY_MS) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  const today = new Date();
  const todayKey = dayKey(today);
  const yesterdayKey = dayKey(new Date(today.getTime() - DAY_MS));
  const latestKey = dayKey(uniqueDays[uniqueDays.length - 1]);
  let current = latestKey === todayKey || latestKey === yesterdayKey ? 1 : 0;

  if (current > 0) {
    for (let index = uniqueDays.length - 1; index > 0; index -= 1) {
      if (uniqueDays[index].getTime() - uniqueDays[index - 1].getTime() !== DAY_MS) break;
      current += 1;
    }
  }

  return { current, longest };
}

function buildSkills(enrollments: DashboardEnrollment[]) {
  const counts = new Map<string, number>();
  for (const enrollment of enrollments) {
    if (enrollment.progress <= 0 || !enrollment.course) continue;
    for (const skill of enrollment.course.skills || []) {
      const normalized = skill.trim();
      if (normalized) counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([name, completedCourses]) => ({ name, completedCourses }))
    .sort((a, b) => b.completedCourses - a.completedCourses || a.name.localeCompare(b.name))
    .slice(0, 12);
}

/**
 * @openapi
 * /api/dashboard:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get the authenticated learner dashboard
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Dashboard aggregation retrieved
 *       '401':
 *         description: Authentication required
 *       '500':
 *         description: Dashboard data could not be loaded
 */
router.get('/', authMiddleware, async (req: Request, res: Response, next) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const userId = user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const [enrollmentDocuments, achievements, credentials] = await Promise.all([
      EnrollmentModel.find({ userId }).sort({ updatedAt: -1 }).lean(),
      AchievementModel.find({ userId, isEarned: true }).sort({ earnedDate: -1 }).lean(),
      TimeLockedCredential.find({
        recipient: { $in: [userId, user?.address].filter(Boolean) },
        isReleased: true,
        isRevoked: false,
      }).sort({ createdAt: -1 }).lean(),
    ]);

    const typedEnrollments = enrollmentDocuments as unknown as Array<IEnrollmentDocument & { metadata?: Record<string, unknown> }>;
    const courseIds = typedEnrollments.map((enrollment) => enrollment.courseId);
    const courses = await CourseModel.find({
      $or: [
        { slug: { $in: courseIds } },
        { _id: { $in: courseIds } },
      ],
    }).lean() as unknown as Array<ICourseDocument>;
    const courseById = new Map(courses.map((course) => [documentId(course), course]));
    for (const course of courses) courseById.set(course.slug, course);

    const enrollments: DashboardEnrollment[] = typedEnrollments.map((enrollment) => {
      const course = courseById.get(enrollment.courseId);
      const progress = Math.min(100, Math.max(0, asNumber(enrollment.progress)));
      const metadata = enrollment.metadata || {};
      const totalLessons = Math.max(1, asNumber((metadata as Record<string, unknown>).totalLessons, 1));
      return {
        id: documentId(enrollment),
        courseId: enrollment.courseId,
        status: enrollment.status,
        enrolledAt: asDate(enrollment.enrolledAt),
        lastAccessed: asDate(enrollment.updatedAt, asDate(enrollment.enrolledAt)),
        progress,
        completedLessons: Math.round((progress / 100) * totalLessons),
        totalLessons,
        certificateIssued: Boolean(enrollment.certificateIssued),
        course: course
          ? {
              id: documentId(course),
              title: course.title,
              slug: course.slug,
              description: course.shortDescription || course.description,
              skills: course.skills || [],
              level: course.level,
              category: course.category,
            }
          : null,
      };
    });

    const activityDates = enrollments.flatMap((enrollment) => [
      enrollment.enrolledAt,
      enrollment.lastAccessed,
    ]);
    const streak = calculateStreak(activityDates);
    const completedEnrollments = enrollments.filter(
      (enrollment) => enrollment.status === EnrollmentStatus.COMPLETED || enrollment.progress >= 100,
    );
    const activeEnrollments = enrollments.filter(
      (enrollment) => ![EnrollmentStatus.CANCELLED, EnrollmentStatus.REFUNDED].includes(enrollment.status as EnrollmentStatus),
    );

    const totalHours = typedEnrollments.reduce((total, enrollment) => {
      const metadata = enrollment.metadata || {};
      const value = (metadata as Record<string, unknown>).timeSpentHours;
      return total + asNumber(value);
    }, 0);

    const enrolledIds = new Set(courseIds);
    const skills = buildSkills(enrollments);
    const recommendedCourses = await CourseModel.find({
      status: CourseStatus.PUBLISHED,
      slug: { $nin: Array.from(enrolledIds) },
    }).limit(30).lean() as unknown as Array<ICourseDocument>;
    const skillNames = new Set(skills.map((skill) => skill.name.toLowerCase()));
    const recommendations = recommendedCourses
      .map((course) => ({
        id: documentId(course),
        slug: course.slug,
        title: course.title,
        description: course.shortDescription || course.description,
        level: course.level,
        category: course.category,
        skills: course.skills || [],
        score: (course.skills || []).filter((skill) => skillNames.has(skill.toLowerCase())).length,
      }))
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, 5)
      .map(({ score: _score, ...course }) => course);

    res.json({
      success: true,
      data: {
        enrollments,
        achievements,
        credentials,
        skills,
        recommendations,
        stats: {
          totalEnrollments: enrollments.length,
          activeEnrollments: activeEnrollments.length,
          completedEnrollments: completedEnrollments.length,
          averageProgress: enrollments.length
            ? Math.round(enrollments.reduce((sum, enrollment) => sum + enrollment.progress, 0) / enrollments.length)
            : 0,
          totalHours: Math.round(totalHours * 10) / 10,
          certificatesEarned: enrollments.filter((enrollment) => enrollment.certificateIssued).length,
          currentStreak: streak.current,
          longestStreak: streak.longest,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
