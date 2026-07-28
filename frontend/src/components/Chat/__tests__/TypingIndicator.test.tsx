import React from 'react';
import { render, screen } from '@testing-library/react';
import { TypingIndicator } from '../TypingIndicator';

describe('TypingIndicator', () => {
  it('renders AI avatar', () => {
    render(<TypingIndicator />);
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('renders bouncing dots', () => {
    const { container } = render(<TypingIndicator />);
    const dots = container.querySelectorAll('.animate-bounce');
    expect(dots.length).toBe(3);
  });

  it('applies pulse animation to container', () => {
    const { container } = render(<TypingIndicator />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });
});