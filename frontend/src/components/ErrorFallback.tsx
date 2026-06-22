'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, WifiOff, Wallet, CreditCard } from 'lucide-react';

export type ErrorVariant = 'default' | 'network' | 'wallet' | 'payment';

interface ErrorFallbackProps {
  error?: Error;
  errorInfo?: React.ErrorInfo;
  onRetry?: () => void;
  variant?: ErrorVariant;
  title?: string;
  message?: string;
  /** If true, shows technical error details (useful in development) */
  showDetails?: boolean;
}

const variantConfig: Record<ErrorVariant, {
  icon: React.ReactNode;
  title: string;
  message: string;
  containerClass: string;
  iconClass: string;
  titleClass: string;
  messageClass: string;
  buttonClass: string;
}> = {
  default: {
    icon: <AlertTriangle className="h-6 w-6" />,
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
    containerClass: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    iconClass: 'text-red-600 dark:text-red-400',
    titleClass: 'text-red-900 dark:text-red-300',
    messageClass: 'text-red-600 dark:text-red-400',
    buttonClass: 'bg-red-600 hover:bg-red-700 text-white',
  },
  network: {
    icon: <WifiOff className="h-6 w-6" />,
    title: 'Network Error',
    message: 'Failed to connect to the network. Please check your internet connection and try again.',
    containerClass: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    iconClass: 'text-orange-600 dark:text-orange-400',
    titleClass: 'text-orange-900 dark:text-orange-300',
    messageClass: 'text-orange-600 dark:text-orange-400',
    buttonClass: 'bg-orange-600 hover:bg-orange-700 text-white',
  },
  wallet: {
    icon: <Wallet className="h-6 w-6" />,
    title: 'Wallet Error',
    message: 'There was a problem with your wallet connection. Please ensure your wallet is unlocked and try again.',
    containerClass: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    iconClass: 'text-yellow-600 dark:text-yellow-400',
    titleClass: 'text-yellow-900 dark:text-yellow-300',
    messageClass: 'text-yellow-600 dark:text-yellow-400',
    buttonClass: 'bg-yellow-600 hover:bg-yellow-700 text-white',
  },
  payment: {
    icon: <CreditCard className="h-6 w-6" />,
    title: 'Payment Error',
    message: 'There was a problem processing your payment. Please verify your balance and try again.',
    containerClass: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    iconClass: 'text-red-600 dark:text-red-400',
    titleClass: 'text-red-900 dark:text-red-300',
    messageClass: 'text-red-600 dark:text-red-400',
    buttonClass: 'bg-red-600 hover:bg-red-700 text-white',
  },
};

export function ErrorFallback({
  error,
  errorInfo,
  onRetry,
  variant = 'default',
  title: customTitle,
  message: customMessage,
  showDetails,
}: ErrorFallbackProps) {
  const config = variantConfig[variant];
  const title = customTitle ?? config.title;
  const message = customMessage ?? config.message;

  return (
    <div className="min-h-[200px] flex items-center justify-center" role="alert" aria-live="assertive">
      <div className={`border rounded-lg p-6 max-w-md w-full mx-4 ${config.containerClass}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={config.iconClass}>{config.icon}</div>
          <h3 className={`text-lg font-semibold ${config.titleClass}`}>{title}</h3>
        </div>

        <p className={`mb-4 ${config.messageClass}`}>{message}</p>

        {showDetails && process.env.NODE_ENV === 'development' && error && (
          <details className="mb-4">
            <summary className={`text-sm cursor-pointer ${config.titleClass}`}>
              Error Details
            </summary>
            <pre className={`mt-2 text-xs bg-black/5 dark:bg-white/10 p-2 rounded overflow-auto max-h-32 ${config.messageClass}`}>
              {error.toString()}
              {errorInfo?.componentStack && `\n\nComponent Stack:\n${errorInfo.componentStack}`}
            </pre>
          </details>
        )}

        {onRetry && (
          <button
            onClick={onRetry}
            className={`w-full px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium ${config.buttonClass}`}
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
