/**
 * WhiteboardSessionController HTTP-layer tests
 *
 * Run with: `npx jest __tests__/whiteboardSessionController.test.ts`
 *
 * Mocks the Redis client so tests do not require a running Redis instance.
 * Exercises the conflict path (409) and the share-link mint/revoke path.
 */

jest.mock('../config/redis', () => ({
  redisConfig: {
    getRawClient: () => null,
  },
}));

import express from 'express';
import request from 'supertest';
import { WhiteboardSessionController } from '../controllers/whiteboardSessionController';
import { getWhiteboardSessionStore } from '../services/whiteboardSessionStore';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.post('/sessions', WhiteboardSessionController.create);
  app.put('/sessions/:id', WhiteboardSessionController.saveOps);
  app.get('/sessions/:id', WhiteboardSessionController.getOne);
  app.get('/sessions', WhiteboardSessionController.list);
  app.delete('/sessions/:id', WhiteboardSessionController.delete);
  app.post('/sessions/:id/share', WhiteboardSessionController.createShare);
  app.delete('/sessions/:id/share', WhiteboardSessionController.revokeShare);
  app.get('/shared', WhiteboardSessionController.getByShare);
  return app;
};

const sampleOp = () => ({
  tool: 'pen',
  userId: 'user-1',
  ts: Date.now(),
  color: '#000',
  width: 2,
  points: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  seq: 1,
});

describe('WhiteboardSessionController', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('roundtrips a created session through GET', async () => {
    const app = buildApp();
    const created = await request(app)
      .post('/sessions')
      .set('X-User-Id', 'owner-x')
      .send({ width: 800, height: 600, ops: [sampleOp()] });
    expect(created.status).toBe(201);
    const id = created.body.data.session.id;

    const fetched = await request(app).get(`/sessions/${id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.data.ownerId).toBe('owner-x');
    expect(fetched.body.data.ops).toHaveLength(1);
  });

  it('returns 409 on conflicting save', async () => {
    const app = buildApp();
    const created = await request(app)
      .post('/sessions')
      .set('X-User-Id', 'owner-x')
      .send({ width: 800, height: 600, ops: [sampleOp()] });
    const id = created.body.data.session.id;

    // First save with correct base version — succeed.
    const ok = await request(app)
      .put(`/sessions/${id}`)
      .set('X-User-Id', 'owner-x')
      .send({ width: 800, height: 600, ops: [sampleOp()], baseVersion: 1 });
    expect(ok.status).toBe(200);

    // Second save with same base — conflict.
    const conflict = await request(app)
      .put(`/sessions/${id}`)
      .set('X-User-Id', 'owner-x')
      .send({ width: 800, height: 600, ops: [sampleOp()], baseVersion: 1 });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('conflict');
    expect(conflict.body.serverVersion).toBe(2);
    expect(Array.isArray(conflict.body.serverOps)).toBe(true);
  });

  it('mints and resolves a share token, then revokes it', async () => {
    const app = buildApp();
    const created = await request(app)
      .post('/sessions')
      .set('X-User-Id', 'owner-x')
      .send({ width: 800, height: 600, ops: [sampleOp()] });
    const id = created.body.data.session.id;

    const minted = await request(app)
      .post(`/sessions/${id}/share`)
      .set('X-User-Id', 'owner-x')
      .send({});
    expect(minted.status).toBe(200);
    const token = minted.body.data.token;
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(minted.body.data.url).toContain(`/whiteboard/shared?token=${token}`);

    // Anonymous viewer fetches the session.
    const shared = await request(app).get(`/shared?token=${token}`);
    expect(shared.status).toBe(200);
    expect(shared.body.data.id).toBe(id);
    // Owner id is stripped on the public payload.
    expect(shared.body.data.ownerId).toBeUndefined();

    // Revoke without owner check fails.
    const badRevoke = await request(app)
      .delete(`/sessions/${id}/share`)
      .set('X-User-Id', 'someone-else')
      .send({ token });
    expect(badRevoke.status).toBe(404);

    // Revoke with correct owner succeeds.
    const revoked = await request(app)
      .delete(`/sessions/${id}/share`)
      .set('X-User-Id', 'owner-x')
      .send({ token });
    expect(revoked.status).toBe(200);

    const after = await request(app).get(`/shared?token=${token}`);
    expect(after.status).toBe(404);
  });

  it('filters out ops with invalid point payloads on create', async () => {
    const app = buildApp();
    const bad = await request(app)
      .post('/sessions')
      .set('X-User-Id', 'owner-x')
      .send({
        width: 100,
        height: 100,
        ops: [{ tool: 'pen', userId: 'user-1', ts: Date.now(), color: '#000', width: 1, points: [] }],
      });
    // Created but empty — controller does not reject malformed ops; the
    // serializer drops them. We just verify the postconditions.
    expect(bad.status).toBe(201);
    expect(bad.body.data.session.ops).toHaveLength(0);
  });

  it('rejects a missing required field', async () => {
    const app = buildApp();
    const missing = await request(app)
      .post('/sessions')
      .set('X-User-Id', 'owner-x')
      .send({ ops: [sampleOp()] }); // missing width/height
    expect(missing.status).toBe(400);
  });

  it('lists owner sessions newest-first', async () => {
    const app = buildApp();
    await request(app)
      .post('/sessions')
      .set('X-User-Id', 'owner-x')
      .send({ width: 1, height: 1, ops: [sampleOp()] });
    await new Promise((r) => setTimeout(r, 5));
    const b = await request(app)
      .post('/sessions')
      .set('X-User-Id', 'owner-x')
      .send({ width: 1, height: 1, ops: [sampleOp()] });
    const list = await request(app)
      .get('/sessions')
      .set('X-User-Id', 'owner-x');
    expect(list.status).toBe(200);
    expect(list.body.data.map((s: any) => s.id)).toEqual([b.body.data.session.id]);
  });
});

// Double-check the store helper behaves well in isolation as a smoke check.
describe('whiteboardSessionStore helpers', () => {
  it('exposes a singleton with the same instance across calls', () => {
    expect(getWhiteboardSessionStore()).toBe(getWhiteboardSessionStore());
  });
});
