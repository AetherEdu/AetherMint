import type { Meta, StoryObj } from '@storybook/react';
import Skeleton from './Skeleton';

const meta = {
  title: 'UI Components/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['text', 'image', 'card', 'list-item'] },
    'aria-label': { control: 'text' },
  },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = { args: { variant: 'text', lines: 3, 'aria-label': 'Loading description' } };
export const Image: Story = { args: { variant: 'image', aspectRatio: '16/9', 'aria-label': 'Loading image' } };
export const Card: Story = { args: { variant: 'card', lines: 3, hasFooter: true, 'aria-label': 'Loading course' } };
export const ListItem: Story = { args: { variant: 'list-item', lines: 2, hasAvatar: true, 'aria-label': 'Loading learner' } };
export const AllVariants: Story = {
  args: { variant: 'text' },
  render: () => (
    <div className="grid max-w-2xl gap-6 md:grid-cols-2">
      <Skeleton variant="text" lines={3} aria-label="Loading text" />
      <Skeleton variant="image" aspectRatio="16/9" aria-label="Loading image" />
      <Skeleton variant="card" lines={2} aria-label="Loading card" />
      <Skeleton variant="list-item" aria-label="Loading list item" />
    </div>
  ),
};
