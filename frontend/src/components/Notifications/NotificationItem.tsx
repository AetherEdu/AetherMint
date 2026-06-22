import React from 'react';
import { Bell, BookOpen, MessageSquare, Settings, Trophy, X, Clock } from 'lucide-react';
import { Notification, NotificationCategory } from '../../hooks/useNotifications';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onRemove: (id: string) => void;
}

const categoryIcons = {
  course: BookOpen,
  message: MessageSquare,
  system: Settings,
  achievement: Trophy,
};

const categoryColors = {
  course: 'bg-blue-100 text-blue-800 border-blue-200',
  message: 'bg-green-100 text-green-800 border-green-200',
  system: 'bg-gray-100 text-gray-800 border-gray-200',
  achievement: 'bg-yellow-100 text-yellow-800 border-yellow-200',
};

const priorityColors = {
  low: 'border-gray-200',
  medium: 'border-orange-300',
  high: 'border-red-300',
};

const formatTimestamp = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
  onRemove,
}) => {
  const Icon = categoryIcons[notification.category];
  const categoryColor = categoryColors[notification.category];
  const priorityColor = priorityColors[notification.priority];

  const handleClick = () => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id);
    }
    if (notification.actionUrl) {
      window.open(notification.actionUrl, '_blank');
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(notification.id);
  };

  return (
    <div
      className={`
        relative p-4 border-l-4 cursor-pointer transition-all duration-200
        ${priorityColor}
        ${notification.isRead 
          ? 'bg-white hover:bg-gray-50' 
          : 'bg-blue-50 hover:bg-blue-100 border-l-blue-500'
        }
      `}
      role="listitem"
    >
      {/* Remove button */}
      <button
        onClick={handleRemove}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-200 transition-colors"
        aria-label="Remove notification"
      >
        <X size={14} className="text-gray-500" />
      </button>

      {/* Notification content */}
      <div
        className="flex gap-3"
        role="button"
        tabIndex={0}
        aria-label={`${notification.isRead ? 'Read' : 'Unread'} ${notification.priority} priority ${notification.category} notification: ${notification.title}`}
        onClick={handleClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleClick();
          }
        }}
      >
        {/* Category icon */}
        <div className={`
          flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
          ${categoryColor}
        `}>
          <Icon size={18} aria-hidden="true" />
        </div>

        {/* Message content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h4 className={`
                font-medium text-gray-900 truncate
                ${notification.isRead ? 'font-normal' : 'font-semibold'}
              `}>
                {notification.title}
              </h4>
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                {notification.message}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Clock size={12} aria-hidden="true" />
                <span>{formatTimestamp(notification.timestamp)}</span>
              </div>
              <span className={`
                px-2 py-0.5 rounded-full text-xs font-medium
                ${categoryColor}
              `}>
                {notification.category}
              </span>
            </div>
            
            {!notification.isRead && (
              <div className="w-2 h-2 bg-blue-500 rounded-full" aria-label="Unread"></div>
            )}
          </div>
        </div>
      </div>

      {/* Priority indicator for high priority */}
      {notification.priority === 'high' && (
        <div className="absolute top-2 left-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" aria-label="High priority"></div>
        </div>
      )}
    </div>
  );
};

export default NotificationItem;
