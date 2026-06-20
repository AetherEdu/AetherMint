'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Achievement } from '../../types/profile';
import { env } from '@/lib/env';
import { io, Socket } from 'socket.io-client';
import { Trophy, Star, Flame, Target, Users, Zap, Settings } from 'lucide-react';

import { AchievementNotification } from './AchievementNotification';
import { Leaderboard } from './Leaderboard';
import { LearningStreak } from './LearningStreak';
import { PointSystem } from './PointSystem';
import { BadgeCollection } from './BadgeCollection';
import { SocialSharing } from './SocialSharing';

interface GamificationData {
  user: {
    id: string;
    name: string;
    points: number;
    level: number;
    streak: number;
    rank: number;
  };
  achievements: Achievement[];
  leaderboard: Array<{
    id: string;
    name: string;
    points: number;
    level: number;
    streak: number;
    rank: number;
    previousRank?: number;
    badges: number;
    completedCourses: number;
  }>;
  streakData: {
    currentStreak: number;
    longestStreak: number;
    lastActiveDate: string;
    streakHistory: Array<{
      date: string;
      active: boolean;
      pointsEarned?: number;
      timeSpent?: number;
    }>;
    nextMilestone: number;
    milestoneReward: string;
    streakFreezeUsed: boolean;
    streakFreezeAvailable: boolean;
  };
  pointData: {
    currentPoints: number;
    totalEarned: number;
    totalSpent: number;
    level: number;
    pointsToNextLevel: number;
    recentTransactions: Array<{
      id: string;
      amount: number;
      reason: string;
      timestamp: string;
      type: 'earned' | 'spent' | 'bonus';
      category: 'lesson' | 'quiz' | 'achievement' | 'streak' | 'bonus' | 'reward';
    }>;
    availableRewards: Array<{
      id: string;
      name: string;
      description: string;
      cost: number;
      icon: string;
      category: 'avatar' | 'badge' | 'course' | 'feature' | 'customization';
      available: boolean;
      claimed?: boolean;
    }>;
  };
}

interface GamificationDashboardProps {
  initialData: GamificationData;
  showRealTime?: boolean;
  compact?: boolean;
  showNotifications?: boolean;
}

