import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { expect, within } from '@storybook/test';
import { ErrorBoundary } from './ErrorBoundary';

// A component that throws on render for testing
function ThrowError({ message = 'Test error' }: { message?: string }) {
  throw new Error(message);
  return null;
}

function SafeComponent() {
  return <div className="p-4 text-green-600">✅ Everything is working fine!</div>;
}

const meta: Meta<typeof ErrorBoundary> = {
  title: 'UI Components/ErrorBoundary',
  component: ErrorBoundary,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'network', 'wallet', 'payment'],
      description: 'Error variant / theme',
    },
    errorTitle: {
      control: 'text',
      description: 'Custom error title override',
    },
    errorMessage: {
      control: 'text',
      description: 'Custom error message override',
    },
    showErrorDetails: {
      control: 'boolean',
      description: 'Show technical stack trace (dev mode)',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ErrorBoundary>;

// ─── Normal Rendering ────────────────────────────────────────────────────────

export const NoError: Story = {
  render: () => (
    <ErrorBoundary>
      <SafeComponent />
    </ErrorBoundary>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/everything is working/i)).toBeInTheDocument();
  },
};

// ─── Error Variants ──────────────────────────────────────────────────────────

export const DefaultError: Story = {
  name: 'Default Error',
  render: () => (
    <ErrorBoundary>
      <ThrowError message="Something went wrong!" />
    </ErrorBoundary>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/something went wrong/i)).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  name: 'Network Error',
  render: () => (
    <ErrorBoundary variant="network">
      <ThrowError message="Network failure!" />
    </ErrorBoundary>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/network error/i)).toBeInTheDocument();
  },
};

export const WalletError: Story = {
  name: 'Wallet Error',
  render: () => (
    <ErrorBoundary variant="wallet">
      <ThrowError message="Wallet connection failed!" />
    </ErrorBoundary>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/wallet error/i)).toBeInTheDocument();
  },
};

export const PaymentError: Story = {
  name: 'Payment Error',
  render: () => (
    <ErrorBoundary variant="payment">
      <ThrowError message="Payment processing failed!" />
    </ErrorBoundary>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/payment error/i)).toBeInTheDocument();
  },
};

// ─── Custom Messages ─────────────────────────────────────────────────────────

export const CustomTitleAndMessage: Story = {
  name: 'Custom Title & Message',
  render: () => (
    <ErrorBoundary
      errorTitle="Course Load Failure"
      errorMessage="We couldn't load your courses. Please check your internet and try again."
    >
      <ThrowError message="API fetch failed" />
    </ErrorBoundary>
  ),
};

// ─── With Dev Details ────────────────────────────────────────────────────────

export const WithErrorDetails: Story = {
  name: 'With Technical Details (Dev)',
  render: () => (
    <ErrorBoundary showErrorDetails>
      <ThrowError message="TypeError: Cannot read properties of undefined" />
    </ErrorBoundary>
  ),
};

// ─── With Reset Key ──────────────────────────────────────────────────────────

export const ExternalReset: Story = {
  name: 'External Reset Trigger',
  render: () => {
    const [key, setKey] = React.useState(0);
    return (
      <div className="space-y-4">
        <button
          onClick={() => setKey((k) => k + 1)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Retry (reset key: {key})
        </button>
        <ErrorBoundary resetKey={key} onError={() => {}}>
          <ThrowError message="Temporary error" />
        </ErrorBoundary>
      </div>
    );
  },
};

