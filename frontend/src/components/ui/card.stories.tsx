import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardHeader, CardTitle, CardContent } from './card';
import { Button } from './button';

const meta: Meta<typeof Card> = {
  title: 'UI Components/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    as: {
      control: 'text',
      description: 'Element type to render as',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
    children: {
      control: 'text',
      description: 'Card content',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

// ─── Basic Card ──────────────────────────────────────────────────────────────

export const Default: Story = {
  render: () => (
    <Card className="max-w-sm border border-gray-200 rounded-xl p-6 shadow-sm">
      <CardHeader>
        <CardTitle>Course Title</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600">
          This is a sample card component used throughout the AetherMint
          platform. It provides a consistent container for content display.
        </p>
      </CardContent>
    </Card>
  ),
};

// ─── Card with Content ───────────────────────────────────────────────────────

export const WithImageContent: Story = {
  name: 'Course Card',
  render: () => (
    <Card className="max-w-sm border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="h-40 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
        <span className="text-white text-4xl">📚</span>
      </div>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-lg">Introduction to Blockchain</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <p className="text-sm text-gray-600">
          Learn the fundamentals of blockchain technology and decentralized
          applications.
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
            Beginner
          </span>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
            Free
          </span>
        </div>
        <Button size="sm" className="w-full mt-2">
          Enroll Now
        </Button>
      </CardContent>
    </Card>
  ),
};

// ─── Empty Card ──────────────────────────────────────────────────────────────

export const Empty: Story = {
  name: 'Empty State',
  render: () => (
    <Card className="max-w-sm border border-dashed border-gray-300 rounded-xl p-8">
      <CardContent className="flex flex-col items-center justify-center text-center space-y-3">
        <span className="text-4xl">📭</span>
        <CardTitle className="text-lg">No courses yet</CardTitle>
        <p className="text-sm text-gray-500">
          You haven&apos;t enrolled in any courses. Browse the catalog to get
          started.
        </p>
        <Button variant="outline" size="sm">
          Browse Courses
        </Button>
      </CardContent>
    </Card>
  ),
};

// ─── Dashboard Card ──────────────────────────────────────────────────────────

export const DashboardStatCard: Story = {
  name: 'Stat Card',
  render: () => (
    <Card className="max-w-[200px] border border-gray-200 rounded-xl p-4">
      <CardContent className="pt-0 space-y-1">
        <p className="text-sm text-gray-500">Active Courses</p>
        <p className="text-3xl font-bold text-blue-600">12</p>
        <p className="text-xs text-green-600">+2 this month</p>
      </CardContent>
    </Card>
  ),
};

// ─── Loading Card ────────────────────────────────────────────────────────────

export const Loading: Story = {
  name: 'Loading State',
  render: () => (
    <Card className="max-w-sm border border-gray-200 rounded-xl overflow-hidden">
      <div className="h-40 bg-gray-200 animate-pulse" />
      <CardHeader className="p-4 pb-2">
        <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse" />
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse" />
        <div className="flex gap-2 mt-2">
          <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" />
          <div className="h-5 w-12 bg-gray-200 rounded-full animate-pulse" />
        </div>
      </CardContent>
    </Card>
  ),
};

// ─── Card Grid ───────────────────────────────────────────────────────────────

export const CardGrid: Story = {
  name: 'Card Grid Layout',
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {[1, 2, 3].map((i) => (
        <Card
          key={i}
          className="border border-gray-200 rounded-xl overflow-hidden shadow-sm"
        >
          <div className="h-32 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
            <span className="text-white text-3xl">🎓</span>
          </div>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-base">Course {i}</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-xs text-gray-500">
              Course description goes here. Learn something new!
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  ),
};
