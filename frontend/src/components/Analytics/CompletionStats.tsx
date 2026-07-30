/**
 * Completion Statistics Component
 * Displays course completion statistics and achievements
 */

import React, { useState, useEffect } from 'react';
import { Trophy, Target, Clock, Award, TrendingUp, BookOpen } from 'lucide-react';
import { Skeleton, ErrorDisplay, EmptyState } from '../LoadingFallback';

interface CourseStats {
  courseId: string;
  title: string;
  completedLessons: number;
  totalLessons: number;
  completionPercentage: number;
  timeSpent: number;
  lastAccessed: string;
  status: 'not_started' | 'in_progress' | 'completed';
  certificateEarned?: boolean;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  earnedAt: string;
  category: 'milestone' | 'streak' | 'performance' | 'engagement';
}

interface CompletionStatsProps {
  userId: string;
  onDataLoaded?: (data: any) => void;
}

export const CompletionStats: React.FC<CompletionStatsProps> = ({ userId, onDataLoaded }) => {
  const [courseStats, setCourseStats] = useState<CourseStats[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    fetchCompletionData();
  }, [userId]);

  const fetchCompletionData = async () => {
    try {
      setLoading(true);
      const [coursesResponse, achievementsResponse] = await Promise.all([
        fetch(`/api/analytics/completion/${userId}`),
        fetch(`/api/analytics/achievements/${userId}`)
      ]);

      if (!coursesResponse.ok || !achievementsResponse.ok) {
        throw new Error('Failed to fetch completion data');
      }

      const coursesData = await coursesResponse.json();
      const achievementsData = await achievementsResponse.json();

      setCourseStats(coursesData);
      setAchievements(achievementsData);
      if (onDataLoaded) onDataLoaded({ completionStats: coursesData, achievements: achievementsData });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: CourseStats['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'in_progress': return 'text-blue-600 bg-blue-100';
      case 'not_started': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getCompletionColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    if (percentage >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const filteredAchievements = selectedCategory === 'all' 
    ? achievements 
    : achievements.filter(a => a.category === selectedCategory);

  const overallStats = {
    totalCourses: courseStats.length,
    completedCourses: courseStats.filter(c => c.status === 'completed').length,
    inProgressCourses: courseStats.filter(c => c.status === 'in_progress').length,
    totalTime: courseStats.reduce((sum, c) => sum + c.timeSpent, 0),
    averageCompletion: courseStats.length > 0 
      ? Math.round(courseStats.reduce((sum, c) => sum + c.completionPercentage, 0) / courseStats.length)
      : 0,
    certificatesEarned: courseStats.filter(c => c.certificateEarned).length
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <ErrorDisplay message={error} onRetry={fetchCompletionData} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Statistics */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-6">Overall Progress</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="text-center">
            <BookOpen className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-800">{overallStats.totalCourses}</p>
            <p className="text-sm text-gray-600">Total Courses</p>
          </div>
          <div className="text-center">
            <Trophy className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-800">{overallStats.completedCourses}</p>
            <p className="text-sm text-gray-600">Completed</p>
          </div>
          <div className="text-center">
            <Target className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-800">{overallStats.inProgressCourses}</p>
            <p className="text-sm text-gray-600">In Progress</p>
          </div>
          <div className="text-center">
            <Clock className="w-8 h-8 text-purple-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-800">{Math.round(overallStats.totalTime / 60)}h</p>
            <p className="text-sm text-gray-600">Total Time</p>
          </div>
          <div className="text-center">
            <TrendingUp className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-800">{overallStats.averageCompletion}%</p>
            <p className="text-sm text-gray-600">Avg Completion</p>
          </div>
          <div className="text-center">
            <Award className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-800">{overallStats.certificatesEarned}</p>
            <p className="text-sm text-gray-600">Certificates</p>
          </div>
        </div>
      </div>

      {/* Course Completion Details */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-6">Course Progress</h3>
        <div className="space-y-4">
          {courseStats.map((course) => (
            <div key={course.courseId} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800">{course.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {course.completedLessons} of {course.totalLessons} lessons completed
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(course.status)}`}>
                    {course.status.replace('_', ' ')}
                  </span>
                  {course.certificateEarned && (
                    <Award className="w-5 h-5 text-yellow-500" />
                  )}
                </div>
              </div>
              
              <div className="mb-3">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Progress</span>
                  <span>{course.completionPercentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${getCompletionColor(course.completionPercentage)}`}
                    style={{ width: `${course.completionPercentage}%` }}
                  ></div>
                </div>
              </div>

              <div className="flex justify-between text-sm text-gray-600">
                <span>Time spent: {Math.round(course.timeSpent / 60)}h {course.timeSpent % 60}m</span>
                <span>Last accessed: {new Date(course.lastAccessed).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Achievements */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-800">Achievements</h3>
          <div className="flex gap-2">
            {['all', 'milestone', 'streak', 'performance', 'engagement'].map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAchievements.map((achievement) => (
            <div key={achievement.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="text-2xl">{achievement.icon}</div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800">{achievement.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{achievement.description}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Earned: {new Date(achievement.earnedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredAchievements.length === 0 && (
          <EmptyState
            icon={<Trophy className="h-8 w-8" />}
            title="No achievements in this category yet"
            description="Keep learning to earn achievements."
          />
        )}
      </div>
    </div>
  );
};
