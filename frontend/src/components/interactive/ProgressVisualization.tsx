import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';

export interface ProgressVisualizationProps {
  userId: string;
  courseId?: string;
  progressData: ProgressData;
  achievements: Achievement[];
  onMilestoneReached?: (milestone: Milestone) => void;
  showCelebrations?: boolean;
  accessibilityMode?: boolean;
}

export interface ProgressData {
  overallProgress: number;
  courseProgress?: CourseProgress[];
  weeklyProgress: WeeklyProgress[];
  skillsProgress: SkillProgress[];
  timeSpent: TimeSpentData;
  streakData: StreakData;
}

export interface CourseProgress {
  courseId: string;
  courseName: string;
  progress: number;
  completedLessons: number;
  totalLessons: number;
  estimatedTimeRemaining: number;
  lastAccessed: Date;
}

export interface WeeklyProgress {
  week: string;
  hoursSpent: number;
  lessonsCompleted: number;
  quizzesPassed: number;
  pointsEarned: number;
}

export interface SkillProgress {
  skillName: string;
  category: string;
  currentLevel: number;
  maxLevel: number;
  experiencePoints: number;
  nextLevelXP: number;
  progressPercentage: number;
}

export interface TimeSpentData {
  totalTime: number;
  todayTime: number;
  weekTime: number;
  monthTime: number;
  averageSession: number;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date;
  streakHistory: { date: Date; active: boolean }[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt: Date;
  progress: number;
  maxProgress: number;
  pointsAwarded: number;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  type: 'course_completion' | 'skill_level' | 'time_spent' | 'streak' | 'points';
  threshold: number;
  currentValue: number;
  reward: {
    points: number;
    badge?: string;
    celebration?: string;
  };
}

const ProgressVisualization: React.FC<ProgressVisualizationProps> = ({
  userId,
  courseId,
  progressData,
  achievements,
  onMilestoneReached,
  showCelebrations = true,
  accessibilityMode = false
}) => {
  const [showCelebration, setShowCelebration] = useState(false);
  const [currentCelebration, setCurrentCelebration] = useState<Milestone | null>(null);
  const [selectedView, setSelectedView] = useState<'overview' | 'courses' | 'skills' | 'time' | 'achievements'>('overview');
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const controls = useAnimation();

  // Animate progress on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(progressData.overallProgress);
    }, 100);
    return () => clearTimeout(timer);
  }, [progressData.overallProgress]);

  // Check for milestones
  useEffect(() => {
    const milestones = checkMilestones();
    if (milestones.length > 0 && showCelebrations) {
      const latestMilestone = milestones[milestones.length - 1];
      setCurrentCelebration(latestMilestone);
      setShowCelebration(true);
      onMilestoneReached?.(latestMilestone);
      
      // Auto-hide celebration after 5 seconds
      setTimeout(() => {
        setShowCelebration(false);
      }, 5000);
    }
  }, [progressData, showCelebrations, onMilestoneReached]);

  const checkMilestones = useCallback((): Milestone[] => {
    const milestones: Milestone[] = [];

    // Overall progress milestones
    if (progressData.overallProgress >= 25 && progressData.overallProgress < 26) {
      milestones.push({
        id: 'progress_25',
        title: 'Quarter Master',
        description: 'Reached 25% overall progress!',
        type: 'course_completion',
        threshold: 25,
        currentValue: progressData.overallProgress,
        reward: { points: 100, badge: 'quarter_progress' }
      });
    }

    if (progressData.overallProgress >= 50 && progressData.overallProgress < 51) {
      milestones.push({
        id: 'progress_50',
        title: 'Half Way There!',
        description: 'Reached 50% overall progress!',
        type: 'course_completion',
        threshold: 50,
        currentValue: progressData.overallProgress,
        reward: { points: 250, badge: 'half_progress', celebration: 'confetti' }
      });
    }

    if (progressData.overallProgress >= 75 && progressData.overallProgress < 76) {
      milestones.push({
        id: 'progress_75',
        title: 'Almost There!',
        description: 'Reached 75% overall progress!',
        type: 'course_completion',
        threshold: 75,
        currentValue: progressData.overallProgress,
        reward: { points: 500, badge: 'three_quarter_progress' }
      });
    }

    if (progressData.overallProgress >= 100) {
      milestones.push({
        id: 'progress_100',
        title: 'Graduate!',
        description: 'Completed all courses! Congratulations!',
        type: 'course_completion',
        threshold: 100,
        currentValue: progressData.overallProgress,
        reward: { points: 1000, badge: 'graduate', celebration: 'fireworks' }
      });
    }

    // Streak milestones
    if (progressData.streakData.currentStreak === 7) {
      milestones.push({
        id: 'streak_7',
        title: 'Week Warrior',
        description: 'Maintained a 7-day learning streak!',
        type: 'streak',
        threshold: 7,
        currentValue: progressData.streakData.currentStreak,
        reward: { points: 200, badge: 'week_streak' }
      });
    }

    if (progressData.streakData.currentStreak === 30) {
      milestones.push({
        id: 'streak_30',
        title: 'Month Master',
        description: 'Maintained a 30-day learning streak!',
        type: 'streak',
        threshold: 30,
        currentValue: progressData.streakData.currentStreak,
        reward: { points: 1000, badge: 'month_streak', celebration: 'confetti' }
      });
    }

    // Time spent milestones
    if (progressData.timeSpent.totalTime >= 3600 && progressData.timeSpent.totalTime < 3660) { // 1 hour
      milestones.push({
        id: 'time_1h',
        title: 'Time Invested',
        description: 'Spent 1 hour learning!',
        type: 'time_spent',
        threshold: 3600,
        currentValue: progressData.timeSpent.totalTime,
        reward: { points: 50 }
      });
    }

    if (progressData.timeSpent.totalTime >= 36000 && progressData.timeSpent.totalTime < 36060) { // 10 hours
      milestones.push({
        id: 'time_10h',
        title: 'Dedicated Learner',
        description: 'Spent 10 hours learning!',
        type: 'time_spent',
        threshold: 36000,
        currentValue: progressData.timeSpent.totalTime,
        reward: { points: 500, badge: 'time_10h' }
      });
    }

    return milestones;
  }, [progressData]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getProgressColor = (progress: number): string => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 60) return 'bg-blue-500';
    if (progress >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const renderCelebration = () => {
    if (!currentCelebration) return null;

    return (
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -50 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-4 text-center">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ repeat: 3, duration: 0.5 }}
                className="text-6xl mb-4"
              >
                🎉
              </motion.div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">
                {currentCelebration.title}
              </h2>
              <p className="text-lg text-gray-600 mb-4">
                {currentCelebration.description}
              </p>
              <div className="flex items-center justify-center gap-4">
                <div className="text-2xl font-bold text-blue-600">
                  +{currentCelebration.reward.points} points
                </div>
                {currentCelebration.reward.badge && (
                  <div className="text-2xl">🏆</div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Overall Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white"
      >
        <h3 className="text-xl font-bold mb-4">Overall Progress</h3>
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-3xl font-bold">{Math.round(animatedProgress)}%</span>
            <span className="text-lg opacity-80">Complete</span>
          </div>
          <div className="w-full bg-white bg-opacity-20 rounded-full h-4">
            <motion.div
              className="bg-white h-4 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${animatedProgress}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{progressData.courseProgress?.length || 0}</p>
            <p className="text-sm opacity-80">Courses</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{formatTime(progressData.timeSpent.totalTime)}</p>
            <p className="text-sm opacity-80">Time Spent</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{progressData.streakData.currentStreak}</p>
            <p className="text-sm opacity-80">Day Streak</p>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg border border-gray-200 p-6"
        >
          <h4 className="font-semibold text-gray-800 mb-2">Today's Progress</h4>
          <p className="text-2xl font-bold text-blue-600">{formatTime(progressData.timeSpent.todayTime)}</p>
          <p className="text-sm text-gray-600">Time spent today</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-lg border border-gray-200 p-6"
        >
          <h4 className="font-semibold text-gray-800 mb-2">This Week</h4>
          <p className="text-2xl font-bold text-green-600">{formatTime(progressData.timeSpent.weekTime)}</p>
          <p className="text-sm text-gray-600">Time this week</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-lg border border-gray-200 p-6"
        >
          <h4 className="font-semibold text-gray-800 mb-2">Current Streak</h4>
          <p className="text-2xl font-bold text-orange-600">{progressData.streakData.currentStreak} days</p>
          <p className="text-sm text-gray-600">Keep it going!</p>
        </motion.div>
      </div>

      {/* Recent Achievements */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-lg border border-gray-200 p-6"
      >
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Achievements</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {achievements.slice(0, 4).map((achievement, index) => (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + index * 0.1 }}
              className="text-center p-4 bg-gray-50 rounded-lg"
            >
              <div className="text-3xl mb-2">{achievement.icon}</div>
              <h4 className="font-medium text-gray-800 text-sm">{achievement.title}</h4>
              <span className={`text-xs font-medium ${
                achievement.rarity === 'legendary' ? 'text-yellow-600' :
                achievement.rarity === 'epic' ? 'text-purple-600' :
                achievement.rarity === 'rare' ? 'text-blue-600' :
                'text-gray-600'
              }`}>
                {achievement.rarity.toUpperCase()}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );

  const renderCourses = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Course Progress</h3>
      {progressData.courseProgress?.map((course, index) => (
        <motion.div
          key={course.courseId}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className="bg-white rounded-lg border border-gray-200 p-6"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <h4 className="font-semibold text-gray-800">{course.courseName}</h4>
              <p className="text-sm text-gray-600">
                {course.completedLessons} of {course.totalLessons} lessons completed
              </p>
            </div>
            <span className="text-2xl font-bold text-blue-600">{Math.round(course.progress)}%</span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <motion.div
              className={`h-3 rounded-full ${getProgressColor(course.progress)}`}
              initial={{ width: 0 }}
              animate={{ width: `${course.progress}%` }}
              transition={{ duration: 1, delay: index * 0.1 }}
            />
          </div>
          
          <div className="flex justify-between text-sm text-gray-600">
            <span>Est. time remaining: {formatTime(course.estimatedTimeRemaining)}</span>
            <span>Last accessed: {course.lastAccessed.toLocaleDateString()}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );

  const renderSkills = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Skills Development</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {progressData.skillsProgress.map((skill, index) => (
          <motion.div
            key={skill.skillName}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-lg border border-gray-200 p-6"
          >
            <div className="flex justify-between items-center mb-4">
              <div>
                <h4 className="font-semibold text-gray-800">{skill.skillName}</h4>
                <p className="text-sm text-gray-600">{skill.category}</p>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-purple-600">Level {skill.currentLevel}</span>
                <p className="text-xs text-gray-600">of {skill.maxLevel}</p>
              </div>
            </div>
            
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>XP: {skill.experiencePoints}/{skill.nextLevelXP}</span>
                <span>{Math.round(skill.progressPercentage)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <motion.div
                  className="bg-purple-500 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${skill.progressPercentage}%` }}
                  transition={{ duration: 1, delay: index * 0.1 }}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  const renderTimeAnalysis = () => (
    <div className="space-y-6">
      {/* Time Statistics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg border border-gray-200 p-6"
      >
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Time Analysis</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{formatTime(progressData.timeSpent.totalTime)}</p>
            <p className="text-sm text-gray-600">Total Time</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{formatTime(progressData.timeSpent.todayTime)}</p>
            <p className="text-sm text-gray-600">Today</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">{formatTime(progressData.timeSpent.weekTime)}</p>
            <p className="text-sm text-gray-600">This Week</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-600">{formatTime(progressData.timeSpent.monthTime)}</p>
            <p className="text-sm text-gray-600">This Month</p>
          </div>
        </div>
      </motion.div>

      {/* Weekly Progress Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-lg border border-gray-200 p-6"
      >
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Weekly Activity</h3>
        <div className="space-y-3">
          {progressData.weeklyProgress.map((week, index) => (
            <div key={week.week} className="flex items-center justify-between">
              <span className="text-sm text-gray-600 w-20">{week.week}</span>
              <div className="flex-1 mx-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <motion.div
                    className="bg-blue-500 h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((week.hoursSpent / 20) * 100, 100)}%` }}
                    transition={{ duration: 1, delay: index * 0.1 }}
                  />
                </div>
              </div>
              <span className="text-sm text-gray-600 w-16 text-right">{week.hoursSpent}h</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );

  const renderAchievements = () => (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg border border-gray-200 p-6"
      >
        <h3 className="text-lg font-semibold text-gray-800 mb-4">All Achievements</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {achievements.map((achievement, index) => (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className={`p-4 rounded-lg border-2 text-center ${
                achievement.rarity === 'legendary' ? 'bg-yellow-50 border-yellow-300' :
                achievement.rarity === 'epic' ? 'bg-purple-50 border-purple-300' :
                achievement.rarity === 'rare' ? 'bg-blue-50 border-blue-300' :
                'bg-gray-50 border-gray-300'
              }`}
            >
              <div className="text-3xl mb-2">{achievement.icon}</div>
              <h4 className="font-semibold text-gray-800 text-sm">{achievement.title}</h4>
              <p className="text-xs text-gray-600 mt-1">{achievement.description}</p>
              <div className="mt-2">
                <span className={`text-xs font-medium ${
                  achievement.rarity === 'legendary' ? 'text-yellow-600' :
                  achievement.rarity === 'epic' ? 'text-purple-600' :
                  achievement.rarity === 'rare' ? 'text-blue-600' :
                  'text-gray-600'
                }`}>
                  {achievement.rarity.toUpperCase()}
                </span>
              </div>
              {achievement.progress < achievement.maxProgress && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-1">
                    <div
                      className="bg-blue-500 h-1 rounded-full"
                      style={{ width: `${(achievement.progress / achievement.maxProgress) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {achievement.progress}/{achievement.maxProgress}
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto">
      {/* Celebration Overlay */}
      {renderCelebration()}

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Progress & Achievements</h2>
        <p className="text-gray-600">Track your learning journey and celebrate your accomplishments</p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'courses', label: 'Courses' },
            { id: 'skills', label: 'Skills' },
            { id: 'time', label: 'Time Analysis' },
            { id: 'achievements', label: 'Achievements' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedView(tab.id as any)}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                selectedView === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div>
        {selectedView === 'overview' && renderOverview()}
        {selectedView === 'courses' && renderCourses()}
        {selectedView === 'skills' && renderSkills()}
        {selectedView === 'time' && renderTimeAnalysis()}
        {selectedView === 'achievements' && renderAchievements()}
      </div>
    </div>
  );
};

export default ProgressVisualization;
