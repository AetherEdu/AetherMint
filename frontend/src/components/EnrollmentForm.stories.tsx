import type { Meta, StoryObj } from '@storybook/react';
import EnrollmentForm from './EnrollmentForm';

const mockCourse = {
  id: 'course-123',
  title: 'Introduction to Stellar Blockchain',
  instructor: 'Dr. Jane Smith',
  price: '50',
  currency: 'XLM',
  thumbnail: '',
  description: 'Learn the fundamentals of Stellar blockchain and Soroban smart contracts.',
};

const meta: Meta<typeof EnrollmentForm> = {
  title: 'Composite Components/EnrollmentForm',
  component: EnrollmentForm,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Multi-step enrollment form with personal info, wallet connection, payment, and confirmation steps. Used when students enroll in courses.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof EnrollmentForm>;

// ─── Initial State (Personal Info) ───────────────────────────────────────────

export const InitialState: Story = {
  name: 'Step 1 — Personal Information',
  args: {
    course: mockCourse,
    wallet: undefined,
    onEnrollmentComplete: (data) => console.log('Enrollment complete:', data),
    onEnrollmentError: (err) => console.error('Enrollment error:', err),
  },
};

// ─── With Connected Wallet ───────────────────────────────────────────────────

export const WithWalletConnected: Story = {
  name: 'Step 2 — Wallet Connected',
  args: {
    course: mockCourse,
    wallet: {
      publicKey: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA',
      connected: true,
      provider: 'freighter',
    },
    onEnrollmentComplete: (data) => console.log('Enrollment complete:', data),
    onEnrollmentError: (err) => console.error('Enrollment error:', err),
  },
};

// ─── With Wallet and Personal Info ───────────────────────────────────────────

export const PreparingPayment: Story = {
  name: 'Step 3 — Payment Pending',
  args: {
    course: mockCourse,
    wallet: {
      publicKey: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA',
      connected: true,
      provider: 'freighter',
    },
    onEnrollmentComplete: (data) => console.log('Enrollment complete:', data),
    onEnrollmentError: (err) => console.error('Enrollment error:', err),
  },
};
