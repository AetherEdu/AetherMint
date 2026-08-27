/**
 * Tests for Classroom Session Routes
 *
 * Issue #403 — Live group classrooms with WebRTC
 */

import request from 'supertest';
import express from 'express';

// We test the router directly without mounting the full app
import classroomRouter from '../routes/classroom';

const app = express();
app.use(express.json());
app.use('/api/classroom', classroomRouter);

describe('Classroom Routes', () => {
  let sessionId: string;

  describe('POST /api/classroom/sessions', () => {
    it('should require authentication to create', async () => {
      const response = await request(app)
        .post('/api/classroom/sessions')
        .send({
          title: 'Test WebRTC Class',
          courseId: 'course_test_001',
          settings: { maxParticipants: 25, allowRecording: true },
        });

      expect(response.status).toBe(401);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/classroom/sessions')
        .send({ title: 'Test', courseId: 'course_test_001' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/classroom/sessions', () => {
    it('should list all sessions', async () => {
      const response = await request(app).get('/api/classroom/sessions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/classroom/sessions/:sessionId', () => {
    it('should get a specific session', async () => {
      const response = await request(app).get('/api/classroom/sessions/classroom_demo_001');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('classroom_demo_001');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app).get('/api/classroom/sessions/nonexistent');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/classroom/sessions/:sessionId/start', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post(`/api/classroom/sessions/${sessionId}/start`);

      // Without auth middleware, authenticateToken returns 401
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/classroom/sessions/:sessionId/join', () => {
    it('should allow joining a live session', async () => {
      // First start the session by directly modifying it (test helper)
      // In a real test, we'd use auth middleware. For now, test the join flow.
      const response = await request(app)
        .post(`/api/classroom/sessions/classroom_demo_001/join`)
        .send({ userId: 'student_1', name: 'Alice', role: 'student' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.participants.length).toBeGreaterThan(0);
    });

    it('should reject join without required fields', async () => {
      const response = await request(app)
        .post(`/api/classroom/sessions/classroom_demo_001/join`)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/classroom/sessions/:sessionId/leave', () => {
    it('should allow leaving a session', async () => {
      const response = await request(app)
        .post(`/api/classroom/sessions/classroom_demo_001/leave`)
        .send({ userId: 'student_1' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/classroom/sessions/:sessionId/breakout-rooms', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post(`/api/classroom/sessions/classroom_demo_001/breakout-rooms`)
        .send({ title: 'Concept Clinic', participantIds: ['student_1', 'student_2'] });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/classroom/sessions/:sessionId/recording/start', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post(`/api/classroom/sessions/classroom_demo_001/recording/start`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/classroom/sessions/:sessionId/playback', () => {
    it('should return 404 when no recording exists', async () => {
      const response = await request(app)
        .get(`/api/classroom/sessions/classroom_demo_001/playback`);

      expect(response.status).toBe(404);
    });
  });
});
