'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, GraduationCap, MessageSquare, Video, Mic, MicOff, Share2, Globe, Settings, Book, Award, Clock, Hand } from 'lucide-react';

export type ClassroomLayout = 'lecture' | 'seminar' | 'lab' | 'discussion' | 'presentation';
export type AvatarState = 'idle' | 'listening' | 'speaking' | 'raising-hand' | 'applauding';
export type UserRole = 'instructor' | 'student' | 'assistant' | 'visitor';

export interface UserAvatar {
  id: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  state: AvatarState;
  isActive: boolean;
  isMuted: boolean;
  handRaised: boolean;
  skinTone: string;
  hairColor: string;
  clothingColor: string;
  accessories: string[];
  animations: string[];
}

export interface ClassroomEnvironment {
  layout: ClassroomLayout;
  capacity: number;
  scene: string;
  lighting: {
    ambient: number;
    directional: number;
    point: number;
    shadows: boolean;
  };
  environment: {
    skybox?: string;
    ground: string;
    walls: string;
    ceiling: string;
  };
  furniture: {
    desks: Array<{
      id: string;
      position: { x: number; y: number; z: number };
      occupied: boolean;
    }>;
    podium: {
      position: { x: number; y: number; z: number };
    };
    whiteboard: {
      position: { x: number; y: number; z: number };
      size: { width: number; height: number };
    };
  };
}

export interface ClassroomSession {
  id: string;
  title: string;
  description: string;
  instructor: UserAvatar;
  students: UserAvatar[];
  environment: ClassroomEnvironment;
  startTime: number;
  endTime?: number;
  isRecording: boolean;
  isActive: boolean;
  currentActivity: string;
  tools: string[];
}

export interface VirtualClassroomProps {
  session: ClassroomSession;
  onUserJoin?: (user: UserAvatar) => void;
  onUserLeave?: (userId: string) => void;
  onUserSpeak?: (userId: string, isSpeaking: boolean) => void;
  onHandRaised?: (userId: string, isRaised: boolean) => void;
  onActivityChange?: (activity: string) => void;
  enableVoiceChat?: boolean;
  enableVideoChat?: boolean;
  enableScreenShare?: boolean;
  enableRecording?: boolean;
  showControls?: boolean;
  maxParticipants?: number;
}

