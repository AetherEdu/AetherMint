'use client';

import React, { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface RootErrorBoundaryProps {
  children: ReactNode;
}

/**
 * A client component that wraps the application root with:
 * - ErrorBoundary at the top level to catch render errors
 * - Toaster for toast notifications
 *
 * This component is designed to be used in the App Router layout.tsx
 * which must remain a server component.
 */
export function RootErrorBoundary({ children }: RootErrorBoundaryProps) {
  return (
    <>
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 5000,
          style: {
            background: '#363636',
            color: '#fff',
            borderRadius: '0.5rem',
          },
          success: {
            style: {
              background: '#059669',
            },
            iconTheme: {
              primary: '#fff',
              secondary: '#059669',
            },
          },
          error: {
            style: {
              background: '#dc2626',
            },
            iconTheme: {
              primary: '#fff',
              secondary: '#dc2626',
            },
          },
        }}
      />
      <ErrorBoundary
        showErrorDetails={process.env.NODE_ENV === 'development'}
        onError={(error, _errorInfo) => {
          // Integration point for external error monitoring services (e.g., Sentry, Datadog)
          // The ErrorBoundary already logs to console and monitoring endpoints internally.
          // Example: Sentry.captureException(error, { extra: errorInfo });
        }}
      >
        {children}
      </ErrorBoundary>
    </>
  );
}
