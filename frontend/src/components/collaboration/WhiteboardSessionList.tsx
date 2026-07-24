'use client';

/**
 * WhiteboardSessionList
 *
 * Lists the caller's persisted whiteboard sessions with thumbnail + op count
 * and a "Load" / "Delete" action. This is the surface that closes the
 * load-session DoD item.
 */

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, FolderOpen, Plus, ImageIcon } from 'lucide-react';
import { whiteboardClient } from '../../services/whiteboardClient';
import type { WhiteboardSessionSummary } from '../../types/whiteboardSession';
import { formatRelativeTime } from '../../lib/i18nFormat';

interface WhiteboardSessionListProps {
  onLoad: (sessionId: string) => void;
  onCreate: () => void;
}

export function WhiteboardSessionList({ onLoad, onCreate }: WhiteboardSessionListProps) {
  const { t, i18n } = useTranslation(['common', 'whiteboard']);
  const [sessions, setSessions] = useState<WhiteboardSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await whiteboardClient.list();
      setSessions(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('whiteboard.listError', 'Failed to load sessions'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm(t('whiteboard.confirmDelete', 'Delete this saved board? This cannot be undone.'))) {
        return;
      }
      setBusyId(id);
      try {
        await whiteboardClient.delete(id);
        setSessions((current) => current.filter((s) => s.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : t('whiteboard.deleteError', 'Failed to delete session'));
      } finally {
        setBusyId(null);
      }
    },
    [t]
  );

  return (
    <div className="flex flex-col gap-4" role="region" aria-label={t('whiteboard.sessionListAria', 'Saved boards')}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('whiteboard.savedBoardsTitle', 'Saved boards')}
        </h2>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('whiteboard.newBoard', 'New board')}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="px-3 py-2 rounded-md bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200 text-sm"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {t('status.loading', 'Loading...')}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {t('whiteboard.emptyState', 'No saved boards yet. Draw on the canvas and click Save to keep one.')}
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800"
            >
              <div className="aspect-video bg-gray-100 dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                {session.thumbnail ? (
                  // The thumbnail is a data: URL generated client-side. We
                  // strip any non-image prefix that could be longer than the
                  // URL; the server stores it verbatim.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.thumbnail}
                    alt={session.title}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <ImageIcon
                    className="w-10 h-10 text-gray-300 dark:text-gray-600"
                    aria-label={t('whiteboard.noThumbnail', 'No preview available')}
                  />
                )}
              </div>
              <div className="p-3 flex flex-col gap-2">
                <p className="font-medium text-sm text-gray-900 dark:text-white truncate" title={session.title}>
                  {session.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {session.opCount} {t('whiteboard.opsLabel', 'ops')} ·{' '}
                  {formatRelativeTime(session.updatedAt, { lng: i18n.language })}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onLoad(session.id)}
                    disabled={busyId === session.id}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 text-sm hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors disabled:opacity-50"
                  >
                    <FolderOpen className="w-4 h-4" />
                    {t('actions.open', 'Open')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(session.id)}
                    disabled={busyId === session.id}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200 text-sm hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors disabled:opacity-50"
                    aria-label={t('whiteboard.deleteAria', 'Delete saved board')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default WhiteboardSessionList;
