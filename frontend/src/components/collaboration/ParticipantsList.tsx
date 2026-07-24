'use client';

import React from 'react';
import { X, Mic, MicOff, Video, VideoOff, Monitor, UserX, Crown } from 'lucide-react';

interface Participant {
  id: string;
  userId: string;
  username: string;
  role: 'instructor' | 'student';
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
}

interface ParticipantsListProps {
  participants: Participant[];
  currentUserId: string;
  userRole: 'instructor' | 'student';
  onKickParticipant: (participantId: string) => void;
  onClose: () => void;
}

const ParticipantsList: React.FC<ParticipantsListProps> = ({
  participants,
  currentUserId,
  userRole,
  onKickParticipant,
  onClose
}) => {
  return (
    <div className="w-80 bg-gray-800 flex flex-col border-l border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Participants ({participants.length + 1})
        </h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Participants list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {/* Current user */}
        <div className="bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold">
                You
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">You</span>
                  {userRole === 'instructor' && (
                    <Crown className="w-4 h-4 text-yellow-400" />
                  )}
                </div>
                <span className="text-xs text-gray-400 capitalize">{userRole}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Other participants */}
        {participants.map((participant) => (
          <div key={participant.id} className="bg-gray-700 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-sm font-bold">
                  {participant.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{participant.username}</span>
                    {participant.role === 'instructor' && (
                      <Crown className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    )}
                  </div>
                  <span className="text-xs text-gray-400 capitalize">
                    {participant.role}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Status icons */}
                <div className="flex gap-1">
                  {participant.isScreenSharing && (
                    <Monitor className="w-4 h-4 text-green-400" />
                  )}
                  {participant.isMuted ? (
                    <MicOff className="w-4 h-4 text-red-400" />
                  ) : (
                    <Mic className="w-4 h-4 text-green-400" />
                  )}
                  {participant.isVideoOn ? (
                    <Video className="w-4 h-4 text-green-400" />
                  ) : (
                    <VideoOff className="w-4 h-4 text-red-400" />
                  )}
                </div>

                {/* Kick button (only for instructors) */}
                {userRole === 'instructor' && participant.role !== 'instructor' && (
                  <button
                    onClick={() => onKickParticipant(participant.id)}
                    className="p-1 hover:bg-red-600 rounded transition-colors"
                    title="Remove participant"
                  >
                    <UserX className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer info */}
      <div className="p-4 border-t border-gray-700">
        <div className="text-xs text-gray-400 space-y-1">
          <div className="flex items-center gap-2">
            <Mic className="w-3 h-3 text-green-400" />
            <span>Microphone on</span>
          </div>
          <div className="flex items-center gap-2">
            <Video className="w-3 h-3 text-green-400" />
            <span>Camera on</span>
          </div>
          <div className="flex items-center gap-2">
            <Monitor className="w-3 h-3 text-green-400" />
            <span>Screen sharing</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParticipantsList;
