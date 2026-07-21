'use client';

import { useMemo } from 'react';
import { ProfileStats as ProfileStatsType } from '../types/profile';
import { 
  TrendingUp, 
  Clock, 
  Award, 
  Target, 
  BookOpen, 
  Users, 
  Calendar,
  Flame,
  Star,
  BarChart3,
  Zap,
  Trophy,
  GraduationCap
} from 'lucide-react';

interface ProfileStatsProps {
  stats: ProfileStatsType | null;
  showRanking?: boolean;
  showProgress?: boolean;
  compact?: boolean;
}

export function ProfileStats({ 
  stats, 
  showRanking = true, 
  showProgress = true,
  compact = false 
}: ProfileStatsProps) {
  // Calculate additional metrics
  const metrics = useMemo(() => {
    // Guard against null stats
    if (!stats) {
      return {
        completionRate: 0,
        verificationRate: 0,
        achievementRate: 0,
        dailyAverage: 0
      };
    }

    const completionRate = stats.totalCourses > 0 
      ? Math.round((stats.completedCourses / stats.totalCourses) * 100) 
      : 0;
    
    const verificationRate = (stats.verifiedCredentials + stats.pendingCredentials) > 0
      ? Math.round((stats.verifiedCredentials / (stats.verifiedCredentials + stats.pendingCredentials)) * 100)
      : 0;

    const achievementRate = stats.totalAchievements > 0
      ? Math.round((stats.rareAchievements / stats.totalAchievements) * 100)
      : 0;

    const dailyAverage = stats.totalStudyHours > 0 && stats.studyStreak > 0
      ? parseFloat((stats.totalStudyHours / stats.studyStreak).toFixed(1))
      : 0;

    return {
      completionRate,
      verificationRate,
      achievementRate,
      dailyAverage
    };
  }, [stats]);

  if (compact) {
    return (
      <div className="grid grid-cols-2 xs:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 sm:p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-blue-600 dark:text-blue-400">Courses</span>
          </div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            {stats?.completedCourses || 0}/{stats?.totalCourses || 0}
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm text-green-600 dark:text-green-400">Achievements</span>
          </div>
          <div className="text-2xl font-bold text-green-700 dark:text-green-300">
            {stats?.totalAchievements || 0}
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2 mb-1">
            <Flame className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span className="text-sm text-purple-600 dark:text-purple-400">Streak</span>
          </div>
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
            {stats?.studyStreak || 0}
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm text-amber-600 dark:text-amber-400">Hours</span>
          </div>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
            {stats?.totalStudyHours || 0}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Learning Progress */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/40 dark:to-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-600 rounded-lg">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
              {metrics.completionRate}% Complete
            </span>
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
              {stats?.completedCourses || 0}
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-400">
              of {stats?.totalCourses || 0} courses
            </div>
            {showProgress && (
              <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${metrics.completionRate}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Study Streak */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/40 dark:to-orange-900/20 rounded-lg p-6 border border-orange-200 dark:border-orange-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-600 rounded-lg">
              <Flame className="h-6 w-6 text-white" />
            </div>
            <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
              {metrics.dailyAverage}h/day
            </span>
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold text-orange-700 dark:text-orange-300">
              {stats?.studyStreak || 0}
            </div>
            <div className="text-sm text-orange-600 dark:text-orange-400">
              day streak
            </div>
            {showProgress && (
              <div className="flex gap-1">
                {Array.from({ length: Math.min(stats?.studyStreak || 0, 7) }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 h-2 bg-orange-600 rounded-full"
                  />
                ))}
                {Array.from({ length: Math.max(0, 7 - (stats?.studyStreak || 0)) }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 h-2 bg-orange-200 dark:bg-orange-800 rounded-full"
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Achievements */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/40 dark:to-purple-900/20 rounded-lg p-6 border border-purple-200 dark:border-purple-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-600 rounded-lg">
              <Trophy className="h-6 w-6 text-white" />
            </div>
            <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
              {metrics.achievementRate}% Rare
            </span>
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold text-purple-700 dark:text-purple-300">
              {stats?.totalAchievements || 0}
            </div>
            <div className="text-sm text-purple-600 dark:text-purple-400">
              {stats?.rareAchievements || 0} rare achievements
            </div>
            {showProgress && (
              <div className="w-full bg-purple-200 dark:bg-purple-800 rounded-full h-2">
                <div 
                  className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(metrics.achievementRate * 10, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Study Time */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/40 dark:to-green-900/20 rounded-lg p-6 border border-green-200 dark:border-green-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-600 rounded-lg">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              Total
            </span>
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold text-green-700 dark:text-green-300">
              {stats?.totalStudyHours || 0}
            </div>
            <div className="text-sm text-green-600 dark:text-green-400">
              hours studied
            </div>
            {showProgress && (
              <div className="text-xs text-green-600 dark:text-green-400">
                Avg: {stats?.averageCompletionTime || 0} days/course
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ranking & Performance */}
      {showRanking && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg p-6 border border-indigo-200 dark:border-indigo-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Ranking & Performance
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Global Rank */}
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <div className="p-3 bg-indigo-600 rounded-full">
                  <Users className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="text-3xl font-bold text-indigo-700 dark:text-indigo-300 mb-1">
                #{stats?.rank || 0}
              </div>
              <div className="text-sm text-indigo-600 dark:text-indigo-400">
                Global Rank
              </div>
              <div className="text-xs text-indigo-500 dark:text-indigo-500 mt-1">
                Top {100 - (stats?.percentile || 0)}%
              </div>
            </div>

            {/* Credentials */}
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <div className="p-3 bg-green-600 rounded-full">
                  <GraduationCap className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="text-3xl font-bold text-green-700 dark:text-green-300 mb-1">
                {stats?.totalCertificates || 0}
              </div>
              <div className="text-sm text-green-600 dark:text-green-400">
                Certificates
              </div>
              <div className="text-xs text-green-500 dark:text-green-500 mt-1">
                {metrics.verificationRate}% verified
              </div>
            </div>

            {/* Performance Score */}
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <div className="p-3 bg-purple-600 rounded-full">
                  <Zap className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="text-3xl font-bold text-purple-700 dark:text-purple-300 mb-1">
                {Math.round((metrics.completionRate + metrics.achievementRate + ((stats?.percentile || 0) / 10)) / 3)}
              </div>
              <div className="text-sm text-purple-600 dark:text-purple-400">
                Performance Score
              </div>
              <div className="text-xs text-purple-500 dark:text-purple-500 mt-1">
                Based on all metrics
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* In Progress */}
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Target className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.inProgressCourses || 0}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                In Progress
              </div>
            </div>
          </div>
        </div>

        {/* Verified Credentials */}
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Star className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.verifiedCredentials || 0}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Verified Credentials
              </div>
            </div>
          </div>
        </div>

        {/* Pending Verification */}
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.pendingCredentials || 0}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Pending Verification
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      {showProgress && (
        <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            Progress Overview
          </h3>
          
          <div className="space-y-4">
            {/* Course Completion */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Course Completion</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {metrics.completionRate}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${metrics.completionRate}%` }}
                />
              </div>
            </div>

            {/* Achievement Progress */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Rare Achievement Rate</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {metrics.achievementRate}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-purple-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${metrics.achievementRate * 10}%` }}
                />
              </div>
            </div>

            {/* Credential Verification */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Credential Verification</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {metrics.verificationRate}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${metrics.verificationRate}%` }}
                />
              </div>
            </div>

            {/* Global Percentile */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Global Percentile</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {stats?.percentile || 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${stats?.percentile || 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
