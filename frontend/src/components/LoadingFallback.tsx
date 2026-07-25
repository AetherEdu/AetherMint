'use client';

import { Loader2 } from 'lucide-react';

interface LoadingFallbackProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingFallback({ 
  message = 'Loading...', 
  size = 'md',
  className = '' 
}: LoadingFallbackProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  return (
    <div
      className={`flex items-center justify-center gap-2 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <Loader2 className={`animate-spin text-blue-600 ${sizeClasses[size]}`} aria-hidden="true" />
      <span className={`text-gray-600 dark:text-gray-400 ${textSizes[size]}`}>
        {message}
      </span>
      <span className="sr-only">{message}</span>
    </div>
  );
}

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  return (
    <div
      className={`flex items-center justify-center ${className}`}
      role="status"
      aria-label="Loading"
    >
      <Loader2 className={`animate-spin text-blue-600 ${sizeClasses[size]}`} aria-hidden="true" />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
