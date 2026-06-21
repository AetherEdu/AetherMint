/**
 * Progress Chart Component
 * Displays learning progress with interactive charts
 */

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface ProgressData {
  date: string;
  completedLessons: number;
  totalTime: number;
  quizScores: number;
  streak: number;
}

interface ProgressChartProps {
  userId: string;
  courseId?: string;
  timeRange: 'week' | 'month' | 'quarter' | 'year';
  onTimeRangeChange: (range: 'week' | 'month' | 'quarter' | 'year') => void;
  onDataLoaded?: (data: any) => void;
}

export const ProgressChart: React.FC<ProgressChartProps> = ({
  userId,
  courseId,
  timeRange,
  onTimeRangeChange,
  onDataLoaded
}) => {
  const [data, setData] = useState<ProgressData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProgressData();
  }, [userId, courseId, timeRange]);

  const fetchProgressData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/analytics/progress/${userId}?courseId=${courseId || ''}&range=${timeRange}`);
      if (!response.ok) throw new Error('Failed to fetch progress data');
      
      const progressData = await response.json();
      setData(progressData);
      if (onDataLoaded) onDataLoaded({ progressData });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Recharts 3.x changed the Formatter signature from
  // `  (value: unknown, name?: string) => string` to
  // `(value: ValueType, name: NameType, ...) => ReactNode | undefined`,
  // so the formatter must accept whatever ReactNode-shaped value the
  // payload hands us and reduce it to a string.
  const formatTooltipValue = (value: unknown, name?: string): string => {
    if (typeof value === 'number') {
      if (name === 'totalTime') return `${value} min`;
      if (name === 'progress' || name === 'completionRate')
        return `${value.toFixed(1)}%`;
      return value.toString();
    }
    if (value === undefined || value === null) return '';
    return String(value);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-red-500 text-center">
          <p>Error loading progress data: {error}</p>
          <button 
            onClick={fetchProgressData}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-800">Learning Progress</h3>
        <div className="flex gap-2">
          {(['week', 'month', 'quarter', 'year'] as const).map((range) => (
            <button
              key={range}
              onClick={() => onTimeRangeChange(range)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lessons Completed Chart */}
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-3">Lessons Completed</h4>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={formatTooltipValue}
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <Area 
                type="monotone" 
                dataKey="completedLessons" 
                stroke="#3b82f6" 
                fill="#93bbfc" 
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Quiz Scores Chart */}
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-3">Quiz Scores</h4>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                domain={[0, 100]}
              />
              <Tooltip 
                formatter={formatTooltipValue}
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <Line 
                type="monotone" 
                dataKey="quizScores" 
                stroke="#10b981" 
                strokeWidth={2}
                dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Study Time Chart */}
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-3">Study Time (minutes)</h4>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={formatTooltipValue}
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <Area 
                type="monotone" 
                dataKey="totalTime" 
                stroke="#f59e0b" 
                fill="#fcd34d" 
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Learning Streak Chart */}
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-3">Learning Streak</h4>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={formatTooltipValue}
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <Line 
                type="monotone" 
                dataKey="streak" 
                stroke="#ef4444" 
                strokeWidth={2}
                dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">
              {data.reduce((sum, d) => sum + d.completedLessons, 0)}
            </p>
            <p className="text-sm text-gray-600">Total Lessons</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {data.length > 0 ? Math.round(data.reduce((sum, d) => sum + d.quizScores, 0) / data.length) : 0}%
            </p>
            <p className="text-sm text-gray-600">Avg Score</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600">
              {Math.round(data.reduce((sum, d) => sum + d.totalTime, 0) / 60)}h
            </p>
            <p className="text-sm text-gray-600">Total Time</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">
              {Math.max(...data.map(d => d.streak), 0)}
            </p>
            <p className="text-sm text-gray-600">Best Streak</p>
          </div>
        </div>
      </div>
    </div>
  );
};
