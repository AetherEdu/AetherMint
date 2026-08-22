import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download } from 'lucide-react';
import { exportData, ExportFormat } from '@/utils/dataExport';

interface ChartData {
  date: string;
  value: number;
}

interface DashboardChartsProps {
  userGrowthData: ChartData[];
  enrollmentData: ChartData[];
  credentialData: ChartData[];
  loading?: boolean;
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  userGrowthData,
  enrollmentData,
  credentialData,
  loading
}) => {
  const [exportMenu, setExportMenu] = useState<string | null>(null);

  const handleChartExport = (chartName: string, chartData: ChartData[], format: ExportFormat) => {
    setExportMenu(null);
    if (chartData.length === 0) return;
    exportData({
      data: chartData.map((d) => ({ Date: d.date, Value: d.value })),
      format,
      filename: chartName.toLowerCase().replace(/\s+/g, '-'),
    });
  };

  const renderExportMenu = (chartName: string, chartData: ChartData[]) => (
    <div className="relative">
      <button
        onClick={() => setExportMenu(exportMenu === chartName ? null : chartName)}
        className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 transition-colors"
        aria-label={`Export ${chartName} data`}
      >
        <Download className="w-4 h-4" />
      </button>
      {exportMenu === chartName && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setExportMenu(null)} />
          <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 z-50 py-1">
            <button
              onClick={() => handleChartExport(chartName, chartData, 'csv')}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              Export CSV
            </button>
            <button
              onClick={() => handleChartExport(chartName, chartData, 'json')}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              Export JSON
            </button>
          </div>
        </>
      )}
    </div>
  );
  const renderTableFallback = (data: ChartData[], title: string) => (
    <div className="sr-only">
      <h4>{title} Data Table</h4>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item: ChartData, i: number) => (
            <tr key={i}>
              <td>{item.date}</td>
              <td>{item.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader><div className="h-6 bg-gray-200 rounded w-1/3"></div></CardHeader>
            <CardContent><div className="h-64 bg-gray-200 rounded"></div></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* User Growth Chart */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>User Growth</CardTitle>
            {renderExportMenu('User Growth', userGrowthData)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={userGrowthData}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  name="Total Users"
                  stroke="#3b82f6" 
                  fillOpacity={1} 
                  fill="url(#colorUsers)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {renderTableFallback(userGrowthData, "User Growth")}
        </CardContent>
      </Card>

      {/* Course Enrollments Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Course Enrollments</CardTitle>
            {renderExportMenu('Course Enrollments', enrollmentData)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={enrollmentData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" name="Enrollments" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {renderTableFallback(enrollmentData, "Course Enrollments")}
        </CardContent>
      </Card>

      {/* Credential Issuances Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Credential Issuances</CardTitle>
            {renderExportMenu('Credential Issuances', credentialData)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={credentialData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  name="Credentials"
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {renderTableFallback(credentialData, "Credential Issuances")}
        </CardContent>
      </Card>
    </div>
  );
};
