'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  FileText,
  Shield,
  Settings,
  BarChart3,
  Database,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface SidebarItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  children?: SidebarItem[];
}

const sidebarItems: SidebarItem[] = [
  {
    title: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard
  },
  {
    title: 'User Management',
    href: '/admin/users',
    icon: Users,
    children: [
      { title: 'All Users', href: '/admin/users', icon: Users },
      { title: 'Roles & Permissions', href: '/admin/users/roles', icon: Shield },
      { title: 'User Activity', href: '/admin/users/activity', icon: BarChart3 }
    ]
  },
  {
    title: 'Content Management',
    href: '/admin/content',
    icon: BookOpen,
    children: [
      { title: 'Courses', href: '/admin/content/courses', icon: BookOpen },
      { title: 'Quizzes', href: '/admin/content/quizzes', icon: FileText },
      { title: 'Moderation', href: '/admin/content/moderation', icon: Shield }
    ]
  },
  {
    title: 'Analytics',
    href: '/admin/analytics',
    icon: BarChart3,
    children: [
      { title: 'Overview', href: '/admin/analytics', icon: BarChart3 },
      { title: 'User Analytics', href: '/admin/analytics/users', icon: Users },
      { title: 'Course Analytics', href: '/admin/analytics/courses', icon: BookOpen },
      { title: 'System Performance', href: '/admin/analytics/system', icon: Database }
    ]
  },
  {
    title: 'Platform Operations',
    href: '/admin/operations',
    icon: Settings,
    children: [
      { title: 'System Settings', href: '/admin/operations/settings', icon: Settings },
      { title: 'Backup & Restore', href: '/admin/operations/backup', icon: Database },
      { title: 'Security', href: '/admin/operations/security', icon: Shield },
      { title: 'Announcements', href: '/admin/operations/announcements', icon: Bell }
    ]
  }
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpanded = (title: string) => {
    setExpandedItems(prev =>
      prev.includes(title)
        ? prev.filter(item => item !== title)
        : [...prev, title]
    );
  };

  const isActive = (href: string) => pathname === href;

  const renderSidebarItem = (item: SidebarItem, level = 0) => {
    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.title);
    const active = isActive(item.href);

    return (
      <div key={item.title} className="w-full">
        <div            className={`
            flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}
            ${isCollapsed && level === 0 ? 'justify-center' : ''}
          `}
          onClick={() => hasChildren && toggleExpanded(item.title)}
          role="button"
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-current={active ? 'page' : undefined}
          tabIndex={0}
        >
          <div className="flex items-center gap-3">
            <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            {!isCollapsed && (
              <span className="font-medium">{item.title}</span>
            )}
          </div>
          {!isCollapsed && hasChildren && (
            isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          )}
          {!isCollapsed && item.badge && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {item.badge}
            </span>
          )}
        </div>
        
        {hasChildren && !isCollapsed && isExpanded && (
          <div className="ml-4 mt-1 space-y-1">
            {item.children!.map(child => renderSidebarItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`
      bg-white border-r border-gray-200 h-screen sticky top-0 flex flex-col
      transition-all duration-300
      ${isCollapsed ? 'w-16' : 'w-64'}
    `}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <h1 id="admin-sidebar-title" className="text-xl font-bold text-gray-800">Admin Panel</h1>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? <Menu className="w-5 h-5" aria-hidden="true" /> : <X className="w-5 h-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto" aria-labelledby="admin-sidebar-title">
        <ul role="list" className="space-y-2">
          {sidebarItems.map(item => (
            <li key={item.title} role="listitem">
              {renderSidebarItem(item)}
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200" role="contentinfo" aria-label="Sidebar footer">
        <Link
          href="/"
          className={`
            flex items-center gap-3 px-3 py-2 text-sm text-gray-700 rounded-lg 
            hover:bg-red-50 hover:text-red-700 transition-colors
            ${isCollapsed ? 'justify-center' : ''}
          `}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          {!isCollapsed && <span className="font-medium">Exit Admin</span>}
        </Link>
      </div>
    </div>
  );
}
