/**
 * Service Worker Registration Helper
 * -------------------------------------------------------------------------
 * Tiny client-side wrapper that registers `/sw.js` once the page has loaded
 * and exposes a user-prompted update flow:
 *
 *   1. Wait for `load` to avoid competing with critical-render fetches.
 *   2. Register with a `/` scope so the SW covers every page route.
 *   3. Detect new workers waiting to activate and call `onUpdate` so the
 *      UI can show a "Reload to update" prompt.
 *   4. Only ON user consent does the page call `applyUpdate()`, which posts
 *      `{ type: 'SKIP_WAITING' }` to the waiting worker. Nothing happens
 *      automatically on install — that would surprise users mid-edit.
 *
 * The whole module is exported as a plain function so it is straightforward
 * to unit-test against a fake `navigator.serviceWorker`.
 */

export type ServiceWorkerStatus =
  | 'unsupported'
  | 'registering'
  | 'registered'
  | 'activated'
  | 'error';

export interface ServiceWorkerCallbacks {
  /** Fired when a new worker is installed and waiting to activate. */
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  /** Fired the first time a worker successfully takes control of the page. */
  onOfflineReady?: (registration: ServiceWorkerRegistration) => void;
  /** Called for any registration error — UI must degrade gracefully. */
  onError?: (error: unknown) => void;
}

export interface RegisterServiceWorkerOptions {
  /** Bypass the production-only guard (used by integration tests). */
  force?: boolean;
  /** Override the script URL (defaults to `/sw.js`). */
  scriptUrl?: string;
  /** Override scope (defaults to `/`). */
  scope?: string;
}

// Module-local state so `applyUpdate()` can find the current registration
// without us threading it through React every render.
let activatedOnce = false;
let currentRegistration: ServiceWorkerRegistration | null = null;

const isProduction = (): boolean => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV === 'production';
  }
  return true;
};

const isSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  typeof window.ServiceWorkerRegistration !== 'undefined';

/**
 * Register the Workbox-based service worker. Resolves with the resulting
 * status — never throws. In development (or when the API is unavailable)
 * the function is a no-op that resolves to `'unsupported'`.
 */
export async function registerServiceWorker(
  callbacks: ServiceWorkerCallbacks = {},
  options: RegisterServiceWorkerOptions = {}
): Promise<ServiceWorkerStatus> {
  const { onUpdate, onOfflineReady, onError } = callbacks;
  const {
    force = false,
    scriptUrl = '/sw.js',
    scope = '/',
  } = options;

  if (!isSupported()) {
    return 'unsupported';
  }

  if (!force && !isProduction()) {
    // Don't pollute local dev caches.
    return 'unsupported';
  }

  try {
    const registration = await navigator.serviceWorker.register(scriptUrl, {
      scope,
      updateViaCache: 'none',
    });

    currentRegistration = registration;

    const fireUpdateIfWaiting = () => {
      const waiting =
        registration.waiting ?? registration.installing ?? null;
      if (
        waiting &&
        waiting.state === 'installed' &&
        navigator.serviceWorker.controller
      ) {
        onUpdate?.(registration);
      }
    };

    // Inspect any worker that is already waiting (e.g. user refreshed after
    // the update was registered but not yet activated).
    fireUpdateIfWaiting();

    // Listen for the next install/activation cycle.
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', fireUpdateIfWaiting);
    });

    // First controller change = a worker took over = the user can use the
    // app offline. Subsequent changes mean a *future* update and we
    // surface them through `onUpdate` above.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!activatedOnce) {
        activatedOnce = true;
        onOfflineReady?.(registration);
      }
    });

    return 'registered';
  } catch (error) {
    onError?.(error);
    return 'error';
  }
}

/**
 * Prompt the waiting worker to take control. The page must call this AFTER
 * the user has accepted an update prompt — typically followed by `location.reload()`.
 *
 * Returns `true` if a `SKIP_WAITING` message was posted, `false` if there is
 * no pending update.
 */
export function applyUpdate(): boolean {
  if (!currentRegistration) return false;
  const waiting = currentRegistration.waiting;
  if (!waiting) return false;
  waiting.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

/** Test-only helper — exposed so jest suites can reset module state. */
export function __resetServiceWorkerRegistrationForTests(): void {
  activatedOnce = false;
  currentRegistration = null;
}
