import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import { performanceMonitor } from '@/lib/performance-monitor';
// Importing env triggers Zod validation at startup — throws with a clear message if vars are missing/invalid.
import '@/lib/env';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AetherMint Education - Decentralized Learning Platform',
  description: 'Learn blockchain development with courses powered by Stellar',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize performance monitoring
  if (typeof window !== 'undefined') {
    void performanceMonitor;
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg"
        >
          Skip to main content
        </a>
        <main id="main-content" role="main" tabIndex={-1}>
          {children}
        </main>
        <footer role="contentinfo" aria-label="Site footer" className="border-t border-gray-200 bg-white mt-auto">
          <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-600">
              <Link
                href="/accessibility"
                className="hover:text-gray-900 underline transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
              >
                Accessibility Statement
              </Link>
              <span aria-hidden="true">·</span>
              <a
                href="https://github.com/AetherEdu/AetherMint/issues/new"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-900 underline transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
              >
                Report Issue
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
