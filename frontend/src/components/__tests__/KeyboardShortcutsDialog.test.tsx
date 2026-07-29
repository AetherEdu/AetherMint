import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeyboardShortcutsDialog } from '../KeyboardShortcutsDialog';

jest.mock('@/hooks/useFocusTrap', () => ({
  useFocusTrap: jest.fn(() => null),
}));

jest.mock('@/hooks/useKeyboardShortcuts', () => ({
  getAllShortcuts: jest.fn(() => [
    { id: '1', key: 'k', ctrl: true, alt: false, shift: false, meta: false, description: 'Search courses', category: 'Navigation' },
    { id: '2', key: 'n', ctrl: false, alt: false, shift: false, meta: false, description: 'Next item', category: 'Navigation' },
    { id: '3', key: 'Escape', ctrl: false, alt: false, shift: false, meta: false, description: 'Close dialog', category: 'General' },
  ]),
}));

describe('KeyboardShortcutsDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing by default', () => {
    const { container } = render(<KeyboardShortcutsDialog />);
    expect(container).toBeEmptyDOMElement();
  });

  it('opens when custom event is dispatched', () => {
    render(<KeyboardShortcutsDialog />);
    fireEvent(window, new CustomEvent('keyboard-shortcut:show-help'));
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('displays shortcuts when opened', () => {
    render(<KeyboardShortcutsDialog />);
    fireEvent(window, new CustomEvent('keyboard-shortcut:show-help'));
    expect(screen.getByText('Search courses')).toBeInTheDocument();
    expect(screen.getByText('Next item')).toBeInTheDocument();
    expect(screen.getByText('Close dialog')).toBeInTheDocument();
  });

  it('shows category headers', () => {
    render(<KeyboardShortcutsDialog />);
    fireEvent(window, new CustomEvent('keyboard-shortcut:show-help'));
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
  });

  it('formats Ctrl+K shortcut', () => {
    render(<KeyboardShortcutsDialog />);
    fireEvent(window, new CustomEvent('keyboard-shortcut:show-help'));
    expect(screen.getByText('Ctrl + K')).toBeInTheDocument();
  });

  it('closes when close button is clicked', () => {
    render(<KeyboardShortcutsDialog />);
    fireEvent(window, new CustomEvent('keyboard-shortcut:show-help'));
    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });

  it('closes when keyboard-shortcut:close is dispatched', () => {
    render(<KeyboardShortcutsDialog />);
    fireEvent(window, new CustomEvent('keyboard-shortcut:show-help'));
    fireEvent(window, new CustomEvent('keyboard-shortcut:close'));
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });
});