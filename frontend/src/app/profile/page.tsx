'use client';

import { useState } from 'react';
import { useProfile } from '../../hooks/useProfile';
import { ProfileEditor } from '../../components/ProfileEditor';
import { AchievementDisplay } from '../../components/AchievementDisplay';
import { CredentialList } from '../../components/CredentialList';
import { ProfileStats } from '../../components/ProfileStats';
import { ProfileHeader } from '../../components/Profile/ProfileHeader';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { SkeletonProfile, ErrorDisplay, EmptyState } from '../../components/LoadingFallback';
import { 
  User, 
  Trophy, 
  Award, 
  BarChart3, 
  Settings, 
  Edit,
  Loader2
} from 'lucide-react';

type ActiveTab = 'overview' | 'achievements' | 'credentials' | 'stats' | 'settings';

export default function ProfilePage() {
  const { 
    profile, 
    achievements, 
    credentials, 
    stats, 
    loading, 
    error, 
    reloadProfile 
  } = useProfile();
  
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [showEditModal, setShowEditModal] = useState(false);

  const tabs = [
    { id: 'overview' as ActiveTab, label: 'Overview', icon: User },
    { id: 'achievements' as ActiveTab, label: 'Achievements', icon: Trophy },
    { id: 'credentials' as ActiveTab, label: 'Credentials', icon: Award },
    { id: 'stats' as ActiveTab, label: 'Statistics', icon: BarChart3 },
    { id: 'settings' as ActiveTab, label: 'Settings', icon: Settings },
  ];

  const handleProfileUpdate = () => {
    setShowEditModal(false);
    reloadProfile();
  };

  if (loading && !profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <SkeletonProfile />
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <ErrorDisplay
          title="Error Loading Profile"
          message={error}
          onRetry={reloadProfile}
          className="max-w-md w-full"
        />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <EmptyState
          icon={<User className="h-8 w-8" />}
          title="No profile found"
          description="Connect your wallet to load your profile."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Edit Profile: bottom sheet on mobile, centered dialog at sm+ */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center sm:items-center p-0 sm:p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
            {/* Drag handle: bottom-sheet affordance on mobile */}
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-slate-600" />
            </div>
            <ProfileEditor
              onClose={() => setShowEditModal(false)}
              onSuccess={handleProfileUpdate}
            />
          </div>
        </div>
      )}

      {/* Profile Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <ProfileHeader user={profile} />
            </div>
            <button
              onClick={() => setShowEditModal(true)}
              className="sm:ml-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 min-h-[44px] w-full sm:w-auto"
            >
              <Edit className="h-4 w-4" />
              Edit Profile
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-1 py-4 border-b-2 transition-colors
                    ${activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <ErrorBoundary>
            <div className="space-y-8">
              {/* Quick Stats */}
              {stats && <ProfileStats stats={stats} compact={true} />}
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Achievements */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Recent Achievements
                  </h3>
                  <ErrorBoundary>
                    <AchievementDisplay 
                      achievements={achievements || []} 
                      compact={true}
                      filterable={false}
                      searchable={false}
                    />
                  </ErrorBoundary>
                </div>
                
                {/* Recent Credentials */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Recent Credentials
                  </h3>
                  <ErrorBoundary>
                    <CredentialList 
                      credentials={(credentials || []).slice(0, 3)}
                      compact={true}
                      filterable={false}
                      searchable={false}
                    />
                  </ErrorBoundary>
                </div>
              </div>
            </div>
          </ErrorBoundary>
        )}

        {/* Achievements Tab */}
        {activeTab === 'achievements' && (
          <ErrorBoundary>
            <AchievementDisplay 
              achievements={achievements || []}
              showProgress={true}
              filterable={true}
              searchable={true}
            />
          </ErrorBoundary>
        )}

        {/* Credentials Tab */}
        {activeTab === 'credentials' && (
          <ErrorBoundary>
            <CredentialList 
              credentials={credentials || []}
              showAddButton={true}
              filterable={true}
              searchable={true}
            />
          </ErrorBoundary>
        )}

        {/* Statistics Tab */}
        {activeTab === 'stats' && (
          <ErrorBoundary>
            {stats && <ProfileStats 
              stats={stats} 
              showRanking={true} 
              showProgress={true}
            />}
          </ErrorBoundary>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <ErrorBoundary>
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                Profile Settings
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Settings panel would be implemented here. This could include privacy settings, 
                notification preferences, account management, etc.
              </p>
            </div>
          </ErrorBoundary>
        )}
      </div>

      {/* Loading Overlay (background refetch) */}
      {loading && profile && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-lg p-4 flex items-center gap-3 shadow-xl">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-sm text-gray-900 dark:text-white">Updating...</span>
          </div>
        </div>
      )}
    </div>
  );
}
