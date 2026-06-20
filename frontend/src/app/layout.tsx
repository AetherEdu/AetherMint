import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
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
      </body>
    </html>
  );
}
