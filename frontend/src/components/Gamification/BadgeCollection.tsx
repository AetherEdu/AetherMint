'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Achievement } from '../../types/profile';
import { 
  Trophy, 
  Star, 
  Sparkles, 
  Zap, 
  Filter, 
  Search, 
  Grid, 
  List, 
  Eye, 
  Lock,
  Calendar,
  TrendingUp,
  Award
} from 'lucide-react';

interface BadgeCollectionProps {
  achievements: Achievement[];
  showLocked?: boolean;
  allowFiltering?: boolean;
  viewMode?: 'grid' | 'list';
  compact?: boolean;
}

const RARITY_CONFIG = {
  common: {
    name: 'Common',
    color: 'from-gray-400 to-gray-600',
    borderColor: 'border-gray-300',
    bgColor: 'bg-gray-50 dark:bg-gray-800/50',
    textColor: 'text-gray-700 dark:text-gray-300',
    glowColor: 'shadow-gray-300/50',
    probability: 0.60,
    icon: Star
  },
  rare: {
    name: 'Rare',
    color: 'from-blue-400 to-blue-600',
    borderColor: 'border-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-800/50',
    textColor: 'text-blue-700 dark:text-blue-300',
    glowColor: 'shadow-blue-300/50',
    probability: 0.25,
    icon: Zap
  },
  epic: {
    name: 'Epic',
    color: 'from-purple-400 to-purple-600',
    borderColor: 'border-purple-300',
    bgColor: 'bg-purple-50 dark:bg-purple-800/50',
    textColor: 'text-purple-700 dark:text-purple-300',
    glowColor: 'shadow-purple-300/50',
    probability: 0.12,
    icon: Sparkles
  },
  legendary: {
    name: 'Legendary',
    color: 'from-amber-400 to-amber-600',
    borderColor: 'border-amber-300',
    bgColor: 'bg-amber-50 dark:bg-amber-800/50',
    textColor: 'text-amber-700 dark:text-amber-300',
    glowColor: 'shadow-amber-300/50',
    probability: 0.03,
    icon: Trophy
  }
};

const CATEGORY_CONFIG = {
  milestone: { name: 'Milestone', icon: Trophy },
  streak: { name: 'Streak', icon: Zap },
  learning: { name: 'Learning', icon: Star },
  level: { name: 'Level', icon: Sparkles },
  skill: { name: 'Skill', icon: Award },
  social: { name: 'Social', icon: Star },
  special: { name: 'Special', icon: Sparkles }
};

/** Renders the category icon for a badge (module-level so it can be used
 * outside the badge-grid map callback). */
function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const Icon = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG]?.icon || Star;
  return <Icon className={className} />;
}

