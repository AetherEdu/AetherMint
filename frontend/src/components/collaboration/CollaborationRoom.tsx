'use client';

import React from 'react';

interface CollaborationRoomProps {
  roomId: string;
  userId: string;
  username: string;
  role: 'instructor' | 'student';
}

const CollaborationRoom: React.FC<CollaborationRoomProps> = ({
  roomId,
  userId,
  username,
  role,
}) => {
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div>
          <h1 className="text-xl font-bold">Collaboration Room</h1>
          <p className="text-sm text-gray-400">Room ID: {roomId}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-300">
            {username} ({role})
          </span>
          <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded-full border border-green-500/30">
            Connected
          </span>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-lg mb-2">Collaboration features coming soon</p>
          <p className="text-sm">
            Real-time editing, whiteboard, and video chat will be available here.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CollaborationRoom;
