import type { Meta, StoryObj } from '@storybook/react';
import { ErrorFallback } from './ErrorFallback';

const meta = {
  title: 'UI Components/ErrorFallback',
  component: ErrorFallback,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'network', 'wallet', 'payment'] },
    title: { control: 'text' },
    message: { control: 'text' },
  },
} satisfies Meta<typeof ErrorFallback>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Network: Story = { args: { variant: 'network', onRetry: () => undefined } };
export const Wallet: Story = { args: { variant: 'wallet', onRetry: () => undefined } };
export const Payment: Story = { args: { variant: 'payment', onRetry: () => undefined } };
export const CustomMessage: Story = {
  args: {
    variant: 'network',
    title: 'Course unavailable',
    message: 'We could not load this course. Try again when your connection is restored.',
    onRetry: () => undefined,
  },
};
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-4">
      {(['default', 'network', 'wallet', 'payment'] as const).map((variant) => (
        <ErrorFallback key={variant} variant={variant} onRetry={() => undefined} />
      ))}
    </div>
  ),
};
