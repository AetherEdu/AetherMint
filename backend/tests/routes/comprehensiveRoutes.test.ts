/**
 * Comprehensive API Route Handler Test Suite (Issue #261)
 *
 * Covers unit and integration testing across backend route handlers:
 * - verify.ts (/api/v1/verify)
 * - disputes.ts (/api/disputes)
 * - metrics.ts (/api/metrics)
 * - forum.ts (/api/forum)
 * - notifications.ts (/api/notifications)
 * - progress.ts (/api/progress)
 * - classroom.ts (/api/classroom)
 * - bookmarks.js (/api/bookmarks)
 * - localization.ts (/api/localization)
 * - vrf.ts (/api/vrf)
 *
 * Verifies:
 * - 200/201 success responses
 * - 400 validation and bad-request errors
 * - 401/403 authentication and RBAC authorization errors
 * - 404 resource not found errors
 * - 500 internal server error handling
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { UserRole } from '../../src/models/User';
import { errorHandler } from '../../src/middleware/errorHandler';
import { NotFoundError, ValidationError, InternalError } from '../../src/utils/errors';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockGetCredentialsForDid = jest.fn();
jest.mock('../../src/services/did/didRegistryClient', () => ({
  createDIDRegistryClient: () => ({
    getCredentialsForDid: (...args: unknown[]) => mockGetCredentialsForDid(...args),
  }),
}));

const mockDisputeService = {
  open: jest.fn(),
  list: jest.fn(),
  get: jest.fn(),
  addEvidence: jest.fn(),
  resolve: jest.fn(),
};
jest.mock('../../src/services/disputes/disputeService', () => ({
  disputeService: mockDisputeService,
}));

const mockMetricsFn = jest.fn();
jest.mock('../../src/middleware/metrics', () => ({
  register: {
    metrics: (...args: unknown[]) => mockMetricsFn(...args),
    contentType: 'text/plain; version=0.0.4; charset=utf-8',
  },
}));

const mockForumService = {
  getPosts: jest.fn(),
  createPost: jest.fn(),
  upvotePost: jest.fn(),
  getReplies: jest.fn(),
  createReply: jest.fn(),
  acceptAnswer: jest.fn(),
};
jest.mock('../../src/services/forum/forumService', () => ({
  forumService: mockForumService,
}));

const mockNotificationService = {
  send: jest.fn(),
};
jest.mock('../../src/services/NotificationService', () => ({
  notificationService: mockNotificationService,
}));

const mockNotificationController = {
  getNotifications: jest.fn((req: Request, res: Response) =>
    res.status(200).json({ success: true, data: [{ id: 'notif-1', userId: req.params.userId }] }),
  ),
  deleteNotification: jest.fn((req: Request, res: Response) =>
    res.status(200).json({ success: true, deletedId: req.params.notificationId }),
  ),
  markAsRead: jest.fn((req: Request, res: Response) =>
    res.status(200).json({ success: true, id: req.params.notificationId, isRead: true }),
  ),
  markAllAsRead: jest.fn((_req: Request, res: Response) =>
    res.status(200).json({ success: true, updatedCount: 3 }),
  ),
  getPreferences: jest.fn((req: Request, res: Response) =>
    res.status(200).json({ success: true, userId: req.params.userId, email: true, push: false }),
  ),
  updatePreferences: jest.fn((req: Request, res: Response) =>
    res.status(200).json({ success: true, userId: req.params.userId, preferences: req.body }),
  ),
};
jest.mock('../../src/controllers/notificationController', () => ({
  notificationController: mockNotificationController,
}));

const mockBookmarkController = {
  getBookmarks: jest.fn((req: Request, res: Response) =>
    res.status(200).json({ success: true, userId: req.params.userId, bookmarks: ['course-1'] }),
  ),
  addBookmark: jest.fn((req: Request, res: Response) => {
    if (!req.body?.courseId) {
      return res.status(400).json({ success: false, error: 'courseId is required' });
    }
    return res.status(201).json({ success: true, bookmark: { id: 'bm-1', courseId: req.body.courseId } });
  }),
  removeBookmark: jest.fn((req: Request, res: Response) => {
    if (req.params.bookmarkId === 'missing') {
      return res.status(404).json({ success: false, error: 'Bookmark not found' });
    }
    return res.status(200).json({ success: true, removedId: req.params.bookmarkId });
  }),
};
jest.mock('../../src/controllers/bookmarkController', () => mockBookmarkController, { virtual: true });

const mockVrfController = {
  generateRandom: jest.fn((req: Request, res: Response) => {
    if (!req.body?.seed) {
      return res.status(400).json({ success: false, error: 'seed is required' });
    }
    return res.status(200).json({ success: true, output: '0xabc123', proof: '0xproof' });
  }),
  verifyProof: jest.fn((req: Request, res: Response) => {
    if (!req.body?.proof) {
      return res.status(400).json({ success: false, error: 'proof is required' });
    }
    return res.status(200).json({ success: true, valid: true });
  }),
  getVRFOutput: jest.fn((req: Request, res: Response) => {
    if (req.params.seed === 'not-found') {
      return res.status(404).json({ success: false, error: 'Seed not found' });
    }
    return res.status(200).json({ success: true, seed: req.params.seed, output: '0xdef456' });
  }),
};
jest.mock('../../src/controllers/vrfController', () => mockVrfController, { virtual: true });

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import route modules after mocks
import verifyRouter from '../../src/routes/verify';
import disputesRouter from '../../src/routes/disputes';
import metricsRouter from '../../src/routes/metrics';
import forumRouter from '../../src/routes/forum';
import notificationsRouter from '../../src/routes/notifications';
import progressRouter from '../../src/routes/progress';
import classroomRouter from '../../src/routes/classroom';
import localizationRouter from '../../src/routes/localization';
import vrfRouter from '../../src/routes/vrf';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bookmarksRouter = require('../../src/routes/bookmarks');

// ── Test Helpers ─────────────────────────────────────────────────────────────

const TEST_JWT_SECRET = 'test-route-coverage-secret';

const signToken = (payload: {
  id: string;
  role: UserRole;
  email?: string;
  username?: string;
}): string => {
  return jwt.sign(
    {
      id: payload.id,
      role: payload.role,
      email: payload.email || `${payload.id}@aethermint.edu`,
      username: payload.username || payload.id,
    },
    TEST_JWT_SECRET,
    { expiresIn: '1h' },
  );
};

const buildTestApp = (): Express => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/verify', verifyRouter);
  app.use('/api/disputes', disputesRouter);
  app.use('/api/metrics', metricsRouter);
  app.use('/api/forum', forumRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/progress', progressRouter);
  app.use('/api/classroom', classroomRouter);
  app.use('/api/bookmarks', bookmarksRouter);
  app.use('/api/localization', localizationRouter);
  app.use('/api/vrf', vrfRouter);
  app.use(errorHandler);
  return app;
};

describe('Comprehensive Route Handler Test Suite (Issue #261)', () => {
  let app: Express;
  let studentToken: string;
  let instructorToken: string;
  let adminToken: string;

  beforeAll(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    studentToken = signToken({ id: 'student_1', role: UserRole.STUDENT });
    instructorToken = signToken({ id: 'instructor_1', role: UserRole.EDUCATOR });
    adminToken = signToken({ id: 'admin_1', role: UserRole.ADMIN });
  });

  beforeEach(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    delete process.env.INTERNAL_METRICS_KEY;
    jest.clearAllMocks();
    app = buildTestApp();
  });

  // ── 1. Verify Route (/api/v1/verify) ──────────────────────────────────────
  describe('GET /api/v1/verify/:hash', () => {
    it('returns 200 and parsed credential when hash is valid and found', async () => {
      mockGetCredentialsForDid.mockResolvedValueOnce(['101', '102']);
      const res = await request(app).get('/api/v1/verify/42');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          credentialId: 42,
          linkedCredentialIds: [101, 102],
          status: 0,
        },
      });
      expect(mockGetCredentialsForDid).toHaveBeenCalledWith('42');
    });

    it('returns 400 when credential hash is non-numeric', async () => {
      const res = await request(app).get('/api/v1/verify/not-a-number');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Invalid credential ID/i);
    });

    it('returns 404 when contract reports credential not found', async () => {
      mockGetCredentialsForDid.mockRejectedValueOnce(new Error('Credential not found on ledger'));
      const res = await request(app).get('/api/v1/verify/999');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        success: false,
        error: 'Credential not found',
      });
    });

    it('returns 500 when contract throws an unexpected error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockGetCredentialsForDid.mockRejectedValueOnce(new Error('RPC timeout'));
      const res = await request(app).get('/api/v1/verify/77');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        success: false,
        error: 'Failed to verify credential',
      });
      consoleSpy.mockRestore();
    });
  });

  // ── 2. Disputes Routes (/api/disputes) ────────────────────────────────────
  describe('Disputes Routes (/api/disputes)', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/api/disputes');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when JWT token is invalid', async () => {
      const res = await request(app)
        .get('/api/disputes')
        .set('Authorization', 'Bearer invalid-jwt-token');
      expect(res.status).toBe(401);
    });

    it('POST /api/disputes creates a dispute (201)', async () => {
      const dispute = { id: 'disp_1', status: 'open', reason: 'Billing issue' };
      mockDisputeService.open.mockResolvedValueOnce(dispute);

      const res = await request(app)
        .post('/api/disputes')
        .set('Authorization', `Bearer ${studentToken}`)
        .set('User-Agent', 'jest-supertest')
        .send({ courseId: 'c1', reason: 'Billing issue' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ success: true, data: dispute });
      expect(mockDisputeService.open).toHaveBeenCalledWith(
        { id: 'student_1', role: UserRole.STUDENT },
        { courseId: 'c1', reason: 'Billing issue' },
        expect.objectContaining({ userAgent: 'jest-supertest' }),
      );
    });

    it('POST /api/disputes forwards validation errors (400)', async () => {
      mockDisputeService.open.mockRejectedValueOnce(new ValidationError('Invalid dispute payload'));
      const res = await request(app)
        .post('/api/disputes')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('GET /api/disputes lists disputes for authenticated user (200)', async () => {
      mockDisputeService.list.mockResolvedValueOnce([{ id: 'disp_1', status: 'open' }]);
      const res = await request(app)
        .get('/api/disputes?status=open')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('GET /api/disputes forwards service errors to errorHandler (500)', async () => {
      mockDisputeService.list.mockRejectedValueOnce(new InternalError('DB failure'));
      const res = await request(app)
        .get('/api/disputes')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(500);
    });

    it('GET /api/disputes/:id returns a single dispute (200) or 404 when missing', async () => {
      mockDisputeService.get.mockResolvedValueOnce({ id: 'disp_1', status: 'open' });
      const okRes = await request(app)
        .get('/api/disputes/disp_1')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(okRes.status).toBe(200);
      expect(okRes.body.data.id).toBe('disp_1');

      mockDisputeService.get.mockRejectedValueOnce(new NotFoundError('Dispute not found'));
      const notFoundRes = await request(app)
        .get('/api/disputes/disp_404')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(notFoundRes.status).toBe(404);
    });

    it('POST /api/disputes/:id/evidence adds evidence (200) and forwards errors', async () => {
      mockDisputeService.addEvidence.mockResolvedValueOnce({ id: 'disp_1', evidence: ['doc1'] });
      const res = await request(app)
        .post('/api/disputes/disp_1/evidence')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ content: 'Receipt screenshot' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      mockDisputeService.addEvidence.mockRejectedValueOnce(new ValidationError('Empty evidence'));
      const errRes = await request(app)
        .post('/api/disputes/disp_1/evidence')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({});
      expect(errRes.status).toBe(400);
    });

    it('POST /api/disputes/:id/resolve enforces admin RBAC (403 for student, 200 for admin)', async () => {
      const forbiddenRes = await request(app)
        .post('/api/disputes/disp_1/resolve')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ resolution: 'refunded' });
      expect(forbiddenRes.status).toBe(403);
      expect(forbiddenRes.body.code).toBe('FORBIDDEN');

      mockDisputeService.resolve.mockResolvedValueOnce({ id: 'disp_1', status: 'resolved' });
      const adminRes = await request(app)
        .post('/api/disputes/disp_1/resolve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ resolution: 'refunded' });
      expect(adminRes.status).toBe(200);
      expect(adminRes.body.data.status).toBe('resolved');

      mockDisputeService.resolve.mockRejectedValueOnce(new NotFoundError('Dispute missing'));
      const missingRes = await request(app)
        .post('/api/disputes/missing/resolve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ resolution: 'refunded' });
      expect(missingRes.status).toBe(404);
    });
  });

  // ── 3. Metrics Route (/api/metrics) ───────────────────────────────────────
  describe('GET /api/metrics', () => {
    it('allows open access in dev mode when INTERNAL_METRICS_KEY is unset (200)', async () => {
      mockMetricsFn.mockResolvedValueOnce('# HELP http_requests_total\nhttp_requests_total 5\n');
      const res = await request(app).get('/api/metrics');
      expect(res.status).toBe(200);
      expect(res.text).toContain('http_requests_total 5');
    });

    it('returns 401 when INTERNAL_METRICS_KEY is set and header is missing or mismatched', async () => {
      process.env.INTERNAL_METRICS_KEY = 'super-secret-metrics-key';
      const resMissing = await request(app).get('/api/metrics');
      expect(resMissing.status).toBe(401);
      expect(resMissing.body.error.code).toBe('UNAUTHORIZED');

      const resWrong = await request(app)
        .get('/api/metrics')
        .set('X-Internal-Key', 'wrong-key');
      expect(resWrong.status).toBe(401);
    });

    it('returns 200 when valid X-Internal-Key or Bearer token is supplied', async () => {
      process.env.INTERNAL_METRICS_KEY = 'super-secret-metrics-key';
      mockMetricsFn.mockResolvedValue('metric_value 1');

      const resHeader = await request(app)
        .get('/api/metrics')
        .set('X-Internal-Key', 'super-secret-metrics-key');
      expect(resHeader.status).toBe(200);

      const resBearer = await request(app)
        .get('/api/metrics')
        .set('Authorization', 'Bearer super-secret-metrics-key');
      expect(resBearer.status).toBe(200);
    });

    it('forwards errors to errorHandler (500) when register.metrics() fails', async () => {
      mockMetricsFn.mockRejectedValueOnce(new Error('Registry scrape failure'));
      const res = await request(app).get('/api/metrics');
      expect(res.status).toBe(500);
    });
  });

  // ── 4. Forum Routes (/api/forum) ──────────────────────────────────────────
  describe('Forum Routes (/api/forum)', () => {
    it('GET /api/forum/posts returns paginated posts (200) and handles errors (500)', async () => {
      mockForumService.getPosts.mockResolvedValueOnce([{ id: 'p1', title: 'First Post' }]);
      const res = await request(app).get('/api/forum/posts?courseId=course_1&page=2');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 'p1', title: 'First Post' }]);
      expect(mockForumService.getPosts).toHaveBeenCalledWith('course_1', 2);

      // Default page=1 when omitted
      mockForumService.getPosts.mockResolvedValueOnce([]);
      await request(app).get('/api/forum/posts?courseId=course_1');
      expect(mockForumService.getPosts).toHaveBeenCalledWith('course_1', 1);

      mockForumService.getPosts.mockRejectedValueOnce(new Error('Database offline'));
      const errRes = await request(app).get('/api/forum/posts');
      expect(errRes.status).toBe(500);
      expect(errRes.body.error).toBe('Database offline');
    });

    it('POST /api/forum/posts creates post (201) and handles validation failure (400)', async () => {
      mockForumService.createPost.mockResolvedValueOnce({ id: 'p2', title: 'Question' });
      const res = await request(app)
        .post('/api/forum/posts')
        .send({ title: 'Question', content: 'How does Soroban work?' });
      expect(res.status).toBe(201);
      expect(mockForumService.createPost).toHaveBeenCalledWith(
        expect.objectContaining({ authorId: 'mock-user-id', title: 'Question' }),
      );

      mockForumService.createPost.mockRejectedValueOnce(new Error('Title is required'));
      const errRes = await request(app).post('/api/forum/posts').send({});
      expect(errRes.status).toBe(400);
      expect(errRes.body.error).toBe('Title is required');
    });

    it('POST /api/forum/posts/:id/upvote increments upvote (200) or returns 400', async () => {
      mockForumService.upvotePost.mockResolvedValueOnce({ id: 'p1', upvotes: 5 });
      const res = await request(app).post('/api/forum/posts/p1/upvote');
      expect(res.status).toBe(200);
      expect(res.body.upvotes).toBe(5);

      mockForumService.upvotePost.mockRejectedValueOnce(new Error('Post not found'));
      const errRes = await request(app).post('/api/forum/posts/missing/upvote');
      expect(errRes.status).toBe(400);
    });

    it('GET & POST /api/forum/posts/:id/replies handles listing and creation', async () => {
      mockForumService.getReplies.mockResolvedValueOnce([{ id: 'r1', content: 'Answer' }]);
      const getRes = await request(app).get('/api/forum/posts/p1/replies');
      expect(getRes.status).toBe(200);
      expect(getRes.body).toHaveLength(1);

      mockForumService.getReplies.mockRejectedValueOnce(new Error('Read error'));
      const getErr = await request(app).get('/api/forum/posts/p1/replies');
      expect(getErr.status).toBe(500);

      mockForumService.createReply.mockResolvedValueOnce({ id: 'r2', postId: 'p1' });
      const postRes = await request(app)
        .post('/api/forum/posts/p1/replies')
        .send({ content: 'Great question!' });
      expect(postRes.status).toBe(201);

      mockForumService.createReply.mockRejectedValueOnce(new Error('Reply content empty'));
      const postErr = await request(app).post('/api/forum/posts/p1/replies').send({});
      expect(postErr.status).toBe(400);
    });

    it('POST /api/forum/posts/:id/replies/:replyId/accept accepts answer (200) or errors (400)', async () => {
      mockForumService.acceptAnswer.mockResolvedValueOnce({ id: 'r1', accepted: true });
      const res = await request(app)
        .post('/api/forum/posts/p1/replies/r1/accept')
        .send({ userId: 'instructor_1', isInstructor: true });
      expect(res.status).toBe(200);
      expect(mockForumService.acceptAnswer).toHaveBeenCalledWith('r1', 'p1', 'instructor_1', true);

      // Default userId / isInstructor fallback
      mockForumService.acceptAnswer.mockResolvedValueOnce({ id: 'r1', accepted: true });
      await request(app).post('/api/forum/posts/p1/replies/r1/accept').send({});
      expect(mockForumService.acceptAnswer).toHaveBeenCalledWith('r1', 'p1', 'mock-user-id', false);

      mockForumService.acceptAnswer.mockRejectedValueOnce(new Error('Not authorized to accept'));
      const errRes = await request(app).post('/api/forum/posts/p1/replies/r1/accept').send({});
      expect(errRes.status).toBe(400);
    });
  });

  // ── 5. Notifications Routes (/api/notifications) ──────────────────────────
  describe('Notifications Routes (/api/notifications)', () => {
    it('POST /api/notifications/trigger sends notification with defaults and custom fields (200)', async () => {
      mockNotificationService.send.mockResolvedValueOnce({ id: 'n1', delivered: true });
      const res = await request(app)
        .post('/api/notifications/trigger')
        .send({ userId: 'u1', title: 'Welcome', message: 'Hello learner' });
      expect(res.status).toBe(200);
      expect(mockNotificationService.send).toHaveBeenCalledWith({
        userId: 'u1',
        title: 'Welcome',
        message: 'Hello learner',
        category: 'system',
        priority: 'medium',
        deliveryMethods: ['in-app'],
        isRead: false,
        isDelivered: false,
      });

      mockNotificationService.send.mockRejectedValueOnce(new Error('Push gateway down'));
      const errRes = await request(app)
        .post('/api/notifications/trigger')
        .send({ userId: 'u1', title: 'Alert', message: 'Fail' });
      expect(errRes.status).toBe(500);
    });

    it('exercises GET, PATCH, DELETE, and preferences endpoints on /api/notifications', async () => {
      const listRes = await request(app).get('/api/notifications/student_1');
      expect(listRes.status).toBe(200);
      expect(listRes.body.data[0].userId).toBe('student_1');

      const readRes = await request(app).patch('/api/notifications/notif_1/read');
      expect(readRes.status).toBe(200);
      expect(readRes.body.isRead).toBe(true);

      const readAllRes = await request(app).patch('/api/notifications/read-all');
      expect(readAllRes.status).toBe(200);
      expect(readAllRes.body.updatedCount).toBe(3);

      const delRes = await request(app).delete('/api/notifications/notif_1');
      expect(delRes.status).toBe(200);
      expect(delRes.body.deletedId).toBe('notif_1');

      const getPrefRes = await request(app).get('/api/notifications/student_1/preferences');
      expect(getPrefRes.status).toBe(200);

      const putPrefRes = await request(app)
        .put('/api/notifications/student_1/preferences')
        .send({ email: false, push: true });
      expect(putPrefRes.status).toBe(200);
      expect(putPrefRes.body.preferences).toEqual({ email: false, push: true });
    });
  });

  // ── 6. Progress Routes (/api/progress) ────────────────────────────────────
  describe('Learner Progress Routes (/api/progress)', () => {
    it('GET /api/progress/:courseId initializes and returns progress record for both authenticated and anonymous users (200)', async () => {
      const res = await request(app)
        .get('/api/progress/course_stellar_101')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        userId: 'student_1',
        courseId: 'course_stellar_101',
        overallProgress: 0,
        completedLessons: [],
      });

      // Second GET hits cached record branch; anonymous request hits demo_user fallback
      const cachedRes = await request(app)
        .get('/api/progress/course_stellar_101')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(cachedRes.status).toBe(200);

      const anonRes = await request(app).get('/api/progress/course_anon_101');
      expect(anonRes.status).toBe(200);
      expect(anonRes.body.data.userId).toBe('demo_user');
    });

    it('POST /api/progress/update validates required fields (400) and merges progress across branches (200)', async () => {
      const badRes = await request(app)
        .post('/api/progress/update')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ courseId: 'course_stellar_101' });
      expect(badRes.status).toBe(400);
      expect(badRes.body.error).toMatch(/Missing required parameters/i);

      // Update with completed=false and omitted numeric fields (exercises fallback branches)
      const partialRes = await request(app)
        .post('/api/progress/update')
        .send({
          courseId: 'course_anon_update',
          lessonId: 'lesson_0',
          completed: false,
        });
      expect(partialRes.status).toBe(200);
      expect(partialRes.body.data.userId).toBe('demo_user');
      expect(partialRes.body.data.playbackPositions.lesson_0.timestamp).toBe(0);

      const okRes = await request(app)
        .post('/api/progress/update')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          courseId: 'course_stellar_101',
          lessonId: 'lesson_1',
          playbackTimestamp: 120,
          completed: true,
          overallProgress: 50,
        });
      expect(okRes.status).toBe(200);
      expect(okRes.body.data.overallProgress).toBe(50);
      expect(okRes.body.data.completedLessons).toContain('lesson_1');
      expect(okRes.body.data.playbackPositions.lesson_1.timestamp).toBe(120);
    });

    it('POST /api/progress/sync reconciles batch offline snapshots and skips invalid items (200)', async () => {
      // Empty items default branch + anonymous fallback
      const emptySync = await request(app).post('/api/progress/sync').send({});
      expect(emptySync.status).toBe(200);
      expect(emptySync.body.data).toEqual([]);

      const now = Date.now();
      const res = await request(app)
        .post('/api/progress/sync')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          items: [
            { invalidItemWithoutCourseId: true },
            {
              courseId: 'course_stellar_101',
              overallProgress: 80,
              completedLessons: ['lesson_2'],
              lastActiveLessonId: 'lesson_2',
              playbackPositions: {
                lesson_1: { timestamp: 30, completed: false, lastUpdated: 1 }, // older than existing, should not overwrite
                lesson_2: { timestamp: 300, completed: true, lastUpdated: now + 1000 },
              },
              lastUpdated: now + 1000,
            },
            {
              // Nested item.data with older lastUpdated to cover older-snapshot merge branch
              data: {
                courseId: 'course_stellar_101',
                overallProgress: 20,
                lastActiveLessonId: 'lesson_old',
                lastUpdated: 1,
              },
            },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].overallProgress).toBe(80);
      expect(res.body.data[0].completedLessons).toEqual(expect.arrayContaining(['lesson_1', 'lesson_2']));
      expect(res.body.data[0].playbackPositions.lesson_1.timestamp).toBe(120);
    });
  });

  // ── 7. Classroom Routes (/api/classroom) ──────────────────────────────────
  describe('Classroom Session Routes (/api/classroom)', () => {
    let createdSessionId: string;
    let restrictedSessionId: string;

    it('GET /api/classroom/sessions lists seeded sessions (200) and 404s on unknown session across all endpoints', async () => {
      const listRes = await request(app).get('/api/classroom/sessions');
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);

      const getDemo = await request(app).get('/api/classroom/sessions/classroom_demo_001');
      expect(getDemo.status).toBe(200);

      // Verify 404 on unknown sessionId across all session-scoped routes
      expect((await request(app).get('/api/classroom/sessions/non_existent')).status).toBe(404);
      expect(
        (
          await request(app)
            .post('/api/classroom/sessions/non_existent/start')
            .set('Authorization', `Bearer ${instructorToken}`)
        ).status,
      ).toBe(404);
      expect(
        (
          await request(app)
            .post('/api/classroom/sessions/non_existent/end')
            .set('Authorization', `Bearer ${instructorToken}`)
        ).status,
      ).toBe(404);
      expect(
        (await request(app).post('/api/classroom/sessions/non_existent/join').send({ userId: 'u1', name: 'A' })).status,
      ).toBe(404);
      expect(
        (await request(app).post('/api/classroom/sessions/non_existent/leave').send({ userId: 'u1' })).status,
      ).toBe(404);
      expect(
        (
          await request(app)
            .post('/api/classroom/sessions/non_existent/breakout-rooms')
            .set('Authorization', `Bearer ${instructorToken}`)
            .send({ title: 'Room' })
        ).status,
      ).toBe(404);
      expect(
        (
          await request(app)
            .delete('/api/classroom/sessions/non_existent/breakout-rooms/b1')
            .set('Authorization', `Bearer ${instructorToken}`)
        ).status,
      ).toBe(404);
      expect(
        (
          await request(app)
            .post('/api/classroom/sessions/non_existent/recording/start')
            .set('Authorization', `Bearer ${instructorToken}`)
        ).status,
      ).toBe(404);
      expect(
        (
          await request(app)
            .post('/api/classroom/sessions/non_existent/recording/stop')
            .set('Authorization', `Bearer ${instructorToken}`)
        ).status,
      ).toBe(404);
      expect((await request(app).get('/api/classroom/sessions/non_existent/playback')).status).toBe(404);
    });

    it('POST /api/classroom/sessions requires auth (401), validates title (400), and creates sessions (201)', async () => {
      const unauth = await request(app).post('/api/classroom/sessions').send({ title: 'Test' });
      expect(unauth.status).toBe(401);

      const noTitle = await request(app)
        .post('/api/classroom/sessions')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({ courseId: 'c1' });
      expect(noTitle.status).toBe(400);

      const created = await request(app)
        .post('/api/classroom/sessions')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          title: 'Soroban Deep Dive',
          courseId: 'c1',
          settings: { maxParticipants: 2, allowScreenShare: true, allowRecording: true, allowBreakouts: true },
        });
      expect(created.status).toBe(201);
      expect(created.body.data.hostId).toBe('instructor_1');
      createdSessionId = created.body.data.id;

      // Create a second session with default settings and disabled breakouts/recording
      const restricted = await request(app)
        .post('/api/classroom/sessions')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          title: 'Restricted Lecture',
          settings: { allowBreakouts: false, allowRecording: false, allowScreenShare: false },
        });
      expect(restricted.status).toBe(201);
      restrictedSessionId = restricted.body.data.id;
    });

    it('manages session lifecycle: join before live (400), non-host start (403), host start (200), join/leave (200)', async () => {
      // Cannot join while status is 'scheduled'
      const earlyJoin = await request(app)
        .post(`/api/classroom/sessions/${createdSessionId}/join`)
        .send({ userId: 'student_1', name: 'Alice' });
      expect(earlyJoin.status).toBe(400);
      expect(earlyJoin.body.message).toMatch(/not live/i);

      // Non-host cannot start
      const nonHostStart = await request(app)
        .post(`/api/classroom/sessions/${createdSessionId}/start`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(nonHostStart.status).toBe(403);

      // Host starts session
      const startRes = await request(app)
        .post(`/api/classroom/sessions/${createdSessionId}/start`)
        .set('Authorization', `Bearer ${instructorToken}`);
      expect(startRes.status).toBe(200);
      expect(startRes.body.data.status).toBe('live');

      // Missing userId/name on join -> 400
      const invalidJoin = await request(app)
        .post(`/api/classroom/sessions/${createdSessionId}/join`)
        .send({ userId: 'student_1' });
      expect(invalidJoin.status).toBe(400);

      // Join 1st participant + idempotent re-join
      const join1 = await request(app)
        .post(`/api/classroom/sessions/${createdSessionId}/join`)
        .send({ userId: 'student_1', name: 'Alice' });
      expect(join1.status).toBe(200);

      const rejoin1 = await request(app)
        .post(`/api/classroom/sessions/${createdSessionId}/join`)
        .send({ userId: 'student_1', name: 'Alice' });
      expect(rejoin1.status).toBe(200);
      expect(rejoin1.body.data.participants).toHaveLength(1);

      // Join 2nd participant with explicit role (reaches maxParticipants: 2)
      await request(app)
        .post(`/api/classroom/sessions/${createdSessionId}/join`)
        .send({ userId: 'student_2', name: 'Bob', role: 'moderator' });

      // 3rd participant rejected because session is full (400)
      const fullJoin = await request(app)
        .post(`/api/classroom/sessions/${createdSessionId}/join`)
        .send({ userId: 'student_3', name: 'Charlie' });
      expect(fullJoin.status).toBe(400);
      expect(fullJoin.body.message).toMatch(/full/i);

      // Leave session validation (400) and success (200)
      const badLeave = await request(app)
        .post(`/api/classroom/sessions/${createdSessionId}/leave`)
        .send({});
      expect(badLeave.status).toBe(400);

      const leaveRes = await request(app)
        .post(`/api/classroom/sessions/${createdSessionId}/leave`)
        .send({ userId: 'student_2' });
      expect(leaveRes.status).toBe(200);
      expect(leaveRes.body.data.participants).toHaveLength(1);
    });

    it('manages breakout rooms and recording lifecycle including disabled settings (400)', async () => {
      // Disabled breakouts & recording on restrictedSessionId -> 400
      const disabledBreakout = await request(app)
        .post(`/api/classroom/sessions/${restrictedSessionId}/breakout-rooms`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({ title: 'Room 1' });
      expect(disabledBreakout.status).toBe(400);

      const disabledRecording = await request(app)
        .post(`/api/classroom/sessions/${restrictedSessionId}/recording/start`)
        .set('Authorization', `Bearer ${instructorToken}`);
      expect(disabledRecording.status).toBe(400);

      // Create breakout room validation (400) and success (201)
      const badBreakout = await request(app)
        .post(`/api/classroom/sessions/${createdSessionId}/breakout-rooms`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({});
      expect(badBreakout.status).toBe(400);

      const breakoutRes = await request(app)
        .post(`/api/classroom/sessions/${createdSessionId}/breakout-rooms`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({ title: 'Group A' });
      expect(breakoutRes.status).toBe(201);
      const breakoutId = breakoutRes.body.data.id;

      // Delete non-existent breakout room -> 404, existing -> 200
      const delMissing = await request(app)
        .delete(`/api/classroom/sessions/${createdSessionId}/breakout-rooms/missing_id`)
        .set('Authorization', `Bearer ${instructorToken}`);
      expect(delMissing.status).toBe(404);

      const delOk = await request(app)
        .delete(`/api/classroom/sessions/${createdSessionId}/breakout-rooms/${breakoutId}`)
        .set('Authorization', `Bearer ${instructorToken}`);
      expect(delOk.status).toBe(200);

      // Playback before recording -> 404
      const noPlayback = await request(app).get(`/api/classroom/sessions/${createdSessionId}/playback`);
      expect(noPlayback.status).toBe(404);

      // Start & stop recording
      const recStart = await request(app)
        .post(`/api/classroom/sessions/${createdSessionId}/recording/start`)
        .set('Authorization', `Bearer ${instructorToken}`);
      expect(recStart.status).toBe(200);
      expect(recStart.body.data.isRecording).toBe(true);

      const recStop = await request(app)
        .post(`/api/classroom/sessions/${createdSessionId}/recording/stop`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({});
      expect(recStop.status).toBe(200);
      expect(recStop.body.data.isRecording).toBe(false);

      // Playback while session is still live (endedAt undefined -> duration: null)
      const livePlayback = await request(app).get(`/api/classroom/sessions/${createdSessionId}/playback`);
      expect(livePlayback.status).toBe(200);
      expect(livePlayback.body.data.duration).toBeNull();

      // End session: 403 for non-host, 200 for host
      const nonHostEnd = await request(app)
        .post(`/api/classroom/sessions/${createdSessionId}/end`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(nonHostEnd.status).toBe(403);

      const hostEnd = await request(app)
        .post(`/api/classroom/sessions/${createdSessionId}/end`)
        .set('Authorization', `Bearer ${instructorToken}`);
      expect(hostEnd.status).toBe(200);
      expect(hostEnd.body.data.status).toBe('ended');

      // Playback after recording & session end -> 200 with numeric duration
      const playbackRes = await request(app).get(`/api/classroom/sessions/${createdSessionId}/playback`);
      expect(playbackRes.status).toBe(200);
      expect(playbackRes.body.data.playbackUrl).toContain(createdSessionId);
      expect(typeof playbackRes.body.data.duration).toBe('number');
    });
  });

  // ── 8. Bookmarks Routes (/api/bookmarks) ──────────────────────────────────
  describe('Bookmarks Routes (/api/bookmarks)', () => {
    it('enforces authentication (401) and handles GET, POST, DELETE', async () => {
      const unauth = await request(app).get('/api/bookmarks/student_1');
      expect(unauth.status).toBe(401);

      const getRes = await request(app)
        .get('/api/bookmarks/student_1')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.bookmarks).toContain('course-1');

      const badAdd = await request(app)
        .post('/api/bookmarks/add')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({});
      expect(badAdd.status).toBe(400);

      const addRes = await request(app)
        .post('/api/bookmarks/add')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ courseId: 'course-2' });
      expect(addRes.status).toBe(201);

      const delMissing = await request(app)
        .delete('/api/bookmarks/missing')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(delMissing.status).toBe(404);

      const delOk = await request(app)
        .delete('/api/bookmarks/bm-1')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(delOk.status).toBe(200);
    });
  });

  // ── 9. Localization Routes (/api/localization) ────────────────────────────
  describe('Localization Routes (/api/localization)', () => {
    let translationId: string;

    it('rejects unauthenticated requests (401) and returns supported locales (200)', async () => {
      const unauth = await request(app).get('/api/localization/locales');
      expect(unauth.status).toBe(401);

      const localesRes = await request(app)
        .get('/api/localization/locales')
        .set('Authorization', `Bearer ${instructorToken}`);
      expect(localesRes.status).toBe(200);
      expect(localesRes.body.data.defaultLocale).toBe('en');
      expect(localesRes.body.data.locales).toContain('es');
    });

    it('validates and executes full translation lifecycle (source -> create -> assign -> submit -> approve/reject -> resolve)', async () => {
      // 400 on invalid source body
      const badSource = await request(app)
        .post('/api/localization/source')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({ entityType: 'invalid_type', entityId: '', fields: 'not-an-object' });
      expect(badSource.status).toBe(400);

      // 200 on valid source upsert
      const sourceRes = await request(app)
        .post('/api/localization/source')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          entityType: 'lesson',
          entityId: 'lesson_loc_1',
          fields: { title: 'Hello Blockchain', body: 'Welcome to Stellar' },
        });
      expect(sourceRes.status).toBe(200);
      expect(sourceRes.body.data.revision).toBe(1);

      // Create translation (201)
      const createRes = await request(app)
        .post('/api/localization/translations')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          entityType: 'lesson',
          entityId: 'lesson_loc_1',
          locale: 'es',
          fields: { title: 'Hola Blockchain' },
        });
      expect(createRes.status).toBe(201);
      translationId = createRes.body.data.id;

      // Get translation by id (200) & missing id (404)
      const getRes = await request(app)
        .get(`/api/localization/translations/${translationId}`)
        .set('Authorization', `Bearer ${instructorToken}`);
      expect(getRes.status).toBe(200);

      const getMissing = await request(app)
        .get('/api/localization/translations/nonexistent_id')
        .set('Authorization', `Bearer ${instructorToken}`);
      expect(getMissing.status).toBe(404);

      // List translations & stale translations (200)
      const listRes = await request(app)
        .get('/api/localization/translations?entityType=lesson&locale=es')
        .set('Authorization', `Bearer ${instructorToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.count).toBeGreaterThanOrEqual(1);

      const staleRes = await request(app)
        .get('/api/localization/translations/stale')
        .set('Authorization', `Bearer ${instructorToken}`);
      expect(staleRes.status).toBe(200);

      // Assign -> Submit -> Reject -> Submit -> Approve
      const assignRes = await request(app)
        .post(`/api/localization/translations/${translationId}/assign`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({ assigneeId: 'translator_1' });
      expect(assignRes.status).toBe(200);

      const submitRes = await request(app)
        .post(`/api/localization/translations/${translationId}/submit`)
        .set('Authorization', `Bearer ${instructorToken}`);
      expect(submitRes.status).toBe(200);

      const rejectRes = await request(app)
        .post(`/api/localization/translations/${translationId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(rejectRes.status).toBe(200);

      await request(app)
        .post(`/api/localization/translations/${translationId}/submit`)
        .set('Authorization', `Bearer ${instructorToken}`);

      const approveRes = await request(app)
        .post(`/api/localization/translations/${translationId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(approveRes.status).toBe(200);

      // Resolve published translation with fallback (200) & missing entity (404)
      const resolveRes = await request(app)
        .get('/api/localization/resolve?entityType=lesson&entityId=lesson_loc_1&locale=es')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.data.value.title).toBe('Hola Blockchain');

      const resolveMissing = await request(app)
        .get('/api/localization/resolve?entityType=lesson&entityId=unknown_entity&locale=es')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(resolveMissing.status).toBe(404);
    });
  });

  // ── 10. VRF Routes (/api/vrf) ─────────────────────────────────────────────
  describe('VRF Routes (/api/vrf)', () => {
    it('handles POST /generate, POST /verify, and GET /:seed across 200, 400, 404', async () => {
      const genBad = await request(app).post('/api/vrf/generate').send({});
      expect(genBad.status).toBe(400);

      const genOk = await request(app).post('/api/vrf/generate').send({ seed: 'seed_1' });
      expect(genOk.status).toBe(200);
      expect(genOk.body.output).toBe('0xabc123');

      const verBad = await request(app).post('/api/vrf/verify').send({});
      expect(verBad.status).toBe(400);

      const verOk = await request(app).post('/api/vrf/verify').send({ proof: '0xproof' });
      expect(verOk.status).toBe(200);
      expect(verOk.body.valid).toBe(true);

      const seedMissing = await request(app).get('/api/vrf/not-found');
      expect(seedMissing.status).toBe(404);

      const seedOk = await request(app).get('/api/vrf/seed_1');
      expect(seedOk.status).toBe(200);
      expect(seedOk.body.seed).toBe('seed_1');
    });
  });
});
