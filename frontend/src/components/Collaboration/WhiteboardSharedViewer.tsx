'use client';

/**
 * WhiteboardSharedViewer
 *
 * Read-only renderer for a session fetched via the share token endpoint.
 * Lives behind the route `frontend/src/pages/whiteboard/shared.tsx` (or
 * `app/whiteboard/shared/page.tsx` for the App Router). The viewer doesn't
 * accept any user input — it just paints the persisted ops.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { whiteboardClient } from '../../services/whiteboardClient';
import type { WhiteboardSession } from '../../types/whiteboardSession';
import { drawOps } from '../../utils/whiteboardExport';

export function WhiteboardSharedViewer({ token }: { token: string }) {
  const { t } = useTranslation(['common', 'whiteboard']);
  const [session, setSession] = useState<WhiteboardSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    whiteboardClient
      .getByShareToken(token)
      .then((loaded) => {
        if (!cancelled) setSession(loaded);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('whiteboard.shared.expired', 'This share link is invalid or has been revoked.'));
      });
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  useEffect(() => {
    if (!session) return;
    const canvas = document.getElementById('shared-whiteboard-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    canvas.width = session.width;
    canvas.height = session.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawOps(ctx, session.ops);
  }, [session]);

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          {t('whiteboard.shared.title', 'Shared board (read-only)')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-gray-500 dark:text-gray-400">
        {t('whiteboard.shared.loading', 'Loading shared board…')}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {session.title}
        </h1>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {t('whiteboard.shared.title', 'Shared board (read-only)')}
        </span>
      </header>
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white p-2">
        <canvas
          id="shared-whiteboard-canvas"
          aria-label={t('whiteboard.canvasAria', 'Collaborative whiteboard canvas')}
          className="w-full h-auto"
        />
      </div>
    </div>
  );
}

export default WhiteboardSharedViewer;
