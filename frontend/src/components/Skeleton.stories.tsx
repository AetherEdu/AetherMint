import type { Meta, StoryObj } from '@storybook/react';
import Skeleton from './Skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'UI Components/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['text', 'image', 'card', 'list-item'],
      description: 'Skeleton variant shape',
    },
    'aria-label': {
      control: 'text',
      description: 'Accessible loading label',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

// ─── Variants ────────────────────────────────────────────────────────────────

export const Text: Story = {
  args: {
    variant: 'text',
    lines: 3,
    lastLineWidth: '60%',
    'aria-label': 'Loading text content',
  },
};

export const TextSingle: Story = {
  args: {
    variant: 'text',
    lines: 1,
    lastLineWidth: '100%',
    'aria-label': 'Loading single line',
  },
  name: 'Text — Single Line',
};

export const TextManyLines: Story = {
  args: {
    variant: 'text',
    lines: 8,
    lastLineWidth: '40%',
    'aria-label': 'Loading paragraph content',
  },
  name: 'Text — Multiple Lines',
};

export const Image: Story = {
  args: {
    variant: 'image',
    aspectRatio: '16/9',
    'aria-label': 'Loading image',
  },
};

export const ImageSquare: Story = {
  args: {
    variant: 'image',
    aspectRatio: '1/1',
    'aria-label': 'Loading square image',
  },
  name: 'Image — Square',
};

export const Card_: Story = {
  args: {
    variant: 'card',
    imageAspectRatio: '16/9',
    lines: 3,
    hasFooter: false,
    'aria-label': 'Loading card content',
  },
  name: 'Card Skeleton',
};

export const CardWithFooter: Story = {
  args: {
    variant: 'card',
    imageAspectRatio: '16/9',
    lines: 2,
    hasFooter: true,
    'aria-label': 'Loading course card',
  },
  name: 'Card — With Footer',
};

export const ListItem: Story = {
  args: {
    variant: 'list-item',
    lines: 2,
    hasAvatar: true,
    'aria-label': 'Loading list item',
  },
};

export const ListItemNoAvatar: Story = {
  args: {
    variant: 'list-item',
    lines: 2,
    hasAvatar: false,
    'aria-label': 'Loading list item',
  },
  name: 'List Item — No Avatar',
};

// ─── Usage Contexts ──────────────────────────────────────────────────────────

export const CourseCardSkeleton: Story = {
  name: 'Course Card Loading',
  render: () => (
    <div className="max-w-sm">
      <Skeleton variant="card" lines={3} hasFooter aria-label="Loading course" />
    </div>
  ),
};

export const ProfileSkeleton: Story = {
  name: 'Profile Loading',
  render: () => (
    <div className="max-w-md space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton
          variant="image"
          aspectRatio="1/1"
          className="!w-16 !h-16 !rounded-full"
          aria-label="Loading avatar"
        />
        <Skeleton variant="text" lines={2} lastLineWidth="50%" aria-label="Loading profile" />
      </div>
      <Skeleton variant="text" lines={1} lastLineWidth="100%" aria-label="Loading title" />
      <Skeleton variant="text" lines={4} lastLineWidth="40%" aria-label="Loading biography" />
    </div>
  ),
};

export const DashboardSkeleton: Story = {
  name: 'Dashboard Loading',
  render: () => (
    <div className="max-w-3xl space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton
            key={i}
            variant="card"
            imageAspectRatio="1/1"
            lines={1}
            aria-label={`Loading metric ${i}`}
          />
        ))}
      </div>
      <Skeleton variant="card" lines={8} hasFooter aria-label="Loading chart" />
    </div>
  ),
};

export const AllVariants: Story = {
  name: 'All Variants Overview',
  render: () => (
    <div className="space-y-8 p-4 max-w-2xl">
      <div>
        <h3 className="text-sm font-semibold mb-3 text-gray-600">Text</h3>
        <Skeleton variant="text" lines={3} aria-label="Loading text" />
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-3 text-gray-600">Image</h3>
        <Skeleton variant="image" aspectRatio="16/9" aria-label="Loading image" />
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-3 text-gray-600">Card</h3>
        <div className="max-w-sm">
          <Skeleton variant="card" lines={3} hasFooter aria-label="Loading card" />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-3 text-gray-600">List Item</h3>
        <Skeleton variant="list-item" lines={2} hasAvatar aria-label="Loading item" />
      </div>
    </div>
  ),
};
