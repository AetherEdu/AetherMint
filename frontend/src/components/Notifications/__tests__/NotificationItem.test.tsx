import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import NotificationItem from '../NotificationItem';

const baseNotification = {
  id: 'n1',
  title: 'Course Updated',
  message: 'New content available',
  category: 'course' as const,
  priority: 'medium' as const,
  timestamp: new Date('2024-01-01T10:00:00'),
  isRead: false,
};

describe('NotificationItem', () => {
  const onMarkAsRead = jest.fn();
  const onRemove = jest.fn();

  it('renders notification title', () => {
    render(<NotificationItem notification={baseNotification} onMarkAsRead={onMarkAsRead} onRemove={onRemove} />);
    expect(screen.getByText('Course Updated')).toBeInTheDocument();
  });

  it('renders notification message', () => {
    render(<NotificationItem notification={baseNotification} onMarkAsRead={onMarkAsRead} onRemove={onRemove} />);
    expect(screen.getByText('New content available')).toBeInTheDocument();
  });

  it('shows unread styles when not read', () => {
    const { container } = render(<NotificationItem notification={baseNotification} onMarkAsRead={onMarkAsRead} onRemove={onRemove} />);
    expect(container.firstChild?.firstChild).toHaveClass('border-l-blue-500');
  });

  it('shows read styles when marked as read', () => {
    const readNotification = { ...baseNotification, isRead: true };
    const { container } = render(<NotificationItem notification={readNotification} onMarkAsRead={onMarkAsRead} onRemove={onRemove} />);
    expect(container.firstChild?.firstChild).not.toHaveClass('border-l-blue-500');
  });

  it('calls onMarkAsRead when unread notification is clicked', () => {
    render(<NotificationItem notification={baseNotification} onMarkAsRead={onMarkAsRead} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: /Course Updated/ }));
    expect(onMarkAsRead).toHaveBeenCalledWith('n1');
  });

  it('calls onRemove when remove button is clicked', () => {
    render(<NotificationItem notification={baseNotification} onMarkAsRead={onMarkAsRead} onRemove={onRemove} />);
    fireEvent.click(screen.getByLabelText('Remove notification: Course Updated'));
    expect(onRemove).toHaveBeenCalledWith('n1');
  });

  it('does not call onMarkAsRead if already read', () => {
    const readNotification = { ...baseNotification, isRead: true };
    render(<NotificationItem notification={readNotification} onMarkAsRead={onMarkAsRead} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: /Course Updated/ }));
    expect(onMarkAsRead).not.toHaveBeenCalled();
  });

  it('displays category label', () => {
    render(<NotificationItem notification={baseNotification} onMarkAsRead={onMarkAsRead} onRemove={onRemove} />);
    expect(screen.getByText('course')).toBeInTheDocument();
  });

  it('displays timestamp', () => {
    render(<NotificationItem notification={baseNotification} onMarkAsRead={onMarkAsRead} onRemove={onRemove} />);
    expect(screen.getByText(/\d+[mhd] ago/)).toBeInTheDocument();
  });

  it('shows unread indicator dot', () => {
    render(<NotificationItem notification={baseNotification} onMarkAsRead={onMarkAsRead} onRemove={onRemove} />);
    expect(screen.getByLabelText('Unread notification')).toBeInTheDocument();
  });

  it('hides unread indicator dot when read', () => {
    const readNotification = { ...baseNotification, isRead: true };
    render(<NotificationItem notification={readNotification} onMarkAsRead={onMarkAsRead} onRemove={onRemove} />);
    expect(screen.queryByLabelText('Unread notification')).not.toBeInTheDocument();
  });

  it('shows priority indicator for high priority', () => {
    const highPriority = { ...baseNotification, priority: 'high' as const };
    const { container } = render(<NotificationItem notification={highPriority} onMarkAsRead={onMarkAsRead} onRemove={onRemove} />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});