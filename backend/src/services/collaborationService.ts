import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import logger from '../utils/logger';

// Type definitions for WebRTC (these are browser types, not available in Node)
interface RTCSessionDescriptionInit {
  type?: 'offer' | 'answer' | 'pranswer' | 'rollback' | null;
  sdp?: string | null;
}

interface RTCIceCandidateInit {
  candidate?: string | null;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

interface Participant {
  id: string;
  userId: string;
  username: string;
  role: 'instructor' | 'student';
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
}

interface Room {
  id: string;
  name: string;
  participants: Map<string, Participant>;
  whiteboardState: any[];
  chatHistory: any[];
  createdAt: Date;
  lastActivityAt: Date;
}

export class CollaborationService {
  private io: SocketIOServer;
  private rooms: Map<string, Room> = new Map();
  private participantSessions: Map<string, { roomId: string; userId: string; lastSeenAt: Date }> = new Map();
  private sessionRecoveryGracePeriod: number = 120000; // 2 minutes grace period for reconnection

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.initializeSocketHandlers();
  }

  private initializeSocketHandlers() {
    this.io.on('connection', (socket: Socket) => {
      logger.info('Client connected', { socketId: socket.id });

      socket.on('join-room', this.handleJoinRoom(socket));
      socket.on('leave-room', this.handleLeaveRoom(socket));
      socket.on('webrtc-offer', this.handleWebRTCOffer(socket));
      socket.on('webrtc-answer', this.handleWebRTCAnswer(socket));
      socket.on('webrtc-ice-candidate', this.handleICECandidate(socket));
      socket.on('whiteboard-draw', this.handleWhiteboardDraw(socket));
      socket.on('whiteboard-clear', this.handleWhiteboardClear(socket));
      socket.on('chat-message', this.handleChatMessage(socket));
      socket.on('emoji-reaction', this.handleEmojiReaction(socket));
      socket.on('toggle-mute', this.handleToggleMute(socket));
      socket.on('toggle-video', this.handleToggleVideo(socket));
      socket.on('start-screen-share', this.handleStartScreenShare(socket));
      socket.on('stop-screen-share', this.handleStopScreenShare(socket));
      socket.on('kick-participant', this.handleKickParticipant(socket));
      socket.on('disconnect', this.handleDisconnect(socket));
    });
  }

  private handleJoinRoom(socket: Socket) {
    return (data: { roomId: string; userId: string; username: string; role: 'instructor' | 'student' }) => {
      const { roomId, userId, username, role } = data;

      // Check if this is a reconnection (session recovery)
      const existingSession = this.participantSessions.get(socket.id);
      const isReconnection = existingSession?.userId === userId && existingSession?.roomId === roomId;

      if (!this.rooms.has(roomId)) {
        this.rooms.set(roomId, {
          id: roomId,
          name: `Room ${roomId}`,
          participants: new Map(),
          whiteboardState: [],
          chatHistory: [],
          createdAt: new Date(),
          lastActivityAt: new Date()
        });
      }

      const room = this.rooms.get(roomId)!;
      room.lastActivityAt = new Date();
      
      const participant: Participant = {
        id: socket.id,
        userId,
        username,
        role,
        isMuted: false,
        isVideoOn: true,
        isScreenSharing: false
      };

      room.participants.set(socket.id, participant);
      socket.join(roomId);

      // Track session for recovery
      this.participantSessions.set(socket.id, {
        roomId,
        userId,
        lastSeenAt: new Date()
      });

      // Send current room state to the participant
      socket.emit('room-state', {
        participants: Array.from(room.participants.values()),
        whiteboardState: room.whiteboardState,
        chatHistory: room.chatHistory,
        isReconnection
      });

      if (!isReconnection) {
        // Notify others about the new participant only if not reconnecting
        socket.to(roomId).emit('participant-joined', participant);
        logger.info('User joined room', { username, roomId });
      } else {
        logger.info('User reconnected to room', { username, roomId, socketId: socket.id });
      }
    };
  }

