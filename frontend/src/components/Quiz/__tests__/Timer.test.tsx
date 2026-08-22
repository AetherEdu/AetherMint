import React from 'react';
import { render, screen, act } from '@testing-library/react';
import Timer from '../Timer';

jest.useFakeTimers();

describe('Timer', () => {
  afterEach(() => {
    jest.clearAllTimers();
  });

  it('renders with the given duration', () => {
    render(<Timer duration={300} onTimeUp={jest.fn()} />);
    expect(screen.getByText('5:00')).toBeInTheDocument();
  });

  it('decrements time every second', () => {
    render(<Timer duration={5} onTimeUp={jest.fn()} />);
    expect(screen.getByText('0:05')).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(1000); });
    expect(screen.getByText('0:04')).toBeInTheDocument();
  });

  it('calls onTimeUp when time reaches zero', () => {
    const onTimeUp = jest.fn();
    render(<Timer duration={2} onTimeUp={onTimeUp} />);
    act(() => { jest.advanceTimersByTime(2000); });
    expect(onTimeUp).toHaveBeenCalledTimes(1);
  });

  it('applies low-time styles when less than 60 seconds remain', () => {
    render(<Timer duration={30} onTimeUp={jest.fn()} />);
    const timer = screen.getByRole('timer');
    expect(timer.className).toContain('bg-red-50');
  });

  it('does not apply low-time styles when more than 60 seconds remain', () => {
    render(<Timer duration={300} onTimeUp={jest.fn()} />);
    const timer = screen.getByRole('timer');
    expect(timer.className).toContain('bg-indigo-50');
  });

  it('has aria-live assertive when time is low', () => {
    render(<Timer duration={30} onTimeUp={jest.fn()} />);
    expect(screen.getByRole('timer')).toHaveAttribute('aria-live', 'assertive');
  });

  it('has aria-live polite when time is sufficient', () => {
    render(<Timer duration={300} onTimeUp={jest.fn()} />);
    expect(screen.getByRole('timer')).toHaveAttribute('aria-live', 'polite');
  });

  it('formats time correctly for various durations', () => {
    const { rerender } = render(<Timer duration={60} onTimeUp={jest.fn()} />);
    expect(screen.getByText('1:00')).toBeInTheDocument();
    rerender(<Timer duration={90} onTimeUp={jest.fn()} />);
    expect(screen.getByText('1:30')).toBeInTheDocument();
    rerender(<Timer duration={3600} onTimeUp={jest.fn()} />);
    expect(screen.getByText('60:00')).toBeInTheDocument();
  });
});