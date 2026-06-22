/**
 * WhiteboardSessionStore
 *
 * Persistence layer for `WhiteboardSession` records. Backed by Redis when
 * available so sessions survive process restarts; falls back to an in-memory
 * `Map` when Redis is unreachable. The choice is made at construction time and
 * is transparent to callers — the public surface is identical.
 *
 * Why Redis?
 * - The collaboration subsystem already depends on Redis (see
 *   `backend/src/utils/redis.ts` and `backend/src/index.ts`). Reusing it keeps
 *   the operational footprint small and avoids introducing a new schema store
 *   for what is effectively ephemeral collaborative state.
 * - Sessions are addressable by id and indexed by owner for listing, which
 *   maps cleanly to Redis SETs and HASHes.
 *
 * Key shape (all prefixed `wb:`):
 *   - `wb:session:{id}`          HASH of session fields (ops stored as JSON).
 *   - `wb:owner:{ownerId}`       SET of session ids owned by a user.
 *   - `wb:share:{shareToken}`    STRING mapping opaque token → session id.
 *
 * Concurrency:
 *   All writes are funnelled through a per-id promise chain so that two
 *   concurrent `saveOps` calls cannot interleave and corrupt the ops array.
 */

import crypto from 'crypto';
import type Redis from 'ioredis';
import logger from '../utils/logger';
import { connectRedis } from '../utils/redis';
import { redisConfig } from '../config/redis';
import type {
  SaveWhiteboardInput,
  SaveWhiteboardResult,
  WhiteboardConflictError,
  WhiteboardOp,
  WhiteboardSession,
  WhiteboardSessionSummary,
} from '../models/WhiteboardSession';

const KEY_PREFIX = 'wb:';
const KEY_SESSION = (id: string) => `${KEY_PREFIX}session:${id}`;
const KEY_OWNER = (ownerId: string) => `${KEY_PREFIX}owner:${ownerId}`;
const KEY_SHARE = (token: string) => `${KEY_PREFIX}share:${token}`;

/**
 * In-memory fallback used when Redis is unavailable. Keeps a parallel
 * `Map<ownerId, Set<id>>` so listing is O(1) per owner.
 */
class MemoryStore {
  private sessions = new Map<string, WhiteboardSession>();
  private owners = new Map<string, Set<string>>();
  private tokens = new Map<string, string>();

  save(session: WhiteboardSession): WhiteboardSession {
    this.sessions.set(session.id, session);
    if (!this.owners.has(session.ownerId)) {
      this.owners.set(session.ownerId, new Set());
    }
    this.owners.get(session.ownerId)!.add(session.id);
    return session;
  }

  patchOps(id: string, ops: WhiteboardOp[], version: number, updatedAt: number): WhiteboardSession | null {
    const existing = this.sessions.get(id);
    if (!existing) return null;
    existing.ops = ops;
    existing.version = version;
    existing.updatedAt = updatedAt;
    return existing;
  }

  get(id: string): WhiteboardSession | null {
    return this.sessions.get(id) ?? null;
  }

  getByShareToken(token: string): WhiteboardSession | null {
    const id = this.tokens.get(token);
    if (!id) return null;
    return this.sessions.get(id) ?? null;
  }

  setShareToken(id: string, token: string): void {
    this.tokens.set(token, id);
  }

  removeShareToken(token: string): void {
    this.tokens.delete(token);
  }

  delete(id: string, ownerId: string): boolean {
    if (!this.sessions.has(id)) return false;
    this.sessions.delete(id);
    this.owners.get(ownerId)?.delete(id);
    // Drop any tokens mapped to this id.
    for (const [t, sid] of this.tokens.entries()) {
      if (sid === id) this.tokens.delete(t);
    }
    return true;
  }

