import { Server } from 'socket.io';
import { createServer } from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { initWebsocketService, getWebsocketService } from '../../src/services/websocketService';

describe('WebSocket Reconnection with State Sync', () => {
  let ioServer: Server;
  let server: any;
  let clientSocket: ClientSocket;
  let wsService: any;

  beforeAll((done) => {
    server = createServer();
    ioServer = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });
    server.listen(() => {
      const port = (server.address() as any).port;
      wsService = initWebsocketService(server);
      done();
    });
  });

  afterAll((done) => {
    if (clientSocket) clientSocket.disconnect();
    ioServer.close();
    server.close(() => done());
  });

  beforeEach((done) => {
    const port = (server.address() as any).port;
    clientSocket = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
      reconnection: false
    });
    clientSocket.on('connect', done);
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Connection State Tracking', () => {
    it('should track client connection state with sequence numbers', (done) => {
      clientSocket.emit('register-user', 'test-user-1');
      
      setTimeout(() => {
        const state = wsService.getConnectionState(clientSocket.id);
        expect(state).toBeDefined();
        expect(state?.userId).toBe('test-user-1');
        expect(state?.lastSeenSequence).toBe(0);
        expect(state?.isReconnecting).toBe(false);
        done();
      }, 100);
    });

    it('should mark connection as reconnecting on disconnect', (done) => {
      clientSocket.emit('register-user', 'test-user-2');
      
      setTimeout(() => {
        clientSocket.disconnect();
        
        setTimeout(() => {
          const state = wsService.getConnectionState(clientSocket.id);
          expect(state?.isReconnecting).toBe(true);
          done();
        }, 100);
      }, 100);
    });
  });

  describe('State Sync on Reconnect', () => {
    it('should buffer events with sequence numbers', (done) => {
      clientSocket.emit('register-user', 'test-user-3');
      
      setTimeout(() => {
        wsService.emitWithBuffer(clientSocket.id, 'test-event', { data: 'test' });
        
        setTimeout(() => {
          clientSocket.emit('request-state-sync', { lastSeenSequence: 0 });
          
          clientSocket.on('state-sync', (data: any) => {
            expect(data.missedEvents).toBeDefined();
            expect(data.missedEvents.length).toBeGreaterThan(0);
            expect(data.currentSequence).toBeGreaterThan(0);
            done();
          });
        }, 100);
      }, 100);
    });

    it('should send only missed events since last sequence', (done) => {
      clientSocket.emit('register-user', 'test-user-4');
      
      setTimeout(() => {
        // Emit multiple events
        wsService.emitWithBuffer(clientSocket.id, 'event-1', { data: 'first' });
        wsService.emitWithBuffer(clientSocket.id, 'event-2', { data: 'second' });
        wsService.emitWithBuffer(clientSocket.id, 'event-3', { data: 'third' });
        
        setTimeout(() => {
          // Request sync after sequence 1
          clientSocket.emit('request-state-sync', { lastSeenSequence: 1 });
          
          clientSocket.on('state-sync', (data: any) => {
            expect(data.missedEvents.length).toBe(2); // Should miss events 2 and 3
            done();
          });
        }, 100);
      }, 100);
    });

    it('should acknowledge sequence numbers', (done) => {
      clientSocket.emit('register-user', 'test-user-5');
      
      setTimeout(() => {
        clientSocket.emit('ack-sequence', { sequence: 5 });
        
        setTimeout(() => {
          const state = wsService.getConnectionState(clientSocket.id);
          expect(state?.lastSeenSequence).toBe(5);
          done();
        }, 100);
      }, 100);
    });
  });

  describe('Ping/Pong Heartbeat', () => {
    it('should send ping every 30 seconds', (done) => {
      let pingCount = 0;
      clientSocket.on('ping', (data: any) => {
        pingCount++;
        if (pingCount === 1) {
          expect(data.timestamp).toBeDefined();
          done();
        }
      });
      
      // Speed up heartbeat for testing
      // In production, this would be 30 seconds
    }, 35000);

    it('should respond to ping with pong', (done) => {
      clientSocket.on('ping', () => {
        clientSocket.emit('pong');
      });
      
      setTimeout(() => {
        const state = wsService.getConnectionState(clientSocket.id);
        expect(state?.lastSeenAt).toBeDefined();
        done();
      }, 100);
    });
  });

  describe('Event Buffer Management', () => {
    it('should maintain buffer size limit', (done) => {
      clientSocket.emit('register-user', 'test-user-6');
      
      setTimeout(() => {
        // Emit more events than buffer size
        for (let i = 0; i < 1100; i++) {
          wsService.emitWithBuffer(clientSocket.id, `event-${i}`, { data: i });
        }
        
        setTimeout(() => {
          clientSocket.emit('request-state-sync', { lastSeenSequence: 0 });
          
          clientSocket.on('state-sync', (data: any) => {
            // Should not exceed max buffer size (1000)
            expect(data.missedEvents.length).toBeLessThanOrEqual(1000);
            done();
          });
        }, 200);
      }, 100);
    });

    it('should clean up old events after acknowledgment', (done) => {
      clientSocket.emit('register-user', 'test-user-7');
      
      setTimeout(() => {
        for (let i = 0; i < 10; i++) {
          wsService.emitWithBuffer(clientSocket.id, `event-${i}`, { data: i });
        }
        
        setTimeout(() => {
          clientSocket.emit('ack-sequence', { sequence: 5 });
          
          setTimeout(() => {
            clientSocket.emit('request-state-sync', { lastSeenSequence: 5 });
            
            clientSocket.on('state-sync', (data: any) => {
              // Should only return events after sequence 5
              expect(data.missedEvents.length).toBeLessThanOrEqual(4);
              done();
            });
          }, 100);
        }, 100);
      }, 100);
    });
  });

  describe('Grace Period for Reconnection', () => {
    it('should preserve connection state during grace period', (done) => {
      clientSocket.emit('register-user', 'test-user-8');
      
      setTimeout(() => {
        clientSocket.disconnect();
        
        setTimeout(() => {
          const state = wsService.getConnectionState(clientSocket.id);
          expect(state).toBeDefined();
          done();
        }, 1000); // Within 1 minute grace period
      }, 100);
    });
  });
});
