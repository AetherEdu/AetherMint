import React from 'react';
import {
  Bell,
  BookOpen,
  Clock,
  MessageSquare,
  Settings,
  Trophy,
  X,
} from 'lucide-react';

import { Notification } from '../../hooks/useNotifications';

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

  const handleActivate = () => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id);
    }

    if (notification.actionUrl) {
      window.open(notification.actionUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleRemove = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onRemove(notification.id);
  };

  return (
    <article
      className={`relative border-l-4 p-4 transition-all duration-200 ${priorityColor} ${
        notification.isRead
          ? 'bg-white hover:bg-gray-50'
          : 'border-l-blue-500 bg-blue-50 hover:bg-blue-100'
      }`}
      aria-label={`${notification.isRead ? 'Read' : 'Unread'} ${notification.priority} priority ${notification.category} notification`}
    >
      <button
        type="button"
        onClick={handleRemove}
        tabIndex={0}
        className="absolute right-2 top-2 rounded-full p-1 transition-colors hover:bg-gray-200"
        aria-label={`Remove notification: ${notification.title}`}
      >
        <X size={14} className="text-gray-500" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={handleActivate}
        tabIndex={0}
        className="flex w-full gap-3 pr-8 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        aria-describedby={`notification-${notification.id}-meta notification-${notification.id}-message`}
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${categoryColor}`}
          aria-hidden="true"
        >
          <Icon size={18} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h4
                className={`truncate text-gray-900 ${
                  notification.isRead ? 'font-normal' : 'font-semibold'
                }`}
              >
                {notification.title}
              </h4>
              <p
                id={`notification-${notification.id}-message`}
                className="mt-1 line-clamp-2 text-sm text-gray-600"
              >
                {notification.message}
              </p>
            </div>
          </div>

          <div
            id={`notification-${notification.id}-meta`}
            className="mt-2 flex items-center justify-between"
          >
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Clock size={12} aria-hidden="true" />
                <span>{formatTimestamp(notification.timestamp)}</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryColor}`}>
                {notification.category}
              </span>
            </div>

            {!notification.isRead && (
              <span className="h-2 w-2 rounded-full bg-blue-500" aria-label="Unread notification" />
            )}
          </div>
        </div>
      </button>

      {notification.priority === 'high' && (
        <span className="absolute left-2 top-2 h-2 w-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
      )}
    </article>
  );
};

export default NotificationItem;
