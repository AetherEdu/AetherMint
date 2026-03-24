import React from 'react';
import InstructorLayout from '../../components/Instructor/InstructorLayout';
import StudentRoster from '../../components/Instructor/StudentRoster';

const InstructorStudentsPage = () => {
  return (
    <InstructorLayout>
      <StudentRoster />
    </InstructorLayout>
  );
};

export default InstructorStudentsPage;
