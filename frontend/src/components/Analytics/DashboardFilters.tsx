import React from 'react';
import { Calendar, Filter, Download } from 'lucide-react';

export type TimeRange = 'daily' | 'weekly' | 'monthly' | 'custom';

interface DashboardFiltersProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  startDate?: string;
  endDate?: string;
  onDateChange: (start: string, end: string) => void;
  onExport: (format: 'csv' | 'pdf') => void;
  isExporting?: boolean;
}

export const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  timeRange,
  onTimeRangeChange,
  startDate,
  endDate,
  onDateChange,
  onExport,
  isExporting
}) => {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={timeRange}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onTimeRangeChange(e.target.value as TimeRange)}
            className="bg-transparent text-sm font-medium focus:outline-none"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {timeRange === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onDateChange(e.target.value, endDate || '')}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onDateChange(startDate || '', e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 w-full md:w-auto">
        <button
          onClick={() => onExport('csv')}
          disabled={isExporting}
          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          CSV
        </button>
        <button
          onClick={() => onExport('pdf')}
          disabled={isExporting}
          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          PDF
        </button>
      </div>
    </div>
  );
};
