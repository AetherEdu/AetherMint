/**
 * OfflineIndicator
 * -------------------------------------------------------------------------
 * Fixed bottom banner rendered whenever `useNetworkStatus` reports an offline
 * state. The component is loaded via `next/dynamic(..., { ssr: false })`
 * (see `PWAClientShell.tsx` and `pages/_app.tsx`) so the first paint
 * always happens on the client — that lets `useNetworkStatus` read
 * `navigator.onLine` without producing a hydration mismatch.
 *
 * Beyond the basic "you're offline" notice, this banner now also surfaces:
 *   • The number of queued offline actions waiting for the network to
 *     return (read from `useOfflineSync().syncStatus.queuedItems`).
 *   • An inline "Clear" → "Confirm" two-step action that drains the
 *     IndexedDB stores plus the in-memory queue so users can free disk
 *     space or wipe stale data without reloading the page. We do not use
 *     `window.confirm()` because blocking the main thread is jarring,
 *     and in jsdom there is no native dialog implementation to mock.
 *   • An `aria-live="assertive"` error chip surfaced inline if the clear
 *     fails (so users aren't silently left wondering what happened).
 *
 * UX notes:
 *   • Users can dismiss the banner; the choice persists in `localStorage`
 *     under `storageKey` so we don't annoy them every refresh.
 *   • The dismiss button is keyboard-reachable and labelled for screen
 *     readers.
 *   • Color tokens match the application's Tailwind palette (amber).
 */

import { useCallback, useMemo, useState } from 'react';

import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useOfflineCourses } from '../../hooks/useOfflineData';

const DEFAULT_STORAGE_KEY = 'aethermint-offline-banner-dismissed';

interface OfflineIndicatorProps {
  /**
   * Override the localStorage key used to remember that the user dismissed
   * the banner. Mostly useful for tests / storybooks.
   */
  storageKey?: string;
}

const safeGetItem = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // localStorage can throw in private mode / sandboxed iframes.
    return null;
  }
};

const safeSetItem = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* intentionally ignored */
  }
};

export function OfflineIndicator({
  storageKey = DEFAULT_STORAGE_KEY,
}: OfflineIndicatorProps) {
  const { isOnline } = useNetworkStatus();
  const [dismissed, setDismissed] = useState<boolean>(
    () => safeGetItem(storageKey) === 'true'
  );
  // `useOfflineSync` upgrades the indicator from a passive notice into a
  // useful control panel. We disable autoSync because this component is
  // about visibility, not background flushing.
  const { syncStatus, clearQueue } = useOfflineSync({ autoSync: false });
  const { clearAll } = useOfflineCourses();
  const [clearing, setClearing] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearedRecently, setClearedRecently] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  const pendingCount = syncStatus.queuedItems;

  const handleDismiss = () => {
    safeSetItem(storageKey, 'true');
    setDismissed(true);
  };

  const handleClear = useCallback(async () => {
    setClearError(null);
    setClearing(true);
    try {
      await clearAll();
      clearQueue();
      setClearedRecently(true);
      setConfirmingClear(false);
      // Reset the success chip after a moment so users don't think the
      // banner stays "cleared" forever.
      window.setTimeout(() => setClearedRecently(false), 4000);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not clear offline data.';
      setClearError(message);
    } finally {
      setClearing(false);
    }
  }, [clearAll, clearQueue]);

  const summary = useMemo(() => {
    if (clearError) {
      return (
        <>
          Couldn&rsquo;t clear offline data: {clearError}. Closed tabs and
          retried writes should be safe &mdash; try again when storage is
          writable.
        </>
      );
    }
    if (clearedRecently) {
      return <>Offline data cleared. Continuing to monitor the connection…</>;
    }
    if (pendingCount > 0) {
      return (
        <>
          You&rsquo;re offline. {pendingCount} pending{' '}
          {pendingCount === 1 ? 'action' : 'actions'} will sync when
          you&rsquo;re back online.
        </>
      );
    }
    return (
      <>
        You&rsquo;re offline &mdash; cached content remains available and
        progress will sync automatically once you&rsquo;re back online.
      </>
    );
  }, [clearError, clearedRecently, pendingCount]);

  if (isOnline || dismissed) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 transform bg-amber-500 text-amber-950 shadow-lg transition-transform duration-200 ease-out"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 flex-shrink-0"
            aria-hidden="true"
          >
            <path d="M5 12.55a11 11 0 0 1 14.08 0" />
            <path d="M1.42 9a16 16 0 0 1 21.16 0" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
            <line x1="2" y1="2" x2="22" y2="22" />
          </svg>
          {pendingCount > 0 && !clearedRecently && !clearError && (
            <span
              data-testid="offline-pending-count"
              className="inline-flex min-w-[1.75rem] items-center justify-center rounded-full bg-amber-700 px-2 py-0.5 text-xs font-semibold text-amber-50"
            >
              {pendingCount}
            </span>
          )}
          <span
            className="truncate text-sm font-medium sm:text-base"
            // Errors should interrupt pending screen-reader speech, while
            // routine status updates stay polite.
            aria-live={clearError ? 'assertive' : 'polite'}
          >
            {summary}
          </span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {confirmingClear ? (
            <>
              <button
                type="button"
                onClick={handleClear}
                disabled={clearing}
                aria-label="Confirm clearing offline data"
                data-testid="offline-clear-confirm"
                className="rounded-md border border-amber-900 bg-amber-700 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-amber-50 transition hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {clearing ? 'Clearing…' : 'Confirm'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                aria-label="Cancel clearing offline data"
                className="rounded-md border border-amber-700 bg-transparent px-2 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900 transition hover:bg-amber-600/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setClearError(null);
                setConfirmingClear(true);
              }}
              disabled={clearing}
              aria-label="Clear all offline data"
              data-testid="offline-clear"
              className="rounded-md border border-amber-700 bg-amber-600/30 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900 transition hover:bg-amber-600/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {clearing ? 'Clearing…' : 'Clear'}
            </button>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss offline banner"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-amber-900 transition hover:bg-amber-600/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default OfflineIndicator;
