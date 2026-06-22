/**
 * Offline Fallback Page
 * -------------------------------------------------------------------------
 * Served by the Workbox `setCatchHandler` in `public/sw.js` whenever a
 * navigation request fails (no network AND no cached page). It is also
 * precached on SW install so it is available on the very first offline
 * load — covering the acceptance criterion:
 *
 *   "Load app, go offline, refresh: app still loads".
 *
 * The page is intentionally context-free: it must NOT depend on `WalletProvider`,
 * theme context, or any client-side data so it can render in the most
 * constrained scenario.
 */

import { useEffect } from 'react';
import Head from 'next/head';

interface OfflineFeature {
  title: string;
  description: string;
}

const OFFLINE_FEATURES: ReadonlyArray<OfflineFeature> = [
  {
    title: 'Cached courses',
    description:
      'Any course you opened at least once stays available, including lessons and reading material.',
  },
  {
    title: 'Background sync',
    description:
      'Quizzes, progress updates, and payments are queued locally and replay automatically when you reconnect.',
  },
  {
    title: 'Pinned install',
    description:
      'Install AetherMint to your home screen to launch offline even with no prior visits.',
  },
];

const STATUS_CHECK_INTERVAL_MS = 5000;

const redirectHome = (): void => {
  // Use `href` (rather than `router.push`) so we bounce through the SW
  // and pick up the newly-cached home route on retry.
  window.location.href = '/';
};

export default function OfflinePage() {
  useEffect(() => {
    // 1. Redirect as soon as the browser emits an `online` event.
    window.addEventListener('online', redirectHome);

    // 2. Belt-and-braces: poll `navigator.onLine` for up-to 5 s in case
    //    the event fires before our listener attaches. This catches
    //    the common "already online when the SW fell back" case.
    const intervalId = window.setInterval(() => {
      if (navigator.onLine) {
        window.clearInterval(intervalId);
        redirectHome();
      }
    }, STATUS_CHECK_INTERVAL_MS);

    return () => {
      window.removeEventListener('online', redirectHome);
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <>
      <Head>
        <title>Offline · AetherMint</title>
        <meta
          name="description"
          content="AetherMint is currently offline. Cached content remains available."
        />
        <meta name="robots" content="noindex" />
        <meta name="theme-color" content="#0f172a" />
      </Head>

      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 px-4 py-12 text-slate-100">
        <div className="w-full max-w-2xl text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-400/40">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-10 w-10 text-amber-300"
              aria-hidden="true"
            >
              <path d="M18.364 5.636a9 9 0 0 1 0 12.728" />
              <path d="M15.536 8.464a5 5 0 0 1 0 7.072" />
              <path d="M2 8.82a15 15 0 0 1 20 0" />
              <path d="M5 12.859a10 10 0 0 1 14 0" />
              <path d="M8.5 16.429a5 5 0 0 1 7 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
              <line x1="3" y1="3" x2="21" y2="21" />
            </svg>
          </div>

          <h1 className="mb-3 text-3xl font-semibold sm:text-4xl">
            You&rsquo;re offline
          </h1>

          <p className="mb-8 text-base text-slate-300 sm:text-lg">
            AetherMint can&rsquo;t reach the network right now. Don&rsquo;t
            worry &mdash; cached courses and queued progress will continue to
            work, and we&rsquo;ll resync everything as soon as you&rsquo;re
            back online.
          </p>

          <div className="mb-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={redirectHome}
              className="inline-flex items-center justify-center rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              Try again
            </button>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-lg border border-slate-600 bg-slate-800/60 px-5 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-700"
            >
              Go to home
            </a>
          </div>

          <div className="grid gap-4 text-left sm:grid-cols-3">
            {OFFLINE_FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="rounded-xl border border-slate-700 bg-slate-800/40 p-4"
              >
                <h2 className="mb-1 text-sm font-semibold text-sky-300">
                  {feature.title}
                </h2>
                <p className="text-xs leading-relaxed text-slate-300">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>

          <p className="mt-10 text-xs text-slate-500">
            Connection status is monitored automatically. You&rsquo;ll be
            redirected as soon as the network comes back &mdash; no need to
            refresh.
          </p>
        </div>
      </main>
    </>
  );
}
