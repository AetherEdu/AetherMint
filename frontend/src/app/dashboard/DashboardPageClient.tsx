'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { LearnerDashboard, LearnerDashboardData } from '@/components/dashboard/LearnerDashboard';

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
        {loading && (
          <div className="flex min-h-[20rem] items-center justify-center" role="status" aria-live="polite">
            <Loader2 className="mr-3 h-7 w-7 animate-spin text-blue-600" aria-hidden="true" />
            <span className="text-slate-700 dark:text-slate-300">Loading your dashboard...</span>
          </div>
        )}

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