export function BadgeCollection({
  achievements,
  showLocked = true,
  allowFiltering = true,
  viewMode = 'grid',
  compact = false
}: BadgeCollectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRarity, setSelectedRarity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewModeState, setViewModeState] = useState<'grid' | 'list'>(viewMode);
  const [selectedBadge, setSelectedBadge] = useState<Achievement | null>(null);
  const [showLockedState, setShowLocked] = useState(showLocked);

  // Get unique categories and rarities
  const categories = useMemo(() => {
    const cats = Array.from(new Set(achievements.map(a => a.category)));
    return ['all', ...cats];
  }, [achievements]);

  const rarities = useMemo(() => {
    const rars = Array.from(new Set(achievements.map(a => a.rarity)));
    return ['all', ...rars];
  }, [achievements]);

  // Filter achievements
  const filteredAchievements = useMemo(() => {
    return achievements.filter(achievement => {
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
      if (!showLockedState && !achievement.earnedDate) {
        return false;
      }

      return true;
    });
  }, [achievements, searchQuery, selectedCategory, selectedRarity, showLockedState]);

  // Statistics
  const stats = useMemo(() => {
    const earned = achievements.filter(a => a.earnedDate);
    const total = achievements.length;
    const byRarity = earned.reduce((acc, achievement) => {
      acc[achievement.rarity] = (acc[achievement.rarity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const byCategory = earned.reduce((acc, achievement) => {
      acc[achievement.category] = (acc[achievement.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      earned: earned.length,
      locked: total - earned.length,
      completion: total > 0 ? Math.round((earned.length / total) * 100) : 0,
      byRarity,
      byCategory
    };
  }, [achievements]);

  if (compact) {
    return (
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {filteredAchievements.slice(0, 12).map((achievement) => {
          const config = RARITY_CONFIG[achievement.rarity];
          const IconComponent = config.icon;
          const isEarned = !!achievement.earnedDate;

          return (
            <motion.div
              key={achievement.id}
              className={`relative aspect-square rounded-lg border-2 transition-all duration-300 cursor-pointer ${
                isEarned 
                  ? `${config.bgColor} ${config.borderColor} hover:scale-105` 
                  : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 opacity-60'
              }`}
              whileHover={{ scale: 1.05 }}
              onClick={() => setSelectedBadge(achievement)}
            >
              <div className="flex flex-col items-center justify-center h-full p-2 text-center">
                <div className={`text-2xl mb-1 ${isEarned ? '' : 'grayscale'}`}>
                  {achievement.icon}
                </div>
                <div className="text-xs font-medium truncate w-full">
                  {achievement.name}
                </div>
              </div>
              {isEarned && (
                <motion.div
                  className={`absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-r ${config.color}`}
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </motion.div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <motion.div
        className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Trophy className="h-8 w-8 text-yellow-500" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Badge Collection
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {stats.earned} of {stats.total} badges collected
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewModeState('grid')}
              className={`p-2 rounded-lg ${viewModeState === 'grid' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'}`}
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewModeState('list')}
              className={`p-2 rounded-lg ${viewModeState === 'list' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.completion}%
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Collection</div>
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
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.byRarity.legendary || 0}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Legendary</div>
          </div>
        </div>

        {/* Rarity Distribution */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Rarity Distribution</h3>
          <div className="space-y-2">
            {Object.entries(RARITY_CONFIG).map(([rarity, config]) => {
              const count = stats.byRarity[rarity] || 0;
              const percentage = stats.earned > 0 ? (count / stats.earned) * 100 : 0;
              
              return (
                <div key={rarity} className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full bg-gradient-to-r ${config.color}`} />
                  <span className="text-sm text-gray-700 dark:text-gray-300 w-20">
                    {config.name}
                  </span>
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <motion.div
                      className={`h-2 rounded-full bg-gradient-to-r ${config.color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 1, delay: 0.2 }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-12 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      {allowFiltering && (
        <motion.div
          className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-200 dark:border-slate-700"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search badges..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Category Filter */}
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
                onClick={() => setShowLocked(!showLockedState)}
                className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                  showLockedState
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white border-gray-300 dark:border-slate-600'
                }`}
              >
                {showLockedState ? 'Hide' : 'Show'} Locked
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Badge Grid/List */}
      <div className={viewModeState === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'space-y-4'}>
        <AnimatePresence>
          {filteredAchievements.map((achievement, index) => {
            const config = RARITY_CONFIG[achievement.rarity];
            const IconComponent = config.icon;
            const CategoryIcon = CATEGORY_CONFIG[achievement.category as keyof typeof CATEGORY_CONFIG]?.icon || Star;
            const isEarned = !!achievement.earnedDate;

            if (viewModeState === 'grid') {
              return (
                <motion.div
                  key={achievement.id}
                  className={`relative rounded-xl border-2 p-4 transition-all duration-300 cursor-pointer ${
                    isEarned 
                      ? `${config.bgColor} ${config.borderColor} hover:scale-105 hover:shadow-lg` 
                      : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 opacity-60'
                  }`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -5 }}
                  onClick={() => setSelectedBadge(achievement)}
                >
                  {/* Rarity Indicator */}
                  <div className={`absolute top-2 right-2 w-8 h-8 rounded-full bg-gradient-to-r ${config.color} flex items-center justify-center`}>
                    <IconComponent className="h-4 w-4 text-white" />
                  </div>

                  {/* Badge Content */}
                  <div className="flex flex-col items-center text-center space-y-3">
                    {/* Icon */}
                    <motion.div
                      className={`text-5xl ${isEarned ? '' : 'grayscale'}`}
                      animate={isEarned ? { 
                        rotate: [0, 5, -5, 0],
                        scale: [1, 1.05, 1]
                      } : {}}
                      transition={{ 
                        duration: 3, 
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    >
                      {achievement.icon}
                    </motion.div>

                    {/* Info */}
                    <div className="w-full">
                      <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                        {achievement.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                        {achievement.description}
                      </p>
                      
                      {/* Category */}
                      <div className="flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-2">
                        <CategoryIcon className="h-3 w-3" />
                        <span>{achievement.category}</span>
                      </div>

                      {/* Progress */}
                      {achievement.progress !== undefined && achievement.maxProgress && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                            <span>Progress</span>
                            <span>{achievement.progress} / {achievement.maxProgress}</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <motion.div 
                              className={`h-2 rounded-full transition-all duration-300 ${
                                isEarned ? 'bg-green-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${Math.min((achievement.progress / achievement.maxProgress) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Status */}
                      <div className="mt-2">
                        {isEarned ? (
                          <div className="flex items-center justify-center gap-1 text-xs text-green-600 dark:text-green-400">
                            <Trophy className="h-3 w-3" />
                            <span>Unlocked</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <Lock className="h-3 w-3" />
                            <span>Locked</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Glow Effect for Earned Badges */}
                  {isEarned && (
                    <motion.div
                      className={`absolute inset-0 rounded-xl ${config.glowColor} blur-md opacity-50`}
                      animate={{
                        opacity: [0.3, 0.6, 0.3]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                  )}
                </motion.div>
              );
            } else {
              // List View
              return (
                <motion.div
                  key={achievement.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer ${
                    isEarned 
                      ? `${config.bgColor} ${config.borderColor} hover:shadow-lg` 
                      : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 opacity-60'
                  }`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setSelectedBadge(achievement)}
                >
                  <div className={`w-16 h-16 rounded-lg flex items-center justify-center text-2xl ${isEarned ? '' : 'grayscale'}`}>
                    {achievement.icon}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900 dark:text-white">
                        {achievement.name}
                      </h3>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${config.color} text-white`}>
                        {config.name}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {achievement.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <CategoryIcon className="h-3 w-3" />
                        <span>{achievement.category}</span>
                      </div>
                      {isEarned && achievement.earnedDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Earned {new Date(achievement.earnedDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    {isEarned ? (
                      <div className="flex flex-col items-center">
                        <Trophy className="h-6 w-6 text-green-500 mb-1" />
                        <span className="text-xs text-green-600 dark:text-green-400">Unlocked</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <Lock className="h-6 w-6 text-gray-400 mb-1" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">Locked</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            }
          })}
        </AnimatePresence>
      </div>

      {/* No Results */}
      {filteredAchievements.length === 0 && (
        <motion.div
          className="text-center py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            {searchQuery || selectedCategory !== 'all' || selectedRarity !== 'all'
              ? 'No badges match your filters'
              : 'No badges available'
            }
          </p>
        </motion.div>
      )}

      {/* Badge Detail Modal */}
      <AnimatePresence>
        {selectedBadge && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedBadge(null)}
          >
            <motion.div
              className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-md w-full"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center space-y-4">
                <div className="text-6xl">{selectedBadge.icon}</div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {selectedBadge.name}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {selectedBadge.description}
                  </p>
                  
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className={`px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r ${RARITY_CONFIG[selectedBadge.rarity].color} text-white`}>
                      {RARITY_CONFIG[selectedBadge.rarity].name}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                      <CategoryIcon category={selectedBadge.category} className="h-4 w-4" />
                      <span>{selectedBadge.category}</span>
                    </div>
                  </div>

                  {selectedBadge.earnedDate ? (
                    <div className="text-green-600 dark:text-green-400">
                      <Trophy className="h-5 w-5 inline mr-2" />
                      Earned on {new Date(selectedBadge.earnedDate).toLocaleDateString()}
                    </div>
                  ) : (
                    <div className="text-gray-500 dark:text-gray-400">
                      <Lock className="h-5 w-5 inline mr-2" />
                      {selectedBadge.requirement}
                    </div>
                  )}

                  {selectedBadge.progress !== undefined && selectedBadge.maxProgress && (
                    <div className="mt-4">
                      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <span>Progress</span>
                        <span>{selectedBadge.progress} / {selectedBadge.maxProgress}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                        <div 
                          className={`h-3 rounded-full transition-all duration-300 ${
                            selectedBadge.earnedDate ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${Math.min((selectedBadge.progress / selectedBadge.maxProgress) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setSelectedBadge(null)}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
