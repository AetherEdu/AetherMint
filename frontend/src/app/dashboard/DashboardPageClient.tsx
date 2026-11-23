'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { LearnerDashboard, LearnerDashboardData } from '@/components/dashboard/LearnerDashboard';
import { Skeleton } from '@/components/Skeleton';

function DashboardSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-8">
      <span className="sr-only">Loading your dashboard...</span>

      <div className="space-y-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-16" />
            <Skeleton className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-6 h-56 w-full" />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <Skeleton className="h-32 w-full" />
              <Skeleton className="mt-4 h-5 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/2" />
              <Skeleton className="mt-4 h-9 w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function dashboardUrl(): string {
  const configuredBase = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL;
  if (!configuredBase) return '/api/dashboard';
  return `${configuredBase.replace(/\/$/, '')}/api/dashboard`;
}

export default function DashboardPageClient() {
  const [data, setData] = useState<LearnerDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = window.localStorage.getItem('admin_token') || window.localStorage.getItem('token');
      const response = await fetch(dashboardUrl(), {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      });

      if (response.status === 401) {
        throw new Error('Sign in to view your learning dashboard.');
      }
      if (!response.ok) {
        throw new Error('We could not load your dashboard right now.');
      }

      const payload = await response.json();
      if (!payload.success || !payload.data) {
        throw new Error('The dashboard response was invalid.');
      }
      setData(payload.data as LearnerDashboardData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'We could not load your dashboard right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {loading && <DashboardSkeleton />}

        {!loading && error && (
          <div className="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/30" role="alert">
            <AlertTriangle className="mb-3 h-7 w-7 text-red-600" aria-hidden="true" />
            <h1 className="text-lg font-semibold text-red-900 dark:text-red-200">Dashboard unavailable</h1>
            <p className="mt-2 text-sm text-red-800 dark:text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="mt-5 min-h-11 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && data && <LearnerDashboard data={data} />}
      </div>
    </main>
  );
}
