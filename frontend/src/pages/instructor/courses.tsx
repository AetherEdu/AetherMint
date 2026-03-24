import React from 'react';
import InstructorLayout from '../../components/Instructor/InstructorLayout';
import CourseManager from '../../components/Instructor/CourseManager';

const InstructorCoursesPage = () => {
  return (
    <InstructorLayout>
      <CourseManager />
    </InstructorLayout>
  );
};

export default InstructorCoursesPage;
