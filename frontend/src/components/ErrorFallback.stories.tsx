import type { Meta, StoryObj } from '@storybook/react';
import { expect, within, userEvent } from '@storybook/test';
import { ErrorFallback } from './ErrorFallback';

const meta: Meta<typeof ErrorFallback> = {
  title: 'UI Components/ErrorFallback',
  component: ErrorFallback,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'network', 'wallet', 'payment'],
      description: 'Error variant determines colors and icon',
    },
    title: {
      control: 'text',
      description: 'Custom error title override',
    },
    message: {
      control: 'text',
      description: 'Custom error message override',
    },
    showDetails: {
      control: 'boolean',
      description: 'Show technical details (development mode)',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ErrorFallback>;

// ─── Variants ────────────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    variant: 'default',
    onRetry: undefined,
  },
};

export const DefaultWithRetry: Story = {
  args: {
    variant: 'default',
    onRetry: () => alert('Retry clicked!'),
  },
  name: 'Default — With Retry',
};

export const Network: Story = {
  args: {
    variant: 'network',
    onRetry: undefined,
  },
};

export const NetworkWithRetry: Story = {
  args: {
    variant: 'network',
    onRetry: () => alert('Reconnecting…'),
  },
  name: 'Network — With Retry',
};

export const Wallet: Story = {
  args: {
    variant: 'wallet',
    onRetry: undefined,
  },
};

export const Payment: Story = {
  args: {
    variant: 'payment',
    onRetry: undefined,
  },
};

// ─── Custom Overrides ────────────────────────────────────────────────────────

export const CustomMessage: Story = {
  args: {
    variant: 'network',
    title: 'Connection Lost',
    message:
      'The server is currently unreachable. Your progress has been saved locally and will sync when the connection is restored.',
    onRetry: () => alert('Retrying…'),
  },
  name: 'Custom Title & Message',
};

// ─── With Technical Details ──────────────────────────────────────────────────

export const WithDevDetails: Story = {
  args: {
    variant: 'default',
    showDetails: true,
    error: new Error('TypeError: Cannot read properties of undefined (reading "map")'),
    errorInfo: {
      componentStack:
        '    at EnrollmentList (webpack-internal:///./src/components/EnrollmentList.tsx:42:21)\n    at DashboardPage (webpack-internal:///./src/app/dashboard/page.tsx:15:11)',
    } as any,
    onRetry: () => alert('Retrying…'),
  },
  name: 'With Technical Details',
  parameters: {
    // This only works in dev mode — accept in storybook for visual display
    docs: { description: { story: 'Shows full error stack and component stack in development mode.' } },
  },
};

// ─── All Variants Overview ───────────────────────────────────────────────────

export const AllVariants: Story = {
  name: 'All Variants Overview',
  render: () => (
    <div className="space-y-6 p-4 max-w-2xl">
      {(['default', 'network', 'wallet', 'payment'] as const).map((variant) => (
        <ErrorFallback
          key={variant}
          variant={variant}
          onRetry={() => {}}
        />
      ))}
    </div>
  ),
};

// ─── Interactive Test ────────────────────────────────────────────────────────

export const RetryInteraction: Story = {
  args: {
    variant: 'default',
    onRetry: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const retryButton = canvas.getByRole('button', { name: /try again/i });
    await expect(retryButton).toBeInTheDocument();
    await userEvent.click(retryButton);
  },
};
