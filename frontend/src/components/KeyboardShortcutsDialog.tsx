'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Keyboard, X } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { getAllShortcuts, type KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';

function formatKey(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.alt) parts.push('Alt');
  if (shortcut.meta) parts.push('Cmd');

  let keyLabel = shortcut.key;
  if (keyLabel === ' ') keyLabel = 'Space';
  else if (keyLabel === 'Escape') keyLabel = 'Esc';
  else if (keyLabel === '?') keyLabel = '?';
  else if (keyLabel.length === 1) keyLabel = keyLabel.toUpperCase();

  if (shortcut.shift && keyLabel !== '?') parts.push('Shift');

  parts.push(keyLabel);
  return parts.join(' + ');
}

export function KeyboardShortcutsDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>([]);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleOpen = useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    setShortcuts(getAllShortcuts());
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    previousFocusRef.current?.focus();
  }, []);

  useEffect(() => {
    const onShowHelp = () => handleOpen();
    const onClose = () => {
      if (isOpen) handleClose();
    };

    window.addEventListener('keyboard-shortcut:show-help', onShowHelp);
    window.addEventListener('keyboard-shortcut:close', onClose);

    return () => {
      window.removeEventListener('keyboard-shortcut:show-help', onShowHelp);
      window.removeEventListener('keyboard-shortcut:close', onClose);
    };
  }, [handleOpen, handleClose, isOpen]);

  const focusTrapRef = useFocusTrap(isOpen, {
    onEscape: handleClose,
    initialFocusSelector: '[data-shortcuts-close]',
  });

  if (!isOpen) return null;

  const grouped = shortcuts.reduce<Record<string, KeyboardShortcut[]>>((acc, s) => {
    (acc[s.category] = acc[s.category] || []).push(s);
    return acc;
  }, {});

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
      ref={focusTrapRef}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Keyboard size={20} className="text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            data-shortcuts-close
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close keyboard shortcuts"
          >
            <X size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {Object.entries(grouped).map(([category, categoryShortcuts]) => (
            <div key={category} className="mb-4 last:mb-0">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                {category}
              </h3>
              <ul className="space-y-1" role="list">
                {categoryShortcuts.map((shortcut, i) => (
                  <li
                    key={`${category}-${i}`}
                    className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {shortcut.description}
                    </span>
                    <kbd className="inline-flex items-center gap-0.5 px-2 py-0.5 text-xs font-mono font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">
                      {formatKey(shortcut)}
                    </kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-gray-200 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">?</kbd> to toggle this dialog
          </p>
        </div>
      </div>
    </div>
  );
}

export default KeyboardShortcutsDialog;
