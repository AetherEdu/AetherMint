'use client';

import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, Monitor } from 'lucide-react';

interface Participant {
  id: string;
  username: string;
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
}

interface VideoGridProps {
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  participants: Participant[];
  localVideoRef: React.RefObject<HTMLVideoElement>;
  isVideoOn: boolean;
}

const VideoGrid: React.FC<VideoGridProps> = ({
  localStream,
  screenStream,
  remoteStreams,
  participants,
  localVideoRef,
  isVideoOn
}) => {
  const getGridClass = (count: number) => {
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count <= 4) return 'grid-cols-2 grid-rows-2';
    if (count <= 6) return 'grid-cols-3 grid-rows-2';
    if (count <= 9) return 'grid-cols-3 grid-rows-3';
    return 'grid-cols-4 grid-rows-3';
  };

  const totalParticipants = participants.length + 1; // +1 for local user

  return (
    <div className="w-full h-full p-4 bg-gray-900">
      {screenStream ? (
        // Screen sharing view
        <div className="w-full h-full flex flex-col">
          <div className="flex-1 bg-black rounded-lg overflow-hidden">
            <video
              autoPlay
              playsInline
              ref={(video) => {
                if (video && screenStream) {
                  video.srcObject = screenStream;
                }
              }}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex gap-2 mt-2 overflow-x-auto">
            {/* Local video thumbnail */}
            <VideoTile
              stream={localStream}
              username="You"
              isMuted={false}
              isVideoOn={isVideoOn}
              isLocal
              isThumbnail
            />
            {/* Remote videos thumbnails */}
            {Array.from(remoteStreams.entries()).map(([peerId, stream]) => {
              const participant = participants.find(p => p.id === peerId);
              return (
                <VideoTile
                  key={peerId}
                  stream={stream}
                  username={participant?.username || 'Unknown'}
                  isMuted={participant?.isMuted || false}
                  isVideoOn={participant?.isVideoOn || true}
                  isThumbnail
                />
              );
            })}
          </div>
        </div>
      ) : (
        // Normal grid view
        <div className={`grid ${getGridClass(totalParticipants)} gap-4 w-full h-full`}>
          {/* Local video */}
          <VideoTile
            stream={localStream}
            username="You"
            isMuted={false}
            isVideoOn={isVideoOn}
            isLocal
          />

          {/* Remote videos */}
          {Array.from(remoteStreams.entries()).map(([peerId, stream]) => {
            const participant = participants.find(p => p.id === peerId);
            return (
              <VideoTile
                key={peerId}
                stream={stream}
                username={participant?.username || 'Unknown'}
                isMuted={participant?.isMuted || false}
                isVideoOn={participant?.isVideoOn || true}
                isScreenSharing={participant?.isScreenSharing || false}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

interface VideoTileProps {
  stream: MediaStream | null;
  username: string;
  isMuted: boolean;
  isVideoOn: boolean;
  isLocal?: boolean;
  isScreenSharing?: boolean;
  isThumbnail?: boolean;
}

const VideoTile: React.FC<VideoTileProps> = ({
  stream,
  username,
  isMuted,
  isVideoOn,
  isLocal = false,
  isScreenSharing = false,
  isThumbnail = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const tileClass = isThumbnail
    ? 'w-32 h-24 flex-shrink-0'
    : 'w-full h-full';

  return (
    <div className={`${tileClass} relative bg-gray-800 rounded-lg overflow-hidden`}>
      {isVideoOn && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-700">
          <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-2xl font-bold">
            {username.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* Overlay info */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium truncate">{username}</span>
          <div className="flex items-center gap-1">
            {isScreenSharing && (
              <Monitor className="w-4 h-4 text-green-400" />
            )}
            {isMuted ? (
              <MicOff className="w-4 h-4 text-red-400" />
            ) : (
              <Mic className="w-4 h-4 text-green-400" />
            )}
            {!isVideoOn && (
              <VideoOff className="w-4 h-4 text-red-400" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoGrid;
