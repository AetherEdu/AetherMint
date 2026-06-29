/**
 * Progress Dashboard Component
 * Displays comprehensive enrollment progress and analytics
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BookOpen,
  Clock,
  Trophy,
  Target,
  TrendingUp,
  Calendar,
  Award,
  BarChart3,
  Download,
  Filter,
  Search,
  Loader2,
  Play,
  Pause,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { ExportButton } from '../Analytics/ExportButton';

interface Enrollment {
  id: string;
  courseId: string;
  status: string;
  enrolledAt: string;
  progress: number;
  lastAccessed: string;
  timeSpent: number;
  completedLessons: number;
  totalLessons: number;
  certificateIssued: boolean;
  course: {
    id: string;
    title: string;
    thumbnail: string;
    instructor: {
      name: string;
    };
    metadata: {
      duration: number;
      level: string;
    };
  };
}

interface ProgressStats {
  totalEnrollments: number;
  activeEnrollments: number;
  completedEnrollments: number;
  totalHours: number;
  averageProgress: number;
  certificatesEarned: number;
  currentStreak: number;
  longestStreak: number;
}

interface LearningActivity {
  date: string;
  hoursSpent: number;
  lessonsCompleted: number;
  coursesAccessed: string[];
}

interface ProgressDashboardProps {
  userId?: string;
  timeRange?: 'week' | 'month' | 'quarter' | 'year';
  className?: string;
}

export function ProgressDashboard({ 
  userId, 
  timeRange = 'month',
  className 
}: ProgressDashboardProps) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [activities, setActivities] = useState<LearningActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);
  const [activeTab, setActiveTab] = useState('enrollments');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchDashboardData();
  }, [selectedTimeRange, userId]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch enrollments
      const enrollmentsResponse = await fetch(`/api/enrollments?timeRange=${selectedTimeRange}`);
      const enrollmentsData = await enrollmentsResponse.json();
      if (enrollmentsData.success) {
        setEnrollments(enrollmentsData.data);
      }

      // Fetch stats
      const statsResponse = await fetch(`/api/enrollments/analytics/user?timeRange=${selectedTimeRange}`);
      const statsData = await statsResponse.json();
      if (statsData.success) {
        setStats(statsData.data);
      }

      // Fetch activities
      const activitiesResponse = await fetch(`/api/analytics/learning-activity?timeRange=${selectedTimeRange}`);
      const activitiesData = await activitiesResponse.json();
      if (activitiesData.success) {
        setActivities(activitiesData.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEnrollments = enrollments.filter(enrollment => {
    const matchesSearch = enrollment.course.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || enrollment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 60) return 'bg-blue-500';
    if (progress >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const formatHours = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} min`;
    }
    return `${hours.toFixed(1)}h`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Prepare enrollment data for export
  const enrollmentExportData = enrollments.map((e) => ({
    'Course Title': e.course.title,
    Instructor: e.course.instructor.name,
    Status: e.status,
    Progress: `${e.progress}%`,
    'Completed Lessons': e.completedLessons,
    'Total Lessons': e.totalLessons,
    'Time Spent (h)': e.timeSpent.toFixed(1),
    Level: e.course.metadata.level,
    Duration: `${e.course.metadata.duration}h`,
    Enrolled: formatDate(e.enrolledAt),
    'Last Accessed': formatDate(e.lastAccessed),
    Certificate: e.certificateIssued ? 'Yes' : 'No',
  }));

  // Prepare activity data for export
  const activityExportData = activities.map((a) => ({
    Date: a.date,
    'Hours Spent': a.hoursSpent.toFixed(1),
    'Lessons Completed': a.lessonsCompleted,
    'Courses Accessed': a.coursesAccessed.join('; '),
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin mr-3" />
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Courses</p>
                  <p className="text-2xl font-bold">{stats.activeEnrollments}</p>
                </div>
                <BookOpen className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{stats.completedEnrollments}</p>
                </div>
                <Trophy className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Learning Hours</p>
                  <p className="text-2xl font-bold">{formatHours(stats.totalHours)}</p>
                </div>
                <Clock className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Certificates</p>
                  <p className="text-2xl font-bold">{stats.certificatesEarned}</p>
                </div>
                <Award className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="enrollments">My Enrollments</TabsTrigger>
            <TabsTrigger value="progress">Progress Analytics</TabsTrigger>
            <TabsTrigger value="activity">Learning Activity</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <ExportButton
              data={activeTab === 'activity' ? activityExportData : enrollmentExportData}
              filename={activeTab === 'activity' ? 'learning-activity' : 'progress-enrollments'}
              variant="outline"
            />
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value as any)}
              className="px-3 py-1 border rounded-md text-sm"
            >
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="quarter">Last Quarter</option>
              <option value="year">Last Year</option>
            </select>
          </div>
        </div>

        {/* Enrollments Tab */}
        <TabsContent value="enrollments" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search courses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border rounded-md"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Enrollments Grid */}
          <div className="grid gap-4">
            {filteredEnrollments.map((enrollment) => (
              <Card key={enrollment.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <img
                      src={enrollment.course.thumbnail}
                      alt={enrollment.course.title}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">{enrollment.course.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            Instructor: {enrollment.course.instructor.name}
                          </p>
                        </div>
                        <Badge className={getStatusColor(enrollment.status)}>
                          {enrollment.status.charAt(0).toUpperCase() + enrollment.status.slice(1)}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Progress</span>
                          <span className="font-medium">{enrollment.progress}%</span>
                        </div>
                        <Progress 
                          value={enrollment.progress} 
                          className="h-2"
                          // @ts-ignore
                          indicatorClassName={getProgressColor(enrollment.progress)}
                        />
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Lessons:</span>
                          <p className="font-medium">
                            {enrollment.completedLessons}/{enrollment.totalLessons}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Time:</span>
                          <p className="font-medium">{formatHours(enrollment.timeSpent)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Level:</span>
                          <p className="font-medium capitalize">{enrollment.course.metadata.level}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Duration:</span>
                          <p className="font-medium">{enrollment.course.metadata.duration}h</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          Last accessed: {formatDate(enrollment.lastAccessed)}
                        </div>
                        <div className="flex gap-2">
                          {enrollment.status === 'active' && (
                            <Button size="sm" variant="outline">
                              <Play className="w-4 h-4 mr-1" />
                              Continue
                            </Button>
                          )}
                          {enrollment.certificateIssued && (
                            <Button size="sm" variant="outline">
                              <Download className="w-4 h-4 mr-1" />
                              Certificate
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredEnrollments.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No enrollments found</h3>
                  <p className="text-muted-foreground">
                    {searchTerm || statusFilter !== 'all' 
                      ? 'Try adjusting your filters or search terms'
                      : 'Start by enrolling in a course'
                    }
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Progress Analytics Tab */}
        <TabsContent value="progress" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Progress Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Progress Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {stats && (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Average Progress</span>
                        <span className="font-bold">{stats.averageProgress}%</span>
                      </div>
                      <Progress value={stats.averageProgress} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Current Streak</span>
                        <p className="font-bold text-lg">{stats.currentStreak} days</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Longest Streak</span>
                        <p className="font-bold text-lg">{stats.longestStreak} days</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Learning Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Learning Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {stats && (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Total Courses Enrolled</span>
                      <span className="font-medium">{stats.totalEnrollments}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Completion Rate</span>
                      <span className="font-medium">
                        {stats.totalEnrollments > 0 
                          ? Math.round((stats.completedEnrollments / stats.totalEnrollments) * 100)
                          : 0}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Learning Hours (Period)</span>
                      <span className="font-medium">{formatHours(stats.totalHours)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Certificates Earned</span>
                      <span className="font-medium">{stats.certificatesEarned}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Activity Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Learning Activity Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <BarChart3 className="w-8 h-8 mr-2" />
                Activity chart would be displayed here
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Learning Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Recent Learning Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activities.map((activity, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{formatDate(activity.date)}</p>
                      <p className="text-sm text-muted-foreground">
                        {activity.lessonsCompleted} lessons completed • {formatHours(activity.hoursSpent)} spent
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Courses</p>
                      <p className="font-medium">{activity.coursesAccessed.length}</p>
                    </div>
                  </div>
                ))}

                {activities.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-4" />
                    <p>No learning activity in the selected period</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
