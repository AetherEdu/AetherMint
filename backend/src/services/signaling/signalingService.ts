/**
 * WebSocket Signaling Service for Live Classrooms
 *
 * Handles WebRTC signaling between participants in a classroom session.
 * Manages room membership, offer/answer exchange, ICE candidate relay,
 * and participant presence via Socket.IO.
 *
 * Issue #403 — Live group classrooms with WebRTC
 */

// @ts-ignore - socket.io types may not be available
import { Server as SocketServer, Socket } from 'socket.io';
import { EventEmitter } from 'events';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SignalingParticipant {
  socketId: string;
  userId: string;
  classroomId: string;
  name: string;
  role: 'student' | 'instructor' | 'moderator';
  isOnline: boolean;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
}

export interface SignalingOffer {
  classroomId: string;
  fromUserId: string;
  toUserId: string;
  sdp: Record<string, unknown>;
}

export interface SignalingAnswer {
  classroomId: string;
  fromUserId: string;
  toUserId: string;
  sdp: Record<string, unknown>;
}

export interface SignalingIceCandidate {
  classroomId: string;
  fromUserId: string;
  toUserId: string;
  candidate: Record<string, unknown>;
}

export interface ClassroomRoom {
  id: string;
  participants: Map<string, SignalingParticipant>;
  createdAt: Date;
}

// ── Service ────────────────────────────────────────────────────────────────

export class SignalingService extends EventEmitter {
  private rooms: Map<string, ClassroomRoom> = new Map();
  private socketToUser: Map<string, { userId: string; classroomId: string }> = new Map();

  /**
   * Initialize signaling handlers on a Socket.IO server instance.
   */
  initialize(io: SocketServer): void {
    io.on('connection', (socket: Socket) => {
      this.handleConnection(socket, io);
    });
  }

