'use client';

import { useState } from 'react';
import { ProfileEditor } from '../../components/ProfileEditor';
import { AchievementDisplay } from '../../components/AchievementDisplay';
import { CredentialList } from '../../components/CredentialList';
import { ProfileStats } from '../../components/ProfileStats';
import { useProfile } from '../../hooks/useProfile';
import { ErrorDisplay, SkeletonCard, SkeletonList } from '../../components/LoadingFallback';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { 
  User, 
  Trophy, 
  Award, 
  BarChart3, 
  Play,
  Code,
  Eye,
  ArrowRight
} from 'lucide-react';

export default function DemoPage() {
  const { profile, achievements, credentials, stats, loading, error, reloadProfile } = useProfile();
  const [activeDemo, setActiveDemo] = useState<'overview' | 'editor' | 'achievements' | 'credentials' | 'stats'>('overview');
  const [showEditor, setShowEditor] = useState(false);

  const demos = [
    {
      id: 'overview',
      title: 'System Overview',
      description: 'See all profile components in action',
      icon: User,
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'editor',
      title: 'Profile Editor',
      description: 'Test the profile editing interface',
      icon: Code,
      color: 'from-green-500 to-green-600'
    },
    {
      id: 'achievements',
      title: 'Achievement System',
      description: 'Explore achievements and progress',
      icon: Trophy,
      color: 'from-purple-500 to-purple-600'
    },
    {
      id: 'credentials',
      title: 'Credential Management',
      description: 'View and manage credentials',
      icon: Award,
      color: 'from-orange-500 to-orange-600'
    },
    {
      id: 'stats',
      title: 'Statistics Dashboard',
      description: 'Check out analytics and progress',
      icon: BarChart3,
      color: 'from-indigo-500 to-indigo-600'
    }
  ];

  const renderDemoContent = () => {
    switch (activeDemo) {
      case 'overview':
        return (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Profile Management Dashboard Demo
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                This demo showcases all the components of the Profile Management Dashboard system. 
                Each component is fully functional with mock data and state management.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                    {profile?.totalCoursesCompleted || 0}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Courses Completed</div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                    {achievements.filter(a => a.earnedDate).length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Achievements Earned</div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                    {credentials.filter(c => c.verificationStatus === 'verified').length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Verified Credentials</div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 mb-1">
                    {profile?.currentStreak || 0}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Day Streak</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Recent Achievements
                </h4>
                <AchievementDisplay 
                  achievements={achievements.slice(0, 4)} 
                  compact={true}
                  filterable={false}
                  searchable={false}
                />
              </div>
              
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Recent Credentials
                </h4>
                <CredentialList 
                  credentials={credentials.slice(0, 3)}
                  compact={true}
                  filterable={false}
                  searchable={false}
                />
              </div>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Quick Stats
              </h4>
              <ProfileStats stats={stats!} compact={true} />
            </div>
          </div>
        );

      case 'editor':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Profile Editor Demo
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Test the profile editing interface with form validation, avatar upload, and privacy settings.
              </p>
              <button
                onClick={() => setShowEditor(true)}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                Open Profile Editor
              </button>
            </div>
            
            {showEditor && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white dark:bg-slate-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <ProfileEditor
                    onClose={() => setShowEditor(false)}
                    onSuccess={() => {
                      setShowEditor(false);
                      alert('Profile updated successfully!');
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        );

      case 'achievements':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Achievement System Demo
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Explore the achievement system with rarity levels, progress tracking, and filtering capabilities.
              </p>
            </div>
            <AchievementDisplay 
              achievements={achievements}
              showProgress={true}
              filterable={true}
              searchable={true}
            />
          </div>
        );

      case 'credentials':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg p-6 border border-orange-200 dark:border-orange-800">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Credential Management Demo
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Manage credentials with verification status, skills tagging, and document management.
              </p>
            </div>
            <CredentialList 
              credentials={credentials}
              showAddButton={true}
              filterable={true}
              searchable={true}
            />
          </div>
        );

      case 'stats':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-lg p-6 border border-indigo-200 dark:border-indigo-800">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Statistics Dashboard Demo
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                View comprehensive statistics, progress tracking, and performance analytics.
              </p>
            </div>
            <ProfileStats 
              stats={stats!} 
              showRanking={true} 
              showProgress={true}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Profile Management Dashboard
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            A comprehensive profile management system for the AetherMint Education platform
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <ErrorDisplay
            message={error}
            onRetry={reloadProfile}
            className="mb-8"
          />
        )}

        {/* Demo Selection */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6 text-center">
            Choose a Demo
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {demos.map((demo) => {
              const Icon = demo.icon;
              return (
                <button
                  key={demo.id}
                  onClick={() => setActiveDemo(demo.id as any)}
                  className={`
                    relative p-6 rounded-lg border-2 transition-all duration-200
                    ${activeDemo === demo.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg'
                      : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600'
                    }
                  `}
                >
                  <div className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${demo.color} text-white mb-4`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    {demo.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {demo.description}
                  </p>
                  {activeDemo === demo.id && (
                    <div className="absolute top-2 right-2">
                      <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Demo Content */}
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-8">
          {loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="h-24 !p-0" />)}
              </div>
              <SkeletonList rows={3} />
            </div>
          ) : (
            <ErrorBoundary>
              {renderDemoContent()}
            </ErrorBoundary>
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Ready to explore the full profile system?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Check out the complete implementation at <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">/profile</code>
            </p>
            <a
              href="/profile"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              View Full Profile
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
