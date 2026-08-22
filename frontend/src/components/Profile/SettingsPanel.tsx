"use client";

import { useState, useEffect } from "react";

export interface Settings {
  emailNotifications: boolean;
  weeklyDigest: boolean;
  achievementAlerts: boolean;
  darkMode: boolean;
  language: string;
  privacy: "public" | "private" | "friends-only";
  twoFactorEnabled: boolean;
  newsletter: boolean;
}

interface SettingsPanelProps {
  initialSettings?: Settings;
  onSettingsChange?: (settings: Settings) => void;
}

const DEFAULT_SETTINGS: Settings = {
  emailNotifications: true,
  weeklyDigest: true,
  achievementAlerts: true,
  darkMode: false,
  language: "en",
  privacy: "public",
  twoFactorEnabled: false,
  newsletter: true,
};

export function SettingsPanel({
  initialSettings = DEFAULT_SETTINGS,
  onSettingsChange,
}: SettingsPanelProps) {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    // Load settings from localStorage on mount
    const saved = localStorage.getItem("userSettings");
    if (saved) {
      const parsedSettings = JSON.parse(saved);
      setSettings(parsedSettings);
    }
  }, []);

  const handleToggle = (key: keyof Settings) => {
    const newSettings = {
      ...settings,
      [key]: !settings[key],
    };
    setSettings(newSettings);
    setHasChanges(true);
    setSaveSuccess(false);
  };

  const handleSelectChange = (key: keyof Settings, value: any) => {
    const newSettings = {
      ...settings,
      [key]: value,
    };
    setSettings(newSettings);
    setHasChanges(true);
    setSaveSuccess(false);
  };

  const handleSave = () => {
    localStorage.setItem("userSettings", JSON.stringify(settings));
    setHasChanges(false);
    setSaveSuccess(true);
    onSettingsChange?.(settings);

    // Hide success message after 3 seconds
    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setHasChanges(true);
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Settings
        </h2>
        {saveSuccess && (
          <div className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-2 animate-pulse">
            ✓ Settings saved successfully
          </div>
        )}
      </div>

      {/* Notification Settings */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Notification Preferences
        </h3>
        <div className="space-y-4">
          <SettingToggle
            label="Email Notifications"
            description="Receive email notifications about your learning activities"
            checked={settings.emailNotifications}
            onChange={() => handleToggle("emailNotifications")}
          />
          <SettingToggle
            label="Weekly Digest"
            description="Get a weekly summary of your learning progress"
            checked={settings.weeklyDigest}
            onChange={() => handleToggle("weeklyDigest")}
          />
          <SettingToggle
            label="Achievement Alerts"
            description="Receive notifications when you earn new achievements"
            checked={settings.achievementAlerts}
            onChange={() => handleToggle("achievementAlerts")}
          />
          <SettingToggle
            label="Newsletter"
            description="Subscribe to our newsletter for tips and updates"
            checked={settings.newsletter}
            onChange={() => handleToggle("newsletter")}
          />
        </div>
      </div>

      {/* Appearance Settings */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Appearance
        </h3>
        <div className="space-y-4">
          <SettingToggle
            label="Dark Mode"
            description="Enable dark theme for the application"
            checked={settings.darkMode}
            onChange={() => handleToggle("darkMode")}
          />

          <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Language
            </label>
            <select
              value={settings.language}
              onChange={(e) => handleSelectChange("language", e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="ja">日本語</option>
            </select>
          </div>
        </div>
      </div>

      {/* Privacy & Security */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Privacy & Security
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Profile Privacy
            </label>
            <select
              value={settings.privacy}
              onChange={(e) =>
                handleSelectChange("privacy", e.target.value as any)
              }
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              <option value="public">
                Public - Anyone can view your profile
              </option>
              <option value="friends-only">
                Friends Only - Only friends can view
              </option>
              <option value="private">
                Private - Only you can view your profile
              </option>
            </select>
          </div>

          <SettingToggle
            label="Two-Factor Authentication"
            description="Add an extra layer of security to your account"
            checked={settings.twoFactorEnabled}
            onChange={() => handleToggle("twoFactorEnabled")}
          />
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-900 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-red-900 dark:text-red-300 mb-6">
          Danger Zone
        </h3>
        <div className="space-y-3">
          <button className="w-full px-4 py-2 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors font-medium">
            Reset All Data
          </button>
          <button className="w-full px-4 py-2 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors font-medium">
            Delete Account
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={handleReset}
          className="px-6 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
        >
          Reset to Default
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}

interface SettingToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
}

const SettingToggle: React.FC<SettingToggleProps> = ({
  label,
  description,
  checked,
  onChange,
}) => {
  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-900 dark:text-white cursor-pointer">
          {label}
        </label>
        {description && (
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {description}
          </p>
        )}
      </div>
      <button
        onClick={onChange}
        className={`
          relative inline-flex h-7 w-12 flex-shrink-0 rounded-full border-2 border-transparent
          cursor-pointer transition-colors duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2
          ${checked ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"}
        `}
        role="switch"
        aria-checked={checked}
        style={{ minHeight: '44px', minWidth: '44px', padding: '8px' }}
      >
        <span
          aria-hidden="true"
          className={`
            pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow
            transform transition duration-200 ease-in-out
            ${checked ? "translate-x-4" : "translate-x-0"}
            my-auto
          `}
        />
      </button>
    </div>
  );
};
