import React from 'react';
import InstructorLayout from '../../components/Instructor/InstructorLayout';
import DashboardOverview from '../../components/Instructor/DashboardOverview';

const InstructorDashboardPage = () => {
  return (
    <InstructorLayout>
      <DashboardOverview />
    </InstructorLayout>
  );
};

export default InstructorDashboardPage;
