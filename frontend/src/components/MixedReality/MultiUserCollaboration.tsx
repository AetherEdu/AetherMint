'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, User, Video, Mic, MicOff, Share2, Wifi, Globe, MessageSquare, Hand, Eye, Settings, Crown } from 'lucide-react';

export type UserRole = 'host' | 'participant' | 'moderator' | 'observer';
export type CollaborationMode = 'shared-space' | 'presentation' | 'collaborative-editing' | 'virtual-classroom';
export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

interface UserPresence {
  id: string;
  name: string;
  role: UserRole;
  avatar?: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  isSpeaking: boolean;
  isSharing: boolean;
  handTracking: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  joinTime: number;
  lastActivity: number;
  permissions: {
    canManipulate: boolean;
    canSpeak: boolean;
    canShare: boolean;
    canModerate: boolean;
  };
}

interface HolographicObject {
  id: string;
  type: 'model' | 'text' | 'annotation' | 'drawing' | 'pointer';
  ownerId: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  content: any;
  isLocked: boolean;
  collaborators: string[];
  lastModified: number;
}

interface CollaborationSession {
  id: string;
  title: string;
  description: string;
  mode: CollaborationMode;
  hostId: string;
  participants: UserPresence[];
  objects: HolographicObject[];
  settings: {
    maxParticipants: number;
    allowGuests: boolean;
    requireApproval: boolean;
    enableRecording: boolean;
    enableChat: boolean;
    enableScreenShare: boolean;
    spatialAudio: boolean;
  };
  createdAt: number;
  expiresAt?: number;
}

interface SpatialAudioNode {
  userId: string;
  position: { x: number; y: number; z: number };
  volume: number;
  isMuted: boolean;
  audioContext?: AudioContext;
  sourceNode?: AudioNode;
  pannerNode?: PannerNode;
  gainNode?: GainNode;
}

interface MultiUserCollaborationProps {
  userId: string;
  userName: string;
  userRole: UserRole;
  onSessionJoin?: (session: CollaborationSession) => void;
  onSessionLeave?: (sessionId: string) => void;
  onUserJoined?: (user: UserPresence) => void;
  onUserLeft?: (userId: string) => void;
  onObjectShared?: (object: HolographicObject) => void;
  onObjectUpdated?: (object: HolographicObject) => void;
  onMessageReceived?: (message: any) => void;
  enableSpatialAudio?: boolean;
  enableVideoChat?: boolean;
  enableScreenShare?: boolean;
  maxBandwidth?: number;
}

const DEFAULT_SESSION: CollaborationSession = {
  id: 'default-session',
  title: 'Holographic Learning Space',
  description: 'Collaborative mixed reality learning environment',
  mode: 'shared-space',
  hostId: 'host-user',
  participants: [],
  objects: [],
  settings: {
    maxParticipants: 10,
    allowGuests: true,
    requireApproval: false,
    enableRecording: false,
    enableChat: true,
    enableScreenShare: true,
    spatialAudio: true
  },
  createdAt: Date.now()
};

