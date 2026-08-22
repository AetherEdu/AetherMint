import type { Meta, StoryObj } from '@storybook/react';
import QuizPlayer from './QuizPlayer';
import type { Question } from './QuestionCard';

const questions: Question[] = [
  {
    id: 'stellar-native-asset',
    type: 'multiple-choice',
    question: 'What is the native asset of the Stellar network?',
    options: [
      { id: 'xlm', text: 'XLM', isCorrect: true },
      { id: 'eth', text: 'ETH', isCorrect: false },
      { id: 'btc', text: 'BTC', isCorrect: false },
    ],
  },
  {
    id: 'soroban-language',
    type: 'multiple-choice',
    question: 'Which language is used for Soroban contracts?',
    options: [
      { id: 'rust', text: 'Rust', isCorrect: true },
      { id: 'python', text: 'Python', isCorrect: false },
      { id: 'solidity', text: 'Solidity', isCorrect: false },
    ],
  },
];

const meta = {
  title: 'Composite Components/QuizPlayer',
  component: QuizPlayer,
  tags: ['autodocs'],
  parameters: { docs: { description: { component: 'Interactive quiz with progress, timer, navigation, and results states.' } } },
} satisfies Meta<typeof QuizPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { questions, timeLimit: 600 } };
export const ShortTimer: Story = { args: { questions, timeLimit: 30 } };
export const Empty: Story = { args: { questions: [], timeLimit: 0 } };
