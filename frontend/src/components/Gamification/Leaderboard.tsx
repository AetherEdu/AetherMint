'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Medal, Crown, TrendingUp, Users, Filter, ChevronDown, Search, Star } from 'lucide-react';
import { env } from '@/lib/env';
import { io, Socket } from 'socket.io-client';

interface LeaderboardUser {
  id: string;
  name: string;
  avatar?: string;
  points: number;
  level: number;
  streak: number;
  rank: number;
  previousRank?: number;
  badges: number;
  completedCourses: number;
  change?: 'up' | 'down' | 'same';
}

interface LeaderboardProps {
  initialData?: LeaderboardUser[];
  timeRange?: 'daily' | 'weekly' | 'monthly' | 'all-time';
  category?: 'points' | 'streak' | 'courses' | 'badges';
  showRealTime?: boolean;
  maxEntries?: number;
  showUserRank?: boolean;
  currentUserId?: string;
}

const TIME_RANGES = [
  { value: 'daily', label: 'Today' },
  { value: 'weekly', label: 'This Week' },
  { value: 'monthly', label: 'This Month' },
  { value: 'all-time', label: 'All Time' }
];

const CATEGORIES = [
  { value: 'points', label: 'Points', icon: Star },
  { value: 'streak', label: 'Streak', icon: Trophy },
  { value: 'courses', label: 'Courses', icon: Crown },
  { value: 'badges', label: 'Badges', icon: Medal }
];

const RANK_COLORS = {
  1: 'from-yellow-400 to-amber-600',
  2: 'from-gray-300 to-gray-500',
  3: 'from-amber-600 to-amber-800',
  default: 'from-blue-400 to-blue-600'
};

const RANK_ICONS = {
  1: Crown,
  2: Trophy,
  3: Medal,
  default: Star
};

