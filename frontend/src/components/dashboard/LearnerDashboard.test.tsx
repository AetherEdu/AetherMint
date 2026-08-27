import { render, screen } from '@testing-library/react';
import { LearnerDashboard, LearnerDashboardData } from './LearnerDashboard';

const dashboardData: LearnerDashboardData = {
  enrollments: [
    {
      id: 'enrollment-1',
      courseId: 'course-1',
      status: 'active',
      progress: 65,
      completedLessons: 13,
      totalLessons: 20,
      certificateIssued: false,
      lastAccessed: '2026-08-20T00:00:00.000Z',
      course: {
        title: 'Stellar Foundations',
        slug: 'stellar-foundations',
        description: 'Learn Stellar fundamentals.',
        skills: ['Stellar', 'Soroban'],
        level: 'beginner',
      },
    },
  ],
  achievements: [
    {
      id: 'achievement-1',
      name: 'First Steps',
      description: 'Complete your first course.',
      icon: '🎯',
    },
  ],
  credentials: [
    {
      credentialId: 'credential-1',
      issuer: 'AetherMint Academy',
      metadata: '{}',
      createdAt: '2026-08-20T00:00:00.000Z',
    },
  ],
  skills: [{ name: 'Stellar', completedCourses: 2 }],
  recommendations: [
    {
      id: 'course-2',
      slug: 'soroban-advanced',
      title: 'Soroban Advanced',
      description: 'Build production contracts.',
      level: 'advanced',
      skills: ['Soroban'],
    },
  ],
  stats: {
    totalEnrollments: 1,
    activeEnrollments: 1,
    completedEnrollments: 0,
    averageProgress: 65,
    totalHours: 12.5,
    certificatesEarned: 1,
    currentStreak: 4,
    longestStreak: 8,
  },
};

describe('LearnerDashboard', () => {
  it('renders progress, achievements, credentials, skills, and recommendations', () => {
    render(<LearnerDashboard data={dashboardData} />);

    expect(screen.getByRole('heading', { name: 'Course progress' })).toBeInTheDocument();
    expect(screen.getByText('Stellar Foundations')).toBeInTheDocument();
    expect(screen.getByText('First Steps')).toBeInTheDocument();
    expect(screen.getByText('credential-1')).toBeInTheDocument();
    expect(screen.getByText('Stellar')).toBeInTheDocument();
    expect(screen.getByText('Soroban Advanced')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Overall progress' })).toHaveAttribute('aria-valuenow', '65');
  });
});
