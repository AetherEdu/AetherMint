import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { createServer } from 'http';
import { INotification } from '../models/Notification';
import logger from '../utils/logger';
const collaborationService = require('./collaborationService').default || require('./collaborationService');

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

interface ClientConnectionState {
  socketId: string;
  userId?: string;
  lastSeenSequence: number;
  lastSeenAt: Date;
  isReconnecting: boolean;
}

interface EventBuffer {
  sequence: number;
  event: string;
  data: any;
  timestamp: Date;
}

class WebsocketService {
  private io: Server;
  private userSockets: UserSockets = {};
  private socketUsers: Record<string, string> = {};
  private connectionStates: Map<string, ClientConnectionState> = new Map();
  private eventBuffers: Map<string, EventBuffer[]> = new Map();
  private sequenceCounter: number = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly MAX_BUFFER_SIZE = 1000; // Max events to buffer per client
  // Closes Issue #266: dedicated pub/sub clients for the Redis adapter.
  // Kept on the instance so they share the lifecycle with the service and
  // can be closed on graceful shutdown.
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;

  constructor(server?: any) {
    // Allow callers (notably the test suite) to inject a pre-built Server
    // instance. Otherwise build a Socket.IO server that supports both
    // websocket and long-polling so front-end clients can gracefully fall
    // back when sticky-session routing isn't available.
    if (server) {
      this.io = new Server(server, {
        cors: {
          origin: process.env.FRONTEND_URL || '*',
          methods: ['GET', 'POST'],
          credentials: true
        },
        transports: ['websocket', 'polling'],
        // Allow up to ~50k sockets per node before upstream load balancing
        // becomes the bottleneck. The actual ceiling is OS file-descriptor
        // based.
        maxHttpBufferSize: 1e6,
      });
    } else {
      // For testing purposes
      const httpServer = createServer();
      this.io = new Server(httpServer, {
        cors: {
          origin: process.env.FRONTEND_URL || '*',
          methods: ['GET', 'POST'],
          credentials: true
        },
        transports: ['websocket', 'polling'],
      });
    }

    // Configure horizontal scaling (Issue #266). Fails open if Redis is
    // unreachable: single-node deployments keep working without an adapter,
    // and a misconfigured cluster just falls back to in-process emit. The
    // container orchestrator decides whether scaling is actually required.
    this.setupHorizontalScaling();

    this.setupConnectionHandlers();
    this.startHeartbeat();
  }

  /**
   * Attach the @socket.io/redis-adapter so emits broadcast across every
   * node in the cluster. Two dedicated Redis connections are used because
   * ioredis enters "subscriber mode" once it issues SUBSCRIBE, which would
   * starve the publisher. The clients are reused for the lifetime of the
   * service; process shutdown closes them via the existing shutdown
   * coordinator.
   */
  private setupHorizontalScaling(): void {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = Number.parseInt(process.env.REDIS_PORT || '6379', 10);
    const password = process.env.REDIS_PASSWORD || undefined;

    // Disable explicit opt-out. The default is to opt in so the deployment
    // topology stays uniform across environments.
    if (process.env.WS_REDIS_ADAPTER_ENABLED === 'false') {
      logger.info('WebSocket Redis adapter disabled by config (WS_REDIS_ADAPTER_ENABLED=false)');
      return;
    }

    try {
      this.pubClient = new Redis({ host, port, password, lazyConnect: false });
      this.subClient = this.pubClient.duplicate();

      this.pubClient.on('error', (err) => {
        logger.warn('WebSocket Redis pub client error', { error: err.message });
      });
      this.subClient.on('error', (err) => {
        logger.warn('WebSocket Redis sub client error', { error: err.message });
      });

      this.io.adapter(createAdapter(this.pubClient, this.subClient));
      logger.info('WebSocket horizontal scaling enabled (Redis adapter attached)', {
        host,
        port,
      });
    } catch (err) {
      logger.error('Failed to attach WebSocket Redis adapter', err as Error);
    }
  }

  private setupConnectionHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info('User connected', { socketId: socket.id });

      // Initialize connection state
      this.connectionStates.set(socket.id, {
        socketId: socket.id,
        lastSeenSequence: 0,
        lastSeenAt: new Date(),
        isReconnecting: false
      });

      // Initialize event buffer for this socket
      this.eventBuffers.set(socket.id, []);