  private handleConnection(socket: Socket, io: SocketServer): void {
    // ── Join classroom ────────────────────────────────────────────────────
    socket.on('classroom:join', (data: {
      classroomId: string;
      userId: string;
      name: string;
      role: 'student' | 'instructor' | 'moderator';
    }) => {
      const { classroomId, userId, name, role } = data;

      // Leave any previous room
      this.leaveCurrentRoom(socket, io);

      // Get or create room
      let room = this.rooms.get(classroomId);
      if (!room) {
        room = {
          id: classroomId,
          participants: new Map(),
          createdAt: new Date(),
        };
        this.rooms.set(classroomId, room);
      }

      // Add participant
      const participant: SignalingParticipant = {
        socketId: socket.id,
        userId,
        classroomId,
        name,
        role,
        isOnline: true,
      };

      room.participants.set(userId, participant);
      this.socketToUser.set(socket.id, { userId, classroomId });

      // Join the Socket.IO room
      socket.join(classroomId);

      // Notify existing participants
      socket.to(classroomId).emit('classroom:participant-joined', {
        userId,
        name,
        role,
        participants: this.getParticipantList(classroomId),
      });

      // Send current participant list to the joining user
      socket.emit('classroom:participants', {
        participants: this.getParticipantList(classroomId),
      });

      this.emit('participant-joined', { classroomId, userId, name, role });
    });

    // ── Leave classroom ───────────────────────────────────────────────────
    socket.on('classroom:leave', () => {
      this.handleLeave(socket, io);
    });

    // ── WebRTC Offer ──────────────────────────────────────────────────────
    socket.on('classroom:offer', (data: SignalingOffer) => {
      const { toUserId, ...offerData } = data;
      const targetParticipant = this.findParticipantByUserId(data.classroomId, toUserId);

      if (targetParticipant) {
        io.to(targetParticipant.socketId).emit('classroom:offer', {
          ...offerData,
          fromUserId: this.socketToUser.get(socket.id)?.userId,
        });
      }
    });

    // ── WebRTC Answer ─────────────────────────────────────────────────────
    socket.on('classroom:answer', (data: SignalingAnswer) => {
      const { toUserId, ...answerData } = data;
      const targetParticipant = this.findParticipantByUserId(data.classroomId, toUserId);

      if (targetParticipant) {
        io.to(targetParticipant.socketId).emit('classroom:answer', {
          ...answerData,
          fromUserId: this.socketToUser.get(socket.id)?.userId,
        });
      }
    });

    // ── ICE Candidate ─────────────────────────────────────────────────────
    socket.on('classroom:ice-candidate', (data: SignalingIceCandidate) => {
      const { toUserId, ...candidateData } = data;
      const targetParticipant = this.findParticipantByUserId(data.classroomId, toUserId);

      if (targetParticipant) {
        io.to(targetParticipant.socketId).emit('classroom:ice-candidate', {
          ...candidateData,
          fromUserId: this.socketToUser.get(socket.id)?.userId,
        });
      }
    });

    // ── Whiteboard update ─────────────────────────────────────────────────
    socket.on('classroom:whiteboard', (data: {
      classroomId: string;
      userId: string;
      stroke: unknown;
    }) => {
      socket.to(data.classroomId).emit('classroom:whiteboard', data);
    });

    // ── Chat message ──────────────────────────────────────────────────────
    socket.on('classroom:chat', (data: {
      classroomId: string;
      userId: string;
      userName: string;
      body: string;
      emojis?: string[];
      files?: Array<{ name: string; url: string; type?: string }>;
    }) => {
      io.to(data.classroomId).emit('classroom:chat', {
        ...data,
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
      });
    });

    // ── Media state update ─────────────────────────────────────────────────
    socket.on('classroom:media-state', (data: {
      classroomId: string;
      userId: string;
      audioEnabled?: boolean;
      videoEnabled?: boolean;
      screenShareEnabled?: boolean;
    }) => {
      const userInfo = this.socketToUser.get(socket.id);
      if (userInfo) {
        const room = this.rooms.get(userInfo.classroomId);
        const participant = room?.participants.get(userInfo.userId);
        if (participant) {
          Object.assign(participant, {
            audioEnabled: data.audioEnabled ?? participant.audioEnabled,
            videoEnabled: data.videoEnabled ?? participant.videoEnabled,
          });
        }
      }
      socket.to(data.classroomId).emit('classroom:media-state', data);
    });

    // ── Disconnect ────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      this.handleLeave(socket, io);
    });
  }

  private handleLeave(socket: Socket, io: SocketServer): void {
    const userInfo = this.socketToUser.get(socket.id);
    if (!userInfo) return;

    const { userId, classroomId } = userInfo;
    const room = this.rooms.get(classroomId);

    if (room) {
      room.participants.delete(userId);

      // Clean up empty rooms
      if (room.participants.size === 0) {
        this.rooms.delete(classroomId);
      } else {
        // Notify remaining participants
        io.to(classroomId).emit('classroom:participant-left', {
          userId,
          participants: this.getParticipantList(classroomId),
        });
      }
    }

    socket.leave(classroomId);
    this.socketToUser.delete(socket.id);

    this.emit('participant-left', { classroomId, userId });
  }

  private leaveCurrentRoom(socket: Socket, io: SocketServer): void {
    const userInfo = this.socketToUser.get(socket.id);
    if (!userInfo) return;

    const { userId, classroomId } = userInfo;
    const room = this.rooms.get(classroomId);

    if (room) {
      room.participants.delete(userId);
      socket.to(classroomId).emit('classroom:participant-left', {
        userId,
        participants: this.getParticipantList(classroomId),
      });
      socket.leave(classroomId);

      if (room.participants.size === 0) {
        this.rooms.delete(classroomId);
      }
    }

    this.socketToUser.delete(socket.id);
  }

  private findParticipantByUserId(classroomId: string, userId: string): SignalingParticipant | undefined {
    const room = this.rooms.get(classroomId);
    return room?.participants.get(userId);
  }

  private getParticipantList(classroomId: string): SignalingParticipant[] {
    const room = this.rooms.get(classroomId);
    if (!room) return [];
    return Array.from(room.participants.values());
  }

  // ── Public API ────────────────────────────────────────────────────────────

  getRoom(classroomId: string): ClassroomRoom | undefined {
    return this.rooms.get(classroomId);
  }

  getParticipantCount(classroomId: string): number {
    return this.rooms.get(classroomId)?.participants.size ?? 0;
  }

  getActiveRooms(): string[] {
    return Array.from(this.rooms.keys());
  }
}

// Singleton instance
let instance: SignalingService | null = null;

export function getSignalingService(): SignalingService {
  if (!instance) {
    instance = new SignalingService();
  }
  return instance;
}
