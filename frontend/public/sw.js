/**
 * AetherMint Service Worker
 * -----------------------------------------------------------------------------
 * Owns the runtime caching layer for the AetherMint PWA.
 *
 * Strategies (in registration order — most-specific to most-generic):
 *   1. POST/PUT/PATCH/DELETE /api/*           → NetworkOnly + BackgroundSync
 *   2. GET /api/(courses|lessons|progress|analytics)/* → StaleWhileRevalidate
 *   3. GET /api/*                              → NetworkFirst (3 s timeout)
 *   4. Scripts/Styles/Images/Fonts/Manifest    → CacheFirst (30 d)
 *   5. /_next/static/*                         → CacheFirst (1 y, immutable)
 *   6. Navigations (HTML)                      → StaleWhileRevalidate (7 d)
 *   7. setCatchHandler → /offline shell for docs & prefetches,
 *                        503 JSON sentinel for `/_next/data/*`.
 *
 * Update flow:
 *   • `skipWaiting()` is NEVER invoked automatically. The page must post
 *     `{ type: 'SKIP_WAITING' }` to the waiting worker so in-flight requests
 *     are not torn down mid-flight.
 *   • `clients.claim()` runs unconditionally on activate so the first
 *     interaction after a refresh sees the new version.
 *
 * Workbox runtime is loaded from Google's CDN and pinned to v6.4.1 so the
 * code below compiles against a known API surface.
 */

importScripts(
  'https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js'
);

/** Current cache key suffix. Bumped to evict stale caches during activate. */
const SW_VERSION = 'v4';

const isLocalHost =
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1';

/**
 * Only register the routes & set up state management when Workbox actually
 * loaded. Older browsers / corporate proxies will leave `self.workbox`
 * undefined and we degrade to a passthrough service worker.
 */
