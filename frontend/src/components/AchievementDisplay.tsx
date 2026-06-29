'use client';

import { useState, useMemo } from 'react';
import { Achievement } from '../types/profile';
import { EmptyState } from './LoadingFallback';
import { 
  Trophy, 
  Star, 
  Lock, 
  Calendar, 
  Target, 
  Filter,
  Search,
  Sparkles,
  Flame,
  BookOpen,
  Brain,
  Zap
} from 'lucide-react';

interface AchievementDisplayProps {
  achievements: Achievement[];
  showProgress?: boolean;
  compact?: boolean;
  filterable?: boolean;
  searchable?: boolean;
}

const RARITY_CONFIG = {
  common: {
    color: 'from-gray-400 to-gray-600',
    borderColor: 'border-gray-300',
    bgColor: 'bg-gray-50 dark:bg-gray-800/50',
    textColor: 'text-gray-700 dark:text-gray-300',
    icon: Star
  },
  rare: {
    color: 'from-blue-400 to-blue-600',
    borderColor: 'border-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-800/50',
    textColor: 'text-blue-700 dark:text-blue-300',
    icon: Zap
  },
  epic: {
    color: 'from-purple-400 to-purple-600',
    borderColor: 'border-purple-300',
    bgColor: 'bg-purple-50 dark:bg-purple-800/50',
    textColor: 'text-purple-700 dark:text-purple-300',
    icon: Sparkles
  },
  legendary: {
    color: 'from-amber-400 to-amber-600',
    borderColor: 'border-amber-300',
    bgColor: 'bg-amber-50 dark:bg-amber-800/50',
    textColor: 'text-amber-700 dark:text-amber-300',
    icon: Trophy
  }
};

const CATEGORY_ICONS = {
  milestone: Trophy,
  streak: Flame,
  learning: BookOpen,
  level: Brain,
  skill: Target,
  default: Star
};