export function MultiUserCollaboration({
  userId,
  userName,
  userRole,
  onSessionJoin,
  onSessionLeave,
  onUserJoined,
  onUserLeft,
  onObjectShared,
  onObjectUpdated,
  onMessageReceived,
  enableSpatialAudio = true,
  enableVideoChat = true,
  enableScreenShare = true,
  maxBandwidth = 1000000
}: MultiUserCollaborationProps) {
  const [currentSession, setCurrentSession] = useState<CollaborationSession>(DEFAULT_SESSION);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [spatialAudioNodes, setSpatialAudioNodes] = useState<Map<string, SpatialAudioNode>>(new Map());
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const webSocketRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // Initialize WebRTC and WebSocket connections
  useEffect(() => {
    initializeCollaboration();
    return () => {
      cleanupConnections();
    };
  }, []);

  // Initialize collaboration system
  const initializeCollaboration = async () => {
    try {
      // Initialize WebRTC peer connections
      await initializeWebRTC();
      
      // Initialize WebSocket for signaling
      await initializeWebSocket();
      
      // Initialize spatial audio
      if (enableSpatialAudio) {
        await initializeSpatialAudio();
      }
      
      // Get local media stream
      if (enableVideoChat) {
        await getLocalMediaStream();
      }
      
      setConnectionState('connected');
      console.log('Multi-user collaboration initialized successfully');
    } catch (error) {
      console.error('Failed to initialize collaboration:', error);
      setConnectionState('disconnected');
    }
  };

  // Initialize WebRTC
  const initializeWebRTC = async () => {
    // Create peer connection configuration
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    // Create peer connections for each participant
    currentSession.participants.forEach(participant => {
      if (participant.id !== userId) {
        const pc = new RTCPeerConnection(configuration);
        peerConnectionsRef.current.set(participant.id, pc);
        setupPeerConnection(pc, participant.id);
      }
    });
  };

  // Initialize WebSocket for signaling
  const initializeWebSocket = async () => {
    const wsUrl = 'wss://localhost:8080/collaboration'; // Replace with actual WebSocket URL
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnectionState('connected');
      
      // Join current session
      ws.send(JSON.stringify({
        type: 'join-session',
        sessionId: currentSession.id,
        userId,
        userName,
        userRole
      }));
    };
    
    ws.onmessage = (event) => {
      handleSignalingMessage(JSON.parse(event.data));
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnectionState('reconnecting');
      // Attempt to reconnect
      setTimeout(() => {
        if (connectionState !== 'connected') {
          initializeWebSocket();
        }
      }, 3000);
    };
    
    webSocketRef.current = ws;
  };

  // Initialize spatial audio
  const initializeSpatialAudio = async () => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContext();
    
    audioContextRef.current = audioContext;
    
    // Create spatial audio nodes for each participant
    currentSession.participants.forEach(participant => {
      if (participant.id !== userId) {
        createSpatialAudioNode(participant);
      }
    });
  };

  // Get local media stream
  const getLocalMediaStream = async () => {
    try {
      const constraints = {
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      
      // Add tracks to peer connections
      peerConnectionsRef.current.forEach((pc, participantId) => {
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });
      });
    } catch (error) {
      console.error('Failed to get local media stream:', error);
    }
  };

  // Setup peer connection
  const setupPeerConnection = (pc: RTCPeerConnection, participantId: string) => {
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        webSocketRef.current?.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate,
          targetUserId: participantId,
          fromUserId: userId
        }));
      }
    };
    
    pc.ontrack = (event) => {
      // Handle incoming media tracks
      console.log('Received track from participant:', participantId);
    };
    
    pc.onconnectionstatechange = () => {
      console.log('Peer connection state with', participantId, ':', pc.connectionState);
    };
  };

  // Create spatial audio node
  const createSpatialAudioNode = (participant: UserPresence) => {
    if (!audioContextRef.current) return;
    
    const audioContext = audioContextRef.current;
    
    // Create audio nodes
    const sourceNode = audioContext.createMediaStreamSource(new MediaStream());
    const pannerNode = audioContext.createPanner();
    const gainNode = audioContext.createGain();
    
    // Connect nodes
    sourceNode.connect(pannerNode);
    pannerNode.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Set spatial parameters
    pannerNode.setPosition(participant.position.x, participant.position.y, participant.position.z);
    pannerNode.setOrientation(0, 0, -1);
    gainNode.gain.value = participant.isSpeaking ? 1.0 : 0.3;
    
    const spatialNode: SpatialAudioNode = {
      userId: participant.id,
      position: participant.position,
      volume: 1.0,
      isMuted: !participant.audioEnabled,
      audioContext,
      sourceNode,
      pannerNode,
      gainNode
    };
    
    spatialAudioNodes.set(participant.id, spatialNode);
  };

  // Handle signaling messages
  const handleSignalingMessage = (message: any) => {
    switch (message.type) {
      case 'user-joined':
        onUserJoined?.(message.user);
        break;
      case 'user-left':
        onUserLeft?.(message.userId);
        break;
      case 'object-shared':
        onObjectShared?.(message.object);
        break;
      case 'object-updated':
        onObjectUpdated?.(message.object);
        break;
      case 'chat-message':
        onMessageReceived?.(message.message);
        setChatMessages(prev => [...prev, message.message]);
        break;
      case 'offer':
        handleWebRTCOffer(message);
        break;
      case 'answer':
        handleWebRTCAnswer(message);
        break;
      case 'ice-candidate':
        handleWebRTCIceCandidate(message);
        break;
    }
  };

  // Handle WebRTC offer
  const handleWebRTCOffer = async (message: any) => {
    const pc = peerConnectionsRef.current.get(message.fromUserId);
    if (!pc) return;
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      webSocketRef.current?.send(JSON.stringify({
        type: 'answer',
        answer,
        targetUserId: message.fromUserId,
        fromUserId: userId
      }));
    } catch (error) {
      console.error('Error handling WebRTC offer:', error);
    }
  };

  // Handle WebRTC answer
  const handleWebRTCAnswer = async (message: any) => {
    const pc = peerConnectionsRef.current.get(message.fromUserId);
    if (!pc) return;
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
    } catch (error) {
      console.error('Error handling WebRTC answer:', error);
    }
  };

  // Handle WebRTC ICE candidate
  const handleWebRTCIceCandidate = async (message: any) => {
    const pc = peerConnectionsRef.current.get(message.fromUserId);
    if (!pc) return;
    
    try {
      await pc.addIceCandidate(message.candidate);
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  };

  // Cleanup connections
  const cleanupConnections = () => {
    // Close peer connections
    peerConnectionsRef.current.forEach(pc => {
      pc.close();
    });
    peerConnectionsRef.current.clear();
    
    // Close WebSocket
    if (webSocketRef.current) {
      webSocketRef.current.close();
    }
    
    // Close media stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
  };

  // Toggle audio
  const toggleAudio = useCallback(() => {
    setIsAudioEnabled(prev => !prev);
    
    // Update local stream audio tracks
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !isAudioEnabled;
      });
    }
    
    // Update spatial audio nodes
    spatialAudioNodes.forEach((node, userId) => {
      if (node.gainNode) {
        node.gainNode.gain.value = !isAudioEnabled ? 0 : 1.0;
      }
    });
  }, [isAudioEnabled, spatialAudioNodes]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    setIsVideoEnabled(prev => !prev);
    
    // Update local stream video tracks
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !isVideoEnabled;
      });
    }
  }, [isVideoEnabled]);

  // Toggle screen sharing
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      // Stop screen sharing
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack && videoTrack.label.startsWith('screen')) {
          videoTrack.stop();
        }
      }
      setIsScreenSharing(false);
    } else {
      // Start screen sharing
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false
        });
        
        // Replace video track in local stream
        if (localStreamRef.current) {
          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          if (videoTrack) {
            localStreamRef.current.removeTrack(videoTrack);
          }
          
          screenStream.getVideoTracks().forEach(track => {
            localStreamRef.current?.addTrack(track);
          });
        }
        
        setIsScreenSharing(true);
      } catch (error) {
        console.error('Failed to start screen sharing:', error);
      }
    }
  }, [isScreenSharing, localStreamRef]);

  // Send chat message
  const sendChatMessage = useCallback((message: string) => {
    const chatMessage = {
      id: Date.now().toString(),
      userId,
      userName,
      message,
      timestamp: Date.now(),
      type: 'text'
    };
    
    webSocketRef.current?.send(JSON.stringify({
      type: 'chat-message',
      message: chatMessage
    }));
    
    setChatMessages(prev => [...prev, chatMessage]);
  }, [userId, userName]);

  // Share holographic object
  const shareObject = useCallback((object: HolographicObject) => {
    const sharedObject = {
      ...object,
      ownerId: userId,
      collaborators: [userId],
      lastModified: Date.now()
    };
    
    webSocketRef.current?.send(JSON.stringify({
      type: 'object-shared',
      object: sharedObject
    }));
    
    onObjectShared?.(sharedObject);
  }, [userId, onObjectShared]);

  // Update holographic object
  const updateObject = useCallback((object: HolographicObject) => {
    const updatedObject = {
      ...object,
      lastModified: Date.now()
    };
    
    webSocketRef.current?.send(JSON.stringify({
      type: 'object-updated',
      object: updatedObject
    }));
    
    onObjectUpdated?.(updatedObject);
  }, [onObjectUpdated]);

  // Get user avatar
  const getUserAvatar = (user: UserPresence) => {
    if (user.avatar) return user.avatar;
    
    // Generate avatar based on role
    const avatars = {
      host: '👑',
      participant: '👤',
      moderator: '🛡️',
      observer: '👁️'
    };
    
    return avatars[user.role] || avatars.participant;
  };

  // Get connection status color
  const getConnectionStatusColor = () => {
    switch (connectionState) {
      case 'connected': return 'text-green-400';
      case 'connecting': return 'text-yellow-400';
      case 'disconnected': return 'text-red-400';
      case 'reconnecting': return 'text-orange-400';
      default: return 'text-gray-400';
    }
  };

  if (connectionState === 'disconnected') {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Connecting to collaboration space...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      {/* Main Collaboration View */}
      <div className="absolute inset-0">
        {/* 3D Space Visualization */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 to-purple-900/20">
          {/* Holographic objects would be rendered here */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Globe className="h-16 w-16 text-blue-400 mx-auto mb-4 animate-pulse" />
              <h3 className="text-white text-xl font-semibold mb-2">Holographic Collaboration Space</h3>
              <p className="text-gray-400 text-sm">Shared learning environment</p>
            </div>
          </div>
        </div>

        {/* Participant Avatars */}
        <div className="absolute inset-0 pointer-events-none">
          {currentSession.participants.map((participant, index) => {
            const avatar = getUserAvatar(participant);
            return (
              <motion.div
                key={participant.id}
                className="absolute"
                style={{
                  left: `${20 + (index * 80)}px`,
                  top: `${20}px`,
                  transform: 'translate(-50%, -50%)'
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.1 }}
              >
                <div className="relative">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl shadow-lg">
                    {avatar}
                  </div>
                  
                  {/* Speaking Indicator */}
                  {participant.isSpeaking && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  )}
                  
                  {/* Video Indicator */}
                  {participant.videoEnabled && (
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full" />
                  )}
                  
                  {/* Name */}
                  <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-sm rounded px-2 py-1 min-w-max">
                    <div className="text-white text-xs font-medium truncate">{participant.name}</div>
                    <div className="text-gray-300 text-xs capitalize">{participant.role}</div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Control Panel */}
      <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-blue-500/30">
        <div className="flex items-center gap-3 mb-4">
          <Users className="h-5 w-5 text-blue-400" />
          <h3 className="text-white font-semibold">Collaboration</h3>
        </div>

        {/* Connection Status */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-gray-400 text-sm">Status:</span>
            <span className={`text-sm font-medium ${getConnectionStatusColor()}`}>
              {connectionState}
            </span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-gray-400 text-sm">Session:</span>
            <span className="text-blue-400 text-sm font-medium">{currentSession.title}</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-gray-400 text-sm">Participants:</span>
            <span className="text-green-400 text-sm font-medium">{currentSession.participants.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Mode:</span>
            <span className="text-purple-400 text-sm font-medium capitalize">{currentSession.mode}</span>
          </div>
        </div>

        {/* Media Controls */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAudio}
              className={`p-2 rounded transition-colors ${
                isAudioEnabled 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
            >
              {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </button>
            <button
              onClick={toggleVideo}
              className={`p-2 rounded transition-colors ${
                isVideoEnabled 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
            >
              <Video className="h-4 w-4" />
            </button>
            <button
              onClick={toggleScreenShare}
              className={`p-2 rounded transition-colors ${
                isScreenSharing 
                  ? 'bg-green-600 text-white hover:bg-green-700' 
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Participants List */}
      <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-purple-500/30 max-w-xs">
        <div className="flex items-center gap-3 mb-3">
          <User className="h-5 w-5 text-purple-400" />
          <h3 className="text-white font-semibold">Participants</h3>
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className="text-purple-400 hover:text-purple-300"
          >
            {showParticipants ? 'Hide' : 'Show'}
          </button>
        </div>
        
        <AnimatePresence>
          {showParticipants && (
            <motion.div
              className="space-y-2 max-h-48 overflow-y-auto"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {currentSession.participants.map((participant) => (
                <div key={participant.id} className="flex items-center gap-2 p-2 bg-purple-600/20 rounded">
                  <div className="text-2xl">{getUserAvatar(participant)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{participant.name}</div>
                    <div className="text-purple-300 text-xs capitalize">{participant.role}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {participant.isSpeaking && (
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                    )}
                    {participant.audioEnabled && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    )}
                    {participant.videoEnabled && (
                      <div className="w-2 h-2 bg-purple-500 rounded-full" />
                    )}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chat Panel */}
      <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-green-500/30 max-w-sm">
        <div className="flex items-center gap-3 mb-3">
          <MessageSquare className="h-5 w-5 text-green-400" />
          <h3 className="text-white font-semibold">Chat</h3>
        </div>
        
        <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
          {chatMessages.slice(-5).map((message, index) => (
            <div key={message.id} className="p-2 bg-green-600/20 rounded">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-green-400 text-xs font-medium">{message.userName}</span>
                <span className="text-green-300 text-xs">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="text-white text-sm">{message.message}</div>
            </div>
          ))}
        </div>
        
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Type a message..."
            className="flex-1 px-2 py-1 bg-black/50 border border-gray-500/30 rounded text-white text-sm"
            onKeyPress={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                sendChatMessage(e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
          />
          <button
            onClick={() => sendChatMessage('Hello everyone! 👋')}
            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
          >
            Send
          </button>
        </div>
      </div>

      {/* Settings Button */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="absolute top-4 right-4 p-2 bg-black/80 backdrop-blur-md rounded-lg border border-gray-500/30 text-white hover:bg-black/90 transition-colors"
      >
        <Settings className="h-5 w-5" />
      </button>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="absolute top-16 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-gray-500/30 w-80"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <h3 className="text-white font-semibold mb-4">Collaboration Settings</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm">Max Bandwidth</label>
                <select className="w-full mt-1 p-2 bg-black/50 border border-gray-500/30 rounded text-white">
                  <option value="500000">500 KB/s</option>
                  <option value="1000000">1 MB/s</option>
                  <option value="2000000">2 MB/s</option>
                  <option value="5000000">5 MB/s</option>
                </select>
              </div>
              
              <div>
                <label className="text-gray-400 text-sm">Max Participants</label>
                <input
                  type="number"
                  min="2"
                  max="50"
                  value={currentSession.settings.maxParticipants}
                  onChange={(e) => {
                    setCurrentSession(prev => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        maxParticipants: parseInt(e.target.value)
                      }
                    }));
                  }}
                  className="w-full mt-1 p-2 bg-black/50 border border-gray-500/30 rounded text-white"
                />
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={currentSession.settings.enableRecording}
                    onChange={(e) => {
                      setCurrentSession(prev => ({
                        ...prev,
                        settings: {
                          ...prev.settings,
                          enableRecording: e.target.checked
                        }
                      }));
                    }}
                    className="rounded"
                  />
                  <span className="text-gray-400 text-sm">Enable Recording</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={currentSession.settings.enableChat}
                    onChange={(e) => {
                      setCurrentSession(prev => ({
                        ...prev,
                        settings: {
                          ...prev.settings,
                          enableChat: e.target.checked
                        }
                      }));
                    }}
                    className="rounded"
                  />
                  <span className="text-gray-400 text-sm">Enable Chat</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={currentSession.settings.spatialAudio}
                    onChange={(e) => {
                      setCurrentSession(prev => ({
                        ...prev,
                        settings: {
                          ...prev.settings,
                          spatialAudio: e.target.checked
                        }
                      }));
                    }}
                    className="rounded"
                  />
                  <span className="text-gray-400 text-sm">Spatial Audio</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={currentSession.settings.allowGuests}
                    onChange={(e) => {
                      setCurrentSession(prev => ({
                        ...prev,
                        settings: {
                          ...prev.settings,
                          allowGuests: e.target.checked
                        }
                      }));
                    }}
                    className="rounded"
                  />
                  <span className="text-gray-400 text-sm">Allow Guests</span>
                </label>
              </div>
              
              <div>
                <label className="text-gray-400 text-sm">Collaboration Mode</label>
                <select
                  value={currentSession.mode}
                  onChange={(e) => {
                    setCurrentSession(prev => ({
                      ...prev,
                      mode: e.target.value as CollaborationMode
                    }));
                  }}
                  className="w-full mt-1 p-2 bg-black/50 border border-gray-500/30 rounded text-white"
                >
                  <option value="shared-space">Shared Space</option>
                  <option value="presentation">Presentation</option>
                  <option value="collaborative-editing">Collaborative Editing</option>
                  <option value="virtual-classroom">Virtual Classroom</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Host Crown Indicator */}
      {userRole === 'host' && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-yellow-500/20 backdrop-blur-sm rounded-full p-2 border border-yellow-500/50">
          <Crown className="h-4 w-4 text-yellow-400" />
        </div>
      )}

      {/* Spatial Audio Visualization */}
      {enableSpatialAudio && (
        <div className="absolute bottom-20 right-20 bg-black/60 backdrop-blur-sm rounded-lg p-2 border border-blue-500/20">
          <div className="flex items-center gap-2 text-xs">
            <Wifi className="h-3 w-3 text-blue-400 animate-pulse" />
            <span className="text-blue-300">Spatial Audio Active</span>
          </div>
        </div>
      )}
    </div>
  );
}
