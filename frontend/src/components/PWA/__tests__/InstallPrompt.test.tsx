import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { InstallPrompt, InstallBanner, usePWAInstall } from '../InstallPrompt';

describe('InstallPrompt', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      configurable: true,
    });
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns null when not in installable state', () => {
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows prompt when beforeinstallprompt event fires', () => {
    render(<InstallPrompt />);
    act(() => {
      const event = new Event('beforeinstallprompt');
      Object.assign(event, { prompt: jest.fn(), userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }) });
      window.dispatchEvent(event);
    });
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText('Install AetherMint')).toBeInTheDocument();
    expect(screen.getByText('Install App')).toBeInTheDocument();
  });

  it('shows dismiss and not now buttons', () => {
    render(<InstallPrompt />);
    act(() => {
      const event = new Event('beforeinstallprompt');
      Object.assign(event, { prompt: jest.fn(), userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }) });
      window.dispatchEvent(event);
    });
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText('Not Now')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Dismiss').length).toBeGreaterThan(0);
  });

  it('calls onInstall when appinstalled event fires', () => {
    const onInstall = jest.fn();
    render(<InstallPrompt onInstall={onInstall} />);
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it('returns null when already installed (standalone)', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('calls onDismiss when dismissed', () => {
    const onDismiss = jest.fn();
    render(<InstallPrompt onDismiss={onDismiss} />);
    act(() => {
      const event = new Event('beforeinstallprompt');
      Object.assign(event, { prompt: jest.fn(), userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }) });
      window.dispatchEvent(event);
    });
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    const dismissButtons = screen.getAllByLabelText('Dismiss');
    if (dismissButtons.length > 0) {
      fireEvent.click(dismissButtons[0]);
      expect(onDismiss).toHaveBeenCalled();
    }
  });
});

describe('InstallBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: false,
        addListener: jest.fn(),
        removeListener: jest.fn(),
      })),
    });
  });

  it('renders nothing by default (no beforeinstallprompt fired)', () => {
    const { container } = render(<InstallBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});