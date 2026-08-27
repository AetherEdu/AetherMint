import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './badge';

const meta = {
  title: 'UI Components/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: { children: 'Active' },
  argTypes: {
    variant: { control: 'select', options: ['default', 'secondary', 'destructive', 'outline'] },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Secondary: Story = { args: { variant: 'secondary', children: 'Pending' } };
export const Destructive: Story = { args: { variant: 'destructive', children: 'Failed' } };
export const Outline: Story = { args: { variant: 'outline', children: 'Completed' } };
export const StatusSet: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Active</Badge>
      <Badge variant="secondary">Pending</Badge>
      <Badge variant="destructive">Failed</Badge>
      <Badge variant="outline">Completed</Badge>
    </div>
  ),
};
