import React from 'react';
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
          <CardTitle>User Growth</CardTitle>
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
          <CardTitle>Course Enrollments</CardTitle>
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
          <CardTitle>Credential Issuances</CardTitle>
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
