import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';

const meta = {
  title: 'UI Components/Card',
  component: Card,
  tags: ['autodocs'],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="max-w-md rounded-xl border border-gray-200 p-6 shadow-sm dark:border-gray-700">
      <CardHeader>
        <CardTitle>Course overview</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600 dark:text-gray-300">Learn the foundations of decentralized education.</p>
      </CardContent>
    </Card>
  ),
};

export const WithAction: Story = {
  render: () => (
    <Card className="max-w-md rounded-xl border border-gray-200 p-6 shadow-sm dark:border-gray-700">
      <CardHeader><CardTitle>Continue learning</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-gray-600 dark:text-gray-300">Your next lesson is ready.</p>
        <Button>Open lesson</Button>
      </CardContent>
    </Card>
  ),
};

export const Empty: Story = {
  render: () => (
    <Card className="max-w-md rounded-xl border border-dashed border-gray-300 p-8 text-center">
      <CardContent>
        <CardTitle>No courses yet</CardTitle>
        <p className="mt-2 text-gray-500">Browse the catalog to begin learning.</p>
      </CardContent>
    </Card>
  ),
};

export const Loading: Story = {
  render: () => (
    <Card className="max-w-md space-y-4 rounded-xl border border-gray-200 p-6">
      <div className="h-5 w-2/3 animate-pulse rounded bg-gray-200" />
      <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
      <div className="h-4 w-4/5 animate-pulse rounded bg-gray-200" />
    </Card>
  ),
};
