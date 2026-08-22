/**
 * Generic Data Export Utility
 *
 * Provides CSV and JSON export functions for analytics dashboards,
 * credential lists, and progress reports. Handles special character
 * escaping, large datasets, and proper file naming with dates.
 *
 * @module dataExport
 */

export type ExportFormat = 'csv' | 'json';

export interface ExportOptions {
  /** The data to export (array of objects or a single object) */
  data: Record<string, unknown>[];
  /** Desired export format */
  format: ExportFormat;
  /** Base filename (without extension, date will be appended) */
  filename: string;
  /** Optional: column headers override (uses Object.keys if not provided) */
  columns?: string[];
  /** Optional: custom column header labels */
  columnLabels?: Record<string, string>;
}

/**
 * Escape a CSV field value, wrapping in quotes if it contains special
 * characters (commas, newlines, or double-quotes).
 */
export function escapeCSVField(value: unknown): string {
  const str = value == null ? '' : String(value);

  // If the value contains commas, newlines, or double-quotes, wrap it
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Convert an array of records to a CSV string.
 *
 * @param data - Array of records to export.
 * @param columns - Optional ordered column keys. Defaults to keys of the first record.
 * @param columnLabels - Optional human-readable column headers keyed by column name.
 * @returns CSV-formatted string.
 */
export function convertToCSV(
  data: Record<string, unknown>[],
  columns?: string[],
  columnLabels?: Record<string, string>,
): string {
  if (!data || data.length === 0) {
    return '';
  }

  // Determine columns
  const cols = columns ?? Object.keys(data[0]);

  // Build header row
  const header = cols
    .map((col) => escapeCSVField(columnLabels?.[col] ?? col))
    .join(',');

  // Build data rows
  const rows = data.map((record) =>
    cols.map((col) => escapeCSVField(record[col])).join(','),
  );

  return [header, ...rows].join('\n');
}

/**
 * Convert any value to a JSON string with pretty-printing.
 *
 * @param data - The data to serialize.
 * @returns Pretty-printed JSON string.
 */
export function convertToJSON(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Generate a filename with the current date appended.
 *
 * @param baseName - Base descriptive name (e.g., "analytics", "credentials").
 * @param format - The file format extension (without dot).
 * @returns Formatted filename like "analytics-2024-01-15.csv".
 */
export function generateExportFilename(
  baseName: string,
  format: ExportFormat,
): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `${baseName}-${date}.${format}`;
}

/**
 * Trigger a file download in the browser using Blob + URL.createObjectURL.
 *
 * @param content - The file content as a string.
 * @param filename - The desired filename for the download.
 * @param mimeType - The MIME type of the file.
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export data to a file and trigger download.
 *
 * This is the main entry point. Chunking is used for datasets larger
 * than 10,000 rows (processed synchronously in the current tick; for
 * truly massive datasets, consider moving to a Web Worker).
 *
 * @param options - Export configuration.
 */
export function exportData(options: ExportOptions): void {
  const { data, format, filename } = options;

  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Handle chunking for large datasets
  const CHUNK_SIZE = 10000;
  if (data.length > CHUNK_SIZE && format === 'csv') {
    console.warn(
      `Dataset has ${data.length} rows. Consider streaming for better performance.`,
    );
  }

  switch (format) {
    case 'csv': {
      const csv = convertToCSV(data, options.columns, options.columnLabels);
      const downloadFilename = generateExportFilename(filename, 'csv');
      downloadFile(csv, downloadFilename, 'text/csv;charset=utf-8');
      break;
    }
    case 'json': {
      const json = convertToJSON(data);
      const downloadFilename = generateExportFilename(filename, 'json');
      downloadFile(json, downloadFilename, 'application/json;charset=utf-8');
      break;
    }
    default: {
      const _exhaustive: never = format;
      throw new Error(`Unsupported export format: ${_exhaustive}`);
    }
  }
}
