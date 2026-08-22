/**
 * Export Button Component
 *
 * Reusable export button with format selector dropdown (CSV / JSON).
 * Uses the generic data export utility from `@/utils/dataExport`.
 */

'use client';

import React, { useState } from 'react';
import { Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { exportData, ExportFormat } from '@/utils/dataExport';

interface ExportButtonProps {
  /** The data to export (array of records) */
  data: Record<string, unknown>[];
  /** Descriptive base name for the export file (e.g., "credentials", "analytics") */
  filename: string;
  /** Optional custom column order */
  columns?: string[];
  /** Optional human-readable column labels */
  columnLabels?: Record<string, string>;
  /** Callback invoked after a successful export */
  onExport?: (format: ExportFormat) => void;
  /** Additional CSS classes */
  className?: string;
  /** Button variant */
  variant?: 'primary' | 'outline' | 'ghost';
}

const variantStyles: Record<string, string> = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-700 border border-blue-600',
  outline:
    'bg-white text-blue-600 hover:bg-blue-50 border border-blue-300 dark:bg-slate-800 dark:text-blue-400 dark:border-slate-600 dark:hover:bg-slate-700',
  ghost:
    'bg-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700',
};

export function ExportButton({
  data,
  filename,
  columns,
  columnLabels,
  onExport,
  className = '',
  variant = 'primary',
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleExport = (format: ExportFormat) => {
    setIsOpen(false);

    if (data.length === 0) {
      return;
    }

    exportData({ data, format, filename, columns, columnLabels });
    onExport?.(format);
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${variantStyles[variant]}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Download className="w-4 h-4" />
        Export
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close on outside click */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 z-50 py-1">
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-green-600" />
              <div className="text-left">
                <div className="font-medium">Export CSV</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Opens in Excel / Sheets
                </div>
              </div>
            </button>

            <button
              onClick={() => handleExport('json')}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              <FileJson className="w-4 h-4 text-orange-600" />
              <div className="text-left">
                <div className="font-medium">Export JSON</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Pretty-printed JSON
                </div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
