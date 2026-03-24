import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  MessageSquare, 
  BarChart3, 
  Settings, 
  PlusCircle, 
  Bell, 
  ChevronRight, 
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface InstructorLayoutProps {
  children: React.ReactNode;
}

const InstructorLayout: React.FC<InstructorLayoutProps> = ({ children }) => {
  const router = useRouter();
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  const menuItems = [
    { name: 'Overview', href: '/instructor/dashboard', icon: LayoutDashboard },
    { name: 'My Courses', href: '/instructor/courses', icon: BookOpen },
    { name: 'Students', href: '/instructor/students', icon: Users },
    { name: 'Communication', href: '/instructor/messages', icon: MessageSquare },
    { name: 'Analytics', href: '/instructor/analytics', icon: BarChart3 },
    { name: 'Settings', href: '/instructor/settings', icon: Settings },
  ];

  const isActive = (href: string) => router.pathname === href;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1e] flex text-gray-900 dark:text-gray-100 transition-colors duration-300">
      {/* Sidebar */}
      <AnimatePresence mode='wait'>
        {isSidebarOpen && (
          <motion.aside 
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className="fixed lg:relative z-50 w-72 h-screen bg-white dark:bg-[#111827] border-r border-gray-200 dark:border-gray-800 shadow-xl lg:shadow-none"
          >
            <div className="p-6 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">S</span>
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  StarkEd
                </span>
              </Link>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-500">
                <X size={20} />
              </button>
            </div>

            <nav className="px-4 mt-6">
              <div className="space-y-1">
                {menuItems.map((item) => (
                  <Link 
                    key={item.name} 
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                      isActive(item.href) 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <item.icon size={20} className={isActive(item.href) ? 'text-white' : 'group-hover:text-indigo-500 transition-colors'} />
                    <span className="font-medium">{item.name}</span>
                    {isActive(item.href) && <ChevronRight size={16} className="ml-auto" />}
                  </Link>
                ))}
              </div>

              <div className="mt-12">
                <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Quick Actions</p>
                <Link 
                  href="/instructor/courses/new"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-all border border-green-500/20"
                >
                  <PlusCircle size={20} />
                  <span className="font-semibold text-sm">Create New Course</span>
                </Link>
              </div>
            </nav>

            <div className="absolute bottom-8 w-full px-8">
              <button className="flex items-center gap-3 text-red-500 hover:text-red-600 transition-colors font-medium">
                <LogOut size={20} />
                <span>Logout</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-20 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-8 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button 
                onClick={() => setSidebarOpen(true)}
                className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500"
              >
                <Menu size={20} />
              </button>
            )}
            <h1 className="text-xl font-bold">Instructor Dashboard</h1>
          </div>

          <div className="flex items-center gap-6">
            <button className="relative p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            
            <div className="h-10 w-px bg-gray-200 dark:bg-gray-800"></div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold">Professor Stark</p>
                <p className="text-xs text-gray-500">Principal Educator</p>
              </div>
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-xl flex items-center justify-center border-2 border-indigo-500/20">
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">PS</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
};

export default InstructorLayout;
