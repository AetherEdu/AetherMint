import type { Meta, StoryObj } from '@storybook/react';
import QuizPlayer from './QuizPlayer';
import type { Question } from './QuestionCard';

const sampleQuestions: Question[] = [
  {
    id: 'q1',
    type: 'multiple-choice',
    question: 'What is the native asset of the Stellar network?',
    options: [
      { id: 'a', text: 'STR', isCorrect: false },
      { id: 'b', text: 'XLM', isCorrect: true },
      { id: 'c', text: 'STL', isCorrect: false },
      { id: 'd', text: 'ETH', isCorrect: false },
    ],
    explanation: 'XLM (Lumens) is the native digital asset of the Stellar network.',
  },
  {
    id: 'q2',
    type: 'true-false',
    question: 'Stellar uses Proof-of-Work consensus mechanism.',
    options: [
      { id: 'a', text: 'True', isCorrect: false },
      { id: 'b', text: 'False', isCorrect: true },
    ],
    explanation: 'Stellar uses the Stellar Consensus Protocol (SCP), a federated Byzantine agreement system.',
  },
  {
    id: 'q3',
    type: 'multiple-choice',
    question: 'What programming language is used to write Soroban smart contracts?',
    options: [
      { id: 'a', text: 'Solidity', isCorrect: false },
      { id: 'b', text: 'JavaScript', isCorrect: false },
      { id: 'c', text: 'Rust', isCorrect: true },
      { id: 'd', text: 'Python', isCorrect: false },
    ],
    explanation: 'Soroban smart contracts are written in Rust using the Soroban SDK.',
  },
  {
    id: 'q4',
    type: 'multiple-choice',
    question: 'What is the minimum account reserve on Stellar?',
    options: [
      { id: 'a', text: '0.5 XLM', isCorrect: false },
      { id: 'b', text: '1 XLM', isCorrect: true },
      { id: 'c', text: '5 XLM', isCorrect: false },
      { id: 'd', text: '10 XLM', isCorrect: false },
    ],
    explanation: 'The minimum account reserve on Stellar is 1 XLM.',
  },
  {
    id: 'q5',
    type: 'multiple-choice',
    question: 'What does IPFS stand for?',
    options: [
      { id: 'a', text: 'Internet Protocol File Storage', isCorrect: false },
      { id: 'b', text: 'InterPlanetary File System', isCorrect: true },
      { id: 'c', text: 'Integrated Protocol for Storage', isCorrect: false },
      { id: 'd', text: 'Internal Private File System', isCorrect: false },
    ],
    explanation: 'IPFS stands for InterPlanetary File System, a peer-to-peer hypermedia protocol.',
  },
];

const meta: Meta<typeof QuizPlayer> = {
  title: 'Composite Components/QuizPlayer',
  component: QuizPlayer,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Interactive quiz player with timer, progress tracking, question navigation, and results display. Supports multiple-choice and true/false questions.',
      },
    },
  },
  argTypes: {
    timeLimit: {
      control: 'number',
      description: 'Quiz time limit in seconds',
    },
    onComplete: {
      action: 'quiz completed',
      description: 'Callback when the quiz is finished',
    },
  },
};

export default meta;
type Story = StoryObj<typeof QuizPlayer>;

// ─── Stories ─────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: 'Default Quiz (5 Questions)',
  args: {
    questions: sampleQuestions,
    timeLimit: 600,
    onComplete: (score) => console.log(`Quiz completed! Score: ${score}/${sampleQuestions.length}`),
  },
};

export const ShortQuiz: Story = {
  name: 'Short Quiz (2 Questions)',
  args: {
    questions: sampleQuestions.slice(0, 2),
    timeLimit: 120,
    onComplete: (score) => console.log(`Short quiz score: ${score}`),
  },
};

export const LongQuiz: Story = {
  name: 'Large Quiz (Custom Questions)',
  args: {
    questions: Array.from({ length: 20 }, (_, i) => ({
      id: `q${i + 1}`,
      type: 'multiple-choice' as const,
      question: `Question ${i + 1}: What is the answer?`,
      options: [
        { id: 'a', text: 'Option A', isCorrect: i % 4 === 0 },
        { id: 'b', text: 'Option B', isCorrect: i % 4 === 1 },
        { id: 'c', text: 'Option C', isCorrect: i % 4 === 2 },
        { id: 'd', text: 'Option D', isCorrect: i % 4 === 3 },
      ],
      explanation: `Explanation for question ${i + 1}.`,
    })),
    timeLimit: 1800,
  },
};

export const TimedQuizShort: Story = {
  name: 'Timed — Short Limit (30s)',
  args: {
    questions: sampleQuestions.slice(0, 3),
    timeLimit: 30,
    onComplete: (score) => console.log(`Timed quiz: ${score}`),
  },
};

export const WithEmptyQuestions: Story = {
  name: 'Empty Quiz State',
  args: {
    questions: [],
    timeLimit: 0,
  },
};
