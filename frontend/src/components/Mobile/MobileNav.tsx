'use client';

/**
 * Mobile Navigation Component
 * Touch-friendly navigation optimized for mobile devices
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Menu, 
  X, 
  Home, 
  BookOpen, 
  TrendingUp, 
  Award, 
  Settings, 
  User,
  Search,
  Bell,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface MobileNavProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  notifications?: number;
  userAvatar?: string;
  userName?: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentPath,
  onNavigate,
  notifications = 0,
  userAvatar,
  userName
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('main');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const mainNavItems: NavItem[] = [
    {
      id: 'home',
      label: 'Home',
      icon: <Home className="w-5 h-5" />,
      path: '/'
    },
    {
      id: 'courses',
      label: 'Courses',
      icon: <BookOpen className="w-5 h-5" />,
      path: '/courses'
    },
    {
      id: 'analytics',
      label: 'Progress',
      icon: <TrendingUp className="w-5 h-5" />,
      path: '/analytics'
    },
    {
      id: 'certificates',
      label: 'Certificates',
      icon: <Award className="w-5 h-5" />,
      path: '/certificates'
    }
  ];

  const secondaryNavItems: NavItem[] = [
    {
      id: 'profile',
      label: 'Profile',
      icon: <User className="w-5 h-5" />,
      path: '/profile'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-5 h-5" />,
      path: '/settings'
    }
  ];

  // Handle swipe gestures
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX.current = e.changedTouches[0].clientX;
      handleSwipe();
    };

    const handleSwipe = () => {
      const swipeThreshold = 50;
      const diff = touchStartX.current - touchEndX.current;
      
      if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
          // Swipe left - close menu
          setIsOpen(false);
        } else {
          // Swipe right - open menu
          setIsOpen(true);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('touchstart', handleTouchStart, { passive: true });
      document.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isOpen]);

  // Handle back button
  useEffect(() => {
    const handleBackButton = (e: PopStateEvent) => {
      if (isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    if (isOpen) {
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handleBackButton);
    }

    return () => {
      window.removeEventListener('popstate', handleBackButton);
    };
  }, [isOpen]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleNavItemClick = (item: NavItem) => {
    onNavigate(item.path);
    setIsOpen(false);
    setActiveTab('main');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onNavigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
      setIsOpen(false);
    }
  };

  const currentNavItems = activeTab === 'main' ? mainNavItems : secondaryNavItems;

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-4 z-40 p-3 bg-blue-500 text-white rounded-full shadow-lg md:hidden touch-manipulation"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Search Button */}
      <button
        onClick={() => setSearchOpen(true)}
        className="fixed top-4 right-4 z-40 p-3 bg-gray-100 text-gray-700 rounded-full shadow-lg md:hidden touch-manipulation"
        aria-label="Search"
      >
        <Search className="w-6 h-6" />
      </button>

      {/* Search Overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-start pt-20 px-4">
          <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-xl">
            <form onSubmit={handleSearch} className="p-4">
              <div className="flex items-center gap-3">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search courses, topics..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 touch-manipulation"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Navigation Menu */}
      <div
        className={`fixed inset-0 z-50 md:hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black transition-opacity duration-300 ${
            isOpen ? 'bg-opacity-50' : 'bg-opacity-0'
          }`}
          onClick={() => setIsOpen(false)}
        />

        {/* Menu Panel */}
        <div
          className={`absolute left-0 top-0 h-full w-80 max-w-full bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Header */}
          <div className="bg-blue-500 text-white p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">AetherMint</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-blue-600 rounded-lg transition-colors touch-manipulation"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Profile */}
            {userName && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt={userName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{userName}</p>
                  <p className="text-sm text-blue-100">Student</p>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('main')}
              className={`flex-1 py-3 text-sm font-medium transition-colors touch-manipulation ${
                activeTab === 'main'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Main
            </button>
            <button
              onClick={() => setActiveTab('secondary')}
              className={`flex-1 py-3 text-sm font-medium transition-colors touch-manipulation ${
                activeTab === 'secondary'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Account
            </button>
          </div>

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto">
            <nav className="p-4 space-y-2">
              {currentNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavItemClick(item)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors touch-manipulation ${
                    currentPath === item.path
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {item.icon}
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Version 1.0.0</span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-blue-600 hover:text-blue-700 font-medium touch-manipulation"
              >
                Close
              </button>
            </div>
          </div>
        </div>

        {/* Swipe Indicator */}
        {isOpen && (
          <div className="absolute left-80 top-1/2 transform -translate-y-1/2 -translate-x-2">
            <ChevronLeft className="w-6 h-6 text-gray-400 animate-pulse" />
          </div>
        )}
      </div>

      {/* Bottom Navigation for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden">
        <nav className="flex items-center justify-around py-2">
          {mainNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavItemClick(item)}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors touch-manipulation ${
                currentPath === item.path
                  ? 'text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {item.icon}
              <span className="text-xs">{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Notification Badge on Menu Button */}
      {notifications > 0 && (
        <div className="fixed top-3 left-3 z-40 w-2 h-2 bg-red-500 rounded-full md:hidden" />
      )}
    </>
  );
};
