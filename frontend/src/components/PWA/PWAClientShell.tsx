'use client';

/**
 * PWAClientShell
 * -------------------------------------------------------------------------
 * Tiny client wrapper mounted in `app/layout.tsx` to host all PWA wiring
 * (service worker registration, offline indicator, react-hot-toast).
 *
 * Why a separate file?
 *   • `useOfflineSync` reads `navigator.onLine` synchronously during its
 *     initial state — accessing this on the server would throw a
 *     `ReferenceError`. So we lazy-load it via `next/dynamic` with
 *     `ssr: false`, matching the existing `_app.tsx` pattern.
 *   • `ServiceWorkerManager` shouldn't be in the SSR HTML at all; it
 *     mounts no DOM and is meaningful only after `window` exists.
 *   • `Toaster` must be a stable element in the document so toasts have
 *     a portal target. Importing it as a normal client component is fine
 *     but keeping it here keeps the moving parts in one file.
 *
 * The file is intentionally bare: no `<div>` wrapper and no styles, so
 * the layout owner retains complete control of stacking context.
 */

import dynamic from 'next/dynamic';
import { Toaster } from 'react-hot-toast';

const ServiceWorkerManager = dynamic(
  () =>
    import('./ServiceWorkerManager').then((mod) => mod.ServiceWorkerManager),
  { ssr: false }
);

const OfflineIndicator = dynamic(
  () =>
    import('./OfflineIndicator').then((mod) => mod.OfflineIndicator),
  { ssr: false }
);

/**
 * Convenience flag — pages/_app.tsx also mounts these components. We
 * intentionally don't deduplicate the registration: each import path
 * has its own effect cycle and the underlying registration helper is
 * idempotent (a duplicate `register()` call returns the existing
 * registration, no double-firing).
 */
export default function PWAClientShell() {
  return (
    <>
      <ServiceWorkerManager />
      <OfflineIndicator />
      <Toaster position="bottom-right" />
    </>
  );
}
