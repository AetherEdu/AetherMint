import { Server, Socket } from 'socket.io';
import { createServer } from 'http';
import { INotification } from '../models/Notification';
import collaborationService from './collaborationService';

// Define the shape of the notification data that will be sent to the client
interface ClientNotificationData {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: 'course' | 'message' | 'system' | 'achievement';
  isRead: boolean;
  priority: 'low' | 'medium' | 'high';
  actionUrl?: string;
  timestamp: Date;
}

interface UserSockets {
  [userId: string]: Socket[];
}

class WebsocketService {
  private io: Server;
  private userSockets: UserSockets = {};
  private socketUsers: Record<string, string> = {};

  constructor(server?: any) {
    if (server) {
      this.io = new Server(server, {
        cors: {
          origin: process.env.FRONTEND_URL || '*',
          methods: ['GET', 'POST'],
          credentials: true
        }
      });
    } else {
      // For testing purposes
      const httpServer = createServer();
      this.io = new Server(httpServer, {
        cors: {
          origin: process.env.FRONTEND_URL || '*',
          methods: ['GET', 'POST'],
          credentials: true
        }
      });
    }

    this.setupConnectionHandlers();
  }

  private setupConnectionHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`User connected: ${socket.id}`);

      socket.on('register-user', (userId: string) => {
        this.socketUsers[socket.id] = userId;
        this.addUserSocket(userId, socket);
        console.log(`User ${userId} registered with socket ${socket.id}`);
      });

      socket.on('join-classroom', (payload: { classroomId: string; userId: string; name: string; role?: 'student' | 'instructor' | 'moderator' | 'reviewer' }) => {
        const classroom = collaborationService.joinClassroom(payload.classroomId, payload);
        socket.join(this.getRoomName(payload.classroomId));
        socket.emit('classroom-state', classroom);
        this.io.to(this.getRoomName(payload.classroomId)).emit('classroom-presence-updated', classroom.participants);
      });

      socket.on('leave-classroom', (payload: { classroomId: string; userId: string }) => {
        const classroom = collaborationService.leaveClassroom(payload.classroomId, payload.userId);
        socket.leave(this.getRoomName(payload.classroomId));
        this.io.to(this.getRoomName(payload.classroomId)).emit('classroom-presence-updated', classroom.participants);
      });

      socket.on('classroom-message', (payload: { classroomId: string; userId: string; userName: string; body: string; emojis?: string[]; files?: any[] }) => {
        const message = collaborationService.addMessage(payload.classroomId, {
          userId: payload.userId,
          userName: payload.userName,
          body: payload.body,
          emojis: payload.emojis ?? [],
          files: payload.files ?? []
        });
        this.io.to(this.getRoomName(payload.classroomId)).emit('classroom-message-created', message);
      });

      socket.on('whiteboard-update', (payload: { classroomId: string; userId: string; color: string; width: number; points: Array<{ x: number; y: number }> }) => {
        const stroke = collaborationService.addWhiteboardStroke(payload.classroomId, payload);
        this.io.to(this.getRoomName(payload.classroomId)).emit('whiteboard-updated', stroke);
      });

      socket.on('screen-share-status', (payload: { classroomId: string; userId?: string; streamLabel?: string; active: boolean }) => {
        const classroom = payload.active && payload.userId
          ? collaborationService.setScreenShare(payload.classroomId, payload.userId, payload.streamLabel)
          : collaborationService.clearScreenShare(payload.classroomId);
        this.io.to(this.getRoomName(payload.classroomId)).emit('screen-share-updated', classroom.screenShare);
      });

      socket.on('hand-raise', (payload: { classroomId: string; userId: string; raised: boolean }) => {
        const classroom = collaborationService.setHandRaise(payload.classroomId, payload.userId, payload.raised);
        this.io.to(this.getRoomName(payload.classroomId)).emit('hand-raise-updated', classroom.presenterControls.queue);
      });

      socket.on('poll-response', (payload: { classroomId: string; pollId: string; optionId: string; userId: string }) => {
        const poll = collaborationService.respondToPoll(payload.classroomId, payload.pollId, payload.optionId, payload.userId);
        this.io.to(this.getRoomName(payload.classroomId)).emit('poll-updated', poll);
      });

      socket.on('document-sync', (payload: { workspaceId: string; documentId: string; title: string; userId: string; version: number; updatedAt?: Date; content: Record<string, unknown>; strategy?: any }) => {
        const document = collaborationService.syncDocument(payload);
        this.io.emit(`workspace-document-${payload.workspaceId}`, document);
      });

      socket.on('disconnect', () => {
        delete this.socketUsers[socket.id];
        this.removeSocket(socket);
        console.log(`User disconnected: ${socket.id}`);
      });
    });
  }

  private addUserSocket(userId: string, socket: Socket): void {
    if (!this.userSockets[userId]) {
      this.userSockets[userId] = [];
    }

    // Remove any existing sockets for this user that might be stale
    this.userSockets[userId] = this.userSockets[userId].filter(s => s.connected);
    this.userSockets[userId].push(socket);

    // Set up cleanup when socket disconnects
    socket.once('disconnect', () => {
      this.removeUserSocket(userId, socket);
    });
  }

  private removeUserSocket(userId: string, socket: Socket): void {
    if (this.userSockets[userId]) {
      this.userSockets[userId] = this.userSockets[userId].filter(s => s.id !== socket.id);
      
      // Clean up empty arrays
      if (this.userSockets[userId].length === 0) {
        delete this.userSockets[userId];
      }
    }
  }

  private removeSocket(socket: Socket): void {
    // Find and remove this socket from all user arrays
    Object.keys(this.userSockets).forEach(userId => {
      this.userSockets[userId] = this.userSockets[userId].filter(s => s.id !== socket.id);
      
      if (this.userSockets[userId].length === 0) {
        delete this.userSockets[userId];
      }
    });

    delete this.socketUsers[socket.id];
  }

  public sendNotification(userId: string, notification: INotification): void {
    const userSockets = this.userSockets[userId];

    if (userSockets && userSockets.length > 0) {
      // Filter out disconnected sockets
      const connectedSockets = userSockets.filter(socket => socket.connected);

      if (connectedSockets.length > 0) {
        // Send notification to all connected sockets for this user
        connectedSockets.forEach(socket => {
          socket.emit('new-notification', {
            id: notification._id.toString(),
            userId: notification.userId,
            title: notification.title,
            message: notification.message,
            category: notification.category,
            isRead: notification.isRead,
            priority: notification.priority,
            actionUrl: notification.actionUrl,
            timestamp: notification.createdAt,
          });
        });

        console.log(`Notification sent via websocket to user ${userId}`);
      } else {
        // Clean up empty socket array
        delete this.userSockets[userId];
      }
    } else {
      console.log(`No connected sockets found for user ${userId}`);
    }
  }

  public broadcastToAll(data: any, event: string): void {
    this.io.emit(event, data);
  }

  public emitToUser(userId: string, event: string, data: unknown): void {
    const sockets = this.userSockets[userId] || [];
    sockets.filter((socket) => socket.connected).forEach((socket) => socket.emit(event, data));
  }

  public emitToRoom(classroomId: string, event: string, data: unknown): void {
    this.io.to(this.getRoomName(classroomId)).emit(event, data);
  }

  public getConnectedUsers(): string[] {
    return Object.keys(this.userSockets);
  }

  public getUserSocketCount(userId: string): number {
    return this.userSockets[userId] ? this.userSockets[userId].length : 0;
  }

  public getIO(): Server {
    return this.io;
  }

  private getRoomName(classroomId: string): string {
    return `classroom:${classroomId}`;
  }
}

// Create a singleton instance
let websocketService: WebsocketService;

export const initWebsocketService = (server?: any): WebsocketService => {
  if (!websocketService) {
    websocketService = new WebsocketService(server);
  }
  return websocketService;
};

export const getWebsocketService = (): WebsocketService => {
  if (!websocketService) {
    throw new Error('Websocket service not initialized. Call initWebsocketService first.');
  }
  return websocketService;
};
