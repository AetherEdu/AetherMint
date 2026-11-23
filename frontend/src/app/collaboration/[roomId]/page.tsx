'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CollaborationRoom from '@/components/Collaboration/CollaborationRoom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Skeleton, SkeletonText } from '@/components/Skeleton';
import toast from 'react-hot-toast';

const CollaborationRoomPage = () => {
  const params = useParams();
  const router = useRouter();
  const roomId = (params?.roomId as string) ?? '';

  const [isLoading, setIsLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<{
    userId: string;
    username: string;
    role: 'instructor' | 'student';
  } | null>(null);

  useEffect(() => {
    // In a real app, fetch user info from auth context or API
    const fetchUserInfo = async () => {
      try {
        // Mock user info - replace with actual auth
        const mockUser = {
          userId: `user_${Date.now()}`,
          username: 'Demo User',
          role: 'student' as const
        };

        setUserInfo(mockUser);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching user info:', error);
        toast.error('Failed to load user information');
        router.push('/dashboard');
      }
    };

    fetchUserInfo();
  }, [router]);

  if (isLoading) {
    return (
      <div
        className="h-screen bg-gray-900 p-4"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Joining collaboration room, loading"
      >
        <span className="sr-only">Joining room...</span>
        <div className="flex flex-col lg:flex-row gap-4 h-full">
          {/* Main video/editor panes */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <Skeleton variant="rectangular" className="w-full flex-1 min-h-[240px] rounded-lg" />
            <Skeleton variant="rectangular" className="w-full flex-1 min-h-[240px] rounded-lg" />
          </div>
          {/* Participant list */}
          <aside className="w-full lg:w-72 shrink-0 rounded-lg bg-gray-800 p-4" aria-hidden="true">
            <Skeleton variant="text" width="50%" className="mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Skeleton variant="circular" width={32} height={32} />
                  <SkeletonText lines={1} className="flex-1" />
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  if (!userInfo) {
    return null;
  }

  return (
    <ErrorBoundary variant="network" errorTitle="Collaboration Error" errorMessage="Failed to load the collaboration room. Please check your connection and try again.">
      <CollaborationRoom
        roomId={roomId}
        userId={userInfo.userId}
        username={userInfo.username}
        role={userInfo.role}
      />
    </ErrorBoundary>
  );
};

export default CollaborationRoomPage;
