/**
 * Custom `_document.tsx`
 * -------------------------------------------------------------------------
 * Supplies the document-level `<meta>` tags and assets the Lighthouse PWA
 * audit expects to find at the HTML root, rather than per-page:
 *
 *   • theme-color                — paints the address bar on mobile.
 *   • apple-touch-icon           — home-screen icon on iOS.
 *   • manifest link              — installable PWA bootstrap.
 *   • apple-mobile-web-app-*     — full-screen / status-bar styling on iOS.
 *   • format-detection           — disable phone-number auto-linking.
 *
 * Keep this file minimal — anything dynamic belongs in `_app.tsx` or in
 * per-page `<Head>` exports.
 */

import { Html, Head, Main, NextScript } from 'next/document';

const THEME_COLOR = '#3b82f6';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="theme-color" content={THEME_COLOR} />
        <meta name="application-name" content="AetherMint" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="default"
        />
        <meta name="apple-mobile-web-app-title" content="AetherMint" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
