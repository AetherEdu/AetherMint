'use client';

import Link from 'next/link';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Flame,
  GraduationCap,
  Lightbulb,
  Lock,
  Trophy,
} from 'lucide-react';

export interface LearnerDashboardData {
  enrollments: Array<{
    id: string;
    courseId: string;
    status: string;
    progress: number;
    completedLessons: number;
    totalLessons: number;
    certificateIssued: boolean;
    lastAccessed: string;
    course: {
      title: string;
      slug: string;
      description: string;
      skills: string[];
      level?: string;
    } | null;
  }>;
  achievements: Array<{
    _id?: string;
    id?: string;
    name?: string;
    title?: string;
    description: string;
    icon?: string;
    rarity?: string;
    earnedDate?: string;
  }>;
  credentials: Array<{
    _id?: string;
    credentialId: string;
    issuer: string;
    metadata: string;
    createdAt: string;
  }>;
  skills: Array<{ name: string; completedCourses: number }>;
  recommendations: Array<{
    id: string;
    slug: string;
    title: string;
    description: string;
    level?: string;
    skills: string[];
  }>;
  stats: {
    totalEnrollments: number;
    activeEnrollments: number;
    completedEnrollments: number;
    averageProgress: number;
    totalHours: number;
    certificatesEarned: number;
    currentStreak: number;
    longestStreak: number;
  };
}

interface LearnerDashboardProps {
  data: LearnerDashboardData;
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  const boundedValue = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-slate-600 dark:text-slate-300">{label}</span>
        <span className="font-semibold text-slate-900 dark:text-white">{boundedValue}%</span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={boundedValue}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-[width]"
          style={{ width: `${boundedValue}%` }}
        />
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof BookOpen;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${title.toLowerCase().replace(/\s+/g, '-')}-heading`}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <h2
        id={`${title.toLowerCase().replace(/\s+/g, '-')}-heading`}
        className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white"
      >
        <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        {title}
      </h2>
      {children}
    </section>
  );
}

export function LearnerDashboard({ data }: LearnerDashboardProps) {
  const { stats } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Active courses', value: stats.activeEnrollments, icon: BookOpen },
          { label: 'Completed', value: stats.completedEnrollments, icon: CheckCircle2 },
          { label: 'Certificates', value: stats.certificatesEarned, icon: GraduationCap },
          { label: 'Day streak', value: stats.currentStreak, icon: Flame },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <Icon className="mb-3 h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 p-6 text-white shadow-md">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-100">Your learning overview</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Keep building momentum</h1>
            <p className="mt-2 max-w-2xl text-sm text-blue-100">
              You have spent {stats.totalHours} hours learning and your longest streak is {stats.longestStreak} days.
            </p>
          </div>
          <div className="min-w-44 rounded-xl bg-white/15 p-4 backdrop-blur-sm">
            <ProgressBar value={stats.averageProgress} label="Overall progress" />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Section title="Course progress" icon={BookOpen}>
          {data.enrollments.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-600 dark:text-slate-400">
              You are not enrolled in a course yet.
            </p>
          ) : (
            <div className="space-y-5">
              {data.enrollments.map((enrollment) => (
                <article key={enrollment.id} className="border-b border-slate-100 pb-5 last:border-0 last:pb-0 dark:border-slate-800">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {enrollment.course?.title || enrollment.courseId}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {enrollment.completedLessons} of {enrollment.totalLessons} lessons completed
                      </p>
                    </div>
                    <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {enrollment.status}
                    </span>
                  </div>
                  <ProgressBar value={enrollment.progress} label={`${enrollment.course?.title || 'Course'} progress`} />
                </article>
              ))}
            </div>
          )}
        </Section>

        <Section title="Skill graph" icon={Lightbulb}>
          {data.skills.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-600 dark:text-slate-400">
              Complete course content to grow your skill graph.
            </p>
          ) : (
            <div className="space-y-4">
              {data.skills.map((skill) => (
                <div key={skill.name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{skill.name}</span>
                    <span className="text-slate-500 dark:text-slate-400">{skill.completedCourses} course{skill.completedCourses === 1 ? '' : 's'}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-2 rounded-full bg-violet-500"
                      style={{ width: `${Math.min(100, skill.completedCourses * 25)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Achievements" icon={Trophy}>
          {data.achievements.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-600 dark:text-slate-400">Your earned achievements will appear here.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.achievements.map((achievement) => (
                <div key={achievement._id || achievement.id} className="rounded-xl border border-amber-100 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl" aria-hidden="true">{achievement.icon || '🏆'}</span>
                    <div className="min-w-0">
                      <h3 className="font-medium text-slate-900 dark:text-white">{achievement.name || achievement.title}</h3>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{achievement.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Verified credentials" icon={Award}>
          {data.credentials.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-600 dark:text-slate-400">Earned credentials will appear here.</p>
          ) : (
            <ul className="space-y-3">
              {data.credentials.map((credential) => (
                <li key={credential._id || credential.credentialId} className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white">{credential.credentialId}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Issued by {credential.issuer}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Next steps" icon={Lightbulb}>
        {data.recommendations.length === 0 ? (
          <p className="py-4 text-sm text-slate-600 dark:text-slate-400">No recommendations are available right now.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.recommendations.map((course) => (
              <article key={course.id} className="flex flex-col rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium capitalize text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                    {course.level || 'Course'}
                  </span>
                  <span className="text-xs text-slate-500">{course.skills.slice(0, 2).join(' · ')}</span>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{course.title}</h3>
                <p className="mt-2 line-clamp-3 flex-1 text-sm text-slate-600 dark:text-slate-400">{course.description}</p>
                <Link href={`/courses/${course.slug}`} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                  View course
                </Link>
              </article>
            ))}
          </div>
        )}
      </Section>

      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Lock className="h-4 w-4" aria-hidden="true" />
        Your dashboard only includes data belonging to your authenticated account.
      </div>
    </div>
  );
}