  private handleLeaveRoom(socket: Socket) {
    return (data: { roomId: string }) => {
      const { roomId } = data;
      const room = this.rooms.get(roomId);

      if (room) {
        const participant = room.participants.get(socket.id);
        room.participants.delete(socket.id);
        socket.leave(roomId);

        socket.to(roomId).emit('participant-left', { participantId: socket.id });

        if (room.participants.size === 0) {
          this.rooms.delete(roomId);
        }

        logger.info('Participant left room', { socketId: socket.id, roomId });
      }
    };
  }

  private handleWebRTCOffer(socket: Socket) {
    return (data: { roomId: string; targetId: string; offer: RTCSessionDescriptionInit }) => {
      socket.to(data.targetId).emit('webrtc-offer', {
        senderId: socket.id,
        offer: data.offer
      });
    };
  }

  private handleWebRTCAnswer(socket: Socket) {
    return (data: { roomId: string; targetId: string; answer: RTCSessionDescriptionInit }) => {
      socket.to(data.targetId).emit('webrtc-answer', {
        senderId: socket.id,
        answer: data.answer
      });
    };
  }

  private handleICECandidate(socket: Socket) {
    return (data: { roomId: string; targetId: string; candidate: RTCIceCandidateInit }) => {
      socket.to(data.targetId).emit('webrtc-ice-candidate', {
        senderId: socket.id,
        candidate: data.candidate
      });
    };
  }

  private handleWhiteboardDraw(socket: Socket) {
    return (data: { roomId: string; drawData: any }) => {
      const room = this.rooms.get(data.roomId);
      if (room) {
        room.whiteboardState.push(data.drawData);
        socket.to(data.roomId).emit('whiteboard-update', data.drawData);
      }
    };
  }

  private handleWhiteboardClear(socket: Socket) {
    return (data: { roomId: string }) => {
      const room = this.rooms.get(data.roomId);
      if (room) {
        room.whiteboardState = [];
        socket.to(data.roomId).emit('whiteboard-cleared');
      }
    };
  }

  private handleChatMessage(socket: Socket) {
    return (data: { roomId: string; message: string; username: string }) => {
      const room = this.rooms.get(data.roomId);
      if (room) {
        const chatMessage = {
          id: Date.now().toString(),
          userId: socket.id,
          username: data.username,
          message: data.message,
          timestamp: new Date()
        };
        room.chatHistory.push(chatMessage);
        this.io.to(data.roomId).emit('chat-message', chatMessage);
      }
    };
  }

  private handleEmojiReaction(socket: Socket) {
    return (data: { roomId: string; emoji: string; username: string }) => {
      this.io.to(data.roomId).emit('emoji-reaction', {
        userId: socket.id,
        username: data.username,
        emoji: data.emoji,
        timestamp: Date.now()
      });
    };
  }

  private handleToggleMute(socket: Socket) {
    return (data: { roomId: string; isMuted: boolean }) => {
      const room = this.rooms.get(data.roomId);
      if (room) {
        const participant = room.participants.get(socket.id);
        if (participant) {
          participant.isMuted = data.isMuted;
          socket.to(data.roomId).emit('participant-muted', {
            participantId: socket.id,
            isMuted: data.isMuted
          });
        }
      }
    };
  }

  private handleToggleVideo(socket: Socket) {
    return (data: { roomId: string; isVideoOn: boolean }) => {
      const room = this.rooms.get(data.roomId);
      if (room) {
        const participant = room.participants.get(socket.id);
        if (participant) {
          participant.isVideoOn = data.isVideoOn;
          socket.to(data.roomId).emit('participant-video-toggled', {
            participantId: socket.id,
            isVideoOn: data.isVideoOn
          });
        }
      }
    };
  }