      socket.on('register-user', (userId: string) => {
        this.socketUsers[socket.id] = userId;
        this.addUserSocket(userId, socket);
        
        // Update connection state with userId
        const state = this.connectionStates.get(socket.id);
        if (state) {
          state.userId = userId;
          state.lastSeenAt = new Date();
        }
        
        logger.info('User registered with socket', { userId, socketId: socket.id });
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

      socket.on('disconnect', (reason) => {
        const state = this.connectionStates.get(socket.id);
        if (state) {
          state.isReconnecting = String(reason) !== 'io client disconnect';
          logger.info('User disconnected', { socketId: socket.id, reason, isReconnecting: state.isReconnecting });
        }
        
        delete this.socketUsers[socket.id];
        this.removeSocket(socket);
      });

      // Handle reconnection request
      socket.on('request-state-sync', (data: { lastSeenSequence?: number }) => {
        const state = this.connectionStates.get(socket.id);
        if (!state) return;

        const lastSeq = data.lastSeenSequence ?? state.lastSeenSequence;
        const missedEvents = this.getMissedEvents(socket.id, lastSeq);
        
        socket.emit('state-sync', {
          missedEvents,
          currentSequence: this.sequenceCounter,
          timestamp: new Date()
        });
        
        logger.info('State sync requested', { socketId: socket.id, lastSeenSequence: lastSeq, missedEventsCount: missedEvents.length });
      });

      // Handle sequence acknowledgment
      socket.on('ack-sequence', (data: { sequence: number }) => {
        const state = this.connectionStates.get(socket.id);
        if (state) {
          state.lastSeenSequence = data.sequence;
          state.lastSeenAt = new Date();
          // Clean up old events from buffer
          this.cleanupEventBuffer(socket.id, data.sequence);
        }
      });

      // Ping/pong heartbeat
      socket.on('pong', () => {
        const state = this.connectionStates.get(socket.id);
        if (state) {
          state.lastSeenAt = new Date();
        }
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
    
    // Clean up connection state and event buffer after delay (for reconnection)
    setTimeout(() => {
      const state = this.connectionStates.get(socket.id);
      if (state && !state.isReconnecting) {
        this.connectionStates.delete(socket.id);
        this.eventBuffers.delete(socket.id);
      }
    }, 60000); // 1 minute grace period for reconnection
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

        logger.info('Notification sent via websocket', { userId });
      } else {
        // Clean up empty socket array
        delete this.userSockets[userId];
      }
    } else {
      logger.info('No connected sockets found for user', { userId });
    }
  }

  public broadcastToAll(data: any, event: string): void {
    this.io.emit(event, data);
  }

  public emitToUser(userId: string, event: string, data: unknown): void {
    const sockets = this.userSockets[userId] || [];
    sockets.filter((socket) => socket.connected).forEach((socket) => socket.emit(event, data));
  }

  public broadcastAnalyticsUpdate(data: { count: number }): void {
    this.io.emit('active-users-update', data);
  }

  public broadcastNewTransaction(transaction: any): void {
    this.io.emit('new-transaction', transaction);
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

  /**
   * Gracefully tears down the WebSocket layer during shutdown. Every connected
   * client is told the server is going away and then force-disconnected, which
   * releases the underlying sockets so the shared HTTP server can finish
   * draining. The Socket.IO engine itself is closed when the HTTP server closes.
   */
  public close(): void {
    this.io.emit('server:shutdown', { message: 'Server is shutting down' });
    this.io.disconnectSockets(true);
    // Issue #266: release the Redis adapter connections so the graceful
    // shutdown coordinator can complete cleanly.
    void Promise.all([
      this.pubClient?.quit().catch(() => undefined),
      this.subClient?.quit().catch(() => undefined),
    ]).finally(() => {
      this.pubClient = null;
      this.subClient = null;
    });
  }

  private getRoomName(classroomId: string): string {
    return `classroom:${classroomId}`;
  }

  // --- Reconnection and State Sync Methods ---

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.io.emit('ping', { timestamp: new Date() });
      
      // Check for stale connections
      const now = new Date();
      this.connectionStates.forEach((state, socketId) => {
        const staleThreshold = new Date(now.getTime() - this.HEARTBEAT_INTERVAL * 2);
        if (state.lastSeenAt < staleThreshold) {
          const socket = this.io.sockets.sockets.get(socketId);
          if (socket && socket.connected) {
            socket.disconnect(true);
            logger.warn('Disconnected stale connection', { socketId });
          }
        }
      });
    }, this.HEARTBEAT_INTERVAL);
  }

  private bufferEvent(socketId: string, event: string, data: any): void {
    const buffer = this.eventBuffers.get(socketId);
    if (!buffer) return;

    this.sequenceCounter++;
    const eventBuffer: EventBuffer = {
      sequence: this.sequenceCounter,
      event,
      data,
      timestamp: new Date()
    };

    buffer.push(eventBuffer);

    // Maintain buffer size limit
    if (buffer.length > this.MAX_BUFFER_SIZE) {
      buffer.shift(); // Remove oldest event
    }
  }

  private getMissedEvents(socketId: string, fromSequence: number): EventBuffer[] {
    const buffer = this.eventBuffers.get(socketId);
    if (!buffer) return [];

    return buffer.filter(e => e.sequence > fromSequence);
  }

  private cleanupEventBuffer(socketId: string, upToSequence: number): void {
    const buffer = this.eventBuffers.get(socketId);
    if (!buffer) return;

    const index = buffer.findIndex(e => e.sequence > upToSequence);
    if (index > 0) {
      buffer.splice(0, index);
    }
  }

  public emitWithBuffer(socketId: string, event: string, data: any): void {
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket && socket.connected) {
      socket.emit(event, data);
      this.bufferEvent(socketId, event, data);
    }
  }

  public getConnectionState(socketId: string): ClientConnectionState | undefined {
    return this.connectionStates.get(socketId);
  }

  public cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.connectionStates.clear();
    this.eventBuffers.clear();
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
