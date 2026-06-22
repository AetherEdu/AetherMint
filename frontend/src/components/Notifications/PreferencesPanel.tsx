import React from 'react';
import { Bell, BellOff, Volume2, Monitor, Clock, Settings } from 'lucide-react';
import { NotificationPreferences, NotificationCategory } from '../../hooks/useNotifications';

interface PreferencesPanelProps {
  preferences: NotificationPreferences;
  onUpdatePreferences: (preferences: Partial<NotificationPreferences>) => void;
}

const categoryLabels = {
  course: 'Course Updates',
  message: 'Messages',
  system: 'System Alerts',
  achievement: 'Achievements',
};

const categoryDescriptions = {
  course: 'Notifications about course materials, assignments, and updates',
  message: 'Direct messages and communication from instructors and peers',
  system: 'Platform maintenance, updates, and important system notifications',
  achievement: 'Milestones, badges, and learning accomplishments',
};

const PreferencesPanel: React.FC<PreferencesPanelProps> = ({
  preferences,
  onUpdatePreferences,
}) => {
  const handleCategoryToggle = (category: NotificationCategory, setting: 'enabled' | 'sound' | 'desktop') => {
    onUpdatePreferences({
      categories: {
        ...preferences.categories,
        [category]: {
          ...preferences.categories[category],
          [setting]: !preferences.categories[category][setting],
        },
      },
    });
  };

  const handleQuietHoursToggle = () => {
    onUpdatePreferences({
      quietHours: {
        ...preferences.quietHours,
        enabled: !preferences.quietHours.enabled,
      },
    });
  };

  const handleQuietHoursChange = (field: 'start' | 'end', value: string) => {
    onUpdatePreferences({
      quietHours: {
        ...preferences.quietHours,
        [field]: value,
      },
    });
  };

  return (
    <div id="notification-preferences-panel" className="p-6 bg-white" aria-labelledby="notification-preferences-title">
      <div className="flex items-center gap-2 mb-6">
        <Settings size={20} className="text-gray-700" />
        <h3 id="notification-preferences-title" className="text-lg font-semibold text-gray-900">Notification Preferences</h3>
      </div>

      {/* Category Settings */}
      <div className="space-y-6">
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-4">Notification Categories</h4>
          <div className="space-y-4">
            {(Object.keys(categoryLabels) as NotificationCategory[]).map((category) => (
              <div key={category} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900">{categoryLabels[category]}</h5>
                    <p className="text-sm text-gray-500 mt-1">{categoryDescriptions[category]}</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  {/* Enable/Disable */}
                  <button
                    onClick={() => handleCategoryToggle(category, 'enabled')}
                    aria-pressed={preferences.categories[category].enabled}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
                      ${preferences.categories[category].enabled
                        ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }
                    `}
                  >
                    {preferences.categories[category].enabled ? (
                      <Bell size={16} />
                    ) : (
                      <BellOff size={16} />
                    )}
                    {preferences.categories[category].enabled ? 'Enabled' : 'Disabled'}
                  </button>

                  {/* Sound */}
                  <button
                    onClick={() => handleCategoryToggle(category, 'sound')}
                    disabled={!preferences.categories[category].enabled}
                    aria-pressed={preferences.categories[category].sound && preferences.categories[category].enabled}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
                      ${preferences.categories[category].sound && preferences.categories[category].enabled
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }
                    `}
                  >
                    <Volume2 size={16} />
                    Sound
                  </button>

                  {/* Desktop */}
                  <button
                    onClick={() => handleCategoryToggle(category, 'desktop')}
                    disabled={!preferences.categories[category].enabled}
                    aria-pressed={preferences.categories[category].desktop && preferences.categories[category].enabled}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
                      ${preferences.categories[category].desktop && preferences.categories[category].enabled
                        ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }
                    `}
                  >
                    <Monitor size={16} />
                    Desktop
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quiet Hours */}
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Quiet Hours</h4>
              <p className="text-sm text-gray-500 mt-1">
                Temporarily pause notifications during specific hours
              </p>
            </div>
            <button
              onClick={handleQuietHoursToggle}
              role="switch"
              aria-checked={preferences.quietHours.enabled}
              aria-label="Toggle quiet hours"
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                ${preferences.quietHours.enabled ? 'bg-blue-600' : 'bg-gray-200'}
              `}
            >
              <span
                className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                  ${preferences.quietHours.enabled ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
          </div>

          {preferences.quietHours.enabled && (
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <Clock size={18} className="text-gray-600" />
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-700">From:</label>
                <input
                  aria-label="Quiet hours start time"
                  type="time"
                  value={preferences.quietHours.start}
                  onChange={(e) => handleQuietHoursChange('start', e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <label className="text-sm text-gray-700">To:</label>
                <input
                  aria-label="Quiet hours end time"
                  type="time"
                  value={preferences.quietHours.end}
                  onChange={(e) => handleQuietHoursChange('end', e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreferencesPanel;
