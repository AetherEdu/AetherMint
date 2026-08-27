import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { Button } from './button';

const meta = {
  title: 'UI Components/Button',
  component: Button,
  tags: ['autodocs'],
  args: { children: 'Continue' },
  argTypes: {
    variant: { control: 'select', options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] },
    size: { control: 'select', options: ['default', 'sm', 'lg', 'icon'] },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Destructive: Story = { args: { variant: 'destructive', children: 'Delete' } };
export const Outline: Story = { args: { variant: 'outline' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Link: Story = { args: { variant: 'link' } };
export const Small: Story = { args: { size: 'sm', children: 'Small' } };
export const Large: Story = { args: { size: 'lg', children: 'Large' } };
export const Icon: Story = { args: { size: 'icon', children: '⋯', 'aria-label': 'More actions' } };
export const Disabled: Story = { args: { disabled: true, children: 'Unavailable' } };

export const Clickable: Story = {
  args: { children: 'Save changes' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Save changes' });
    await userEvent.click(button);
    await expect(button).toBeEnabled();
  },
};