if (self.workbox) {
  const { routing, strategies, backgroundSync, expiration, precaching } =
    self.workbox;

  // -------------------------------------------------------------------------
  // Dev / live toggle.
  // -------------------------------------------------------------------------
  // Skip *all* caching in dev so HMR stays snappy and stale chunks never
  // confuse the developer. Production builds log a single banner so we can
  // confirm the SW activated in DevTools → Application → Service Workers.
  if (isLocalHost) {
    // eslint-disable-next-line no-console
    console.info(
      '[AetherMint SW] local development detected — caching disabled.'
    );
  } else {
    /* eslint-disable no-console */
    console.info(`[AetherMint SW] AetherMint SW ${SW_VERSION} activating.`);
    /* eslint-enable no-console */

    // Opt-in verbose Workbox logging via querystring, useful for debugging.
    if (self.location.search.includes('workbox-debug')) {
      self.workbox.setConfig({ debug: true });
    }

    // -------------------------------------------------------------------------
    // Precache the offline fallback shell.
    // -------------------------------------------------------------------------
    // Must correspond to a real navigable route — see
    // `frontend/src/pages/_offline.tsx`. Revision is bumped with SW_VERSION so
    // a deploy automatically replaces the precached shell.
    precaching.precacheAndRoute([
      { url: '/offline', revision: SW_VERSION },
    ]);

    // -------------------------------------------------------------------------
    // Background-sync plugin for mutating requests.
    // -------------------------------------------------------------------------
    const bgSyncPlugin = new backgroundSync.BackgroundSyncPlugin(
      'aethermint-offline-queue',
      {
        // Workbox uses minutes here; 24h retries ensure mutating calls
        // (progress, enrollment, payments) eventually settle.
        maxRetentionTime: 24 * 60,
        onSync: async ({ queue }) => {
          try {
            await queue.replayRequests();
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              '[AetherMint SW] background-sync replay failed:',
              error
            );
          }
        },
      }
    );

    // -------------------------------------------------------------------------
    // 1. Mutating API requests → queue + replay.
    // -------------------------------------------------------------------------
    routing.registerRoute(
      ({ url, request }) =>
        url.pathname.startsWith('/api/') &&
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method),
      new strategies.NetworkOnly({ plugins: [bgSyncPlugin] }),
      'POST'
    );

    // -------------------------------------------------------------------------
    // 2. Read-only course/lesson/progress/analytics payload → SWR.
    // -------------------------------------------------------------------------
    // Registered BEFORE the broader /api GET handler so Workbox matches the
    // narrow pattern first. This is the entry that satisfies the acceptance
    // criterion: "Previously viewed courses available offline".
    const READ_ONLY_API_PATTERN = /^\/api\/(courses|lessons|progress|analytics)(\/|$|\?)/;

    routing.registerRoute(
      ({ url, request }) =>
        request.method === 'GET' && READ_ONLY_API_PATTERN.test(url.pathname),
      new strategies.StaleWhileRevalidate({
        cacheName: `aethermint-api-readonly-${SW_VERSION}`,
        plugins: [
          new expiration.ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 7 * 24 * 60 * 60,
            purgeOnQuotaError: true,
          }),
        ],
      })
    );

    // -------------------------------------------------------------------------
    // 3. All other GET /api/* → NetworkFirst with 3 s timeout.
    // -------------------------------------------------------------------------
    // User/profile/auth endpoints should stay as fresh as possible, but we
    // still degrade gracefully to cache so the app stays interactive offline.
    routing.registerRoute(
      ({ url, request }) =>
        url.pathname.startsWith('/api/') && request.method === 'GET',
      new strategies.NetworkFirst({
        cacheName: `aethermint-api-${SW_VERSION}`,
        networkTimeoutSeconds: 3,
        plugins: [
          new expiration.ExpirationPlugin({
            maxEntries: 60,
            maxAgeSeconds: 24 * 60 * 60,
            purgeOnQuotaError: true,
          }),
        ],
      })
    );

    // -------------------------------------------------------------------------
    // 4. Static assets (images, scripts, styles, fonts, manifest).
    // -------------------------------------------------------------------------
    routing.registerRoute(
      ({ request }) =>
        request.destination === 'image' ||
        request.destination === 'script' ||
        request.destination === 'style' ||
        request.destination === 'font' ||
        request.destination === 'manifest',
      new strategies.CacheFirst({
        cacheName: `aethermint-static-${SW_VERSION}`,
        plugins: [
          new expiration.ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 30 * 24 * 60 * 60,
            purgeOnQuotaError: true,
          }),
        ],
      })
    );

    // -------------------------------------------------------------------------
    // 5. Next.js static chunks — already fingerprinted, cache-first forever.
    // -------------------------------------------------------------------------
    routing.registerRoute(
      ({ url }) => url.pathname.startsWith('/_next/static/'),
      new strategies.CacheFirst({
        cacheName: `aethermint-next-static-${SW_VERSION}`,
        plugins: [
          new expiration.ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 365 * 24 * 60 * 60,
            purgeOnQuotaError: true,
          }),
        ],
      })
    );

    // -------------------------------------------------------------------------
    // 6. Navigations (top-level HTML).
    // -------------------------------------------------------------------------
    routing.registerRoute(
      ({ request }) => request.mode === 'navigate',
      new strategies.StaleWhileRevalidate({
        cacheName: `aethermint-pages-${SW_VERSION}`,
        plugins: [
          new expiration.ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 7 * 24 * 60 * 60,
            purgeOnQuotaError: true,
          }),
        ],
      })
    );

    // -------------------------------------------------------------------------
    // 7. Catch handler — final fallback when EVERYTHING above misses.
    // -------------------------------------------------------------------------
    const OFFLINE_FALLBACK_URL = '/offline';

    self.workbox.routing.setCatchHandler(async ({ event, request }) => {
      // Never cache or proxy cross-origin errors — just return a generic
      // network error so the browser handles it normally.
      if (!request.url.startsWith(self.location.origin)) {
        return Response.error();
      }

      const accept = request.headers.get('accept') || '';
      const { pathname } = new URL(request.url);

      // 7a. Document / navigation → precached /offline shell.
      if (
        event.request.destination === 'document' ||
        request.mode === 'navigate'
      ) {
        const cached = await caches.match(OFFLINE_FALLBACK_URL);
        if (cached) return cached;
        return Response.error();
      }

      // 7b. Next.js pages-router payload (`/_next/data/<buildId>/<page>.json`)
      //     or any explicit JSON accept header.
      //
      // Returning the HTML shell here would crash any caller that does
      // `await res.json()` — issue a 503 with a JSON body so data-fetching
      // helpers (React Query, SWR, fetchJson) short-circuit cleanly.
      if (
        pathname.startsWith('/_next/data/') ||
        accept.includes('application/json')
      ) {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return new Response(
          JSON.stringify({
            offline: true,
            message: 'Network unavailable',
          }),
          {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // 7c. HTML prefetch hints — keep layout intact with the shell.
      if (accept.includes('text/html')) {
        const cached = await caches.match(OFFLINE_FALLBACK_URL);
        if (cached) return cached;
      }

      // 7d. Image requests — fail soft; most icons are already precached.
      if (request.destination === 'image') {
        return new Response('', { status: 504 });
      }

      return Response.error();
    });
  }

  // ---------------------------------------------------------------------------
  // Activate hook — evict predecessor caches & claim clients.
  // ---------------------------------------------------------------------------
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      (async () => {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter(
              (name) =>
                name.startsWith('aethermint-') &&
                !name.endsWith(`-${SW_VERSION}`)
            )
            .map((name) => {
              // eslint-disable-next-line no-console
              console.info('[AetherMint SW] deleting outdated cache:', name);
              return caches.delete(name);
            })
        );

        if (self.clients && typeof self.clients.claim === 'function') {
          await self.clients.claim();
        }
      })()
    );
  });

  // ---------------------------------------------------------------------------
  // User-prompted update flow.
  // ---------------------------------------------------------------------------
  // IMPORTANT: this arrow function is fully closed so the sync / push /
  // notificationclick handlers below register at the worker scope, not at
  // the body of the message handler. Earlier versions were missing the
  // closing `});`, which meant subsequent listeners only registered when the
  // page posted the first SKIP_WAITING message — and the file overall
  // failed to parse as JavaScript. Fixed by [AetherMint PR: offline-#139].
  self.addEventListener('message', (event) => {
    if (event && event.data && event.data.type === 'SKIP_WAITING') {
      // eslint-disable-next-line no-console
      console.info('[AetherMint SW] SKIP_WAITING — activating new version.');
      self.skipWaiting();
    }
  });

  // -------------------------------------------------------------------------
  // IndexedDB-driven background sync trigger.
  // -------------------------------------------------------------------------
  self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-progress' || event.tag === 'background-sync') {
      // The Workbox BackgroundSyncPlugin transparently handles queued
      // network requests above. Hooks for custom IndexedDB replay can be
      // added here without breaking the plugin contract.
      // eslint-disable-next-line no-console
      console.info('[AetherMint SW] sync event fired:', event.tag);
    }
  });

  // -------------------------------------------------------------------------
  // Push notifications.
  // -------------------------------------------------------------------------
  self.addEventListener('push', (event) => {
    if (!event.data) return;

    let payload = {};
    try {
      payload = event.data.json();
    } catch {
      payload = { title: 'AetherMint', body: event.data.text() };
    }

    const options = {
      body: payload.body || 'You have a new notification from AetherMint',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: payload,
      vibrate: [200, 100, 200],
      actions: [
        { action: 'open', title: 'Open App' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    };

    event.waitUntil(
      self.registration.showNotification(
        payload.title || 'AetherMint',
        options
      )
    );
  });

  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'dismiss') return;
    event.waitUntil(
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) {
            if ('focus' in client) return client.focus();
          }
          if (self.clients.openWindow) return self.clients.openWindow('/');
          return null;
        })
    );
  });
} else {
  // eslint-disable-next-line no-console
  console.warn(
    '[AetherMint SW] Workbox failed to load — falling back to passthrough.'
  );
}
