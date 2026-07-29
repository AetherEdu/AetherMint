import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PreferencesPanel from '../PreferencesPanel';

const defaultPreferences = {
  categories: {
    course: { enabled: true, sound: true, desktop: false },
    message: { enabled: true, sound: false, desktop: true },
    system: { enabled: true, sound: true, desktop: true },
    achievement: { enabled: false, sound: false, desktop: false },
  },
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '07:00',
  },
};

describe('PreferencesPanel', () => {
  const onUpdatePreferences = jest.fn();

  it('renders preferences title', () => {
    render(<PreferencesPanel preferences={defaultPreferences} onUpdatePreferences={onUpdatePreferences} />);
    expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
  });

  it('renders all category labels', () => {
    render(<PreferencesPanel preferences={defaultPreferences} onUpdatePreferences={onUpdatePreferences} />);
    expect(screen.getByText('Course Updates')).toBeInTheDocument();
    expect(screen.getByText('Messages')).toBeInTheDocument();
    expect(screen.getByText('System Alerts')).toBeInTheDocument();
    expect(screen.getByText('Achievements')).toBeInTheDocument();
  });

  it('shows enabled/disabled state', () => {
    render(<PreferencesPanel preferences={defaultPreferences} onUpdatePreferences={onUpdatePreferences} />);
    const enabledButtons = screen.getAllByText('Enabled');
    expect(enabledButtons.length).toBe(3);
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('renders quiet hours section', () => {
    render(<PreferencesPanel preferences={defaultPreferences} onUpdatePreferences={onUpdatePreferences} />);
    expect(screen.getByText('Quiet Hours')).toBeInTheDocument();
  });

  it('toggles category enabled state', () => {
    render(<PreferencesPanel preferences={defaultPreferences} onUpdatePreferences={onUpdatePreferences} />);
    const enableButtons = screen.getAllByText('Enabled');
    fireEvent.click(enableButtons[0]);
    expect(onUpdatePreferences).toHaveBeenCalled();
  });

  it('toggles quiet hours', () => {
    render(<PreferencesPanel preferences={defaultPreferences} onUpdatePreferences={onUpdatePreferences} />);
    const toggle = screen.getByLabelText('Toggle quiet hours');
    fireEvent.click(toggle);
    expect(onUpdatePreferences).toHaveBeenCalled();
  });

  it('shows time inputs when quiet hours enabled', () => {
    const prefsWithQuietHours = {
      ...defaultPreferences,
      quietHours: { enabled: true, start: '22:00', end: '07:00' },
    };
    render(<PreferencesPanel preferences={prefsWithQuietHours} onUpdatePreferences={onUpdatePreferences} />);
    expect(screen.getByLabelText('Quiet hours start time')).toBeInTheDocument();
    expect(screen.getByLabelText('Quiet hours end time')).toBeInTheDocument();
  });
});