  private handleStartScreenShare(socket: Socket) {
    return (data: { roomId: string }) => {
      const room = this.rooms.get(data.roomId);
      if (room) {
        const participant = room.participants.get(socket.id);
        if (participant) {
          participant.isScreenSharing = true;
          socket.to(data.roomId).emit('screen-share-started', {
            participantId: socket.id,
            username: participant.username
          });
        }
      }
    };
  }

  private handleStopScreenShare(socket: Socket) {
    return (data: { roomId: string }) => {
      const room = this.rooms.get(data.roomId);
      if (room) {
        const participant = room.participants.get(socket.id);
        if (participant) {
          participant.isScreenSharing = false;
          socket.to(data.roomId).emit('screen-share-stopped', {
            participantId: socket.id
          });
        }
      }
    };
  }

  private handleKickParticipant(socket: Socket) {
    return (data: { roomId: string; participantId: string }) => {
      const room = this.rooms.get(data.roomId);
      if (room) {
        const kicker = room.participants.get(socket.id);
        if (kicker && kicker.role === 'instructor') {
          room.participants.delete(data.participantId);
          this.io.to(data.participantId).emit('kicked-from-room');
          socket.to(data.roomId).emit('participant-left', { participantId: data.participantId });
        }
      }
    };
  }

  private handleDisconnect(socket: Socket) {
    return () => {
      logger.info('Client disconnected', { socketId: socket.id });
      
      const session = this.participantSessions.get(socket.id);
      
      this.rooms.forEach((room, roomId) => {
        if (room.participants.has(socket.id)) {
          // Mark participant as potentially reconnecting
          if (session) {
            session.lastSeenAt = new Date();
          }
          
          // Don't immediately remove - wait for grace period
          setTimeout(() => {
            const currentSession = this.participantSessions.get(socket.id);
            const now = new Date();
            const gracePeriodExpired = !currentSession || 
              (now.getTime() - currentSession.lastSeenAt.getTime()) > this.sessionRecoveryGracePeriod;
            
            if (gracePeriodExpired) {
              const currentRoom = this.rooms.get(roomId);
              if (currentRoom && currentRoom.participants.has(socket.id)) {
                currentRoom.participants.delete(socket.id);
                this.io.to(roomId).emit('participant-left', { participantId: socket.id });
                
                if (currentRoom.participants.size === 0) {
                  this.rooms.delete(roomId);
                }
              }
              this.participantSessions.delete(socket.id);
              logger.info('Participant session expired', { socketId: socket.id, roomId });
            }
          }, this.sessionRecoveryGracePeriod);
        }
      });
    };
  }

  public getRoomInfo(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return {
      id: room.id,
      name: room.name,
      participantCount: room.participants.size,
      participants: Array.from(room.participants.values()),
      createdAt: room.createdAt,
      lastActivityAt: room.lastActivityAt
    };
  }

  public recoverSession(socketId: string): { roomId?: string; userId?: string; recovered: boolean } {
    const session = this.participantSessions.get(socketId);
    if (!session) {
      return { recovered: false };
    }

    const now = new Date();
    const withinGracePeriod = (now.getTime() - session.lastSeenAt.getTime()) <= this.sessionRecoveryGracePeriod;

    if (withinGracePeriod) {
      const room = this.rooms.get(session.roomId);
      if (room) {
        return {
          roomId: session.roomId,
          userId: session.userId,
          recovered: true
        };
      }
    }

    // Clean up expired session
    this.participantSessions.delete(socketId);
    return { recovered: false };
  }

  public cleanupExpiredSessions(): void {
    const now = new Date();
    const expiredSessions: string[] = [];

    this.participantSessions.forEach((session, socketId) => {
      if ((now.getTime() - session.lastSeenAt.getTime()) > this.sessionRecoveryGracePeriod) {
        expiredSessions.push(socketId);
      }
    });

    expiredSessions.forEach(socketId => {
      this.participantSessions.delete(socketId);
    });

    if (expiredSessions.length > 0) {
      logger.info('Cleaned up expired sessions', { count: expiredSessions.length });
    }
  }
}
