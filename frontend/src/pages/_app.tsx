import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { AppProps } from 'next/app';
import { appWithTranslation } from 'next-i18next';
import { WalletProvider } from '../context/WalletContext';
import { Toaster } from 'react-hot-toast';
import { useRouter } from 'next/router';
import { MobileNav } from '../components/Mobile/MobileNav';
import '../styles/globals.css';
// Bootstraps i18next on the client side (LanguageDetector, querystring, etc).
import '../lib/i18n';
import nextI18NextConfig from '../../next-i18next.config';
import { PageTransition } from '../components/PageTransition';

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

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  return (
    <WalletProvider>
      <ServiceWorkerBootstrap />
      <MobileNav
        currentPath={router.pathname}
        onNavigate={(path) => router.push(path)}
      />
      {/* Reserve space on mobile so the fixed hamburger (top) and bottom
          nav bar don't overlap page content; removed at md+. */}
      <div className="pt-16 pb-20 md:pt-0 md:pb-0">
        <PageTransition routeKey={router.asPath}>
          <Component {...pageProps} />
        </PageTransition>
      </div>
      <OfflineIndicator />
      <Toaster position="bottom-right" />
    </WalletProvider>
  );
}

export default appWithTranslation(MyApp, nextI18NextConfig);
