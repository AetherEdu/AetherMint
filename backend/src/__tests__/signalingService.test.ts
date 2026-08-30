/**
 * Tests for Signaling Service
 *
 * Issue #403 — Live group classrooms with WebRTC
 */

import { SignalingService, getSignalingService } from '../services/signaling/signalingService';

describe('SignalingService', () => {
  let service: SignalingService;

  beforeEach(() => {
    service = new SignalingService();
  });

  describe('getSignalingService', () => {
    it('should return a singleton instance', () => {
      const instance1 = getSignalingService();
      const instance2 = getSignalingService();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Room management', () => {
    it('should track active rooms', () => {
      expect(service.getActiveRooms()).toEqual([]);
    });

    it('should return participant count for non-existent room', () => {
      expect(service.getParticipantCount('nonexistent')).toBe(0);
    });

    it('should return undefined for non-existent room', () => {
      expect(service.getRoom('nonexistent')).toBeUndefined();
    });
  });

  describe('Event emission', () => {
    it('should emit participant-joined event', (done) => {
      service.on('participant-joined', (data) => {
        expect(data.classroomId).toBe('room_1');
        expect(data.userId).toBe('user_1');
        done();
      });

      // Simulate the event (in real usage, this comes from socket handlers)
      service.emit('participant-joined', { classroomId: 'room_1', userId: 'user_1', name: 'Test', role: 'student' });
    });

    it('should emit participant-left event', (done) => {
      service.on('participant-left', (data) => {
        expect(data.classroomId).toBe('room_1');
        expect(data.userId).toBe('user_1');
        done();
      });

      service.emit('participant-left', { classroomId: 'room_1', userId: 'user_1' });
    });
  });
});
