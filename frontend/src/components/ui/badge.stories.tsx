import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './badge';

const meta: Meta<typeof Badge> = {
  title: 'UI Components/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline'],
      description: 'Badge style variant',
    },
    children: {
      control: 'text',
      description: 'Badge content',
    },
  },
  args: {
    children: 'Badge',
    variant: 'default',
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

// ─── Variants ────────────────────────────────────────────────────────────────

export const Default: Story = {
  args: { variant: 'default', children: 'Active' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Draft' },
};

export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Archived' },
};

export const Outline: Story = {
  args: { variant: 'outline', children: 'External' },
};

// ─── Common Use Cases ────────────────────────────────────────────────────────

export const StatusBadges: Story = {
  name: 'Status Badges',
  render: () => (
    <div className="flex flex-wrap gap-2 p-4">
      <Badge variant="default">Active</Badge>
      <Badge variant="secondary">Pending</Badge>
      <Badge variant="destructive">Cancelled</Badge>
      <Badge variant="outline">Completed</Badge>
    </div>
  ),
};

export const DifficultyLevels: Story = {
  name: 'Difficulty Levels',
  render: () => (
    <div className="flex flex-wrap gap-2 p-4">
      <Badge
        variant="default"
        className="bg-green-100 text-green-800 border-green-200"
      >
        Beginner
      </Badge>
      <Badge
        variant="default"
        className="bg-yellow-100 text-yellow-800 border-yellow-200"
      >
        Intermediate
      </Badge>
      <Badge
        variant="default"
        className="bg-red-100 text-red-800 border-red-200"
      >
        Advanced
      </Badge>
      <Badge
        variant="default"
        className="bg-purple-100 text-purple-800 border-purple-200"
      >
        Expert
      </Badge>
    </div>
  ),
};

export const CredentialBadges: Story = {
  name: 'Credential / Certificate',
  render: () => (
    <div className="flex flex-wrap gap-2 p-4">
      <Badge
        variant="default"
        className="bg-blue-100 text-blue-700 border-blue-200"
      >
        🏆 Verified
      </Badge>
      <Badge
        variant="default"
        className="bg-indigo-100 text-indigo-700 border-indigo-200"
      >
        🎓 Certificate
      </Badge>
      <Badge
        variant="default"
        className="bg-amber-100 text-amber-700 border-amber-200"
      >
        ⭐ Achievement
      </Badge>
      <Badge
        variant="outline"
        className="text-gray-600"
      >
        🔗 On-chain
      </Badge>
    </div>
  ),
};

export const AllVariants: Story = {
  name: 'All Variants Overview',
  render: () => (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap gap-2">
        {(['default', 'secondary', 'destructive', 'outline'] as const).map(
          (variant) => (
            <Badge key={variant} variant={variant}>
              {variant.charAt(0).toUpperCase() + variant.slice(1)}
            </Badge>
          )
        )}
      </div>
    </div>
  ),
};
