import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatMessage } from '../ChatMessage';

Object.assign(navigator, {
  clipboard: { writeText: jest.fn() },
});

describe('ChatMessage', () => {
  const userMessage = {
    id: '1',
    content: 'Hello assistant',
    type: 'user' as const,
    timestamp: new Date('2024-01-01T12:00:00'),
  };

  const assistantMessage = {
    id: '2',
    content: 'Hello! How can I help?',
    type: 'assistant' as const,
    timestamp: new Date('2024-01-01T12:00:05'),
  };

  const systemMessage = {
    id: '3',
    content: 'Connection established',
    type: 'system' as const,
    timestamp: new Date('2024-01-01T12:00:00'),
  };

  it('renders user message with content', () => {
    render(<ChatMessage message={userMessage} />);
    expect(screen.getByText('Hello assistant')).toBeInTheDocument();
  });

  it('renders user message with "You" label', () => {
    render(<ChatMessage message={userMessage} />);
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('renders assistant message with "AI Assistant" label', () => {
    render(<ChatMessage message={assistantMessage} />);
    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
  });

  it('renders system message with "System" label', () => {
    render(<ChatMessage message={systemMessage} />);
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('renders timestamp', () => {
    render(<ChatMessage message={userMessage} />);
    expect(screen.getByText('12:00 PM')).toBeInTheDocument();
  });

  it('shows copy button for non-system messages', () => {
    render(<ChatMessage message={userMessage} />);
    expect(screen.getByTitle('Copy message')).toBeInTheDocument();
  });

  it('hides copy button for system messages', () => {
    render(<ChatMessage message={systemMessage} />);
    expect(screen.queryByTitle('Copy message')).not.toBeInTheDocument();
  });

  it('copies message content when copy button is clicked', async () => {
    render(<ChatMessage message={userMessage} />);
    const copyButton = screen.getByTitle('Copy message');
    fireEvent.click(copyButton);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Hello assistant');
  });

  it('renders attachments when present', () => {
    const messageWithAttachment = {
      ...userMessage,
      attachments: [{ type: 'document', title: 'report.pdf', url: '/files/report.pdf' }],
    };
    render(<ChatMessage message={messageWithAttachment} />);
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    expect(screen.getByText('View')).toBeInTheDocument();
  });

  it('renders image attachment icon', () => {
    const messageWithImage = {
      ...userMessage,
      attachments: [{ type: 'image', title: 'photo.png', url: '/files/photo.png' }],
    };
    render(<ChatMessage message={messageWithImage} />);
    expect(screen.getByText('image')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<ChatMessage message={userMessage} className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('formats markdown-style bold text', () => {
    const boldMessage = { ...userMessage, content: 'This is **bold** text' };
    render(<ChatMessage message={boldMessage} />);
    expect(screen.getByText('bold')).toBeInTheDocument();
  });

  it('formats inline code', () => {
    const codeMessage = { ...userMessage, content: 'Use the `format()` function' };
    render(<ChatMessage message={codeMessage} />);
    expect(screen.getByText('format()')).toBeInTheDocument();
  });
});