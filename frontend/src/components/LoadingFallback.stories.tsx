import type { Meta, StoryObj } from '@storybook/react';
import {
  EmptyState,
  ErrorDisplay,
  LoadingFallback,
  SkeletonCard,
  SkeletonList,
  SkeletonProfile,
} from './LoadingFallback';

const meta = {
  title: 'UI Components/LoadingFallback',
  component: LoadingFallback,
  tags: ['autodocs'],
  args: { message: 'Loading course data…', size: 'md' },
  argTypes: { size: { control: 'select', options: ['sm', 'md', 'lg'] } },
} satisfies Meta<typeof LoadingFallback>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {};
export const LargeLoading: Story = { args: { size: 'lg', message: 'Preparing your dashboard…' } };
export const Empty: Story = {
  render: () => (
    <EmptyState
      title="No courses found"
      description="Enroll in a course to see your learning progress here."
      action={{ label: 'Browse courses', onClick: () => undefined }}
    />
  ),
};
export const Error: Story = {
  render: () => (
    <ErrorDisplay
      title="Could not load courses"
      message="Check your connection and try again."
      details="Request failed with status 503"
      onRetry={() => undefined}
    />
  ),
};
export const Skeletons: Story = {
  render: () => (
    <div className="max-w-2xl space-y-6">
      <SkeletonProfile />
      <SkeletonCard />
      <SkeletonList rows={2} />
    </div>
  ),
};
