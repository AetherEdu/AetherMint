import React from 'react';
import InstructorLayout from '../../../components/Instructor/InstructorLayout';
import CourseWizard from '../../../components/Instructor/CourseWizard';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/router';

const CreateCoursePage = () => {
  const router = useRouter();

  return (
    <InstructorLayout>
      <div className="max-w-5xl mx-auto mb-12 flex items-center justify-between">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition-colors font-bold uppercase tracking-widest text-[10px]"
        >
          <ChevronLeft size={16} /> Back to Dashboard
        </button>
        <div className="text-right">
           <h1 className="text-2xl font-black">Create New Course</h1>
           <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">StarkEd Instructor Portal</p>
        </div>
      </div>
      <CourseWizard />
    </InstructorLayout>
  );
};

export default CreateCoursePage;
