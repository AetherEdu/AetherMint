'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/Skeleton';
import {
  Users,
  BookOpen,
  Trophy,
  TrendingUp,
  Activity,
  AlertCircle,
  DollarSign,
  Clock,
  Eye,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

interface DashboardStats {
  users: {
    total: number;
    students: number;
    educators: number;
    admins: number;
    newThisMonth: number;
    growth: number;
  };
  courses: {
    total: number;
    published: number;
    draft: number;
    newThisMonth: number;
    growth: number;
  };
  quizzes: {
    total: number;
    active: number;
    completed: number;
    averageScore: number;
  };
  system: {
    uptime: string;
    storage: string;
    lastBackup: string;
    activeConnections: number;
  };
}

interface RecentActivity {
  id: string;
  type: 'user' | 'course' | 'quiz' | 'system';
  title: string;
  description: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error';
}

export default function AdminDashboard() {
  const { user, hasPermission } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsResponse, activityResponse] = await Promise.all([
        fetch('/api/admin/dashboard'),
        fetch('/api/admin/activity')
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.stats);
      }

      if (activityResponse.ok) {
        const activityData = await activityResponse.json();
        setRecentActivity(activityData.activities || []);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user': return <Users className="w-4 h-4" />;
      case 'course': return <BookOpen className="w-4 h-4" />;
      case 'quiz': return <Trophy className="w-4 h-4" />;
      case 'system': return <Activity className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div
        className="space-y-6"
        role="status"
        aria-live="polite"
        aria-label="Loading dashboard"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} variant="card" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
            <Skeleton variant="text" className="w-1/3 mb-4" />
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} variant="list-item" />
              ))}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <Skeleton variant="text" className="w-1/2 mb-4" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} variant="list-item" />
              ))}
            </div>
          </div>
        </div>
        <span className="sr-only">Loading dashboard…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.name}</h1>
        <p className="text-blue-100">Here's what's happening on your platform today.</p>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Users Stats */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className={`flex items-center text-sm ${stats.users.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.users.growth >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                {Math.abs(stats.users.growth)}%
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-800">{stats.users.total.toLocaleString()}</h3>
            <p className="text-gray-600 text-sm">Total Users</p>
            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Students: {stats.users.students}</span>
                <span>Educators: {stats.users.educators}</span>
              </div>
              <div className="text-xs text-blue-600">
                {stats.users.newThisMonth} new this month
              </div>
            </div>
          </div>

          {/* Courses Stats */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <BookOpen className="w-6 h-6 text-green-600" />
              </div>
              <div className={`flex items-center text-sm ${stats.courses.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.courses.growth >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                {Math.abs(stats.courses.growth)}%
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-800">{stats.courses.total}</h3>
            <p className="text-gray-600 text-sm">Total Courses</p>
            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Published: {stats.courses.published}</span>
                <span>Draft: {stats.courses.draft}</span>
              </div>
              <div className="text-xs text-green-600">
                {stats.courses.newThisMonth} new this month
              </div>
            </div>
          </div>

          {/* Quizzes Stats */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Trophy className="w-6 h-6 text-purple-600" />
              </div>
              <div className="text-sm text-gray-600">
                <Eye className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-800">{stats.quizzes.total}</h3>
            <p className="text-gray-600 text-sm">Total Quizzes</p>
            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Active: {stats.quizzes.active}</span>
                <span>Completed: {stats.quizzes.completed}</span>
              </div>
              <div className="text-xs text-purple-600">
                Avg Score: {stats.quizzes.averageScore}%
              </div>
            </div>
          </div>

          {/* System Stats */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Activity className="w-6 h-6 text-orange-600" />
              </div>
              <div className="text-sm text-green-600">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-800">{stats.system.uptime}</h3>
            <p className="text-gray-600 text-sm">System Uptime</p>
            <div className="mt-4 space-y-1">
              <div className="text-xs text-gray-500">
                <div>Storage: {stats.system.storage}</div>
                <div>Active: {stats.system.activeConnections}</div>
              </div>
              <div className="text-xs text-orange-600">
                Backup: {new Date(stats.system.lastBackup).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {recentActivity.slice(0, 5).map((activity) => (
              <div key={activity.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg">
                <div className={`p-2 rounded-lg ${getStatusColor(activity.status)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800">{activity.title}</h4>
                  <p className="text-sm text-gray-600">{activity.description}</p>
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(activity.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            {hasPermission('user:create') && (
              <button className="w-full text-left px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors">
                <Users className="w-5 h-5 mb-2" />
                <div className="font-medium">Add New User</div>
                <div className="text-sm opacity-80">Create a new user account</div>
              </button>
            )}
            {hasPermission('course:create') && (
              <button className="w-full text-left px-4 py-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors">
                <BookOpen className="w-5 h-5 mb-2" />
                <div className="font-medium">Create Course</div>
                <div className="text-sm opacity-80">Add a new course</div>
              </button>
            )}
            {hasPermission('system:manage') && (
              <button className="w-full text-left px-4 py-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors">
                <Activity className="w-5 h-5 mb-2" />
                <div className="font-medium">System Backup</div>
                <div className="text-sm opacity-80">Create backup now</div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
