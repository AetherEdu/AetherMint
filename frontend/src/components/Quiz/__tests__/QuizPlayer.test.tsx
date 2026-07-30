import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import QuizPlayer from '../QuizPlayer';

const mockQuestions = [
  {
    id: 'q1',
    type: 'multiple-choice' as const,
    question: 'What is 2+2?',
    options: ['3', '4', '5'],
  },
  {
    id: 'q2',
    type: 'true-false' as const,
    question: 'The sky is blue',
    options: [
      { id: 'true', text: 'True', isCorrect: true },
      { id: 'false', text: 'False' },
    ],
  },
];

jest.useFakeTimers();

describe('QuizPlayer', () => {
  const onComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the first question', () => {
    render(<QuizPlayer questions={mockQuestions} onComplete={onComplete} />);
    expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
  });

  it('shows question progress', () => {
    render(<QuizPlayer questions={mockQuestions} onComplete={onComplete} />);
    expect(screen.getByText('(1/2)')).toBeInTheDocument();
  });

  it('shows progress percentage', () => {
    render(<QuizPlayer questions={mockQuestions} onComplete={onComplete} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('navigates to next question', () => {
    render(<QuizPlayer questions={mockQuestions} onComplete={onComplete} />);
    fireEvent.click(screen.getByText('Option A') || screen.getByText('3'));
    fireEvent.click(screen.getByLabelText('Go to next question'));
    expect(screen.getByText('The sky is blue')).toBeInTheDocument();
  });

  it('prevents navigation without answering', () => {
    render(<QuizPlayer questions={mockQuestions} onComplete={onComplete} />);
    const nextButton = screen.getByLabelText('Go to next question');
    expect(nextButton).toBeDisabled();
  });

  it('shows previous button on second question', () => {
    render(<QuizPlayer questions={mockQuestions} onComplete={onComplete} />);
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByLabelText('Go to next question'));
    expect(screen.getByLabelText('Go to previous question')).toBeInTheDocument();
  });

  it('finishes quiz and shows results', () => {
    render(<QuizPlayer questions={mockQuestions} onComplete={onComplete} />);
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByLabelText('Go to next question'));
    fireEvent.click(screen.getByText('True'));
    act(() => {
      jest.advanceTimersByTime(100);
    });
    const finishButton = screen.getByLabelText('Complete assessment');
    fireEvent.click(finishButton);
    expect(screen.getByText('Quiz Completed!')).toBeInTheDocument();
  });

  it('calls onComplete with the score', () => {
    render(<QuizPlayer questions={mockQuestions} onComplete={onComplete} />);
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByLabelText('Go to next question'));
    fireEvent.click(screen.getByText('True'));
    fireEvent.click(screen.getByLabelText('Complete assessment'));
    expect(onComplete).toHaveBeenCalledWith(1);
  });

  it('allows retry', () => {
    render(<QuizPlayer questions={mockQuestions} onComplete={onComplete} />);
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByLabelText('Go to next question'));
    fireEvent.click(screen.getByText('True'));
    fireEvent.click(screen.getByLabelText('Complete assessment'));
    fireEvent.click(screen.getByText('Retry Quiz'));
    expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
  });

  it('shows timer by default', () => {
    render(<QuizPlayer questions={mockQuestions} onComplete={onComplete} />);
    expect(screen.getByRole('timer')).toBeInTheDocument();
  });

  it('finishes quiz when time runs out', () => {
    render(<QuizPlayer questions={mockQuestions} timeLimit={1} onComplete={onComplete} />);
    act(() => { jest.advanceTimersByTime(1000); });
    expect(screen.getByText('Keep Practicing!')).toBeInTheDocument();
  });

  it('shows navigation dots for each question', () => {
    render(<QuizPlayer questions={mockQuestions} onComplete={onComplete} />);
    const dots = screen.getAllByRole('button', { name: /Go to question/i });
    expect(dots).toHaveLength(2);
  });
});