import React from 'react';
import VirtualClassroom from '../components/Collaboration/VirtualClassroom';
import { useCollaborationSession } from '../hooks/useCollaborationSession';

const CollaborationPage: React.FC = () => {
  const session = useCollaborationSession();

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#fdf7ec_0%,_#f8fbff_45%,_#eef6ff_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <VirtualClassroom session={session} />
      </div>
    </main>
  );
};

export default CollaborationPage;
