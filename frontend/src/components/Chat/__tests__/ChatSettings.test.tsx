import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatSettings } from '../ChatSettings';

describe('ChatSettings', () => {
  const defaultProps = {
    language: 'en',
    onLanguageChange: jest.fn(),
    onClose: jest.fn(),
    onClearHistory: jest.fn(),
  };

  it('renders settings title', () => {
    render(<ChatSettings {...defaultProps} />);
    expect(screen.getByText('Chat Settings')).toBeInTheDocument();
  });

  it('renders language selection', () => {
    render(<ChatSettings {...defaultProps} />);
    expect(screen.getByText('Language')).toBeInTheDocument();
    expect(screen.getByDisplayValue('English')).toBeInTheDocument();
  });

  it('renders voice settings', () => {
    render(<ChatSettings {...defaultProps} />);
    expect(screen.getByText('Voice Settings')).toBeInTheDocument();
    expect(screen.getByText('Speech Rate')).toBeInTheDocument();
    expect(screen.getByText('Voice Pitch')).toBeInTheDocument();
  });

  it('renders clear history button', () => {
    render(<ChatSettings {...defaultProps} />);
    expect(screen.getByText('Clear Chat History')).toBeInTheDocument();
  });

  it('shows confirmation when clear history is clicked', () => {
    render(<ChatSettings {...defaultProps} />);
    fireEvent.click(screen.getByText('Clear Chat History'));
    expect(screen.getByText(/Are you sure/)).toBeInTheDocument();
    expect(screen.getByText('Yes, Clear')).toBeInTheDocument();
  });

  it('calls onClearHistory when confirmed', () => {
    const onClearHistory = jest.fn();
    const onClose = jest.fn();
    render(<ChatSettings {...defaultProps} onClearHistory={onClearHistory} onClose={onClose} />);
    fireEvent.click(screen.getByText('Clear Chat History'));
    fireEvent.click(screen.getByText('Yes, Clear'));
    expect(onClearHistory).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cancels clear history', () => {
    render(<ChatSettings {...defaultProps} />);
    fireEvent.click(screen.getByText('Clear Chat History'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.getByText('Clear Chat History')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(<ChatSettings {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTitle('Close settings'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onLanguageChange when language is changed', () => {
    const onLanguageChange = jest.fn();
    render(<ChatSettings {...defaultProps} onLanguageChange={onLanguageChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'es' } });
    expect(onLanguageChange).toHaveBeenCalledWith('es');
  });

  it('renders about section', () => {
    render(<ChatSettings {...defaultProps} />);
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText(/AI Learning Assistant/)).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<ChatSettings {...defaultProps} className="custom" />);
    expect(container.firstChild).toHaveClass('custom');
  });
});