export function AchievementDisplay({ 
  achievements, 
  showProgress = true, 
  compact = false,
  filterable = true,
  searchable = true 
}: AchievementDisplayProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRarity, setSelectedRarity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showLocked, setShowLocked] = useState(true);

  // Get unique categories and rarities
  const categories = useMemo(() => {
    const achs = achievements || [];
    const cats = Array.from(new Set(achs.map(a => a.category)));
    return ['all', ...cats];
  }, [achievements]);

  const rarities = useMemo(() => {
    const achs = achievements || [];
    const rars = Array.from(new Set(achs.map(a => a.rarity)));
    return ['all', ...rars];
  }, [achievements]);

  // Filter achievements
  const filteredAchievements = useMemo(() => {
    return (achievements || []).filter(achievement => {
      // Search filter
      if (searchQuery && !achievement.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !achievement.description.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && achievement.category !== selectedCategory) {
        return false;
      }

      // Rarity filter
      if (selectedRarity !== 'all' && achievement.rarity !== selectedRarity) {
        return false;
      }

      // Locked filter
      if (!showLocked && !achievement.earnedDate) {
        return false;
      }

      return true;
    });
  }, [achievements, searchQuery, selectedCategory, selectedRarity, showLocked]);

  // Statistics
  const stats = useMemo(() => {
    const earned = achievements.filter(a => a.earnedDate);
    const total = achievements.length;
    const byRarity = earned.reduce((acc, achievement) => {
      acc[achievement.rarity] = (acc[achievement.rarity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      earned: earned.length,
      locked: total - earned.length,
      completion: total > 0 ? Math.round((earned.length / total) * 100) : 0,
      byRarity
    };
  }, [achievements]);

  if (compact) {
    if (filteredAchievements.length === 0) {
      return (
        <EmptyState
          icon={<Trophy className="h-6 w-6" />}
          title="No achievements yet"
          description="Complete courses and reach milestones to earn achievements."
        />
      );
    }
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {filteredAchievements.slice(0, 12).map((achievement) => {
          const config = RARITY_CONFIG[achievement.rarity];
          const IconComponent = config.icon;
          const isEarned = !!achievement.earnedDate;

          return (
            <div
              key={achievement.id}
              className={`
                relative p-3 rounded-lg border-2 transition-all duration-300
                ${isEarned 
                  ? `${config.bgColor} ${config.borderColor} hover:scale-105 shadow-md` 
                  : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 opacity-60'
                }
              `}
              title={`${achievement.name}: ${achievement.description}`}
            >
              <div className="flex flex-col items-center text-center gap-1">
                <div className={`text-2xl ${isEarned ? '' : 'grayscale'}`}>
                  {achievement.icon}
                </div>
                <div className="text-xs font-medium truncate w-full">
                  {achievement.name}
                </div>
                {showProgress && achievement.progress !== undefined && achievement.maxProgress && (
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                    <div 
                      className="bg-green-500 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min((achievement.progress / achievement.maxProgress) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
              {isEarned && (
                <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full bg-gradient-to-r ${config.color}`} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Achievements
          </h2>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {stats.earned} / {stats.total} Unlocked
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.completion}%
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Completion</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.earned}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Earned</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
              {stats.locked}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Locked</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.byRarity.legendary || 0}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Legendary</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      {(filterable || searchable) && (
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            {searchable && (
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search achievements..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Category Filter */}
            {filterable && (
              <div className="flex gap-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedRarity}
                  onChange={(e) => setSelectedRarity(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
                >
                  {rarities.map(rarity => (
                    <option key={rarity} value={rarity}>
                      {rarity === 'all' ? 'All Rarities' : rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setShowLocked(!showLocked)}
                  className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                    showLocked
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white border-gray-300 dark:border-slate-600'
                  }`}
                >
                  {showLocked ? 'Hide' : 'Show'} Locked
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Achievement Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredAchievements.map((achievement) => {
          const config = RARITY_CONFIG[achievement.rarity];
          const IconComponent = config.icon;
          const CategoryIcon = CATEGORY_ICONS[achievement.category as keyof typeof CATEGORY_ICONS] || CATEGORY_ICONS.default;
          const isEarned = !!achievement.earnedDate;

          return (
            <div
              key={achievement.id}
              className={`
                relative rounded-lg border-2 p-4 transition-all duration-300
                ${isEarned 
                  ? `${config.bgColor} ${config.borderColor} hover:scale-105 shadow-lg cursor-pointer` 
                  : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 opacity-60'
                }
              `}
            >
              {/* Rarity Indicator */}
              <div className={`absolute top-2 right-2 w-8 h-8 rounded-full bg-gradient-to-r ${config.color} flex items-center justify-center`}>
                <IconComponent className="h-4 w-4 text-white" />
              </div>

              {/* Achievement Content */}
              <div className="flex flex-col gap-3">
                {/* Icon */}
                <div className={`text-4xl text-center ${isEarned ? '' : 'grayscale'}`}>
                  {achievement.icon}
                </div>

                {/* Info */}
                <div className="text-center">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                    {achievement.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {achievement.description}
                  </p>
                  
                  {/* Category */}
                  <div className="flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-2">
                    <CategoryIcon className="h-3 w-3" />
                    <span>{achievement.category}</span>
                  </div>

                  {/* Progress */}
                  {showProgress && achievement.progress !== undefined && achievement.maxProgress && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                        <span>Progress</span>
                        <span>{achievement.progress} / {achievement.maxProgress}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            isEarned ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${Math.min((achievement.progress / achievement.maxProgress) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Requirement */}
                  {!isEarned && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded">
                      <Target className="h-3 w-3 inline mr-1" />
                      {achievement.requirement}
                    </div>
                  )}

                  {/* Earned Date */}
                  {isEarned && achievement.earnedDate && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center justify-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Earned {new Date(achievement.earnedDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* No Results */}
      {filteredAchievements.length === 0 && (
        <EmptyState
          icon={<Trophy className="h-8 w-8" />}
          title={
            searchQuery || selectedCategory !== 'all' || selectedRarity !== 'all'
              ? 'No achievements match your filters'
              : 'No achievements yet'
          }
          description={
            searchQuery || selectedCategory !== 'all' || selectedRarity !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'Complete courses and reach milestones to earn achievements.'
          }
          action={
            searchQuery || selectedCategory !== 'all' || selectedRarity !== 'all'
              ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); setSelectedCategory('all'); setSelectedRarity('all'); } }
              : undefined
          }
        />
      )}
    </div>
  );
}