export function GamificationDashboard({
  initialData,
  showRealTime = true,
  compact = false,
  showNotifications = true
}: GamificationDashboardProps) {
  const [data, setData] = useState<GamificationData>(initialData);
  const [activeTab, setActiveTab] = useState<'overview' | 'achievements' | 'leaderboard' | 'streak' | 'points'>('overview');
  const [showAchievementNotification, setShowAchievementNotification] = useState(false);
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);
  const [showSocialShare, setShowSocialShare] = useState(false);
  const [shareContent, setShareContent] = useState<any>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Initialize Socket.io for real-time updates
  useEffect(() => {
    if (showRealTime) {
      const newSocket = io(env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3001');
      setSocket(newSocket);

      newSocket.on('achievement-unlocked', (achievement: Achievement) => {
        setNewAchievement(achievement);
        setShowAchievementNotification(true);
        
        // Update local data
        setData(prevData => ({
          ...prevData,
          achievements: prevData.achievements.map(a => 
            a.id === achievement.id ? achievement : a
          ),
          user: {
            ...prevData.user,
            points: prevData.user.points + (achievement.points || 0)
          }
        }));
      });

      newSocket.on('points-updated', (pointsData: any) => {
        setData(prevData => ({
          ...prevData,
          user: {
            ...prevData.user,
            points: pointsData.currentPoints,
            level: pointsData.level
          },
          pointData: {
            ...prevData.pointData,
            ...pointsData
          }
        }));
      });

      newSocket.on('streak-updated', (streakData: any) => {
        setData(prevData => ({
          ...prevData,
          user: {
            ...prevData.user,
            streak: streakData.currentStreak
          },
          streakData: {
            ...prevData.streakData,
            ...streakData
          }
        }));
      });

      newSocket.on('leaderboard-updated', (leaderboardData: any[]) => {
        setData(prevData => ({
          ...prevData,
          leaderboard: leaderboardData
        }));
      });

      return () => {
        newSocket.close();
      };
    }
  }, [showRealTime]);

  // Handle achievement notification close
  const handleAchievementClose = () => {
    setShowAchievementNotification(false);
    
    // Show social sharing for rare+ achievements
    if (newAchievement && ['rare', 'epic', 'legendary'].includes(newAchievement.rarity)) {
      setShareContent({
        type: 'achievement',
        title: newAchievement.name,
        description: newAchievement.description,
        badge: newAchievement.icon,
        points: newAchievement.points
      });
      setShowSocialShare(true);
    }
    
    setNewAchievement(null);
  };

  // Handle social sharing
  const handleSocialShare = () => {
    setShowSocialShare(false);
    setShareContent(null);
  };

  // Handle points earned
  const handlePointsEarned = (amount: number, reason: string) => {
    setData(prevData => ({
      ...prevData,
      user: {
        ...prevData.user,
        points: prevData.user.points + amount
      },
      pointData: {
        ...prevData.pointData,
        currentPoints: prevData.pointData.currentPoints + amount,
        totalEarned: prevData.pointData.totalEarned + amount
      }
    }));
  };

  // Handle reward claimed
  const handleRewardClaimed = (rewardId: string) => {
    const reward = data.pointData.availableRewards.find(r => r.id === rewardId);
    if (reward && data.user.points >= reward.cost) {
      setData(prevData => ({
        ...prevData,
        user: {
          ...prevData.user,
          points: prevData.user.points - reward.cost
        },
        pointData: {
          ...prevData.pointData,
          currentPoints: prevData.pointData.currentPoints - reward.cost,
          totalSpent: prevData.pointData.totalSpent + reward.cost,
          availableRewards: prevData.pointData.availableRewards.map(r =>
            r.id === rewardId ? { ...r, claimed: true } : r
          )
        }
      }));
    }
  };

  if (compact) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <LearningStreak streakData={data.streakData} compact />
        <PointSystem 
          {...data.pointData}
          compact
          onPointsEarned={handlePointsEarned}
        />
        <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-300 dark:border-purple-700">
          <Trophy className="h-5 w-5 text-purple-500" />
          <div>
            <div className="font-bold text-gray-900 dark:text-white">
              {data.achievements.filter(a => a.earnedDate).length}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Achievements
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-300 dark:border-blue-700">
          <Users className="h-5 w-5 text-blue-500" />
          <div>
            <div className="font-bold text-gray-900 dark:text-white">
              #{data.user.rank}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Global Rank
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Star },
    { id: 'achievements', label: 'Achievements', icon: Trophy },
    { id: 'leaderboard', label: 'Leaderboard', icon: Users },
    { id: 'streak', label: 'Streak', icon: Flame },
    { id: 'points', label: 'Points', icon: Target }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-6 text-white"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Gamification Hub</h1>
            <p className="text-white/80">Track your progress, compete with others, and unlock achievements</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{data.user.points.toLocaleString()}</div>
              <div className="text-sm text-white/80">Points</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">Level {data.user.level}</div>
              <div className="text-sm text-white/80">Level</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">#{data.user.rank}</div>
              <div className="text-sm text-white/80">Rank</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mt-6">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-purple-600'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                <IconComponent className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Tab Content */}
      <motion.div
        className="min-h-[400px]"
        key={activeTab}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LearningStreak streakData={data.streakData} />
            <PointSystem 
              {...data.pointData}
              onPointsEarned={handlePointsEarned}
              onRewardClaimed={handleRewardClaimed}
            />
          </div>
        )}

        {activeTab === 'achievements' && (
          <BadgeCollection 
            achievements={data.achievements}
            showLocked={true}
            allowFiltering={true}
            viewMode="grid"
          />
        )}

        {activeTab === 'leaderboard' && (
          <Leaderboard
            initialData={data.leaderboard}
            showRealTime={showRealTime}
            currentUserId={data.user.id}
            showUserRank={true}
          />
        )}

        {activeTab === 'streak' && (
          <LearningStreak 
            streakData={data.streakData}
            showHistory={true}
            showMilestones={true}
          />
        )}

        {activeTab === 'points' && (
          <PointSystem 
            {...data.pointData}
            showHistory={true}
            showRewards={true}
            onPointsEarned={handlePointsEarned}
            onRewardClaimed={handleRewardClaimed}
          />
        )}
      </motion.div>

      {/* Achievement Notification */}
      {showNotifications && newAchievement && (
        <AchievementNotification
          achievement={newAchievement}
          isVisible={showAchievementNotification}
          onClose={handleAchievementClose}
          onShare={() => {
            setShareContent({
              type: 'achievement',
              title: newAchievement.name,
              description: newAchievement.description,
              badge: newAchievement.icon,
              points: newAchievement.points
            });
            setShowSocialShare(true);
          }}
        />
      )}

      {/* Social Sharing Modal */}
      {shareContent && (
        <SocialSharing
          content={shareContent}
          isOpen={showSocialShare}
          onClose={handleSocialShare}
        />
      )}
    </div>
  );
}
