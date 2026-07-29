import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import NotificationCenter from '../NotificationCenter';

jest.mock('../../../hooks/useNotifications', () => ({
  useNotifications: jest.fn(),
}));

jest.mock('../../../hooks/useFocusTrap', () => ({
  useFocusTrap: jest.fn(() => null),
}));

import { useNotifications } from '../../../hooks/useNotifications';

describe('NotificationCenter', () => {
  const mockMarkAsRead = jest.fn();
  const mockMarkAllAsRead = jest.fn();
  const mockRemoveNotification = jest.fn();
  const mockClearAll = jest.fn();
  const mockSetIsOpen = jest.fn();
  const mockSetSelectedCategory = jest.fn();
  const mockUpdatePreferences = jest.fn();

  const defaultState = {
    notifications: [],
    unreadCount: 0,
    isOpen: false,
    selectedCategory: 'all',
    preferences: {
      categories: { course: { enabled: true, sound: true, desktop: true }, message: { enabled: true, sound: true, desktop: true }, system: { enabled: true, sound: true, desktop: true }, achievement: { enabled: true, sound: true, desktop: true } },
      quietHours: { enabled: false, start: '22:00', end: '07:00' },
    },
    setIsOpen: mockSetIsOpen,
    setSelectedCategory: mockSetSelectedCategory,
    markAsRead: mockMarkAsRead,
    markAllAsRead: mockMarkAllAsRead,
    removeNotification: mockRemoveNotification,
    clearAllNotifications: mockClearAll,
    updatePreferences: mockUpdatePreferences,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useNotifications as jest.Mock).mockReturnValue(defaultState);
  });

  it('renders bell button', () => {
    render(<NotificationCenter />);
    expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
  });

  it('shows notification count in badge', () => {
    (useNotifications as jest.Mock).mockReturnValue({ ...defaultState, unreadCount: 5 });
    render(<NotificationCenter />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('opens dropdown when bell is clicked', () => {
    render(<NotificationCenter />);
    fireEvent.click(screen.getByLabelText('Notifications'));
    expect(mockSetIsOpen).toHaveBeenCalledWith(true);
  });

  it('shows empty state when no notifications', () => {
    (useNotifications as jest.Mock).mockReturnValue({ ...defaultState, isOpen: true });
    render(<NotificationCenter />);
    expect(screen.getByText("You're all caught up!")).toBeInTheDocument();
  });

  it('shows notifications list', () => {
    (useNotifications as jest.Mock).mockReturnValue({
      ...defaultState,
      isOpen: true,
      notifications: [{ id: 'n1', title: 'Test Notification', message: 'Test message', category: 'course', priority: 'medium', timestamp: new Date(), isRead: false }],
      unreadCount: 1,
    });
    render(<NotificationCenter />);
    expect(screen.getByText('Test Notification')).toBeInTheDocument();
  });

  it('shows mark all read button when unread exist', () => {
    (useNotifications as jest.Mock).mockReturnValue({ ...defaultState, isOpen: true, unreadCount: 3 });
    render(<NotificationCenter />);
    expect(screen.getByLabelText('Mark all notifications as read')).toBeInTheDocument();
  });

  it('calls markAllAsRead when button clicked', () => {
    (useNotifications as jest.Mock).mockReturnValue({ ...defaultState, isOpen: true, unreadCount: 3 });
    render(<NotificationCenter />);
    fireEvent.click(screen.getByLabelText('Mark all notifications as read'));
    expect(mockMarkAllAsRead).toHaveBeenCalled();
  });

  it('shows clear all button', () => {
    (useNotifications as jest.Mock).mockReturnValue({
      ...defaultState,
      isOpen: true,
      notifications: [{ id: 'n1', title: 'Test', message: 'Test', category: 'course', priority: 'medium', timestamp: new Date(), isRead: false }],
    });
    render(<NotificationCenter />);
    expect(screen.getByLabelText('Clear all notifications')).toBeInTheDocument();
  });

  it('shows category filters', () => {
    (useNotifications as jest.Mock).mockReturnValue({ ...defaultState, isOpen: true });
    render(<NotificationCenter />);
    expect(screen.getByText('Courses')).toBeInTheDocument();
    expect(screen.getByText('Messages')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.getByText('Achievements')).toBeInTheDocument();
  });

  it('shows preferences panel when preferences button clicked', () => {
    (useNotifications as jest.Mock).mockReturnValue({ ...defaultState, isOpen: true });
    render(<NotificationCenter />);
    fireEvent.click(screen.getByText('Preferences'));
    expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
  });
});