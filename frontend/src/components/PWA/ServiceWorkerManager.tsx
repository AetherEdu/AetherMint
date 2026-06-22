'use client';

/**
 * ServiceWorkerManager
 * -------------------------------------------------------------------------
 * Headless client component that registers the Workbox service worker and
 * surfaces a non-blocking update prompt.
 *
 * Responsibilities
 *   1. Register `/sw.js` via `registerServiceWorker` (production builds
 *      only by default; pass `forceRegister` from storybook / e2e).
 *   2. When the registered worker signals an update (an `onUpdate`
 *      callback from the helper), queue a react-hot-toast with an
 *      "Update now" action that posts SKIP_WAITING and waits for the
 *      new worker to take control before reloading.
 *   3. Show a brief "Back online" toast when the browser re-establishes
 *      connectivity — important because users have learned to expect
 *      visible confirmation that anything they queued while offline has
 *      actually been delivered.
 *
 * Rendered from `app/layout.tsx → PWAClientShell.tsx` (App Router) so
 * registration runs on every App Router route, and from `pages/_app.tsx`
 * (Pages Router tree) via a sibling import.
 *
 * IMPORTANT: every render path is purely client-side. We never read
 * `window` outside of `useEffect` so this file can be imported by an
 * App Router layout without triggering a hydration mismatch.
 */

import { useEffect } from 'react';
import toast from 'react-hot-toast';

import {
  applyUpdate,
  registerServiceWorker,
  type ServiceWorkerCallbacks,
} from './serviceWorkerRegistration';

const TOAST_ID_UPDATE_AVAILABLE = 'aethermint-sw-update';
const TOAST_ID_OFFLINE = 'aethermint-offline';

interface ServiceWorkerManagerProps {
  /**
   * When `false` (default) the helper runs in production only. Set
   * `true` from storybook / end-to-end tests to force-activate the SW.
   */
  forceRegister?: boolean;
}

export function ServiceWorkerManager({
  forceRegister = false,
}: ServiceWorkerManagerProps) {
  useEffect(() => {
    let cancelled = false;

    const handleOnline = () => {
      toast.dismiss(TOAST_ID_OFFLINE);
      toast.success('Back online — syncing your queued changes.');
    };

    const handleOffline = () => {
      toast(TOAST_ID_OFFLINE, {
        id: TOAST_ID_OFFLINE,
        icon: '📡',
        duration: 4000,
        style: { background: '#f59e0b', color: '#1f2937' },
      });
    };

    // Once the user clicks "Update now", we post SKIP_WAITING to the
    // waiting worker. The browser then takes a beat before swapping
    // controllers — we wait for the `controllerchange` event (one-shot)
    // rather than guessing with a timeout, and reload only once the new
    // worker is actually in charge.
    const armReloader = () => {
      const controller = navigator.serviceWorker.controller;
      const reloadOnce = () => {
        navigator.serviceWorker.removeEventListener(
          'controllerchange',
          reloadOnce
        );
        // Avoid reload loops when this page itself is the controller
        // AND nothing changed.
        if (navigator.serviceWorker.controller && navigator.serviceWorker.controller !== controller) {
          window.location.reload();
        }
      };
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        reloadOnce,
        { once: true }
      );
    };

    const callbacks: ServiceWorkerCallbacks = {
      onUpdate: () => {
        // Single persistent toast with an "Update now" action.
        toast(
          (t) => (
            <div className="flex items-center gap-3" data-testid="sw-update-toast">
              <span className="text-sm font-medium">
                A new version of AetherMint is available.
              </span>
              <button
                type="button"
                onClick={() => {
                  armReloader();
                  const activated = applyUpdate();
                  if (!activated) {
                    // No waiting worker — dismiss the toast and let the
                    // user keep working. This is the common case during
                    // the very first load.
                    toast.dismiss(t.id);
                  }
                }}
                className="rounded-md bg-sky-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                Update now
              </button>
            </div>
          ),
          {
            id: TOAST_ID_UPDATE_AVAILABLE,
            duration: Infinity,
            position: 'bottom-right',
            style: {
              background: '#0f172a',
              color: '#f8fafc',
              maxWidth: '32rem',
            },
          }
        );
      },
      onOfflineReady: () => {
        // First-time ready notification — short and dismissible.
        toast('AetherMint is ready to work offline.', {
          icon: '✅',
          duration: 3000,
        });
      },
      onError: (error) => {
        // eslint-disable-next-line no-console
        console.warn('[AetherMint] service worker registration failed:', error);
      },
    };

    (async () => {
      try {
        if (cancelled) return;
        await registerServiceWorker(callbacks, { force: forceRegister });
      } catch (error) {
        // Service workers are a progressive enhancement — failures must
        // never crash the app.
        // eslint-disable-next-line no-console
        console.warn('[AetherMint] service worker bootstrap failed:', error);
      }
    })();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [forceRegister]);

  return null;
}

export default ServiceWorkerManager;
