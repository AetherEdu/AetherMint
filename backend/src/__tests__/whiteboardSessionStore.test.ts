/**
 * WhiteboardSessionStore tests
 *
 * Run with: `npx jest __tests__/whiteboardSessionStore.test.ts`
 *
 * These exercise the in-memory code path so we don't depend on a live Redis.
 * The Redis path uses the same lock semantics and ops serializer, so the
 * failures we are guarding against here (lost updates, missing conflict
 * surfacing, share token reuse without revocation) would also fail on Redis.
 */

// Force the in-memory path for tests by stubbing the redisConfig getter.
jest.mock('../config/redis', () => ({
  redisConfig: {
    getRawClient: () => null,
  },
}));

import { getWhiteboardSessionStore } from '../services/whiteboardSessionStore';
import { serializeOps, estimateOpsBytes, MAX_OPS_BYTES } from '../utils/whiteboardSerialization';
import type { WhiteboardOp } from '../models/WhiteboardSession';

const sampleOp = (overrides: Partial<WhiteboardOp> = {}): WhiteboardOp => ({
  tool: 'pen',
  userId: 'user-1',
  ts: 1_700_000_000_000,
  color: '#000000',
  width: 2,
  points: [
    { x: 10, y: 10 },
    { x: 11, y: 11 },
  ],
  ...overrides,
});

describe('WhiteboardSessionStore', () => {
  beforeEach(() => {
    // Reset the singleton between tests so deletes + creations stay isolated.
    jest.resetModules();
  });

  it('creates a new session with version 1', async () => {
    const store = getWhiteboardSessionStore();
    const session = await store.create('owner-a', {
      width: 1280,
      height: 720,
      ops: [sampleOp()],
    });
    expect(session.id).toMatch(/^wbs_/);
    expect(session.ownerId).toBe('owner-a');
    expect(session.version).toBe(1);
    expect(session.ops).toHaveLength(1);
  });

  it('roundtrips ops through save and get', async () => {
    const store = getWhiteboardSessionStore();
    const created = await store.create('owner-a', {
      title: 'Round Trip',
      width: 100,
      height: 100,
      ops: [sampleOp({ points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] })],
    });
    const fetched = await store.get(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.ops[0].points).toEqual([{ x: 1, y: 2 }, { x: 3, y: 4 }]);
    expect(fetched!.title).toBe('Round Trip');
  });

  it('bumps version on each save and rejects stale base versions', async () => {
    const store = getWhiteboardSessionStore();
    const created = await store.create('owner-a', {
      width: 100,
      height: 100,
      ops: [sampleOp()],
    });

    const ok = await store.saveOps(created.id, 'owner-a', {
      width: 100,
      height: 100,
      ops: [sampleOp(), sampleOp({ ts: 1_700_000_000_001 })],
      baseVersion: 1,
    });
    expect('session' in ok).toBe(true);
    expect((ok as any).session.version).toBe(2);

    const stale = await store.saveOps(created.id, 'owner-a', {
      width: 100,
      height: 100,
      ops: [sampleOp()],
      baseVersion: 1,
    });
    expect((stale as any).code).toBe('conflict');
    expect((stale as any).serverVersion).toBe(2);
  });

  it('serializes concurrent saves of the same session so neither is lost', async () => {
    const store = getWhiteboardSessionStore();
    const created = await store.create('owner-a', {
      width: 100,
      height: 100,
      ops: [sampleOp()],
    });

    const baseV = created.version;
    // Fire two saves back-to-back: one with the correct base, one stale.
    const [a, b] = await Promise.all([
      store.saveOps(created.id, 'owner-a', {
        width: 100,
        height: 100,
        ops: [sampleOp({ ts: 1_700_000_000_005 })],
        baseVersion: baseV,
      }),
      store.saveOps(created.id, 'owner-a', {
        width: 100,
        height: 100,
        ops: [sampleOp({ ts: 1_700_000_000_010 })],
        baseVersion: 0, // stale caller
      }),
    ]);

    // Exactly one must win; the other must report a conflict.
    const winners = [a, b].filter((r: any) => r.session);
    const conflicts = [a, b].filter((r: any) => r.code === 'conflict');
    expect(winners).toHaveLength(1);
    expect(conflicts).toHaveLength(1);

    const finalSession = await store.get(created.id);
    expect(finalSession!.version).toBe(baseV + 1);
  });

  it('filters out ops with no points on save', async () => {
    const store = getWhiteboardSessionStore();
    const created = await store.create('owner-a', {
      width: 100,
      height: 100,
      ops: [sampleOp()],
    });
    const saved = await store.saveOps(created.id, 'owner-a', {
      width: 100,
      height: 100,
      ops: [
        sampleOp({ points: [] }), // invalid
        sampleOp({ points: [{ x: 5, y: 5 }] }), // valid (one point dropped)
      ],
      baseVersion: 1,
    });
    expect((saved as any).session.ops).toHaveLength(1);
    expect((saved as any).session.ops[0].points).toEqual([{ x: 5, y: 5 }]);
  });

  it('mints share tokens, resolves them, and revokes them', async () => {
    const store = getWhiteboardSessionStore();
    const created = await store.create('owner-a', {
      width: 100,
      height: 100,
      ops: [sampleOp()],
    });
    const token = await store.ensureShareToken(created.id);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);

    const shared = await store.getByShareToken(token!);
    expect(shared?.id).toBe(created.id);

    const ok = await store.revokeShareToken(created.id, token!);
    expect(ok).toBe(true);

    const after = await store.getByShareToken(token!);
    expect(after).toBeNull();
  });

  it('lists sessions by owner, newest first', async () => {
    const store = getWhiteboardSessionStore();
    const a = await store.create('owner-a', {
      width: 100,
      height: 100,
      ops: [sampleOp()],
    });
    // Sleep a tiny bit so the timestamps differ deterministically.
    await new Promise((r) => setTimeout(r, 5));
    const b = await store.create('owner-a', {
      width: 100,
      height: 100,
      ops: [sampleOp()],
    });
    const list = await store.listByOwner('owner-a');
    expect(list.map((s) => s.id)).toEqual([b.id, a.id]);
  });

  it('refuses to delete a session owned by someone else', async () => {
    const store = getWhiteboardSessionStore();
    const created = await store.create('owner-a', {
      width: 100,
      height: 100,
      ops: [sampleOp()],
    });
    const ok = await store.delete(created.id, 'owner-b');
    expect(ok).toBe(false);
    const still = await store.get(created.id);
    expect(still).not.toBeNull();
  });
});

describe('serializeOps helper', () => {
  it('rounds coordinates to 2 decimals for stable hashing', () => {
    const ops = serializeOps([
      sampleOp({ points: [{ x: 1.23456, y: 9.87654 }, { x: 2.5, y: 3 }] }),
    ]);
    expect(ops[0].points).toEqual([{ x: 1.23, y: 9.88 }, { x: 2.5, y: 3 }]);
  });

  it('assigns sequential seq numbers when missing', () => {
    const ops = serializeOps([sampleOp(), sampleOp({ ts: 1_700_000_000_002 })]);
    expect(ops.map((o) => o.seq)).toEqual([1, 2]);
  });

  it('estimate stays below MAX_OPS_BYTES for realistic drawings', () => {
    const many = Array.from({ length: 500 }, () => sampleOp({ points: [{ x: 1, y: 2 }, { x: 2, y: 3 }] }));
    expect(estimateOpsBytes(many)).toBeLessThan(MAX_OPS_BYTES);
  });
});
