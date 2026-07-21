import type { Meta, StoryObj } from '@storybook/react';
import { expect, within, userEvent } from '@storybook/test';
import { Button } from './button';

const meta: Meta<typeof Button> = {
  title: 'UI Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
      description: 'Button style variant',
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
      description: 'Button size',
    },
    disabled: {
      control: 'boolean',
      description: 'Disables the button',
    },
    asChild: {
      control: 'boolean',
      description: 'Render as child using Radix Slot',
    },
    children: {
      control: 'text',
      description: 'Button content',
    },
  },
  args: {
    children: 'Button',
    variant: 'default',
    size: 'default',
    disabled: false,
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// ─── Variants ────────────────────────────────────────────────────────────────

export const Default: Story = {
  args: { variant: 'default', children: 'Default Button' },
};

export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Delete' },
};

export const Outline: Story = {
  args: { variant: 'outline', children: 'Outline Button' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Secondary Button' },
};

export const Ghost: Story = {
  args: { variant: 'ghost', children: 'Ghost Button' },
};

export const Link: Story = {
  args: { variant: 'link', children: 'Link Button' },
};

// ─── Sizes ───────────────────────────────────────────────────────────────────

export const Small: Story = {
  args: { size: 'sm', children: 'Small' },
};

export const Large: Story = {
  args: { size: 'lg', children: 'Large Button' },
};

export const Icon: Story = {
  args: {
    size: 'icon',
    children: '🔔',
    'aria-label': 'Notifications',
  },
};

// ─── States ──────────────────────────────────────────────────────────────────

export const Disabled: Story = {
  args: { disabled: true, children: 'Disabled' },
};

export const DisabledDestructive: Story = {
  args: {
    variant: 'destructive',
    disabled: true,
    children: 'Cannot Delete',
  },
};

// ─── With Icon ───────────────────────────────────────────────────────────────

export const WithIcon: Story = {
  args: {
    children: (
      <span className="flex items-center gap-2">
        <span>🚀</span>
        <span>Launch</span>
      </span>
    ),
  },
  name: 'With Icon',
};

// ─── Interactive Tests ───────────────────────────────────────────────────────

export const ClickInteraction: Story = {
  args: { children: 'Click Me' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Click Me' });
    await expect(button).toBeInTheDocument();
    await userEvent.click(button);
  },
};

export const DisabledInteraction: Story = {
  args: { disabled: true, children: 'Cannot Click' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Cannot Click' });
    await expect(button).toBeDisabled();
  },
};

// ─── All Variants Grid ───────────────────────────────────────────────────────

export const AllVariants: Story = {
  name: 'All Variants Overview',
  render: () => (
    <div className="flex flex-wrap items-center gap-4 p-6">
      <Button variant="default">Default</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

export const AllSizes: Story = {
  name: 'All Sizes Overview',
  render: () => (
    <div className="flex flex-wrap items-center gap-4 p-6">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon">🔔</Button>
    </div>
  ),
};

export const AllStates: Story = {
  name: 'All States Overview',
  render: () => (
    <div className="flex flex-wrap items-center gap-4 p-6">
      <Button variant="default">Default</Button>
      <Button variant="default" disabled>Disabled</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="destructive" disabled>Disabled Destructive</Button>
      <Button variant="outline" disabled>Disabled Outline</Button>
    </div>
  ),
};
