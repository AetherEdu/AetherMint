import type { Meta, StoryObj } from '@storybook/react';
import { LoadingSpinner } from './LoadingSpinner';

const meta = {
  title: 'UI Components/LoadingSpinner',
  component: LoadingSpinner,
  tags: ['autodocs'],
  args: { size: 'md', label: 'Loading…', showLabel: false },
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg', 'xl'] },
    showLabel: { control: 'boolean' },
  },
} satisfies Meta<typeof LoadingSpinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithLabel: Story = { args: { showLabel: true, label: 'Loading course data…' } };
export const AllSizes: Story = {
  render: () => (
    <div className="flex items-end gap-8">
      {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <LoadingSpinner size={size} label={`Loading (${size})`} />
          <span className="text-xs text-gray-500">{size}</span>
        </div>
      ))}
    </div>
  ),
};
