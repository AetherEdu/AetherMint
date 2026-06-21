'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CollaborationRoom from '@/components/Collaboration/CollaborationRoom';
import toast from 'react-hot-toast';

const CollaborationRoomPage = () => {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

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
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Joining room...</p>
        </div>
      </div>
    );
  }

  if (!userInfo) {
    return null;
  }

  return (
    <CollaborationRoom
      roomId={roomId}
      userId={userInfo.userId}
      username={userInfo.username}
      role={userInfo.role}
    />
  );
};

export default CollaborationRoomPage;
