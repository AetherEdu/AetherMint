import type { Meta, StoryObj } from '@storybook/react';
import { ProgressDashboard } from './ProgressDashboard';

const mockEnrollments = [
  {
    id: 'enr-001',
    courseId: 'course-001',
    status: 'active',
    enrolledAt: '2026-06-15T10:00:00Z',
    progress: 75,
    lastAccessed: '2026-07-20T14:30:00Z',
    timeSpent: 12.5,
    completedLessons: 15,
    totalLessons: 20,
    certificateIssued: false,
    course: {
      id: 'course-001',
      title: 'Introduction to Stellar Blockchain',
      thumbnail: '',
      instructor: { name: 'Dr. Jane Smith' },
      metadata: { duration: 20, level: 'beginner' },
    },
  },
  {
    id: 'enr-002',
    courseId: 'course-002',
    status: 'completed',
    enrolledAt: '2026-05-01T08:00:00Z',
    progress: 100,
    lastAccessed: '2026-06-10T09:00:00Z',
    timeSpent: 25,
    completedLessons: 30,
    totalLessons: 30,
    certificateIssued: true,
    course: {
      id: 'course-002',
      title: 'Soroban Smart Contracts',
      thumbnail: '',
      instructor: { name: 'Prof. John Doe' },
      metadata: { duration: 30, level: 'intermediate' },
    },
  },
  {
    id: 'enr-003',
    courseId: 'course-003',
    status: 'pending',
    enrolledAt: '2026-07-18T12:00:00Z',
    progress: 0,
    lastAccessed: '2026-07-18T12:00:00Z',
    timeSpent: 0,
    completedLessons: 0,
    totalLessons: 15,
    certificateIssued: false,
    course: {
      id: 'course-003',
      title: 'DeFi Fundamentals',
      thumbnail: '',
      instructor: { name: 'Alice Johnson' },
      metadata: { duration: 15, level: 'beginner' },
    },
  },
];

const meta: Meta<typeof ProgressDashboard> = {
  title: 'Composite Components/ProgressDashboard',
  component: ProgressDashboard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Comprehensive learning progress dashboard displaying enrollment stats, progress analytics, and learning activity. Features tabbed views, search/filter, and data export.',
      },
    },
  },
  argTypes: {
    timeRange: {
      control: 'select',
      options: ['week', 'month', 'quarter', 'year'],
      description: 'Time range filter for analytics',
    },
    userId: {
      control: 'text',
      description: 'Target user ID',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ProgressDashboard>;

// ─── Stories ─────────────────────────────────────────────────────────────────

export const MonthView: Story = {
  name: 'Default — Month View',
  args: {
    timeRange: 'month',
  },
};

export const WeekView: Story = {
  name: 'Week View',
  args: {
    timeRange: 'week',
  },
};

export const QuarterView: Story = {
  name: 'Quarter View',
  args: {
    timeRange: 'quarter',
  },
};

export const YearView: Story = {
  name: 'Year View',
  args: {
    timeRange: 'year',
  },
};

export const SpecificUser: Story = {
  name: 'Specific User Dashboard',
  args: {
    userId: 'user-abc-123',
    timeRange: 'month',
  },
};

export const LoadingState: Story = {
  name: 'Loading State',
  args: {
    timeRange: 'month',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows the loading spinner while dashboard data is being fetched.',
      },
    },
  },
};
