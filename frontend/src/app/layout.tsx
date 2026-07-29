import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
// Importing env triggers Zod validation at startup — throws with a clear message if vars are missing/invalid.
import '@/lib/env';
import { RootErrorBoundary } from '@/components/providers/RootErrorBoundary';
// Side-effect import: constructing the performance-monitor singleton registers
// the Web-Vitals observers. The constructor no-ops during SSR, so importing it
// here (a Server Component) is safe.
import '@/lib/performance-monitor';
import PWAClientShell from '@/components/PWA/PWAClientShell';
import MobileNavShell from '@/components/Mobile/MobileNavShell';
import { PageTransition } from '@/components/PageTransition';
import KeyboardShortcutsProvider from '@/components/providers/KeyboardShortcutsProvider';

const inter = Inter({ subsets: ['latin'] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://aethermint.edu';
const metadataBase = new URL(siteUrl);

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: 'AetherMint Education - Decentralized Learning Platform',
    template: '%s | AetherMint Education',
  },
  description:
    'Explore blockchain, AI, and web3 education with immersive courses, credentials, and a decentralized learning platform.',
  keywords: ['AetherMint', 'blockchain education', 'web3 courses', 'decentralized learning', 'Stellar'],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'AetherMint Education',
    description:
      'Discover expert-led courses and verifiable credentials for the next generation of blockchain builders.',
    url: siteUrl,
    siteName: 'AetherMint Education',
    images: [{ url: `${siteUrl}/og-image.svg`, width: 1200, height: 630, alt: 'AetherMint Education' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AetherMint Education',
    description:
      'Discover expert-led courses and verifiable credentials for the next generation of blockchain builders.',
    images: [`${siteUrl}/og-image.svg`],
  },
  robots: {
    index: true,
    follow: true,
  },
};

// `themeColor` lives under `viewport` in Next.js 14 to avoid the
// "deprecated top-level themeColor" warning. Keeping the manifest URL
// off of `metadata` because it is already wired by `next.config.js`
// (the SW precache references `/manifest.json` directly).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3b82f6',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <a
          href="#main-content"
          className="skip-to-content"
        >
          Skip to main content
        </a>
        {/* PWA wiring (service worker, offline banner, toaster) — all
            client-only so SSR never accesses `navigator`/`localStorage`. */}
        <PWAClientShell />
        {/* Mobile navigation (hamburger + bottom bar). The component hides
            itself on md+ via its own `md:hidden` classes; the client shell
            supplies the current path + navigate callback from next/navigation. */}
        <MobileNavShell />
        {/* Global keyboard shortcuts listener + ? key help dialog */}
        <KeyboardShortcutsProvider />
        {/* Reserve space on mobile so the fixed hamburger (top) and bottom
            nav bar don't overlap page content; removed at md+ where the
            mobile nav is hidden. */}
        <main id="main-content" role="main" tabIndex={-1} className="pt-16 pb-20 md:pt-0 md:pb-0">
          <RootErrorBoundary>
            {children}
          </RootErrorBoundary>
        </main>
      </body>
    </html>
  );
}
