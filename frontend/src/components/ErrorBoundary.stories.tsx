import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

function ThrowOnRender({ message = 'Preview error' }: { message?: string }): never {
  throw new Error(message);
}

const meta = {
  title: 'UI Components/ErrorBoundary',
  component: ErrorBoundary,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'network', 'wallet', 'payment'] },
    errorTitle: { control: 'text' },
    errorMessage: { control: 'text' },
    showErrorDetails: { control: 'boolean' },
  },
} satisfies Meta<typeof ErrorBoundary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Healthy: Story = {
  args: { children: null },
  render: () => <ErrorBoundary><p className="text-green-700">The component rendered successfully.</p></ErrorBoundary>,
};
export const DefaultError: Story = {
  args: { children: null },
  render: () => <ErrorBoundary><ThrowOnRender /></ErrorBoundary>,
};
export const NetworkError: Story = {
  args: { children: null },
  render: () => <ErrorBoundary variant="network"><ThrowOnRender message="Network request failed" /></ErrorBoundary>,
};
export const CustomFallback: Story = {
  args: { children: null },
  render: () => (
    <ErrorBoundary fallback={<div role="alert" className="rounded border border-red-300 p-4">Custom recovery UI</div>}>
      <ThrowOnRender message="Custom fallback example" />
    </ErrorBoundary>
  ),
};
export const Resettable: Story = {
  args: { children: null },
  render: () => {
    const [resetKey, setResetKey] = React.useState(0);
    return (
      <div className="space-y-4">
        <button className="rounded bg-blue-600 px-3 py-2 text-white" onClick={() => setResetKey((key) => key + 1)}>
          Reset boundary
        </button>
        <ErrorBoundary resetKey={resetKey}><ThrowOnRender message="Reset me" /></ErrorBoundary>
      </div>
    );
  },
};
