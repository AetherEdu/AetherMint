import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface GamificationProps {
  userId: string;
  courseId?: string;
  showPoints?: boolean;
  showBadges?: boolean;
  showLeaderboard?: boolean;
  showStreaks?: boolean;
  onAchievementUnlock?: (achievement: Achievement) => void;
  accessibilityMode?: boolean;
}

export interface Points {
  total: number;
  weekly: number;
  monthly: number;
  coursePoints?: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  category: string;
  unlockedAt?: Date;
  progress?: number;
  maxProgress?: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  points: number;
  badge: Badge;
  unlockedAt: Date;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatar?: string;
  points: number;
  rank: number;
  change: number;
}

export interface LearningStreak {
  current: number;
  longest: number;
  lastActivityDate: Date;
  nextMilestone: number;
}

const GamificationEngine: React.FC<GamificationProps> = ({
  userId,
  courseId,
  showPoints = true,
  showBadges = true,
  showLeaderboard = true,
  showStreaks = true,
  onAchievementUnlock,
  accessibilityMode = false
}) => {
  const [points, setPoints] = useState<Points>({
    total: 0,
    weekly: 0,
    monthly: 0,
    coursePoints: 0
  });
  
  const [badges, setBadges] = useState<Badge[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [streak, setStreak] = useState<LearningStreak>({
    current: 0,
    longest: 0,
    lastActivityDate: new Date(),
    nextMilestone: 7
  });
  
  const [showAchievementPopup, setShowAchievementPopup] = useState(false);
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);
  const [activeTab, setActiveTab] = useState<'points' | 'badges' | 'leaderboard' | 'streaks'>('points');
  const [loading, setLoading] = useState(true);

  // Mock data - in real app, this would come from API
  useEffect(() => {
    const mockData = {
      points: {
        total: 2450,
        weekly: 320,
        monthly: 1200,
        coursePoints: 450
      },
      badges: [
        {
          id: 'first_lesson',
          name: 'First Steps',
          description: 'Complete your first lesson',
          icon: '🎯',
          rarity: 'common' as const,
          category: 'Progress',
          unlockedAt: new Date('2024-01-15'),
          progress: 1,
          maxProgress: 1
        },
        {
          id: 'week_streak',
          name: 'Week Warrior',
          description: 'Maintain a 7-day learning streak',
          icon: '🔥',
          rarity: 'rare' as const,
          category: 'Streak',
          unlockedAt: new Date('2024-01-22'),
          progress: 7,
          maxProgress: 7
        },
        {
          id: 'quiz_master',
          name: 'Quiz Master',
          description: 'Score 100% on 10 quizzes',
          icon: '🧠',
          rarity: 'epic' as const,
          category: 'Academic',
          progress: 8,
          maxProgress: 10
        },
        {
          id: 'helper',
          name: 'Community Helper',
          description: 'Help 20 fellow students',
          icon: '🤝',
          rarity: 'legendary' as const,
          category: 'Community',
          progress: 15,
          maxProgress: 20
        }
      ],
      leaderboard: [
        { userId: '1', username: 'AlexChampion', points: 3200, rank: 1, change: 0 },
        { userId: '2', username: 'SarahLearns', points: 2850, rank: 2, change: 1 },
        { userId: '3', username: 'MikeStudy', points: 2650, rank: 3, change: -1 },
        { userId: userId, username: 'You', points: 2450, rank: 4, change: 2 },
        { userId: '5', username: 'EmmaBooks', points: 2300, rank: 5, change: 0 }
      ],
      streak: {
        current: 12,
        longest: 23,
        lastActivityDate: new Date(),
        nextMilestone: 30
      }
    };

    setPoints(mockData.points);
    setBadges(mockData.badges);
    setLeaderboard(mockData.leaderboard);
    setStreak(mockData.streak);
    setLoading(false);
  }, [userId]);

  const awardPoints = useCallback((amount: number, reason: string) => {
    setPoints(prev => ({
      ...prev,
      total: prev.total + amount,
      weekly: prev.weekly + amount,
      monthly: prev.monthly + amount,
      coursePoints: prev.coursePoints ? prev.coursePoints + amount : amount
    }));

    // Check for point-based achievements
    checkPointAchievements(points.total + amount);
  }, [points.total]);

  const checkPointAchievements = useCallback((newTotal: number) => {
    if (newTotal >= 100 && newTotal - 100 < 100) {
      unlockAchievement({
        id: 'centurion',
        title: 'Centurion',
        description: 'Earn 100 points',
        points: 50,
        badge: {
          id: 'centurion_badge',
          name: 'Centurion',
          description: 'Earned 100 points',
          icon: '💯',
          rarity: 'common',
          category: 'Points'
        },
        unlockedAt: new Date()
      });
    }

    if (newTotal >= 1000 && newTotal - 1000 < 1000) {
      unlockAchievement({
        id: 'point_master',
        title: 'Point Master',
        description: 'Earn 1000 points',
        points: 100,
        badge: {
          id: 'point_master_badge',
          name: 'Point Master',
          description: 'Earned 1000 points',
          icon: '⭐',
          rarity: 'rare',
          category: 'Points'
        },
        unlockedAt: new Date()
      });
    }
  }, []);

  const unlockAchievement = useCallback((achievement: Achievement) => {
    setAchievements(prev => [...prev, achievement]);
    setNewAchievement(achievement);
    setShowAchievementPopup(true);
    onAchievementUnlock?.(achievement);

    // Auto-hide popup after 5 seconds
    setTimeout(() => {
      setShowAchievementPopup(false);
    }, 5000);
  }, [onAchievementUnlock]);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'bg-gray-100 border-gray-300';
      case 'rare': return 'bg-blue-100 border-blue-300';
      case 'epic': return 'bg-purple-100 border-purple-300';
      case 'legendary': return 'bg-yellow-100 border-yellow-300';
      default: return 'bg-gray-100 border-gray-300';
    }
  };

  const getRarityTextColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'text-gray-600';
      case 'rare': return 'text-blue-600';
      case 'epic': return 'text-purple-600';
      case 'legendary': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const formatPoints = (points: number) => {
    return new Intl.NumberFormat().format(points);
  };

  const getStreakEmoji = (days: number) => {
    if (days >= 30) return '🔥🔥🔥';
    if (days >= 14) return '🔥🔥';
    if (days >= 7) return '🔥';
    return '⭐';
  };

  const renderPointsTab = () => (
    <div className="space-y-6">
      {/* Total Points Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white"
      >
        <h3 className="text-xl font-bold mb-4">Total Points</h3>
        <div className="text-4xl font-bold mb-4">{formatPoints(points.total)}</div>
        
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm opacity-80">This Week</p>
            <p className="text-lg font-semibold">{formatPoints(points.weekly)}</p>
          </div>
          <div>
            <p className="text-sm opacity-80">This Month</p>
            <p className="text-lg font-semibold">{formatPoints(points.monthly)}</p>
          </div>
          <div>
            <p className="text-sm opacity-80">Course</p>
            <p className="text-lg font-semibold">{formatPoints(points.coursePoints || 0)}</p>
          </div>
        </div>
      </motion.div>

      {/* Point History */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-800">Completed Lesson: Introduction</p>
              <p className="text-sm text-gray-600">2 hours ago</p>
            </div>
            <span className="text-green-600 font-semibold">+50</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-800">Quiz Score: 95%</p>
              <p className="text-sm text-gray-600">Yesterday</p>
            </div>
            <span className="text-blue-600 font-semibold">+75</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-800">Helped Community Member</p>
              <p className="text-sm text-gray-600">2 days ago</p>
            </div>
            <span className="text-purple-600 font-semibold">+25</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBadgesTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Your Badges</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {badges.map((badge, index) => (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-lg border-2 text-center ${getRarityColor(badge.rarity)}`}
            >
              <div className="text-3xl mb-2">{badge.icon}</div>
              <h4 className="font-semibold text-gray-800 text-sm">{badge.name}</h4>
              <p className="text-xs text-gray-600 mt-1">{badge.description}</p>
              <span className={`text-xs font-medium ${getRarityTextColor(badge.rarity)} mt-2 inline-block`}>
                {badge.rarity.toUpperCase()}
              </span>
              
              {badge.progress && badge.maxProgress && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${(badge.progress / badge.maxProgress) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {badge.progress}/{badge.maxProgress}
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Locked Badges */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Locked Badges</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border-2 border-gray-200 text-center opacity-60">
            <div className="text-3xl mb-2 grayscale">🏆</div>
            <h4 className="font-semibold text-gray-600 text-sm">Champion</h4>
            <p className="text-xs text-gray-500 mt-1">Reach #1 on leaderboard</p>
          </div>
          <div className="p-4 rounded-lg border-2 border-gray-200 text-center opacity-60">
            <div className="text-3xl mb-2 grayscale">📚</div>
            <h4 className="font-semibold text-gray-600 text-sm">Bookworm</h4>
            <p className="text-xs text-gray-500 mt-1">Complete 50 lessons</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLeaderboardTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Leaderboard</h3>
        <div className="space-y-3">
          {leaderboard.map((entry, index) => (
            <motion.div
              key={entry.userId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`flex items-center justify-between p-4 rounded-lg ${
                entry.userId === userId ? 'bg-blue-50 border-2 border-blue-300' : 'bg-gray-50'
              }`}
            >
              <div className="flex items-center space-x-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  entry.rank === 1 ? 'bg-yellow-500 text-white' :
                  entry.rank === 2 ? 'bg-gray-400 text-white' :
                  entry.rank === 3 ? 'bg-orange-600 text-white' :
                  'bg-gray-200 text-gray-600'
                }`}>
                  {entry.rank}
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{entry.username}</p>
                  <p className="text-sm text-gray-600">{formatPoints(entry.points)} points</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {entry.change !== 0 && (
                  <span className={`text-sm font-medium ${
                    entry.change > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {entry.change > 0 ? '↑' : '↓'} {Math.abs(entry.change)}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStreaksTab = () => (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-orange-500 to-red-600 rounded-xl p-6 text-white"
      >
        <h3 className="text-xl font-bold mb-4">Learning Streak</h3>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-5xl font-bold mb-2">
              {getStreakEmoji(streak.current)} {streak.current}
            </div>
            <p className="text-lg opacity-90">days in a row!</p>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-80">Longest streak</p>
            <p className="text-2xl font-bold">{streak.longest} days</p>
          </div>
        </div>
        
        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm opacity-80">Next milestone</span>
            <span className="text-sm font-medium">{streak.nextMilestone} days</span>
          </div>
          <div className="w-full bg-white bg-opacity-20 rounded-full h-3">
            <div
              className="bg-white h-3 rounded-full transition-all"
              style={{ width: `${(streak.current / streak.nextMilestone) * 100}%` }}
            />
          </div>
        </div>
      </motion.div>

      {/* Streak Calendar */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Activity Calendar</h3>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 30 }, (_, i) => {
            const isActive = i < streak.current;
            const isToday = i === streak.current - 1;
            return (
              <div
                key={i}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  isActive 
                    ? isToday 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                {30 - i}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Achievement Popup */}
      <AnimatePresence>
        {showAchievementPopup && newAchievement && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.8 }}
            className="fixed top-4 right-4 bg-white rounded-lg shadow-2xl p-6 z-50 max-w-sm"
          >
            <div className="flex items-center space-x-4">
              <div className="text-4xl">{newAchievement.badge.icon}</div>
              <div>
                <h3 className="font-bold text-gray-800">Achievement Unlocked!</h3>
                <p className="text-gray-600">{newAchievement.title}</p>
                <p className="text-sm text-blue-600 font-medium">+{newAchievement.points} points</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow-lg">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex space-x-8 px-6">
            {showPoints && (
              <button
                onClick={() => setActiveTab('points')}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'points'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Points
              </button>
            )}
            {showBadges && (
              <button
                onClick={() => setActiveTab('badges')}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'badges'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Badges
              </button>
            )}
            {showLeaderboard && (
              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'leaderboard'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Leaderboard
              </button>
            )}
            {showStreaks && (
              <button
                onClick={() => setActiveTab('streaks')}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'streaks'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Streaks
              </button>
            )}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'points' && renderPointsTab()}
          {activeTab === 'badges' && renderBadgesTab()}
          {activeTab === 'leaderboard' && renderLeaderboardTab()}
          {activeTab === 'streaks' && renderStreaksTab()}
        </div>
      </div>
    </div>
  );
};

export default GamificationEngine;
