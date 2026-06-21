import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Clock, Calendar, Activity } from 'lucide-react';

interface TimeData {
  totalTime: number;
  avgSessionDuration: number;
  timeByCourse: { name: string; value: number }[];
  timeByDay: { day: string; minutes: number }[];
  mostActiveTime: string;
}

interface TimeAnalysisProps {
  userId: string;
  onDataLoaded?: (data: any) => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export const TimeAnalysis: React.FC<TimeAnalysisProps> = ({ userId, onDataLoaded }) => {
  const [data, setData] = useState<TimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTimeData();
  }, [userId]);

  const fetchTimeData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/analytics/time/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch time analysis');
      
      const timeData = await response.json();
      setData(timeData);
      if (onDataLoaded) onDataLoaded({ timeData });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-red-500 text-center">
          <p>Error loading time analysis: {error}</p>
          <button onClick={fetchTimeData} className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-6">Time Analysis</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-blue-50 p-4 rounded-lg flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-full text-blue-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Time</p>
            <p className="text-xl font-bold text-gray-800">{Math.round(data.totalTime / 60)}h {data.totalTime % 60}m</p>
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-full text-green-600">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Avg Session</p>
            <p className="text-xl font-bold text-gray-800">{data.avgSessionDuration} min</p>
          </div>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg flex items-center gap-4">
          <div className="p-3 bg-purple-100 rounded-full text-purple-600">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Most Active</p>
            <p className="text-xl font-bold text-gray-800">{data.mostActiveTime}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-4">Time Distribution by Course</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.timeByCourse}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.timeByCourse.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: unknown) => {
                  if (typeof value !== 'number') return String(value ?? '');
                  return `${Math.round(value / 60)}h ${value % 60}m`;
                }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-4">Activity by Day of Week</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.timeByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: unknown) => {
                  if (typeof value !== 'number') return String(value ?? '');
                  return `${value} min`;
                }} />
                <Bar dataKey="minutes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};