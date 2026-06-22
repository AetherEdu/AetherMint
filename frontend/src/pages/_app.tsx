import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { AppProps } from 'next/app';
import { appWithTranslation } from 'next-i18next';
import { WalletProvider } from '../context/WalletContext';
import { Toaster } from 'react-hot-toast';
import '../styles/globals.css';
// Bootstraps i18next on the client side (LanguageDetector, querystring, etc).
import '../lib/i18n';

// The OfflineIndicator uses `useNetworkStatus`, which reads
// `navigator.onLine` on first render — that produces a different value
// on the server. Skip SSR for it.
const OfflineIndicator = dynamic(
  () => import('../components/PWA/OfflineIndicator').then((mod) => mod.OfflineIndicator),
  { ssr: false }
);

function ServiceWorkerBootstrap() {
  // Lazy-load the registration helper only on the client so it never
  // touches `window` during SSR.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { registerServiceWorker } = await import(
          '../components/PWA/serviceWorkerRegistration'
        );
        if (cancelled) return;
        await registerServiceWorker();
      } catch (error) {
        // Service workers are a progressive enhancement — failures must
        // never crash the app.
        // eslint-disable-next-line no-console
        console.warn('[AetherMint] Service worker registration failed:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

// The OfflineIndicator uses `useNetworkStatus`, which reads
// `navigator.onLine` on first render — that produces a different value on
// the server. Skip SSR for it.
const OfflineIndicator = dynamic(
  () =>
    import('../components/PWA/OfflineIndicator').then(
      (mod) => mod.OfflineIndicator
    ),
  { ssr: false }
);

/**
 * Invisible client-only component that registers the Workbox service worker.
 * Kept out of the React tree (returns null) so it has no SSR footprint and
 * never blocks rendering. Errors are swallowed: a failed registration must
 * never bring the app down.
 */
function ServiceWorkerBootstrap() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { registerServiceWorker } = await import(
          '../components/PWA/serviceWorkerRegistration'
        );
        if (cancelled) return;
        await registerServiceWorker();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(
          '[AetherMint] service worker registration failed:',
          error
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <WalletProvider>
      <ServiceWorkerBootstrap />
      <Component {...pageProps} />
      <OfflineIndicator />
      <Toaster position="bottom-right" />
    </WalletProvider>
  );
}

export default appWithTranslation(MyApp);