export function VirtualClassroom({
  session,
  onUserJoin,
  onUserLeave,
  onUserSpeak,
  onHandRaised,
  onActivityChange,
  enableVoiceChat = true,
  enableVideoChat = true,
  enableScreenShare = true,
  enableRecording = false,
  showControls = true,
  maxParticipants = 50
}: VirtualClassroomProps) {
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [currentActivity, setCurrentActivity] = useState(session.currentActivity);
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string;
    userId: string;
    userName: string;
    message: string;
    timestamp: number;
    type: 'text' | 'system';
  }>>([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getAvatarColor = (state: AvatarState) => {
    const colors: Record<AvatarState, string> = {
      idle: 'text-gray-400',
      listening: 'text-blue-400',
      speaking: 'text-green-400',
      'raising-hand': 'text-yellow-400',
      applauding: 'text-purple-400'
    };
    return colors[state] || 'text-gray-400';
  };

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-lg overflow-hidden">
      {/* Virtual Classroom Scene */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-sky-400 to-sky-600">
          <div className="absolute inset-0 bg-black/10"></div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-800 to-gray-700">
          <div className="absolute inset-0 bg-gray-900/20"></div>
        </div>
        <div className="absolute inset-0">
          <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 w-32 h-16 bg-gradient-to-r from-amber-700 to-amber-800 rounded-t-lg shadow-2xl"
            style={{ perspective: '1000px', transform: 'rotateX(-10deg)' }}>
            <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-center">
              <GraduationCap className="h-8 w-8 text-amber-200 mx-auto mb-1" />
              <div className="text-amber-200 text-sm font-bold">Instructor Podium</div>
            </div>
          </div>
          {session.students.slice(0, 8).map((student, index) => (
            <div key={student.id} className="absolute"
              style={{ bottom: '8rem', left: `${(index * 10 + 5)}%`, transform: 'translateX(-50%)' }}>
              <div className="w-16 h-12 bg-gradient-to-b from-amber-600 to-amber-700 rounded-t-lg shadow-lg">
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                    {student.avatarUrl ? (
                      <img src={student.avatarUrl} alt={student.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <Users className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <div className={`absolute -top-2 left-1/2 transform -translate-x-1/2 w-2 h-2 rounded-full ${getAvatarColor(student.state)} animate-pulse`}></div>
                  {student.handRaised && (
                    <div className="absolute -top-2 right-0 w-2 h-2 rounded-full bg-yellow-500 animate-pulse">
                      <Hand className="h-2 w-2 text-white" />
                    </div>
                  )}
                  <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-sm rounded px-2 py-1 min-w-max">
                    <div className="text-white text-xs font-medium truncate">{student.name}</div>
                    <div className="text-gray-300 text-xs capitalize">{student.role}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {session.students.length > 8 && (
            <div className="absolute right-2 bottom-8 bg-black/60 backdrop-blur-sm rounded px-2 py-1">
              <span className="text-white text-xs">+{session.students.length - 8} more</span>
            </div>
          )}
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 w-96 h-64 bg-white rounded-lg shadow-2xl"
            style={{ perspective: '1000px', transform: 'rotateX(-5deg)' }}>
            <div className="p-4 h-full flex items-center justify-center">
              <div className="text-center">
                <Book className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <div className="text-gray-600 text-sm">Interactive Whiteboard</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Control Panel */}
      {showControls && (
        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-blue-500/30">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="h-5 w-5 text-blue-400" />
            <h3 className="text-white font-semibold">Virtual Classroom</h3>
          </div>
          <div className="mb-4">
            <div className="text-white text-sm font-medium mb-1">{session.title}</div>
            <div className="text-gray-400 text-xs mb-2">{session.description}</div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400">Layout:</span>
              <span className="text-blue-300 capitalize">{session.environment.layout}</span>
              <span className="text-gray-400">•</span>
              <span className="text-green-300">{session.students.length}/{session.environment.capacity}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setIsAudioEnabled(!isAudioEnabled)}
              className={`p-2 rounded ${isAudioEnabled ? 'bg-blue-600' : 'bg-gray-600'} text-white`}>
              {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </button>
            <button onClick={() => setIsVideoEnabled(!isVideoEnabled)}
              className={`p-2 rounded ${isVideoEnabled ? 'bg-blue-600' : 'bg-gray-600'} text-white`}>
              <Video className="h-4 w-4" />
            </button>
            <button onClick={() => setIsScreenSharing(!isScreenSharing)}
              className={`p-2 rounded ${isScreenSharing ? 'bg-green-600' : 'bg-gray-600'} text-white`}>
              <Share2 className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2">
            <button onClick={() => setShowParticipants(!showParticipants)}
              className="w-full px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 flex items-center justify-center gap-2">
              <Users className="h-4 w-4" /> Participants ({session.students.length})
            </button>
            <button onClick={() => setShowChat(!showChat)}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center justify-center gap-2">
              <MessageSquare className="h-4 w-4" /> Chat ({chatMessages.length})
            </button>
            <button onClick={() => setShowSettings(!showSettings)}
              className="w-full px-3 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 flex items-center justify-center gap-2">
              <Settings className="h-4 w-4" /> Settings
            </button>
          </div>
        </div>
      )}

      {/* Current Activity */}
      <div className="absolute top-20 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-green-500/30 max-w-xs">
        <div className="flex items-center gap-3 mb-3">
          <Clock className="h-5 w-5 text-green-400" />
          <h3 className="text-white font-semibold">Current Activity</h3>
        </div>
        <div className="text-white text-sm font-medium mb-2">{currentActivity}</div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Duration:</span>
            <span className="text-green-300">{Math.floor((Date.now() - session.startTime) / 60000)}m</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Participants:</span>
            <span className="text-blue-300">{session.students.length}/{session.environment.capacity}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Mode:</span>
            <span className="text-purple-300 capitalize">{session.environment.layout}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
