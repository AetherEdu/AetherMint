'use client';

import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useWhiteboard } from '@/hooks/useWhiteboard';
import VideoGrid from './VideoGrid';
import Whiteboard from './Whiteboard';
import ChatPanel from './ChatPanel';
import ControlBar from './ControlBar';
import ParticipantsList from './ParticipantsList';
import toast from 'react-hot-toast';

interface Participant {
  id: string;
  userId: string;
  username: string;
  role: 'instructor' | 'student';
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
}

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
  role
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showParticipants, setShowParticipants] = useState(true);

  const localVideoRef = useRef<HTMLVideoElement>(null);

  const { remoteStreams } = useWebRTC(socket, roomId, localStream);
  const whiteboardHook = useWhiteboard(socket, roomId);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000', {
      transports: ['websocket'],
      reconnection: true
    });

    newSocket.on('connect', () => {
      console.log('Connected to collaboration server');
      newSocket.emit('join-room', { roomId, userId, username, role });
    });

    newSocket.on('room-state', (state) => {
      setParticipants(state.participants);
    });

    newSocket.on('participant-joined', (participant: Participant) => {
      setParticipants(prev => [...prev, participant]);
      toast.success(`${participant.username} joined the room`);
    });

    newSocket.on('participant-left', ({ participantId }) => {
      setParticipants(prev => prev.filter(p => p.id !== participantId));
    });

    newSocket.on('participant-muted', ({ participantId, isMuted }) => {
      setParticipants(prev =>
        prev.map(p => p.id === participantId ? { ...p, isMuted } : p)
      );
    });

    newSocket.on('participant-video-toggled', ({ participantId, isVideoOn }) => {
      setParticipants(prev =>
        prev.map(p => p.id === participantId ? { ...p, isVideoOn } : p)
      );
    });

    newSocket.on('screen-share-started', ({ participantId, username }) => {
      setParticipants(prev =>
        prev.map(p => p.id === participantId ? { ...p, isScreenSharing: true } : p)
      );
      toast(`${username} started sharing screen`);
    });

    newSocket.on('screen-share-stopped', ({ participantId }) => {
      setParticipants(prev =>
        prev.map(p => p.id === participantId ? { ...p, isScreenSharing: false } : p)
      );
    });

    newSocket.on('kicked-from-room', () => {
      toast.error('You have been removed from the room');
      window.location.href = '/dashboard';
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('leave-room', { roomId });
      newSocket.disconnect();
    };
  }, [roomId, userId, username, role]);

  // Initialize local media stream
  useEffect(() => {
    const initMediaStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        setLocalStream(stream);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing media devices:', error);
        toast.error('Failed to access camera/microphone');
      }
    };

    initMediaStream();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        socket?.emit('toggle-mute', { roomId, isMuted: !audioTrack.enabled });
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
        socket?.emit('toggle-video', { roomId, isVideoOn: videoTrack.enabled });
      }
    }
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always'
        },
        audio: false
      });

      setScreenStream(stream);
      setIsScreenSharing(true);
      socket?.emit('start-screen-share', { roomId });

      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
    } catch (error) {
      console.error('Error sharing screen:', error);
      toast.error('Failed to share screen');
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
      socket?.emit('stop-screen-share', { roomId });
    }
  };

  const leaveRoom = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
    }
    socket?.emit('leave-room', { roomId });
    window.location.href = '/dashboard';
  };

  const kickParticipant = (participantId: string) => {
    if (role === 'instructor') {
      socket?.emit('kick-participant', { roomId, participantId });
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {/* Video grid or whiteboard */}
        <div className="flex-1 relative">
          {showWhiteboard ? (
            <Whiteboard {...whiteboardHook} />
          ) : (
            <VideoGrid
              localStream={localStream}
              screenStream={screenStream}
              remoteStreams={remoteStreams}
              participants={participants}
              localVideoRef={localVideoRef}
              isVideoOn={isVideoOn}
            />
          )}
        </div>

        {/* Control bar */}
        <ControlBar
          isMuted={isMuted}
          isVideoOn={isVideoOn}
          isScreenSharing={isScreenSharing}
          showWhiteboard={showWhiteboard}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onToggleScreenShare={isScreenSharing ? stopScreenShare : startScreenShare}
          onToggleWhiteboard={() => setShowWhiteboard(!showWhiteboard)}
          onLeaveRoom={leaveRoom}
        />
      </div>

      {/* Side panels */}
      {showParticipants && (
        <ParticipantsList
          participants={participants}
          currentUserId={userId}
          userRole={role}
          onKickParticipant={kickParticipant}
          onClose={() => setShowParticipants(false)}
        />
      )}

      {showChat && (
        <ChatPanel
          socket={socket}
          roomId={roomId}
          username={username}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  );
};

export default CollaborationRoom;
