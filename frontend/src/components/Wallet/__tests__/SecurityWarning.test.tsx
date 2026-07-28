import React from 'react';
import { render, screen } from '@testing-library/react';
import { SecurityWarning } from '../SecurityWarning';

describe('SecurityWarning', () => {
  it('renders the warning title', () => {
    render(<SecurityWarning />);
    expect(screen.getByText('Stay Safe on AetherMint')).toBeInTheDocument();
  });

  it('renders security message', () => {
    render(<SecurityWarning />);
    expect(screen.getByText(/AetherMint will never ask for your secret key/)).toBeInTheDocument();
  });

  it('renders a learn more link', () => {
    render(<SecurityWarning />);
    const link = screen.getByText('Learn More');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', 'https://www.stellar.org/lumens/safety-guide');
    expect(link.closest('a')).toHaveAttribute('target', '_blank');
    expect(link.closest('a')).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders the official domain mention', () => {
    render(<SecurityWarning />);
    expect(screen.getByText('aethermint.edu')).toBeInTheDocument();
  });
});