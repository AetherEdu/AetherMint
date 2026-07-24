'use client';

import React from 'react';
import { Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, Pencil, PhoneOff } from 'lucide-react';

interface ControlBarProps {
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  showWhiteboard: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleWhiteboard: () => void;
  onLeaveRoom: () => void;
}

const ControlBar: React.FC<ControlBarProps> = ({
  isMuted,
  isVideoOn,
  isScreenSharing,
  showWhiteboard,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onToggleWhiteboard,
  onLeaveRoom
}) => {
  return (
    <div className="bg-gray-800 border-t border-gray-700 p-4">
      <div className="flex items-center justify-center gap-4">
        {/* Mute/Unmute */}
        <button
          onClick={onToggleMute}
          className={`p-4 rounded-full transition-all ${
            isMuted
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-gray-700 hover:bg-gray-600'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <MicOff className="w-6 h-6" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </button>

        {/* Video On/Off */}
        <button
          onClick={onToggleVideo}
          className={`p-4 rounded-full transition-all ${
            !isVideoOn
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-gray-700 hover:bg-gray-600'
          }`}
          title={isVideoOn ? 'Turn off video' : 'Turn on video'}
        >
          {isVideoOn ? (
            <Video className="w-6 h-6" />
          ) : (
            <VideoOff className="w-6 h-6" />
          )}
        </button>

        {/* Screen Share */}
        <button
          onClick={onToggleScreenShare}
          className={`p-4 rounded-full transition-all ${
            isScreenSharing
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-gray-700 hover:bg-gray-600'
          }`}
          title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        >
          {isScreenSharing ? (
            <MonitorOff className="w-6 h-6" />
          ) : (
            <Monitor className="w-6 h-6" />
          )}
        </button>

        {/* Whiteboard */}
        <button
          onClick={onToggleWhiteboard}
          className={`p-4 rounded-full transition-all ${
            showWhiteboard
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-gray-700 hover:bg-gray-600'
          }`}
          title={showWhiteboard ? 'Hide whiteboard' : 'Show whiteboard'}
        >
          <Pencil className="w-6 h-6" />
        </button>

        <div className="w-px h-12 bg-gray-700 mx-2" />

        {/* Leave Room */}
        <button
          onClick={onLeaveRoom}
          className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-all"
          title="Leave room"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default ControlBar;
