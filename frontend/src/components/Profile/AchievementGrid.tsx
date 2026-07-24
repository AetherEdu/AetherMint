import { useState, useEffect } from "react";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedDate?: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  requirement: string;
}

interface AchievementGridProps {
  achievements: Achievement[];
  newAchievements?: string[];
}

const rarityColors: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  common: {
    bg: "bg-gray-100 dark:bg-gray-800",
    border: "border-gray-300 dark:border-gray-600",
    text: "text-gray-700 dark:text-gray-300",
  },
  rare: {
    bg: "bg-blue-50 dark:bg-blue-900/30",
    border: "border-blue-300 dark:border-blue-600",
    text: "text-blue-700 dark:text-blue-300",
  },
  epic: {
    bg: "bg-purple-50 dark:bg-purple-900/30",
    border: "border-purple-300 dark:border-purple-600",
    text: "text-purple-700 dark:text-purple-300",
  },
  legendary: {
    bg: "bg-amber-50 dark:bg-amber-900/30",
    border: "border-amber-300 dark:border-amber-600",
    text: "text-amber-700 dark:text-amber-300",
  },
};

export function AchievementGrid({
  achievements,
  newAchievements = [],
}: AchievementGridProps) {
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(
    new Set(newAchievements),
  );

  useEffect(() => {
    if (newAchievements.length > 0) {
      setAnimatingIds(new Set(newAchievements));
      const timer = setTimeout(() => {
        setAnimatingIds(new Set());
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [newAchievements]);

  const earnedAchievements = achievements.filter((a) => a.earnedDate);
  const lockedAchievements = achievements.filter((a) => !a.earnedDate);

  return (
    <div className="w-full space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-2 xs:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/40 dark:to-blue-900/20 rounded-lg p-3 sm:p-4 border border-blue-200 dark:border-blue-700">
          <div className="text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-300 mb-1">
            Total Earned
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-blue-700 dark:text-blue-200">
            {earnedAchievements.length}
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/40 dark:to-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
          <div className="text-sm font-medium text-purple-600 dark:text-purple-300 mb-1">
            Locked
          </div>
          <div className="text-3xl font-bold text-purple-700 dark:text-purple-200">
            {lockedAchievements.length}
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/40 dark:to-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-700">
          <div className="text-sm font-medium text-amber-600 dark:text-amber-300 mb-1">
            Completion
          </div>
          <div className="text-3xl font-bold text-amber-700 dark:text-amber-200">
            {Math.round(
              (earnedAchievements.length / achievements.length) * 100,
            )}
            %
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/40 dark:to-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-700">
          <div className="text-sm font-medium text-green-600 dark:text-green-300 mb-1">
            Rarest
          </div>
          <div className="text-sm font-bold text-green-700 dark:text-green-200">
            {achievements.filter(
              (a) => a.rarity === "legendary" && a.earnedDate,
            ).length > 0
              ? "Legendary"
              : "N/A"}
          </div>
        </div>
      </div>

      {/* Earned Achievements */}
      {earnedAchievements.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">
            Earned Achievements ({earnedAchievements.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {earnedAchievements.map((achievement) => {
              const colors = rarityColors[achievement.rarity];
              const isAnimating = animatingIds.has(achievement.id);

              return (
                <div
                  key={achievement.id}
                  className={`
                    relative rounded-lg p-6 border-2 cursor-pointer transition-all duration-300
                    ${colors.bg} ${colors.border} ${colors.text}
                    ${isAnimating ? "scale-110 shadow-2xl animate-bounce" : "hover:scale-105 shadow-md"}
                  `}
                >
                  {isAnimating && (
                    <div className="absolute inset-0 rounded-lg animate-pulse bg-yellow-400/20 pointer-events-none" />
                  )}

                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="text-5xl">{achievement.icon}</div>
                    <div>
                      <h4 className="font-bold text-sm">{achievement.name}</h4>
                      <p className="text-xs opacity-75 mt-1">
                        {achievement.description}
                      </p>
                    </div>

                    {achievement.earnedDate && (
                      <div className="text-xs opacity-60 border-t border-current w-full pt-2 mt-2">
                        Earned{" "}
                        {new Date(achievement.earnedDate).toLocaleDateString()}
                      </div>
                    )}

                    {/* Rarity Badge */}
                    <div className="inline-block px-2 py-1 bg-black/10 dark:bg-white/10 rounded text-xs font-medium mt-2 capitalize">
                      {achievement.rarity}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Locked Achievements */}
      {lockedAchievements.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">
            Locked Achievements ({lockedAchievements.length})
          </h3>
          <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {lockedAchievements.map((achievement) => (
              <div
                key={achievement.id}
                className="relative rounded-lg p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-slate-800/30 opacity-60 transition-all duration-300 hover:opacity-80 cursor-pointer group"
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="text-5xl opacity-40">🔒</div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-600 dark:text-gray-300">
                      {achievement.name}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {achievement.description}
                    </p>
                  </div>

                  {/* Requirement Tooltip */}
                  <div className="text-xs bg-gray-800 dark:bg-gray-900 text-white rounded px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-2 whitespace-nowrap">
                    {achievement.requirement}
                  </div>

                  <div className="inline-block px-2 py-1 bg-black/10 dark:bg-white/10 rounded text-xs font-medium mt-2 capitalize">
                    {achievement.rarity}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {achievements.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎯</div>
          <p className="text-gray-600 dark:text-gray-400">
            No achievements yet. Start learning to unlock achievements!
          </p>
        </div>
      )}
    </div>
  );
}
