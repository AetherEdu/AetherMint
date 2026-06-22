/**
 * @jest-environment jsdom
 */
import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { OfflineIndicator } from '../OfflineIndicator';

// `useNetworkStatus` reads `navigator.onLine` and subscribes to `window`
// online/offline events — fine in jsdom but we mock it so each test can
// flip the value deterministically.
jest.mock('../../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: jest.fn(),
}));

// `useOfflineSync` reads navigator.onLine + IndexedDB at first render —
// mock it so tests run in plain jsdom without an IDB shim.
jest.mock('../../../hooks/useOfflineSync', () => ({
  useOfflineSync: jest.fn(),
}));

// The hook that clears the offline store reads IndexedDB on mount; mock
// the hook so tests remain hermetic, exposing just the methods the
// banner exercises.
jest.mock('../../../hooks/useOfflineData', () => ({
  useOfflineCourses: jest.fn(),
}));

import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import { useOfflineSync } from '../../../hooks/useOfflineSync';
import { useOfflineCourses } from '../../../hooks/useOfflineData';

// `jest.Mock` keeps this file free of generic type expressions — the TSX
// transformer otherwise confuses `<typeof useNetworkStatus>` with JSX.
const mockUseNetworkStatus = useNetworkStatus as unknown as jest.Mock;
const mockUseOfflineSync = useOfflineSync as unknown as jest.Mock;
const mockUseOfflineCourses = useOfflineCourses as unknown as jest.Mock;

interface MockSyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  queuedItems: number;
  lastSyncTime: Date | undefined;
  syncErrors: string[];
}

interface UseOfflineCoursesApi {
  clearAll: jest.Mock;
}

function mockSync({ queuedItems = 0, clearQueue = jest.fn() }: Partial<{
  queuedItems: number;
  clearQueue: jest.Mock;
}> = {}) {
  const syncStatus: MockSyncStatus = {
    isOnline: false,
    isSyncing: false,
    queuedItems,
    lastSyncTime: undefined,
    syncErrors: [],
  };
  mockUseOfflineSync.mockReturnValue({ syncStatus, clearQueue });
}

function mockCourses({ clearAll = jest.fn().mockResolvedValue(undefined) }: Partial<{
  clearAll: jest.Mock;
}> = {}) {
  mockUseOfflineCourses.mockReturnValue({ clearAll });
}

describe('OfflineIndicator', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseNetworkStatus.mockReturnValue({ isOnline: true });
    mockSync({ queuedItems: 0 });
    mockCourses();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('renders nothing when online', () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: true });
    const { container } = render(<OfflineIndicator />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the banner with role="alert" when offline', async () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: false });
    render(<OfflineIndicator />);

    const banner = await screen.findByRole('alert');
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toMatch(/offline/i);
  });

  it('shows a pending-count chip when there are queued offline actions', async () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: false });
    mockSync({ queuedItems: 3 });
    render(<OfflineIndicator />);

    const chip = await screen.findByTestId('offline-pending-count');
    expect(chip.textContent).toBe('3');
    expect(screen.getByRole('alert').textContent).toMatch(
      /3 pending actions/
    );
  });

  it('hides the banner once dismissed and persists the choice', async () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: false });
    render(<OfflineIndicator />);

    const dismiss = await screen.findByRole('button', {
      name: /dismiss offline banner/i,
    });

    await act(async () => {
      fireEvent.click(dismiss);
    });

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    expect(
      window.localStorage.getItem('aethermint-offline-banner-dismissed')
    ).toBe('true');
  });

  it('honours a custom storage key', async () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: false });
    render(<OfflineIndicator storageKey="custom-dismiss" />);

    const dismiss = await screen.findByRole('button', {
      name: /dismiss offline banner/i,
    });

    await act(async () => {
      fireEvent.click(dismiss);
    });

    await waitFor(() => {
      expect(window.localStorage.getItem('custom-dismiss')).toBe('true');
    });
  });

  it('does not throw when localStorage is unavailable', () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: false });
    const original = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });

    expect(() => render(<OfflineIndicator />)).not.toThrow();

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: original,
    });
  });

  it('Clear → Confirm two-step wipes offline data and shows success copy', async () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: false });
    const clearQueue = jest.fn();
    const clearAll = jest.fn().mockResolvedValue(undefined);
    mockSync({ queuedItems: 2, clearQueue });
    mockCourses({ clearAll });

    render(<OfflineIndicator />);

    const clearBtn = await screen.findByTestId('offline-clear');
    await act(async () => {
      fireEvent.click(clearBtn);
    });

    const confirmBtn = await screen.findByTestId('offline-clear-confirm');
    expect(confirmBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(clearAll).toHaveBeenCalledTimes(1);
      expect(clearQueue).toHaveBeenCalledTimes(1);
    });

    // Confirmation row is gone; "Clear" button is back.
    await waitFor(() => {
      expect(screen.queryByTestId('offline-clear-confirm')).toBeNull();
      expect(screen.getByTestId('offline-clear')).toBeInTheDocument();
    });

    // Pending chip is hidden; banner copy now says data is cleared.
    expect(screen.queryByTestId('offline-pending-count')).toBeNull();
    expect(screen.getByRole('alert').textContent).toMatch(/cleared/i);
  });

  it('surfaces a clear-failure message inline when clearAll rejects', async () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: false });
    const clearAll = jest
      .fn()
      .mockRejectedValueOnce(new Error('IDB write blocked'));
    mockCourses({ clearAll });

    render(<OfflineIndicator />);

    await act(async () => {
      fireEvent.click(await screen.findByTestId('offline-clear'));
    });
    await act(async () => {
      fireEvent.click(await screen.findByTestId('offline-clear-confirm'));
    });

    await waitFor(() => {
      expect(
        screen.getByRole('alert').textContent
      ).toMatch(/IDB write blocked/);
    });
    expect(clearAll).toHaveBeenCalledTimes(1);
    // Chip stays hidden while we're in the error state.
    expect(screen.queryByTestId('offline-pending-count')).toBeNull();
  });
});
