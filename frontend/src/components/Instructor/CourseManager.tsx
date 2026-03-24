import React, { useState } from 'react';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Users, 
  Star, 
  Eye, 
  Edit, 
  Trash, 
  Copy,
  LayoutGrid,
  List
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CourseCard: React.FC<{
  id: string;
  title: string;
  category: string;
  status: 'published' | 'draft' | 'scheduled';
  students: number;
  rating: number;
  lastUpdated: string;
}> = ({ id, title, category, status, students, rating, lastUpdated }) => (
  <motion.div 
    layout
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ y: -5 }}
    className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-100 dark:border-gray-800 p-6 flex flex-col group transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 shadow-sm"
  >
    <div className="flex justify-between items-start mb-4">
      <div className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
        status === 'published' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
        status === 'scheduled' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
        'bg-orange-500/10 text-orange-600 dark:text-orange-400'
      }`}>
        {status}
      </div>
      <button className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
        <MoreVertical size={16} />
      </button>
    </div>

    <div className="h-40 w-full bg-gray-100 dark:bg-gray-800 rounded-2xl mb-6 relative overflow-hidden flex items-center justify-center p-8 group-hover:scale-[1.02] transition-transform duration-500">
       <BookOpen size={48} className="text-gray-300 dark:text-gray-700 group-hover:text-indigo-500/40 transition-colors" />
       {/* Background glow on hover */}
       <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
    </div>

    <h3 className="text-xl font-bold mb-1 leading-tight mb-2 group-hover:text-indigo-500 transition-colors">{title}</h3>
    <p className="text-sm text-gray-500 mb-6 font-medium">{category}</p>

    <div className="mt-auto pt-6 flex items-center justify-between border-t border-gray-50 dark:border-gray-800/50">
       <div className="flex gap-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-bold">
            <Users size={14} className="text-indigo-500" />
            {students}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-bold">
            <Star size={14} className="text-yellow-500" />
            {rating}
          </div>
       </div>
       <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">{lastUpdated}</p>
    </div>

    {/* Hover Actions Bar */}
    <div className="absolute inset-0 bg-indigo-600/95 opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-3xl flex flex-col items-center justify-center gap-4 z-20">
       <div className="flex gap-3">
          <button className="p-3 bg-white/20 backdrop-blur-md rounded-2xl text-white hover:bg-white hover:text-indigo-600 transition-all translate-y-4 group-hover:translate-y-0 duration-300 delay-75">
             <Eye size={20}/>
          </button>
          <button className="p-3 bg-white/20 backdrop-blur-md rounded-2xl text-white hover:bg-white hover:text-indigo-600 transition-all translate-y-4 group-hover:translate-y-0 duration-300 delay-100">
             <Edit size={20}/>
          </button>
          <button className="p-3 bg-white/20 backdrop-blur-md rounded-2xl text-white hover:bg-white hover:text-indigo-600 transition-all translate-y-4 group-hover:translate-y-0 duration-300 delay-150">
             <Copy size={20}/>
          </button>
          <button className="p-3 bg-red-500 shadow-xl shadow-red-500/20 rounded-2xl text-white hover:bg-red-600 transition-all translate-y-4 group-hover:translate-y-0 duration-300 delay-200">
             <Trash size={20}/>
          </button>
       </div>
       <p className="text-white font-bold text-sm select-none">Quick Actions</p>
    </div>
  </motion.div>
);

interface CourseItem {
  id: string;
  title: string;
  category: string;
  status: 'published' | 'draft' | 'scheduled';
  students: number;
  rating: number;
  lastUpdated: string;
}

const CourseManager = () => {
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const courses: CourseItem[] = [
    { id: '1', title: 'Stellar Smart Contracts for Dapps', category: 'Blockchain', status: 'published', students: 450, rating: 4.9, lastUpdated: '2 days ago' },
    { id: '2', title: 'Soroban Development with Rust', category: 'Rust / Web3', status: 'published', students: 320, rating: 4.8, lastUpdated: '5 days ago' },
    { id: '3', title: 'Building DEXs on Stellar Network', category: 'Finance', status: 'draft', students: 0, rating: 0, lastUpdated: '1 hour ago' },
    { id: '4', title: 'Introduction to Web3 Design', category: 'UI/UX Design', status: 'scheduled', students: 125, rating: 4.5, lastUpdated: '3 days ago' },
  ];

  const filteredCourses = filter === 'all' ? courses : courses.filter(c => c.status === filter);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header with Search and Actions */}
      <div className="bg-white dark:bg-[#111827] p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex flex-col md:flex-row gap-6 justify-between items-center">
           <div className="relative flex-1 w-full group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-indigo-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search your courses..." 
                className="w-full bg-gray-50 dark:bg-gray-800/50 border-none rounded-2xl py-4 pl-12 pr-6 focus:ring-2 ring-indigo-500/30 transition-all font-medium"
              />
           </div>
           
           <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="bg-gray-50 dark:bg-gray-800/50 p-1.5 rounded-2xl flex border border-gray-100 dark:border-gray-800">
                 <button 
                  onClick={() => setView('grid')}
                  className={`p-2.5 rounded-xl transition-all ${view === 'grid' ? 'bg-white dark:bg-gray-700 shadow-lg text-indigo-500' : 'text-gray-400'}`}
                 >
                    <LayoutGrid size={18} />
                 </button>
                 <button 
                  onClick={() => setView('list')}
                  className={`p-2.5 rounded-xl transition-all ${view === 'list' ? 'bg-white dark:bg-gray-700 shadow-lg text-indigo-500' : 'text-gray-400'}`}
                 >
                    <List size={18} />
                 </button>
              </div>

              <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 mx-2"></div>

              <button className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-bold shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all shrink-0">
                <Plus size={20}/>
                Create Course
              </button>
           </div>
        </div>

        {/* Filters Bar */}
        <div className="flex items-center gap-6 mt-8 overflow-x-auto pb-2 scrollbar-none">
           <div className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-widest mr-4">
              <Filter size={14} className="text-indigo-500"/>
              Filters
           </div>
           {['all', 'published', 'draft', 'scheduled'].map((f) => (
             <button
               key={f}
               onClick={() => setFilter(f)}
               className={`px-6 py-2 rounded-xl text-sm font-bold capitalize transition-all border whitespace-nowrap ${
                 filter === f 
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50' 
                  : 'bg-transparent text-gray-500 border-transparent hover:border-gray-200 dark:hover:border-gray-800'
               }`}
             >
               {f}
             </button>
           ))}
        </div>
      </div>

      {/* Grid Container */}
      <AnimatePresence mode='popLayout'>
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8"
        >
          {filteredCourses.map((course) => (
            <CourseCard key={course.id} {...course} />
          ))}
        </motion.div>
      </AnimatePresence>

      {filteredCourses.length === 0 && (
        <div className="text-center py-32 bg-white dark:bg-[#111827] rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-800">
           <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen size={40} className="text-gray-300" />
           </div>
           <h3 className="text-xl font-bold mb-2">No courses found</h3>
           <p className="text-gray-500 max-w-xs mx-auto">Try adjusting your filters or create a new course to get started.</p>
        </div>
      )}
    </div>
  );
};

export default CourseManager;
