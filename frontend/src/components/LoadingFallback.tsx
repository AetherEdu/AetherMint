'use client';

import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { ReactNode, useState } from 'react';

// ─── Spinner / Fallback ────────────────────────────────────────────────────────

interface LoadingFallbackProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingFallback({ message = 'Loading...', size = 'md', className = '' }: LoadingFallbackProps) {
  const sizeClasses = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };
  const textSizes = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' };
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      <Loader2 className={`animate-spin text-blue-600 ${sizeClasses[size]}`} />
      <span className={`text-gray-600 dark:text-gray-400 ${textSizes[size]}`}>{message}</span>
    </div>
  );
}

export function LoadingSpinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeClasses = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Loader2 className={`animate-spin text-blue-600 ${sizeClasses[size]}`} />
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded bg-gray-200 dark:bg-slate-700', className)} />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-3/4' : 'w-full')} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cn('rounded-xl border border-gray-200 dark:border-slate-700 p-4 space-y-3', className)}>
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonProfile({ className }: SkeletonProps) {
  return (
    <div className={cn('rounded-xl bg-gradient-to-r from-gray-200 to-gray-300 dark:from-slate-700 dark:to-slate-600 p-8', className)}>
      <div className="flex items-center gap-6">
        <Skeleton className="h-24 w-24 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
          <div className="flex gap-8 pt-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SkeletonList({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
          <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <Skeleton className="h-8 w-24 rounded-lg flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)}>
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ─── ErrorDisplay ─────────────────────────────────────────────────────────────

interface ErrorDisplayProps {
  title?: string;
  message: string;
  details?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorDisplay({ title = 'Something went wrong', message, details, onRetry, className }: ErrorDisplayProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className={cn('rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6', className)}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-red-900 dark:text-red-300 mb-1">{title}</h3>
          <p className="text-sm text-red-700 dark:text-red-400">{message}</p>

          {details && (
            <div className="mt-3">
              <button
                onClick={() => setShowDetails(v => !v)}
                className="text-xs text-red-600 dark:text-red-400 underline hover:no-underline"
              >
                {showDetails ? 'Hide details' : 'Show details'}
              </button>
              {showDetails && (
                <pre className="mt-2 text-xs text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 rounded p-2 overflow-auto whitespace-pre-wrap break-words">
                  {details}
                </pre>
              )}
            </div>
          )}

          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-4 flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