export function Leaderboard({
  initialData = [],
  timeRange = 'weekly',
  category = 'points',
  showRealTime = true,
  maxEntries = 50,
  showUserRank = true,
  currentUserId
}: LeaderboardProps) {
  const [data, setData] = useState<LeaderboardUser[]>(initialData);
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);
  const [selectedCategory, setSelectedCategory] = useState(category);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Initialize Socket.io for real-time updates
  useEffect(() => {
    if (showRealTime) {
      const newSocket = io(env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3001');
      setSocket(newSocket);

      newSocket.on('leaderboard-update', (updatedData: LeaderboardUser[]) => {
        setData(updatedData);
      });

      newSocket.on('rank-change', ({ userId, newRank, previousRank }: { userId: string; newRank: number; previousRank: number }) => {
        setData(prevData => 
          prevData.map(user => 
            user.id === userId 
              ? { 
                  ...user, 
                  rank: newRank, 
                  previousRank,
                  change: newRank < previousRank ? 'up' : newRank > previousRank ? 'down' : 'same'
                }
              : user
          )
        );
      });

      return () => {
        newSocket.close();
      };
    }
  }, [showRealTime]);

  // Fetch leaderboard data
  const fetchLeaderboard = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/leaderboard?timeRange=${selectedTimeRange}&category=${selectedCategory}&limit=${maxEntries}`);
      const leaderboardData = await response.json();
      setData(leaderboardData);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [selectedTimeRange, selectedCategory]);

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    
    return data.filter(user => 
      user.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data, searchQuery]);

  // Find current user's rank
  const currentUserRank = useMemo(() => {
    if (!currentUserId) return null;
    return data.find(user => user.id === currentUserId);
  }, [data, currentUserId]);

  // Get rank icon and colors
  const getRankDisplay = (rank: number) => {
    const colors = RANK_COLORS[rank as keyof typeof RANK_COLORS] || RANK_COLORS.default;
    const IconComponent = RANK_ICONS[rank as keyof typeof RANK_ICONS] || RANK_ICONS.default;
    return { colors, IconComponent };
  };

  const getUserChange = (user: LeaderboardUser) => {
    if (!user.previousRank || user.previousRank === user.rank) return null;
    return user.rank < user.previousRank ? 'up' : 'down';
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Trophy className="h-8 w-8 text-yellow-400" />
            <h2 className="text-2xl font-bold text-white">Leaderboard</h2>
          </div>
          <div className="flex items-center gap-2 text-white/80">
            <Users className="h-5 w-5" />
            <span className="text-sm">{filteredData.length} learners</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
            <input
              type="text"
              placeholder="Search learners..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/20 backdrop-blur-sm text-white placeholder-white/60 border border-white/30 focus:outline-none focus:border-white/50"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 backdrop-blur-sm text-white border border-white/30 hover:bg-white/30 transition-colors"
          >
            <Filter className="h-4 w-4" />
            <span>Filters</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Expanded Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 pt-4 border-t border-white/20"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Time Range */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Time Range</label>
                  <div className="flex gap-2">
                    {TIME_RANGES.map((range) => (
                      <button
                        key={range.value}
                        onClick={() => setSelectedTimeRange(range.value as any)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                          selectedTimeRange === range.value
                            ? 'bg-white text-blue-600'
                            : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                      >
                        {range.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Category</label>
                  <div className="flex gap-2">
                    {CATEGORIES.map((cat) => {
                      const IconComponent = cat.icon;
                      return (
                        <button
                          key={cat.value}
                          onClick={() => setSelectedCategory(cat.value as any)}
                          className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                            selectedCategory === cat.value
                              ? 'bg-white text-blue-600'
                              : 'bg-white/20 text-white hover:bg-white/30'
                          }`}
                        >
                          <IconComponent className="h-3 w-3" />
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Current User Rank */}
      {showUserRank && currentUserRank && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 border-b border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                Your Rank: #{currentUserRank.rank}
              </div>
              {getUserChange(currentUserRank) && (
                <div className={`flex items-center gap-1 text-sm font-medium ${
                  getUserChange(currentUserRank) === 'up' 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  <TrendingUp className={`h-4 w-4 ${getUserChange(currentUserRank) === 'down' ? 'rotate-180' : ''}`} />
                  {Math.abs(currentUserRank.rank - (currentUserRank.previousRank || currentUserRank.rank))}
                </div>
              )}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {currentUserRank.points} points • Level {currentUserRank.level}
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard List */}
      <div className="divide-y divide-gray-200 dark:divide-slate-700">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Loading leaderboard...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="p-8 text-center">
            <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              {searchQuery ? 'No learners found matching your search' : 'No data available'}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredData.slice(0, maxEntries).map((user, index) => {
              const { colors, IconComponent } = getRankDisplay(user.rank);
              const userChange = getUserChange(user);
              const isCurrentUser = user.id === currentUserId;

              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-4 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors ${
                    isCurrentUser ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    {/* Rank and User Info */}
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className={`relative w-10 h-10 rounded-full bg-gradient-to-r ${colors} flex items-center justify-center text-white font-bold`}>
                        <IconComponent className="h-5 w-5" />
                        {user.rank > 3 && (
                          <span className="absolute -bottom-1 -right-1 text-xs font-bold">
                            {user.rank}
                          </span>
                        )}
                      </div>

                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          user.name.charAt(0).toUpperCase()
                        )}
                      </div>

                      {/* Name and Stats */}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {user.name}
                            {isCurrentUser && (
                              <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-1 rounded-full">You</span>
                            )}
                          </h3>
                          {userChange && (
                            <div className={`flex items-center gap-1 text-xs font-medium ${
                              userChange === 'up' 
                                ? 'text-green-600 dark:text-green-400' 
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              <TrendingUp className={`h-3 w-3 ${userChange === 'down' ? 'rotate-180' : ''}`} />
                              {Math.abs(user.rank - (user.previousRank || user.rank))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <span>Level {user.level}</span>
                          <span>{user.points} points</span>
                          <span>{user.streak} day streak</span>
                        </div>
                      </div>
                    </div>

                    {/* Additional Stats */}
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="font-semibold text-gray-900 dark:text-white">{user.badges}</div>
                        <div className="text-gray-600 dark:text-gray-400">Badges</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-gray-900 dark:text-white">{user.completedCourses}</div>
                        <div className="text-gray-600 dark:text-gray-400">Courses</div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
