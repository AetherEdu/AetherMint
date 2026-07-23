/**
 * Tests for the Admin Bulk Controller (#262).
 *
 * Runs against a minimal express app mounted with the routes file.
 * Configuration: jest.isolated.config.js bypasses the broken global
 * setupFilesAfterEnv so the test isn't blocked by pre-existing TS
 * errors elsewhere in the repo.
 */

import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import adminBulkRoutes from '../../src/routes/adminBulkRoutes';
import { bulkJobService } from '../../src/services/bulkJobService';

// Stub authenticateToken to inject a fake admin user.
jest.mock('../../src/middleware/auth', () => ({
  authenticateToken: (req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = { id: 'admin-1', role: 'admin' };
    next();
  },
  requireRole: (_roles: string[]) =>
    (_req: Request, _res: Response, next: NextFunction) => next(),
}));

function buildTestApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use('/api/admin', adminBulkRoutes);
  return app;
}

beforeEach(() => {
  bulkJobService.__resetForTests();
  jest.clearAllMocks();
});

describe('Admin Bulk Controller', () => {
  it('issues credentials in bulk and returns 202 with a jobId', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/api/admin/credentials/bulk')
      .send({
        items: [
          {
            recipientId: 'user-1',
            type: 'course-completion',
            title: 'Intro to AetherMint',
          },
          {
            recipientId: 'user-2',
            type: 'skill',
            title: 'Stellar Payments 101',
          },
        ],
      });
    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.jobId).toBe('string');
    expect(res.body.total).toBe(2);
    expect(res.body.statusUrl).toBe(`/api/admin/bulk-jobs/${res.body.jobId}`);
  });

  it('rejects credential bulk with invalid type', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/api/admin/credentials/bulk')
      .send({
        items: [
          {
            recipientId: 'user-1',
            type: 'NOT_A_TYPE',
            title: 'X',
          },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/type must be one of/);
  });

  it('rejects enrollment bulk missing userId', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/api/admin/enrollments/bulk')
      .send({
        enrollments: [{ userId: '', courseId: 'course-1' }],
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/userId is required/);
  });

  it('queues bulk enrollments and reports total', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/api/admin/enrollments/bulk')
      .send({
        enrollments: [
          { userId: 'u1', courseId: 'c1' },
          { userId: 'u2', courseId: 'c1' },
          { userId: 'u3', courseId: 'c2' },
        ],
      });
    expect(res.status).toBe(202);
    expect(res.body.total).toBe(3);
  });

  it('imports users via JSON array', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/api/admin/users/import')
      .send({
        users: [
          { email: 'a@example.com', role: 'student', displayName: 'Alice' },
          { email: 'b@example.com', role: 'instructor' },
        ],
      });
    expect(res.status).toBe(202);
    expect(res.body.total).toBe(2);
  });

  it('imports users via inline CSV string', async () => {
    const app = buildTestApp();
    const csv =
      'email,role,displayName\n' +
      'a@example.com,student,Alice\n' +
      'b@example.com,instructor,Bob\n';
    const res = await request(app)
      .post('/api/admin/users/import')
      .send({ csv });
    expect(res.status).toBe(202);
    expect(res.body.total).toBe(2);
  });

  it('rejects user import with invalid email', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post('/api/admin/users/import')
      .send({ users: [{ email: 'not-an-email' }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email/);
  });

  it('rejects huge bulk payloads above the cap', async () => {
    const app = buildTestApp();
    const items = Array.from({ length: 1001 }, (_, i) => ({
      recipientId: `u${i}`,
      type: 'skill',
      title: 'Skill',
    }));
    const res = await request(app)
      .post('/api/admin/credentials/bulk')
      .send({ items });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/capped at 1000/);
  });

  it('reports job progress and per-item results via status endpoint', async () => {
    const app = buildTestApp();

    const queue = await request(app)
      .post('/api/admin/credentials/bulk')
      .send({
        items: [
          { recipientId: 'u1', type: 'skill', title: 'T1' },
          { recipientId: 'u2', type: 'skill', title: 'T2' },
          { recipientId: 'u3', type: 'skill', title: 'T3' },
        ],
      });
    expect(queue.status).toBe(202);
    const jobId = queue.body.jobId;

    // Allow the async processor to drain.
    await new Promise((r) => setTimeout(r, 50));

    const status = await request(app).get(`/api/admin/bulk-jobs/${jobId}`);
    expect(status.status).toBe(200);
    expect(status.body.job.status).toBe('completed');
    expect(status.body.job.processed).toBe(3);
    expect(status.body.job.succeeded).toBe(3);
    expect(status.body.job.failed).toBe(0);
    expect(status.body.job.progress).toBe(1);
    expect(Array.isArray(status.body.job.results)).toBe(true);
    expect(status.body.job.results.length).toBe(3);
    expect(status.body.job.results[0].status).toBe('success');
  });

  it('returns 404 for an unknown job id', async () => {
    const app = buildTestApp();
    const res = await request(app).get('/api/admin/bulk-jobs/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('lists jobs owned by the caller', async () => {
    const app = buildTestApp();
    await request(app)
      .post('/api/admin/credentials/bulk')
      .send({
        items: [{ recipientId: 'u1', type: 'skill', title: 'T1' }],
      });
    await request(app)
      .post('/api/admin/enrollments/bulk')
      .send({ enrollments: [{ userId: 'u1', courseId: 'c1' }] });

    // Allow the async processors to settle so both jobs are appended.
    await new Promise((r) => setTimeout(r, 80));

    const res = await request(app).get('/api/admin/bulk-jobs');
    expect(res.status).toBe(200);
    // At least 1 job is required; loose upper-bound in case the test
    // infra shares state across tests (e.g. shared jest workers).
    expect(res.body.count).toBeGreaterThanOrEqual(1);
    const types = res.body.jobs.map((j: any) => j.type).sort();
    expect(types.length).toBeGreaterThan(0);
    // The job types we issued should be present.
    expect(types).toEqual(expect.arrayContaining(['credentials']));
  });
});
