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

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AetherMint Education - Decentralized Learning Platform',
  description: 'Learn blockchain development with courses powered by Stellar',
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
        {/* Reserve space on mobile so the fixed hamburger (top) and bottom
            nav bar don't overlap page content; removed at md+ where the
            mobile nav is hidden. */}
        <main id="main-content" role="main" tabIndex={-1} className="pt-16 pb-20 md:pt-0 md:pb-0">
          <RootErrorBoundary>
            <PageTransition>
              {children}
            </PageTransition>
          </RootErrorBoundary>
        </main>
      </body>
    </html>
  );
}
