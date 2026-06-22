'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorFallback, ErrorVariant } from './ErrorFallback';

interface Props {
  children: ReactNode;
  /** Custom fallback UI. If not provided, uses ErrorFallback component. */
  fallback?: ReactNode;
  /** Variant of the error fallback UI */
  variant?: ErrorVariant;
  /** Custom error title */
  errorTitle?: string;
  /** Custom error message */
  errorMessage?: string;
  /** Callback invoked when an error is caught. Useful for error monitoring services. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** When this key changes, the boundary resets. Useful for external retry triggers. */
  resetKey?: number | string;
  /** Whether to show error details in the fallback (development only) */
  showErrorDetails?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

/**
 * Logs an error to the console and optionally to a monitoring service.
 * Extend this function to integrate with Sentry, Datadog, etc.
 */
function logError(error: Error, errorInfo: ErrorInfo) {
  // Console logging (always)
  console.error('[ErrorBoundary] Uncaught error:', {
    error: error.toString(),
    componentStack: errorInfo.componentStack,
    timestamp: new Date().toISOString(),
  });

  // Structured error logging for monitoring services
  const errorPayload = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo.componentStack,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };

  // Attempt to send to a monitoring endpoint (fire-and-forget)
  if (process.env.NEXT_PUBLIC_ERROR_MONITORING_ENDPOINT) {
    try {
      fetch(process.env.NEXT_PUBLIC_ERROR_MONITORING_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorPayload),
        // Use keepalive so the request completes even if the page navigates away
        keepalive: true,
      }).catch(() => {
        // Silently ignore monitoring failures
      });
    } catch {
      // Ignore monitoring send failures
    }
  }
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Invoke the external onError callback (e.g., for Sentry)
    this.props.onError?.(error, errorInfo);

    // Log to console and monitoring service
    logError(error, errorInfo);

    this.setState({ error, errorInfo });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  public componentDidUpdate(prevProps: Props) {
    // Reset the boundary when resetKey changes
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.handleRetry();
    }
  }

  public render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
          variant={this.props.variant ?? 'default'}
          title={this.props.errorTitle}
          message={this.props.errorMessage}
          showDetails={this.props.showErrorDetails}
        />
      );
    }

    return this.props.children;
  }
}
