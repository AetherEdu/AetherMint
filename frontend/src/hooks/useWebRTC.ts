import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';

interface PeerConnection {
  connection: RTCPeerConnection;
  stream?: MediaStream;
}

export interface GroupParticipant {
  userId: string;
  name: string;
  role: 'student' | 'instructor' | 'moderator';
  isOnline: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  connectionQuality?: string;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

/**
 * useWebRTC — Supports both 1:1 and group (mesh) WebRTC calls.
 *
 * Group mode: When `groupMode` is true, the hook manages peer connections
 * for all participants in a classroom using a full-mesh topology. Each
 * participant maintains a direct connection to every other participant.
 */
export const useWebRTC = (
  socket: Socket | null,
  roomId: string,
  localStream: MediaStream | null,
  groupMode = false
) => {
  const [peers, setPeers] = useState<Map<string, PeerConnection>>(new Map());
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [participants, setParticipants] = useState<GroupParticipant[]>([]);
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());

  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    const peerConnection = new RTCPeerConnection(ICE_SERVERS);

    // Add local stream tracks to peer connection
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    }

    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemoteStreams(prev => new Map(prev).set(peerId, remoteStream));
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc-ice-candidate', {
          roomId,
          targetId: peerId,
          candidate: event.candidate
        });
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'disconnected' || 
          peerConnection.connectionState === 'failed') {
        removePeer(peerId);
      }
    };

    return peerConnection;
  }, [localStream, socket, roomId]);

  const createOffer = useCallback(async (peerId: string) => {
    try {
      const peerConnection = createPeerConnection(peerId);
      peersRef.current.set(peerId, { connection: peerConnection });
      setPeers(new Map(peersRef.current));

      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await peerConnection.setLocalDescription(offer);

      if (socket) {
        socket.emit('webrtc-offer', {
          roomId,
          targetId: peerId,
          offer
        });
      }
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }, [createPeerConnection, socket, roomId]);

  const handleOffer = useCallback(async (senderId: string, offer: RTCSessionDescriptionInit) => {
    try {
      const peerConnection = createPeerConnection(senderId);
      peersRef.current.set(senderId, { connection: peerConnection });
      setPeers(new Map(peersRef.current));

      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      if (socket) {
        socket.emit('webrtc-answer', {
          roomId,
          targetId: senderId,
          answer
        });
      }
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }, [createPeerConnection, socket, roomId]);

  const handleAnswer = useCallback(async (senderId: string, answer: RTCSessionDescriptionInit) => {
    try {
      const peer = peersRef.current.get(senderId);
      if (peer) {
        await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }, []);

  const handleICECandidate = useCallback(async (senderId: string, candidate: RTCIceCandidateInit) => {
    try {
      const peer = peersRef.current.get(senderId);
      if (peer) {
        await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }, []);

  const removePeer = useCallback((peerId: string) => {
    const peer = peersRef.current.get(peerId);
    if (peer) {
      peer.connection.close();
      peersRef.current.delete(peerId);
      setPeers(new Map(peersRef.current));
      
      setRemoteStreams(prev => {
        const newStreams = new Map(prev);
        newStreams.delete(peerId);
        return newStreams;
      });
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('webrtc-offer', ({ senderId, offer }) => {
      handleOffer(senderId, offer);
    });

    socket.on('webrtc-answer', ({ senderId, answer }) => {
      handleAnswer(senderId, answer);
    });

    socket.on('webrtc-ice-candidate', ({ senderId, candidate }) => {
      handleICECandidate(senderId, candidate);
    });

    socket.on('participant-joined', (participant) => {
      createOffer(participant.id);
    });

    socket.on('participant-left', ({ participantId }) => {
      removePeer(participantId);
    });

    return () => {
      socket.off('webrtc-offer');
      socket.off('webrtc-answer');
      socket.off('webrtc-ice-candidate');
      socket.off('participant-joined');
      socket.off('participant-left');
    };
  }, [socket, handleOffer, handleAnswer, handleICECandidate, createOffer, removePeer]);

  // ── Group call: join/leave/signaling via Socket.IO ──────────────────
  const joinGroup = useCallback((userId: string, name: string, role: 'student' | 'instructor' | 'moderator' = 'student') => {
    if (!socket) return;
    socket.emit('classroom:join', { classroomId: roomId, userId, name, role });
  }, [socket, roomId]);

  const leaveGroup = useCallback(() => {
    if (!socket) return;
    socket.emit('classroom:leave', { classroomId: roomId });
    // Close all peer connections
    peersRef.current.forEach((peer) => peer.connection.close());
    peersRef.current.clear();
    setPeers(new Map());
    setRemoteStreams(new Map());
    setParticipants([]);
  }, [socket, roomId]);

  const sendGroupOffer = useCallback(async (targetUserId: string) => {
    if (!socket || !localStream) return;
    const peerConnection = createPeerConnection(targetUserId);
    peersRef.current.set(targetUserId, { connection: peerConnection });
    setPeers(new Map(peersRef.current));

    const offer = await peerConnection.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await peerConnection.setLocalDescription(offer);

    socket.emit('classroom:offer', { classroomId: roomId, toUserId: targetUserId, sdp: offer });
  }, [socket, localStream, roomId, createPeerConnection]);

  useEffect(() => {
    if (!socket || !groupMode) return;

    socket.on('classroom:participants', (data: { participants: GroupParticipant[] }) => {
      setParticipants(data.participants);
    });

    socket.on('classroom:participant-joined', (data: { userId: string; name: string; participants: GroupParticipant[] }) => {
      setParticipants(data.participants);
      // Initiate connection to the new participant
      sendGroupOffer(data.userId);
    });

    socket.on('classroom:participant-left', (data: { userId: string; participants: GroupParticipant[] }) => {
      setParticipants(data.participants);
      removePeer(data.userId);
    });

    socket.on('classroom:offer', async (data: { fromUserId: string; sdp: RTCSessionDescriptionInit }) => {
      await handleOffer(data.fromUserId, data.sdp);
    });

    socket.on('classroom:answer', async (data: { fromUserId: string; sdp: RTCSessionDescriptionInit }) => {
      await handleAnswer(data.fromUserId, data.sdp);
    });

    socket.on('classroom:ice-candidate', async (data: { fromUserId: string; candidate: RTCIceCandidateInit }) => {
      await handleICECandidate(data.fromUserId, data.candidate);
    });

    socket.on('classroom:media-state', (data: { userId: string; audioEnabled?: boolean; videoEnabled?: boolean }) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.userId === data.userId
            ? { ...p, audioEnabled: data.audioEnabled ?? p.audioEnabled, videoEnabled: data.videoEnabled ?? p.videoEnabled }
            : p
        )
      );
    });

    return () => {
      socket.off('classroom:participants');
      socket.off('classroom:participant-joined');
      socket.off('classroom:participant-left');
      socket.off('classroom:offer');
      socket.off('classroom:answer');
      socket.off('classroom:ice-candidate');
      socket.off('classroom:media-state');
    };
  }, [socket, groupMode, handleOffer, handleAnswer, handleICECandidate, removePeer, sendGroupOffer]);

  return {
    peers,
    remoteStreams,
    participants,
    createOffer,
    removePeer,
    joinGroup,
    leaveGroup,
    sendGroupOffer
  };
};
