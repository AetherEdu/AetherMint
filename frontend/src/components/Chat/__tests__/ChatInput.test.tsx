import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInput } from '../ChatInput';

describe('ChatInput', () => {
  const defaultProps = {
    value: '',
    onChange: jest.fn(),
    onSend: jest.fn(),
  };

  it('renders textarea', () => {
    render(<ChatInput {...defaultProps} />);
    const textarea = screen.getByPlaceholderText('Type your message...');
    expect(textarea).toBeInTheDocument();
  });

  it('renders send button', () => {
    render(<ChatInput {...defaultProps} />);
    expect(screen.getByTitle('Send message')).toBeInTheDocument();
  });

  it('renders attach file button', () => {
    render(<ChatInput {...defaultProps} />);
    expect(screen.getByTitle('Attach file')).toBeInTheDocument();
  });

  it('calls onSend when send button is clicked with text', () => {
    const onSend = jest.fn();
    render(<ChatInput {...defaultProps} value="Hello" onSend={onSend} />);
    fireEvent.click(screen.getByTitle('Send message'));
    expect(onSend).toHaveBeenCalledWith('Hello', []);
  });

  it('calls onSend when Enter is pressed', () => {
    const onSend = jest.fn();
    render(<ChatInput {...defaultProps} value="Hello" onSend={onSend} />);
    fireEvent.keyPress(screen.getByPlaceholderText('Type your message...'), { key: 'Enter', charCode: 13 });
    expect(onSend).toHaveBeenCalledWith('Hello', []);
  });

  it('does not call onSend for empty text', () => {
    const onSend = jest.fn();
    render(<ChatInput {...defaultProps} value="" onSend={onSend} />);
    fireEvent.click(screen.getByTitle('Send message'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('disables send button when empty and no attachments', () => {
    render(<ChatInput {...defaultProps} value="" />);
    expect(screen.getByTitle('Send message')).toBeDisabled();
  });

  it('calls onChange when typing', () => {
    const onChange = jest.fn();
    render(<ChatInput {...defaultProps} onChange={onChange} />);
    const textarea = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(textarea, { target: { value: 'test' } });
    expect(onChange).toHaveBeenCalledWith('test');
  });

  it('shows voice button when speech recognition is supported', () => {
    const onVoiceToggle = jest.fn();
    render(<ChatInput {...defaultProps} speechRecognitionSupported onVoiceToggle={onVoiceToggle} />);
    expect(screen.getByTitle('Start voice input')).toBeInTheDocument();
  });

  it('hides voice button when speech recognition is not supported', () => {
    render(<ChatInput {...defaultProps} speechRecognitionSupported={false} />);
    expect(screen.queryByTitle('Start voice input')).not.toBeInTheDocument();
  });

  it('shows listening state indicator', () => {
    const onVoiceToggle = jest.fn();
    render(<ChatInput {...defaultProps} speechRecognitionSupported isListening onVoiceToggle={onVoiceToggle} />);
    expect(screen.getByTitle('Stop recording')).toBeInTheDocument();
  });

  it('shows guidelines text', () => {
    render(<ChatInput {...defaultProps} />);
    expect(screen.getByText(/Press Enter to send/)).toBeInTheDocument();
    expect(screen.getByText(/Supports images, documents/)).toBeInTheDocument();
  });

  it('disables all interactive elements when disabled', () => {
    render(<ChatInput {...defaultProps} disabled />);
    expect(screen.getByTitle('Send message')).toBeDisabled();
    expect(screen.getByTitle('Attach file')).toBeDisabled();
  });

  it('shows character count near limit', () => {
    const longText = 'a'.repeat(501);
    render(<ChatInput {...defaultProps} value={longText} />);
    expect(screen.getByText('501/2000')).toBeInTheDocument();
  });

  it('applies custom placeholder', () => {
    render(<ChatInput {...defaultProps} placeholder="Custom placeholder" />);
    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<ChatInput {...defaultProps} className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});