import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Results from '../Results';

describe('Results', () => {
  const defaultProps = {
    score: 8,
    totalQuestions: 10,
    onRetry: jest.fn(),
    onContinue: jest.fn(),
  };

  it('shows passing message when score >= 70%', () => {
    render(<Results {...defaultProps} />);
    expect(screen.getByText('Quiz Completed!')).toBeInTheDocument();
  });

  it('shows keep practicing when score < 70%', () => {
    render(<Results {...defaultProps} score={4} totalQuestions={10} />);
    expect(screen.getByText('Keep Practicing!')).toBeInTheDocument();
  });

  it('displays score out of total questions', () => {
    render(<Results {...defaultProps} />);
    expect(screen.getByText(/8/)).toBeInTheDocument();
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('shows progress bar with correct percentage', () => {
    render(<Results {...defaultProps} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '80');
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = jest.fn();
    render(<Results {...defaultProps} onRetry={onRetry} />);
    fireEvent.click(screen.getByText('Retry Quiz'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows continue button only when passing', () => {
    render(<Results {...defaultProps} />);
    expect(screen.getByText('Continue Course')).toBeInTheDocument();
  });

  it('hides continue button when not passing', () => {
    render(<Results {...defaultProps} score={4} totalQuestions={10} />);
    expect(screen.queryByText('Continue Course')).not.toBeInTheDocument();
  });

  it('calls onContinue when continue button is clicked', () => {
    const onContinue = jest.fn();
    render(<Results {...defaultProps} onContinue={onContinue} />);
    fireEvent.click(screen.getByText('Continue Course'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('does not show continue button when onContinue is not provided', () => {
    render(<Results {...defaultProps} onContinue={undefined} />);
    expect(screen.queryByText('Continue Course')).not.toBeInTheDocument();
  });

  it('has correct aria label for results section', () => {
    render(<Results {...defaultProps} />);
    expect(screen.getByLabelText('quiz-results-title')).toBeInTheDocument();
  });
});