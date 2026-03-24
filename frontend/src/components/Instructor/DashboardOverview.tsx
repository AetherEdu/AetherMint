import React from 'react';
import { 
  Users, 
  BookOpen, 
  DollarSign, 
  Star, 
  TrendingUp, 
  Clock, 
  Award,
  ArrowUpRight,
  TrendingDown,
  BarChart2,
  MessageSquare
} from 'lucide-react';
import { motion } from 'framer-motion';

const StatCard: React.FC<{
  title: string;
  value: string | number;
  trend: string;
  isPositive: boolean;
  icon: any;
  color: string;
}> = ({ title, value, trend, isPositive, icon: Icon, color }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-white dark:bg-[#111827] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm"
  >
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl bg-${color}-500/10 text-${color}-600 dark:text-${color}-400`}>
        <Icon size={24} />
      </div>
      <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
        <span>{trend}</span>
        {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
      </div>
    </div>
    <h3 className="text-gray-500 text-sm font-medium mb-1">{title}</h3>
    <p className="text-2xl font-bold">{value}</p>
  </motion.div>
);

const DashboardOverview = () => {
  const stats = [
    { title: 'Total Students', value: '1,250', trend: '+12%', isPositive: true, icon: Users, color: 'blue' },
    { title: 'Active Courses', value: '8', trend: '+2', isPositive: true, icon: BookOpen, color: 'indigo' },
    { title: 'Total Revenue', value: '$45,200', trend: '+24%', isPositive: true, icon: DollarSign, color: 'green' },
    { title: 'Avg. Rating', value: '4.8', trend: '-0.1', isPositive: false, icon: Star, color: 'yellow' },
  ];

  const recentActivities = [
    { 
      type: 'enrollment', 
      user: 'Alex J.', 
      course: 'Stellar Smart Contracts', 
      timestamp: '2 mins ago',
      color: 'blue'
    },
    { 
      type: 'completion', 
      user: 'Sarah M.', 
      course: 'Blockchain Basics', 
      timestamp: '45 mins ago',
      color: 'green'
    },
    { 
      type: 'review', 
      user: 'Mike R.', 
      course: 'Advanced Soroban', 
      rating: 5,
      timestamp: '2 hours ago',
      color: 'yellow'
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold mb-2 tracking-tight">Welcome back, Professor!</h2>
          <p className="text-gray-500">Here's what's happening with your courses today.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
            Download Report
          </button>
          <button className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all">
            Quick Actions
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <StatCard key={i} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        {/* Course Performance (Main Area) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#111827] p-8 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden group">
            <div className="flex justify-between items-center mb-8 relative z-10">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <BarChart2 size={20} className="text-indigo-500" />
                Revenue Analytics
              </h3>
              <select className="bg-gray-50 dark:bg-gray-800 border-none rounded-lg text-sm px-3 py-1.5 focus:ring-2 ring-indigo-500/50">
                <option>Last 7 Days</option>
                <option>Last 30 Days</option>
              </select>
            </div>
            
            <div className="h-64 flex items-end justify-between gap-1 relative z-10 px-4">
               {[45, 62, 58, 75, 52, 68, 85].map((val, i) => (
                 <div key={i} className="flex-1 flex flex-col items-center group/bar">
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${val}%` }}
                      transition={{ delay: i * 0.1, duration: 0.8 }}
                      className="w-full max-w-[40px] bg-gradient-to-t from-indigo-600/80 to-indigo-400 rounded-t-lg relative group transition-all"
                    >
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        ${val * 100}
                      </div>
                    </motion.div>
                    <span className="text-xs text-gray-400 mt-4 capitalize font-medium">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                    </span>
                 </div>
               ))}
            </div>

            {/* Background design elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-indigo-500/10 transition-colors"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl group-hover:bg-purple-500/10 transition-colors"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-[#111827] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
               <h3 className="font-bold flex items-center gap-2 mb-6">
                 < Award size={20} className="text-yellow-500" />
                 Top Performing Course
               </h3>
               <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div className="w-16 h-12 bg-indigo-600 rounded-lg shrink-0 overflow-hidden shadow-inner"></div>
                  <div>
                    <h4 className="font-bold text-sm leading-tight mb-1">Stellar Smart Contracts for Dapps</h4>
                    <p className="text-xs text-gray-500 flex items-center gap-2">
                      <Users size={12} /> 450 Students
                    </p>
                  </div>
                  <button className="ml-auto p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                    <ArrowUpRight size={16} className="text-indigo-500" />
                  </button>
               </div>
            </div>
            
            <div className="bg-white dark:bg-[#111827] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
               <h3 className="font-bold flex items-center gap-2 mb-6 text-orange-500">
                 < Clock size={20} />
                 Course Submissions
               </h3>
               <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-orange-600">
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm mb-1">12 Pending Reviews</h4>
                    <p className="text-xs text-gray-500">Last submitted 15m ago</p>
                  </div>
                  <button className="ml-auto px-3 py-1 bg-orange-500 text-white text-xs font-bold rounded-lg hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition-all">
                    Grading UI
                  </button>
               </div>
            </div>
          </div>
        </div>

        {/* Sidebar Analytics/Activities */}
        <div className="space-y-6">
           <div className="bg-white dark:bg-[#111827] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm h-full">
              <h3 className="text-lg font-bold mb-6 flex items-center justify-between">
                Recent Activity
                <span className="text-xs font-medium text-indigo-500 cursor-pointer hover:underline">View All</span>
              </h3>
              
              <div className="space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-gray-100 dark:before:bg-gray-800">
                {recentActivities.map((act, i) => (
                  <div key={i} className="flex gap-4 relative z-10">
                    <div className={`w-6 h-6 rounded-full bg-white dark:bg-[#111827] border-2 border-${act.color}-500 shrink-0 mt-1`}></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        <span className="font-bold">{act.user}</span> 
                        {act.type === 'enrollment' ? ' just enrolled in ' : act.type === 'completion' ? ' completed ' : ' rated '}
                        <span className="text-indigo-500 font-semibold">{act.course}</span>
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest">{act.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-12 p-6 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl relative overflow-hidden text-white shadow-xl shadow-indigo-500/20 group">
                <h3 className="font-bold mb-2 relative z-10 text-lg">Growth Plan</h3>
                <p className="text-white/80 text-sm relative z-10 mb-6 leading-relaxed">You're in the top 5% of educators this month! Unlock specialized marketing tools.</p>
                <button className="bg-white text-indigo-700 px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg hover:scale-105 transition-transform relative z-10">
                  Upgrade Account
                </button>
                <Star size={80} className="absolute -bottom-6 -right-6 text-white/10 group-hover:rotate-12 transition-transform duration-700" />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
