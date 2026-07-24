'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Video, Users, Calendar, Plus } from 'lucide-react';
import { env } from '@/lib/env';
import axios from 'axios';
import toast from 'react-hot-toast';

interface Room {
  id: string;
  name: string;
  courseId?: string;
  participantCount: number;
  scheduledAt: Date;
  isActive: boolean;
}

const RoomLobby: React.FC = () => {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'}/api/collaboration/rooms`
      );
      setRooms(response.data.data || []);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast.error('Failed to load rooms');
    } finally {
      setIsLoading(false);
    }
  };

  const createRoom = async () => {
    if (!newRoomName.trim()) {
      toast.error('Please enter a room name');
      return;
    }

    try {
      const response = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'}/api/collaboration/rooms`,
        {
          name: newRoomName,
          scheduledAt: new Date().toISOString()
        }
      );

      const room = response.data.data;
      toast.success('Room created successfully');
      router.push(`/collaboration/${room.id}`);
    } catch (error) {
      console.error('Error creating room:', error);
      toast.error('Failed to create room');
    }
  };

  const joinRoom = (roomId: string) => {
    router.push(`/collaboration/${roomId}`);
  };

  const quickJoin = () => {
    const roomId = `room_${Date.now()}`;
    router.push(`/collaboration/${roomId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading rooms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Collaboration Rooms</h1>
          <p className="text-gray-400">Join or create a room to start collaborating</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <button
            onClick={quickJoin}
            className="p-6 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center gap-3"
          >
            <Video className="w-6 h-6" />
            <span className="text-lg font-semibold">Quick Join</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-6 bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center justify-center gap-3"
          >
            <Plus className="w-6 h-6" />
            <span className="text-lg font-semibold">Create Room</span>
          </button>
        </div>

        {/* Active Rooms */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Active Rooms</h2>
          {rooms.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400">No active rooms at the moment</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Create First Room
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="bg-gray-800 rounded-lg p-6 hover:bg-gray-750 transition-colors cursor-pointer"
                  onClick={() => joinRoom(room.id)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-xl font-semibold">{room.name}</h3>
                    {room.isActive && (
                      <span className="px-2 py-1 bg-green-600 text-xs rounded-full">
                        Live
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 text-sm text-gray-400">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>{room.participantCount} participants</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {new Date(room.scheduledAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      joinRoom(room.id);
                    }}
                    className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    Join Room
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Create New Room</h2>
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Enter room name..."
              className="w-full px-4 py-2 bg-gray-700 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && createRoom()}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createRoom}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomLobby;
