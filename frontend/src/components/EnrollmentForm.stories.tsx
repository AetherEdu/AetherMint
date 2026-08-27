import type { Meta, StoryObj } from '@storybook/react';
import EnrollmentForm from './EnrollmentForm';

const course = {
  id: 'course-story',
  title: 'Introduction to Stellar Blockchain',
  description: 'Learn the fundamentals of Stellar and Soroban.',
  instructor: 'AetherMint Academy',
  price: 50,
  currency: 'XLM',
  duration: '4 weeks',
  level: 'beginner' as const,
  category: 'Blockchain',
};

const wallet = {
  publicKey: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA',
  network: 'testnet' as const,
  connected: true,
  walletType: 'demo',
};

const meta = {
  title: 'Composite Components/EnrollmentForm',
  component: EnrollmentForm,
  tags: ['autodocs'],
  parameters: { docs: { description: { component: 'Multi-step course enrollment and payment flow.' } } },
} satisfies Meta<typeof EnrollmentForm>;

export default meta;
type Story = StoryObj<typeof meta>;

const callbacks = {
  onEnrollmentComplete: () => undefined,
  onEnrollmentError: () => undefined,
};

export const InitialPersonalInfo: Story = { args: { course, wallet: null, ...callbacks } };
export const ConnectedWallet: Story = { args: { course, wallet, ...callbacks } };
