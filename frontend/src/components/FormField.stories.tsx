import type { Meta, StoryObj } from '@storybook/react';
import FormField from './FormField';

const meta = {
  title: 'Form Components/FormField',
  component: FormField,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: { component: 'Accessible input wrapper used for text, textarea, and select fields.' },
    },
  },
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Input: Story = {
  args: { id: 'email', label: 'Email address', type: 'email', placeholder: 'learner@example.com', required: true },
};
export const WithHint: Story = {
  args: { id: 'username', label: 'Username', hint: 'Use 3–30 characters.', placeholder: 'learner' },
};
export const Error: Story = {
  args: { id: 'email-error', label: 'Email address', type: 'email', value: 'not-an-email', error: 'Enter a valid email address.' },
};
export const Disabled: Story = {
  args: { id: 'disabled', label: 'Account email', value: 'learner@example.com', disabled: true },
};
export const Textarea: Story = {
  args: { id: 'bio', label: 'About you', as: 'textarea', rows: 4, placeholder: 'Tell us about your learning goals.' },
};
export const Select: Story = {
  args: {
    id: 'level',
    label: 'Experience level',
    as: 'select',
    children: <><option value="">Choose a level</option><option value="beginner">Beginner</option><option value="advanced">Advanced</option></>,
  },
};
