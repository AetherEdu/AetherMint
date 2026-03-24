import React, { useState } from 'react';
import { 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Upload, 
  Trash, 
  Plus, 
  Video, 
  FileText, 
  Target,
  FileQuestion,
  GraduationCap,
  Save,
  Globe,
  Settings,
  BookOpen,
  Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RichTextEditor } from '../Editor/RichTextEditor';

const StepIcon: React.FC<{ active: boolean; completed: boolean; icon: any }> = ({ active, completed, icon: Icon }) => (
  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all border-2 ${
    completed ? 'bg-indigo-600 border-indigo-600 text-white' :
    active ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 text-indigo-600 dark:text-indigo-400' :
    'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 text-gray-400'
  }`}>
    {completed ? <Check size={20} /> : <Icon size={20} />}
  </div>
);

const CourseWizard = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [courseData, setCourseData] = useState({
    title: '',
    category: '',
    level: 'beginner',
    description: '',
    outcomes: [''],
    curriculum: [
      { id: 'm1', title: 'Introduction', lessons: [{ id: 'l1', title: 'Welcome', type: 'video' }] }
    ]
  });

  const steps = [
    { id: 1, name: 'Basic Info', icon: GraduationCap },
    { id: 2, name: 'Curriculum', icon: BookOpen },
    { id: 3, name: 'Assessments', icon: FileQuestion },
    { id: 4, name: 'Publishing', icon: Globe },
  ];

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, steps.length));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-6">
                  <div>
                    <label className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3 block">Course Title</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Advanced Soroban Development"
                      className="w-full bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 rounded-2xl p-4 focus:ring-2 ring-indigo-500/20 outline-none transition-all text-lg font-bold"
                      value={courseData.title}
                      onChange={(e) => setCourseData({...courseData, title: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3 block">Category</label>
                    <select className="w-full bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 rounded-2xl p-4 focus:ring-2 ring-indigo-500/20 outline-none transition-all font-semibold">
                       <option>Blockchain Development</option>
                       <option>Smart Contracts</option>
                       <option>Rust Programming</option>
                       <option>Web3 Design</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3 block">Level</label>
                    <div className="flex gap-4">
                       {['beginner', 'intermediate', 'advanced'].map((lvl) => (
                         <button 
                           key={lvl}
                           onClick={() => setCourseData({...courseData, level: lvl})}
                           className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold capitalize transition-all border ${
                             courseData.level === lvl 
                              ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 border-indigo-200 dark:border-indigo-900/50' 
                              : 'bg-transparent text-gray-500 border-gray-100 dark:border-gray-800'
                           }`}
                         >
                           {lvl}
                         </button>
                       ))}
                    </div>
                  </div>

                  <div>
                     <label className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3 block">Course Description</label>
                     <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-inner">
                        <RichTextEditor 
                          placeholder="Write a compelling course description..."
                          minHeight={250}
                          onChange={(content) => setCourseData({...courseData, description: content.html})}
                        />
                     </div>
                  </div>
               </div>
               
               <div className="bg-gray-50 dark:bg-gray-800/50 rounded-3xl p-8 border-2 border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/80 transition-all">
                  <div className="w-20 h-20 bg-white dark:bg-[#111827] rounded-3xl flex items-center justify-center shadow-sm mb-6 group-hover:scale-110 transition-transform">
                    <Upload className="text-indigo-500" size={32} />
                  </div>
                  <h4 className="font-bold mb-2">Upload Course Thumbnail</h4>
                  <p className="text-xs text-gray-500 max-w-[200px]">1280x720 (16:9) Recommended. PNG, JPG or WebP.</p>
               </div>
            </div>

            <div className="mt-12 bg-indigo-600/5 p-8 rounded-3xl border border-indigo-500/10">
               <h3 className="font-bold flex items-center gap-2 mb-6">
                <Target size={20} className="text-indigo-500" />
                Learning Outcomes
               </h3>
               <div className="space-y-4">
                  {courseData.outcomes.map((outcome, i) => (
                    <div key={i} className="flex gap-4">
                       <input 
                        type="text" 
                        placeholder="e.g. Master Soroban SDK basics"
                        className="flex-1 bg-white dark:bg-[#111827] border-gray-200 dark:border-gray-800 rounded-xl p-3 shadow-sm focus:ring-2 ring-indigo-500/10 outline-none"
                       />
                       <button className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-colors">
                          <Trash size={18} />
                       </button>
                    </div>
                  ))}
                  <button className="flex items-center gap-2 text-indigo-500 font-bold text-sm hover:underline mt-2">
                    <Plus size={16} /> Add Another Outcome
                  </button>
               </div>
            </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold">Course Curriculum</h3>
              <button className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-bold text-sm shadow-xl hover:-translate-y-1 transition-all">
                <Plus size={20} /> Add Section
              </button>
            </div>

            <div className="space-y-6">
               {courseData.curriculum.map((section, idx) => (
                 <div key={section.id} className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm group">
                    <div className="p-6 bg-gray-50/50 dark:bg-gray-800/30 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
                       <div className="flex items-center gap-4 flex-1">
                          <div className="text-indigo-500 font-bold bg-indigo-500/10 px-3 py-1 rounded-lg text-xs leading-none">0{idx + 1}</div>
                          <input 
                            defaultValue={section.title}
                            className="bg-transparent border-none font-bold text-lg outline-none w-full"
                          />
                       </div>
                       <button className="p-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Settings size={18} />
                       </button>
                    </div>
                    <div className="p-6 space-y-4">
                       {section.lessons.map((lesson) => (
                         <div key={lesson.id} className="flex items-center gap-4 bg-gray-50/50 dark:bg-gray-800/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-indigo-500/30 transition-all cursor-move group/lesson">
                            {lesson.type === 'video' ? <Video size={18} className="text-blue-500" /> : <FileText size={18} className="text-orange-500" />}
                            <span className="font-semibold text-sm flex-1">{lesson.title}</span>
                            <div className="flex gap-2 opacity-0 group-hover/lesson:opacity-100 transition-opacity">
                               <button className="p-2 text-gray-400 hover:text-indigo-500"><Edit3 size={16}/></button>
                               <button className="p-2 text-gray-400 hover:text-red-500"><Trash size={16}/></button>
                            </div>
                         </div>
                       ))}
                       <button className="w-full py-4 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl text-gray-400 font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all">
                          <Plus size={18} /> Add Lesson
                       </button>
                    </div>
                 </div>
               ))}
            </div>
          </motion.div>
        );
      default:
        return <div className="p-12 text-center text-gray-500 italic">This step is under development.</div>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-20">
      {/* Wizard Progress Bar */}
      <div className="bg-white dark:bg-[#111827] p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm mb-12">
        <div className="flex justify-between items-center relative after:absolute after:left-12 after:right-12 after:top-6 after:h-0.5 after:bg-gray-100 dark:after:bg-gray-800 after:-z-0">
          {steps.map((step) => (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-3 w-32 px-4 group">
               <StepIcon 
                active={currentStep === step.id} 
                completed={currentStep > step.id} 
                icon={step.icon} 
               />
               <span className={`text-[10px] font-bold uppercase tracking-widest ${
                 currentStep === step.id ? 'text-indigo-600' : 'text-gray-400'
               }`}>
                 Step {step.id}
               </span>
               <span className={`text-xs font-bold text-center leading-tight transition-colors ${
                 currentStep === step.id ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'
               }`}>
                 {step.name}
               </span>
               
               {/* Progress Dot on bar */}
               <div className={`absolute left-1/2 top-6 -translate-x-1/2 w-2 h-2 rounded-full -mt-1 transition-all ${
                 currentStep >= step.id ? 'bg-indigo-600 scale-125' : 'bg-gray-200 dark:bg-gray-700'
               }`}></div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Form Area */}
      <div className="bg-white dark:bg-[#111827] p-12 rounded-[40px] border border-gray-100 dark:border-gray-800 shadow-xl shadow-indigo-500/5 min-h-[500px] flex flex-col">
        {renderStep()}

        <div className="mt-auto pt-12 flex justify-between items-center border-t border-gray-50 dark:border-gray-800/50">
           <button 
            onClick={prevStep}
            disabled={currentStep === 1}
            className={`flex items-center gap-2 font-bold px-8 py-4 rounded-2xl transition-all ${
              currentStep === 1 ? 'opacity-0 select-none' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
           >
              <ChevronLeft size={20} /> Back
           </button>
           
           <div className="flex gap-4">
              <button className="flex items-center gap-2 px-8 py-4 bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400 font-bold rounded-2xl border border-indigo-500/20 hover:bg-indigo-100 transition-all">
                <Save size={20} /> Save Progress
              </button>
              <button 
                onClick={nextStep}
                className="flex items-center gap-2 px-10 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 hover:scale-[1.02] transition-all"
              >
                {currentStep === steps.length ? 'Finalize Course' : 'Continue'}
                <ChevronRight size={20} />
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default CourseWizard;
