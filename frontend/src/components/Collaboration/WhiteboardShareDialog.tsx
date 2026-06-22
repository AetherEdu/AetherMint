'use client';

/**
 * WhiteboardShareDialog
 *
 * Renders a small modal with a generated read-only share URL for a session.
 * The URL is minted by the backend (`POST /api/collaboration/whiteboard/sessions/:id/share`)
 * and resolves to the read-only viewer page on the frontend.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clipboard, Link as LinkIcon } from 'lucide-react';

interface WhiteboardShareDialogProps {
  open: boolean;
  shareUrl: string | null;
  busy: boolean;
  onClose: () => void;
  onMint: () => void;
  onRevoke: () => void;
}

export function WhiteboardShareDialog({
  open,
  shareUrl,
  busy,
  onClose,
  onMint,
  onRevoke,
}: WhiteboardShareDialogProps) {
  const { t } = useTranslation(['common', 'whiteboard']);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  if (!open) return null;

  const onCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail in insecure contexts. Fall through silently.
      setCopied(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('whiteboard.shareDialogTitle', 'Share board')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-2">
          <LinkIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('whiteboard.shareDialogTitle', 'Share board')}
          </h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t(
            'whiteboard.shareDialogCopy',
            'Anyone with this link can view this board. The link is read-only — viewers cannot edit or download state.'
          )}
        </p>

        {shareUrl ? (
          <>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                aria-label={t('whiteboard.shareUrlAria', 'Share URL')}
              />
              <button
                type="button"
                onClick={onCopy}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors"
              >
                <Clipboard className="w-4 h-4" />
                {copied ? t('whiteboard.copied', 'Copied!') : t('actions.copy', 'Copy')}
              </button>
            </div>
            <button
              type="button"
              onClick={onRevoke}
              disabled={busy}
              className="text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
            >
              {t('whiteboard.revokeShare', 'Revoke link')}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onMint}
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {busy ? t('status.saving', 'Saving...') : t('whiteboard.generateShare', 'Generate read-only link')}
          </button>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-md text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {t('actions.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WhiteboardShareDialog;
