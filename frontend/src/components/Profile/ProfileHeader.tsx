'use client';

import { useState } from 'react';
import { SkeletonProfile } from '../LoadingFallback';

export interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
  joinDate: string;
  totalCoursesCompleted: number;
  currentStreak: number;
}

interface ProfileHeaderProps {
  user?: UserProfile;
  loading?: boolean;
}

export function ProfileHeader({ user, loading = false }: ProfileHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(user?.name ?? '');

  if (loading || !user) {
    return <SkeletonProfile className="mb-8" />;
  }

  const handleSave = () => {
    setIsEditing(false);
    localStorage.setItem('userProfile', JSON.stringify({ ...user, name: editedName }));
  };

  return (
    <div className="w-full bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-4 sm:p-6 md:p-8 mb-6 sm:mb-8 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex flex-col xs:flex-row items-center xs:items-start gap-4 sm:gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/20 border-4 border-white flex items-center justify-center shadow-lg flex-shrink-0">
            {user.avatar ? (
              <img src={user.avatar} srcSet={`${user.avatar}?w=96 96w, ${user.avatar}?w=192 192w`} sizes="96px" alt={user.name} className="w-full h-full rounded-full object-cover" loading="lazy" />
            ) : (
              <span className="text-3xl sm:text-4xl font-bold text-white">{user.name.charAt(0).toUpperCase()}</span>
            )}
          </div>

          {/* User Info */}
          <div className="text-white text-center xs:text-left">
            <div className="flex items-center justify-center xs:justify-start gap-2 mb-2">
              {isEditing ? (
                <input
                  type="text"
                  value={editedName}
                  onChange={e => setEditedName(e.target.value)}
                  className="bg-white/20 border border-white/30 rounded px-3 py-1 text-white placeholder-white/50 text-2xl font-bold"
                  onBlur={handleSave}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  autoFocus
                />
              ) : (
                <>
                  <h1 className="text-2xl sm:text-3xl font-bold">{editedName || user.name}</h1>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-white/70 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center touch-target"
                    aria-label="Edit name"
                  >
                    ✎
                  </button>
                </>
              )}
            </div>
            <p className="text-white/80 mb-4">{user.email}</p>

            <div className="flex gap-4 sm:gap-8 justify-center xs:justify-start flex-wrap">
              <div>
                <div className="text-sm text-white/70">Courses Completed</div>
                <div className="text-2xl font-bold">{user.totalCoursesCompleted}</div>
              </div>
              <div>
                <div className="text-sm text-white/70">Current Streak</div>
                <div className="text-2xl font-bold">{user.currentStreak} days</div>
              </div>
              <div>
                <div className="text-sm text-white/70">Member Since</div>
                <div className="text-lg font-semibold">{user.joinDate}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
