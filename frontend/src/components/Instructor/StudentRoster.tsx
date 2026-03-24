import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Mail, 
  MoreHorizontal, 
  ChevronRight, 
  ArrowUpRight,
  UserCheck,
  UserPlus,
  BarChart2,
  Calendar,
  ChevronLeft,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const StudentRow: React.FC<{
  id: string;
  name: string;
  email: string;
  avatar: string;
  course: string;
  progress: number;
  grade: string;
  lastActive: string;
}> = ({ id, name, email, avatar, course, progress, grade, lastActive }) => (
  <motion.tr 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-b border-gray-100 dark:border-gray-800"
  >
    <td className="py-6 pl-8">
       <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-2xl flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400 border-2 border-indigo-500/10 group-hover:scale-110 transition-transform duration-300">
             {avatar}
          </div>
          <div>
             <h4 className="font-bold text-sm leading-none transition-colors group-hover:text-indigo-500">{name}</h4>
             <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-semibold">{email}</p>
          </div>
       </div>
    </td>
    <td className="py-6">
       <div className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg inline-block text-[10px] font-bold text-gray-500 max-w-[150px] truncate">
          {course}
       </div>
    </td>
    <td className="py-6">
       <div className="w-48 space-y-2">
          <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
             <span>Progress</span>
             <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
             <motion.div 
               initial={{ width: 0 }}
               animate={{ width: `${progress * 100}%` }}
               transition={{ duration: 1, delay: 0.2 }}
               className="h-full bg-gradient-to-r from-indigo-600 to-purple-500 rounded-full shadow-sm"
             />
          </div>
       </div>
    </td>
    <td className="py-6">
       <div className="px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 text-xs font-bold rounded-lg inline-block">
          {grade}
       </div>
    </td>
    <td className="py-6 text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
       {lastActive}
    </td>
    <td className="py-6 pr-8 text-right">
       <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-300">
          <button className="p-2.5 bg-white dark:bg-gray-700 shadow-sm border border-gray-100 dark:border-gray-800 rounded-xl text-indigo-500 hover:scale-110 transition-all">
             <Mail size={16} />
          </button>
          <button className="p-2.5 bg-white dark:bg-gray-700 shadow-sm border border-gray-100 dark:border-gray-800 rounded-xl text-indigo-500 hover:scale-110 transition-all">
             <BarChart2 size={16} />
          </button>
          <button className="p-2.5 bg-white dark:bg-gray-700 shadow-sm border border-gray-100 dark:border-gray-800 rounded-xl text-gray-400 hover:text-red-500 hover:scale-110 transition-all">
             <MoreHorizontal size={16} />
          </button>
       </div>
    </td>
  </motion.tr>
);

const StudentRoster = () => {
  const [activeTab, setActiveTab] = useState('all');

  const students = [
    { id: '1', name: 'Alex Johnson', email: 'alex.j@example.com', avatar: 'AJ', course: 'Stellar Smart Contracts', progress: 0.85, grade: 'A', lastActive: '2 hours ago' },
    { id: '2', name: 'Sarah Miller', email: 'smiller@web3.io', avatar: 'SM', course: 'Blockchain Basics', progress: 0.45, grade: 'B', lastActive: '12 mins ago' },
    { id: '3', name: 'Mike Rivera', email: 'm.rivera@edu.org', avatar: 'MR', course: 'Advanced Soroban', progress: 0.92, grade: 'A+', lastActive: 'Just now' },
    { id: '4', name: 'Jenny Wilson', email: 'jwilson@stack.com', avatar: 'JW', course: 'Stellar Smart Contracts', progress: 0.12, grade: 'Pending', lastActive: '3 days ago' },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header with Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-indigo-600 p-8 rounded-[40px] text-white shadow-xl shadow-indigo-500/20 flex flex-col justify-between overflow-hidden relative group">
            <UserPlus size={120} className="absolute -bottom-8 -right-8 text-white/10 group-hover:rotate-12 transition-transform duration-500" />
            <div className="relative z-10">
               <h3 className="text-xl font-bold mb-1 leading-tight">New Enrollments</h3>
               <p className="text-white/60 text-sm">Last 7 days</p>
            </div>
            <div className="relative z-10 flex items-end justify-between mt-12">
               <span className="text-5xl font-black">+42</span>
               <div className="flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-xl text-xs font-bold">
                  <TrendingUp size={14} /> 12%
               </div>
            </div>
         </div>
         
         <div className="md:col-span-2 bg-white dark:bg-[#111827] p-8 rounded-[40px] border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between gap-12">
            <div className="flex-1">
               <h3 className="text-xl font-bold mb-2">Student Performance</h3>
               <p className="text-gray-500 text-sm mb-8 leading-relaxed max-w-xs">Average completion rate is up by 8.5% across all your courses this month.</p>
               <div className="flex gap-12">
                  <div>
                    <p className="text-2xl font-black text-indigo-600">82%</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Avg progress</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-green-500">92%</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Pass rate</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-yellow-500">4.9</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Satisfaction</p>
                  </div>
               </div>
            </div>
            <div className="w-32 h-32 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center p-4">
                <BarChart2 size={64} className="text-indigo-500" />
            </div>
         </div>
      </div>

      {/* Main Table Interface */}
      <div className="bg-white dark:bg-[#111827] rounded-[40px] border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-500/5 overflow-hidden">
         <div className="p-8 border-b border-gray-50 dark:border-gray-800/50 flex flex-col md:flex-row gap-6 justify-between items-center">
            <div className="flex gap-1 bg-gray-50 dark:bg-gray-800 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-800">
               {['all', 'active', 'inactive', 'flagged'].map(t => (
                 <button 
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase transition-all tracking-widest ${
                    activeTab === t ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600' : 'text-gray-400'
                  }`}
                 >
                    {t}
                 </button>
               ))}
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto">
               <div className="relative flex-1 min-w-[250px]">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search by name, email..."
                    className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl py-3.5 pl-12 pr-6 focus:ring-2 ring-indigo-500/20 transition-all font-medium text-sm"
                  />
               </div>
               <button className="p-3.5 border border-gray-100 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-gray-500">
                  <Filter size={20} />
               </button>
            </div>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-800/20 text-[10px] text-gray-400 uppercase tracking-[0.2em] font-black border-b border-gray-100 dark:border-gray-800">
                     <th className="py-5 pl-8">Student Info</th>
                     <th className="py-5">Enrolled Course</th>
                     <th className="py-5">Current Progress</th>
                     <th className="py-5">Grade</th>
                     <th className="py-5">Last Activity</th>
                     <th className="py-5 pr-8 text-right">Actions</th>
                  </tr>
               </thead>
               <tbody>
                  {students.map(student => (
                    <StudentRow key={student.id} {...student} />
                  ))}
               </tbody>
            </table>
         </div>

         <div className="p-6 bg-gray-50/50 dark:bg-gray-800/20 flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-widest px-12">
            <div>Showing 4 of 1,250 students</div>
            <div className="flex items-center gap-4">
               <button className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:translate-x-[-2px] transition-transform"><ChevronLeft size={16}/></button>
               <button className="p-3 bg-white dark:bg-gray-700 rounded-xl shadow-sm shadow-indigo-500/10 text-indigo-600">1</button>
               <button className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:translate-x-[2px] transition-transform"><ChevronRight size={16}/></button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default StudentRoster;
