import React, { useEffect, useRef } from 'react';
import { Bell, BellRing, Filter, Check, CheckCheck, Trash2, Settings, X } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import NotificationItem from './NotificationItem';
import PreferencesPanel from './PreferencesPanel';

const NotificationCenter: React.FC = () => {
  const {
    notifications,
    unreadCount,
    preferences,
    isOpen,
    selectedCategory,
    setIsOpen,
    setSelectedCategory,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAllNotifications,
    updatePreferences,
  } = useNotifications();

  const dropdownRef = useRef<HTMLDivElement>(null);
  const focusTrapRef = useFocusTrap(isOpen, {
    onEscape: () => setIsOpen(false),
    initialFocusSelector: '[data-notification-close]',
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setIsOpen]);

  const categories = [
    { value: 'all', label: 'All', color: 'bg-gray-100 text-gray-800' },
    { value: 'course', label: 'Courses', color: 'bg-blue-100 text-blue-800' },
    { value: 'message', label: 'Messages', color: 'bg-green-100 text-green-800' },
    { value: 'system', label: 'System', color: 'bg-gray-100 text-gray-800' },
    { value: 'achievement', label: 'Achievements', color: 'bg-yellow-100 text-yellow-800' },
  ];

  const [showPreferences, setShowPreferences] = React.useState(false);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-controls="notification-center-panel"
        aria-expanded={isOpen}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      >
        {unreadCount > 0 ? (
          <BellRing size={20} className="text-blue-600" />
        ) : (
          <Bell size={20} className="text-gray-600" />
        )}
        
        {/* Unread count badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        <span className="sr-only" aria-live="polite">
          {unreadCount} unread notifications
        </span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          id="notification-center-panel"
          className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[600px] overflow-hidden"
          role="dialog"
          aria-modal="false"
          aria-labelledby="notification-center-title"
          ref={focusTrapRef}
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 id="notification-center-title" className="text-lg font-semibold text-gray-900">Notifications</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                aria-label="Close notifications"
                data-notification-close
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2 mb-3">
              <Filter size={16} className="text-gray-500" />
              <div className="flex gap-1 flex-wrap">
                {categories.map((category) => (
                  <button
                    key={category.value}
                    onClick={() => setSelectedCategory(category.value as any)}
                    aria-pressed={selectedCategory === category.value}
                    className={`
                      px-3 py-1 rounded-full text-xs font-medium transition-colors
                      ${selectedCategory === category.value
                        ? category.color
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }
                    `}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    aria-label="Mark all notifications as read"
                  >
                    <CheckCheck size={14} />
                    Mark all read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAllNotifications}
                    className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    aria-label="Clear all notifications"
                  >
                    <Trash2 size={14} />
                    Clear all
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowPreferences(!showPreferences)}
                aria-expanded={showPreferences}
                aria-controls="notification-preferences-panel"
                className={`
                  flex items-center gap-1 px-3 py-1 text-sm rounded-md transition-colors
                  ${showPreferences
                    ? 'bg-blue-100 text-blue-800'
                    : 'text-gray-600 hover:bg-gray-100'
                  }
                `}
              >
                <Settings size={14} />
                Preferences
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="overflow-y-auto" style={{ maxHeight: '400px' }}>
            {showPreferences ? (
              <PreferencesPanel
                preferences={preferences}
                onUpdatePreferences={updatePreferences}
              />
            ) : (
              <>
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Bell size={24} className="text-gray-400" />
                    </div>
                    <h4 className="text-gray-900 font-medium mb-1">No notifications</h4>
                    <p className="text-gray-500 text-sm">
                      {selectedCategory === 'all' 
                        ? "You're all caught up!" 
                        : `No ${selectedCategory} notifications`}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100" role="list" aria-label="Notifications">
                    {notifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onMarkAsRead={markAsRead}
                        onRemove={removeNotification}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {!showPreferences && notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  {unreadCount} unread of {notifications.length} total
                </span>
                <span>
                  {selectedCategory === 'all' ? 'All categories' : `${selectedCategory} only`}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
