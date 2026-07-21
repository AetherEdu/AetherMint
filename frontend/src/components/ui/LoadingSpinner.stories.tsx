import type { Meta, StoryObj } from '@storybook/react';
import { LoadingSpinner } from './LoadingSpinner';

const meta: Meta<typeof LoadingSpinner> = {
  title: 'UI Components/LoadingSpinner',
  component: LoadingSpinner,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
      description: 'Spinner size',
    },
    label: {
      control: 'text',
      description: 'Accessible label for screen readers',
    },
    showLabel: {
      control: 'boolean',
      description: 'Show a visible label below the spinner',
    },
  },
  args: {
    size: 'md',
    label: 'Loading…',
    showLabel: false,
  },
};

export default meta;
type Story = StoryObj<typeof LoadingSpinner>;

// ─── Sizes ───────────────────────────────────────────────────────────────────

export const Small: Story = {
  args: { size: 'sm' },
  name: 'Small (20px)',
};

export const Medium: Story = {
  args: { size: 'md' },
  name: 'Medium (32px) — Default',
};

export const Large: Story = {
  args: { size: 'lg' },
  name: 'Large (48px)',
};

export const ExtraLarge: Story = {
  args: { size: 'xl' },
  name: 'Extra Large (64px)',
};

// ─── With Label ──────────────────────────────────────────────────────────────

export const WithVisibleLabel: Story = {
  args: {
    size: 'md',
    showLabel: true,
    label: 'Fetching course data…',
  },
  name: 'With Visible Label',
};

export const CustomLabel: Story = {
  args: {
    size: 'lg',
    showLabel: true,
    label: 'Connecting to Stellar network…',
  },
  name: 'Custom Accessible Label',
};

// ─── All Sizes Overview ──────────────────────────────────────────────────────

export const AllSizes: Story = {
  name: 'All Sizes Overview',
  render: () => (
    <div className="flex items-end gap-8 p-6">
      {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <LoadingSpinner size={size} />
          <span className="text-xs text-gray-500 mt-2">{size}</span>
        </div>
      ))}
    </div>
  ),
};

// ─── Full Page Loading ───────────────────────────────────────────────────────

export const FullPageOverlay: Story = {
  name: 'Full Page Overlay',
  render: () => (
    <div className="flex items-center justify-center min-h-[400px] bg-gray-50 rounded-xl">
      <LoadingSpinner size="xl" showLabel label="Loading dashboard…" />
    </div>
  ),
};

// ─── In Card Context ─────────────────────────────────────────────────────────

export const Inline: Story = {
  name: 'Inline (Button Context)',
  render: () => (
    <button
      disabled
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg opacity-75"
    >
      <LoadingSpinner size="sm" label="Processing…" />
      <span>Processing…</span>
    </button>
  ),
};