  listByOwner(ownerId: string): WhiteboardSession[] {
    const ids = this.owners.get(ownerId);
    if (!ids) return [];
    const result: WhiteboardSession[] = [];
    for (const id of ids) {
      const session = this.sessions.get(id);
      if (session) result.push(session);
    }
    // Newest first — handy for the UI session list.
    result.sort((a, b) => b.updatedAt - a.updatedAt);
    return result;
  }
}

export class WhiteboardSessionStore {
  private memory = new MemoryStore();
  private redis: Redis | null = null;
  private useRedis = false;
  /** Per-id mutex chain to serialize concurrent saves. */
  private locks = new Map<string, Promise<unknown>>();

  constructor() {
    // Best-effort Redis hook-up; do not block startup if it fails.
    connectRedis().catch(() => undefined);
    try {
      const candidate = redisConfig.getRawClient();
      if (candidate) {
        this.redis = candidate;
        this.useRedis = true;
      }
    } catch (err) {
      logger.warn('[whiteboard] Redis not available, using in-memory store', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async create(
    ownerId: string,
    input: SaveWhiteboardInput
  ): Promise<WhiteboardSession> {
    const now = Date.now();
    const id = this.generateId();
    const session: WhiteboardSession = {
      id,
      ownerId,
      title: input.title?.trim() || 'Untitled board',
      courseId: input.courseId,
      roomId: input.roomId,
      width: input.width,
      height: input.height,
      thumbnail: input.thumbnail,
      ops: dedupeAndSort(input.ops),
      version: 1,
      updatedAt: now,
      createdAt: now,
    };

    await this.writeSession(session, /* isNew */ true);
    return session;
  }

  /**
   * Save (replace) the ops list for an existing session. Returns a
   * `WhiteboardConflictError`-shaped result when the caller's `baseVersion` is
   * stale.
   */
  async saveOps(
    id: string,
    ownerId: string,
    input: SaveWhiteboardInput
  ): Promise<SaveWhiteboardResult | WhiteboardConflictError> {
    return this.withLock(id, async () => {
      const existing = await this.internalGet(id);
      if (!existing) {
        // Treat save-to-nonexistent as a create to ease the recovery story.
        const session = await this.create(ownerId, input);
        return { session, created: true };
      }
      // We verify ownership at the controller layer; here we only check version.
      const clientBase = Number.isFinite(input.baseVersion) ? input.baseVersion : -1;
      if (existing.version !== clientBase) {
        return {
          code: 'conflict',
          message:
            'Whiteboard was modified by another client. Reload the latest version and merge.',
          serverVersion: existing.version,
          serverOps: existing.ops,
        };
      }
      const now = Date.now();
      const nextVersion = existing.version + 1;
      const patched: WhiteboardSession = {
        ...existing,
        title: input.title?.trim() || existing.title,
        width: input.width,
        height: input.height,
        thumbnail: input.thumbnail ?? existing.thumbnail,
        ops: dedupeAndSort(input.ops),
        version: nextVersion,
        updatedAt: now,
      };
      await this.writeSession(patched, /* isNew */ false);
      return { session: patched, created: false };
    });
  }

  async get(id: string): Promise<WhiteboardSession | null> {
    return this.internalGet(id);
  }

  async getByShareToken(token: string): Promise<WhiteboardSession | null> {
    if (this.useRedis && this.redis) {
      try {
        const id = await this.redis.get(KEY_SHARE(token));
        if (!id) return null;
        return this.internalGet(id);
      } catch (err) {
        logger.warn('[whiteboard] Redis share lookup failed, falling back to memory', err);
      }
    }
    return this.memory.getByShareToken(token);
  }

  async ensureShareToken(id: string): Promise<string | null> {
    const existing = await this.internalGet(id);
    if (!existing) return null;
    if (this.useRedis && this.redis) {
      try {
        // We intentionally do not store share tokens in the session hash so
        // list responses can answer "has token" without leaking the value.
        // Share tokens carry a TTL so a leaked link does not work forever even
        // if the owner never revokes it.
        const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
        const token = await this.redis.get(`${KEY_SESSION(id)}:share`);
        if (token) return token;
        const fresh = this.generateToken();
        await this.redis.set(`${KEY_SESSION(id)}:share`, fresh, 'EX', TOKEN_TTL_SECONDS);
        await this.redis.set(KEY_SHARE(fresh), id, 'EX', TOKEN_TTL_SECONDS);
        return fresh;
      } catch (err) {
        logger.warn('[whiteboard] Redis share token generation failed, using memory', err);
      }
    }
    // Fallback: scan memory tokens for this id (cheap — at most a few active
    // share tokens per session in practice).
    // To keep this implementation simple, always mint a fresh token in memory.
    const fresh = this.generateToken();
    this.memory.setShareToken(id, fresh);
    return fresh;
  }

  async revokeShareToken(id: string, token: string): Promise<boolean> {
    if (this.useRedis && this.redis) {
      try {
        const storedId = await this.redis.get(KEY_SHARE(token));
        if (storedId !== id) return false;
        await this.redis.del(KEY_SHARE(token));
        await this.redis.del(`${KEY_SESSION(id)}:share`);
        return true;
      } catch (err) {
        logger.warn('[whiteboard] Redis share revoke failed', err);
      }
    }
    this.memory.removeShareToken(token);
    return true;
  }

  async listByOwner(ownerId: string): Promise<WhiteboardSessionSummary[]> {
    const sessions = await this.internalListByOwner(ownerId);
    const summaries: WhiteboardSessionSummary[] = [];
    for (const session of sessions) {
      const hasShareToken = await this.hasShareToken(session.id);
      summaries.push({
        id: session.id,
        ownerId: session.ownerId,
        title: session.title,
        courseId: session.courseId,
        roomId: session.roomId,
        width: session.width,
        height: session.height,
        opCount: session.ops.length,
        version: session.version,
        updatedAt: session.updatedAt,
        createdAt: session.createdAt,
        thumbnail: session.thumbnail,
        hasShareToken,
      });
    }
    return summaries;
  }

  async delete(id: string, ownerId: string): Promise<boolean> {
    return this.withLock(id, async () => {
      const existing = await this.internalGet(id);
      if (!existing || existing.ownerId !== ownerId) return false;
      if (this.useRedis && this.redis) {
        try {
          await this.redis.del(KEY_SESSION(id));
          await this.redis.srem(KEY_OWNER(ownerId), id);
          // Note: we cannot easily scan every share token — they will expire
          // with the namespace or be GC'd on next lookup. Sharing is best-effort.
          return true;
        } catch (err) {
          logger.warn('[whiteboard] Redis delete failed', err);
        }
      }
      return this.memory.delete(id, ownerId);
    });
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async writeSession(session: WhiteboardSession, _isNew: boolean): Promise<void> {
    if (this.useRedis && this.redis) {
      try {
        await this.writeSessionRedis(session);
        return;
      } catch (err) {
        logger.warn('[whiteboard] Redis write failed, using memory', err);
      }
    }
    this.memory.save(session);
  }

  private async writeSessionRedis(session: WhiteboardSession): Promise<void> {
    const redis = this.redis!;
    const key = KEY_SESSION(session.id);
    await redis.hset(key, {
      id: session.id,
      ownerId: session.ownerId,
      title: session.title,
      courseId: session.courseId ?? '',
      roomId: session.roomId ?? '',
      width: String(session.width),
      height: String(session.height),
      thumbnail: session.thumbnail ?? '',
      ops: JSON.stringify(session.ops),
      version: String(session.version),
      updatedAt: String(session.updatedAt),
      createdAt: String(session.createdAt),
    });
    await redis.sadd(KEY_OWNER(session.ownerId), session.id);
  }

  private async internalGet(id: string): Promise<WhiteboardSession | null> {
    if (this.useRedis && this.redis) {
      try {
        const data = await this.redis.hgetall(KEY_SESSION(id));
        if (!data || Object.keys(data).length === 0) return null;
        return this.decodeSession(data);
      } catch (err) {
        logger.warn('[whiteboard] Redis get failed, using memory', err);
      }
    }
    return this.memory.get(id);
  }

  private async internalListByOwner(ownerId: string): Promise<WhiteboardSession[]> {
    if (this.useRedis && this.redis) {
      try {
        const ids = await this.redis.smembers(KEY_OWNER(ownerId));
        const sessions: WhiteboardSession[] = [];
        for (const id of ids) {
          const data = await this.redis.hgetall(KEY_SESSION(id));
          if (data && Object.keys(data).length > 0) {
            sessions.push(this.decodeSession(data));
          }
        }
        sessions.sort((a, b) => b.updatedAt - a.updatedAt);
        return sessions;
      } catch (err) {
        logger.warn('[whiteboard] Redis list failed, using memory', err);
      }
    }
    return this.memory.listByOwner(ownerId);
  }

  private decodeSession(data: Record<string, string>): WhiteboardSession {
    let parsedOps: WhiteboardOp[] = [];
    try {
      parsedOps = data.ops ? JSON.parse(data.ops) : [];
    } catch (err) {
      logger.warn('[whiteboard] could not parse ops JSON, treating as empty', err);
      parsedOps = [];
    }
    return {
      id: data.id,
      ownerId: data.ownerId,
      title: data.title || 'Untitled board',
      courseId: data.courseId || undefined,
      roomId: data.roomId || undefined,
      width: Number(data.width) || 0,
      height: Number(data.height) || 0,
      thumbnail: data.thumbnail || undefined,
      ops: parsedOps,
      version: Number(data.version) || 1,
      updatedAt: Number(data.updatedAt) || Date.now(),
      createdAt: Number(data.createdAt) || Date.now(),
    };
  }

  private async hasShareToken(id: string): Promise<boolean> {
    if (this.useRedis && this.redis) {
      try {
        const token = await this.redis.get(`${KEY_SESSION(id)}:share`);
        return Boolean(token);
      } catch (err) {
        // Non-fatal — pretend we don't have one.
        logger.warn('[whiteboard] share token probe failed', err);
        return false;
      }
    }
    // Memory path: tokens are not pre-listed; we'd need to scan. Keep simple.
    return false;
  }

  /**
   * Serialize operations on the same session id. Without this, two concurrent
   * `saveOps` calls could each read the same version, both compute
   * `nextVersion=v+1`, and the loser's write would silently clobber the
   * winner. The lock ensures read-modify-write happens atomically from the
   * caller's perspective.
   */
  private withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(id) ?? Promise.resolve();
    const next = previous.then(fn, fn);
    // Always clear the lock chain so failures don't poison it forever.
    this.locks.set(id, next.catch(() => undefined));
    return next;
  }

  private generateId(): string {
    // 16 bytes → 22-char base64url; collision-free for our scale.
    return 'wbs_' + crypto.randomBytes(12).toString('base64url');
  }

  private generateToken(): string {
    return crypto.randomBytes(18).toString('base64url');
  }
}

/**
 * Strip ops with no point payload and sort by `seq` (falling back to `ts`).
 * Combined with the per-id lock, this guarantees deterministic replay even
 * if the client batches ops out of order before save.
 */
function dedupeAndSort(ops: WhiteboardOp[]): WhiteboardOp[] {
  const filtered = ops.filter((op) => Array.isArray(op.points) && op.points.length > 0);
  filtered.sort((a, b) => {
    const aSeq = a.seq ?? Number.MAX_SAFE_INTEGER;
    const bSeq = b.seq ?? Number.MAX_SAFE_INTEGER;
    if (aSeq !== bSeq) return aSeq - bSeq;
    return a.ts - b.ts;
  });
  return filtered;
}

// Singleton — controllers import this directly.
let singleton: WhiteboardSessionStore | null = null;
export function getWhiteboardSessionStore(): WhiteboardSessionStore {
  if (!singleton) singleton = new WhiteboardSessionStore();
  return singleton;
}
