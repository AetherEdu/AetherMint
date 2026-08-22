/**
 * WhiteboardSession Model
 *
 * Persisted representation of a real-time collaboration whiteboard session.
 *
 * Design notes:
 * - Drawing operations are stored as a compact ordered list of `WhiteboardOp`s.
 *   Each op carries a monotonically increasing `seq` so that concurrent writers
 *   can be serialized deterministically when the stream is replayed.
 * - `version` is bumped on every save; clients pass their last-known version on
 *   save so the server can detect and reject stale writes (last-writer-wins
 *   with explicit conflict detection).
 * - `shareToken` is an opaque, secret URL-safe string that grants read-only
 *   access without authentication. It is regenerated on demand and never
 *   returned from list endpoints.
 * - `thumbnail` is a compact data-URL produced client-side via `canvas.toDataURL`
 *   on save. We intentionally do not generate thumbnails server-side because
 *   there is no headless canvas hosting in this stack.
 */

export type WhiteboardTool =
  | 'pen'
  | 'eraser'
  | 'line'
  | 'rectangle'
  | 'circle'
  | 'text';

export interface WhiteboardOp {
  /** Tool used to record this op. */
  tool: WhiteboardTool;
  /** Author of the op. */
  userId: string;
  /** Unix-ms timestamp when the op was first produced locally. */
  ts: number;
  /**
   * Monotonic sequence number assigned by the originating client session. Used
   * for deterministic replay ordering. May be `undefined` for legacy data.
   */
  seq?: number;
  /** Stroke / fill colour (`#rrggbb[a]`) or `null` when irrelevant. */
  color: string | null;
  /** Pixel stroke width. */
  width: number;
  /**
   * Normalized point set. For `pen` / `eraser` it is a poly-line; for shapes
   * (`line`, `rectangle`, `circle`) it is `[start, end]`; for `text` it is
   * `[position, anchor]` (anchor is unused but kept for shape parity).
   */
  points: Array<{ x: number; y: number }>;
  /** Optional text payload for `text` tool. */
  text?: string;
}

export interface WhiteboardSessionMetadata {
  id: string;
  /** Owner/creator user id. */
  ownerId: string;
  /** Friendly title shown in the session list. */
  title: string;
  /** Optional association with a course or classroom. */
  courseId?: string;
  /** Optional association with a live collaboration room. */
  roomId?: string;
  /** Human-readable width × height of the source canvas, in pixels. */
  width: number;
  height: number;
  /** Compact data-URL thumbnail (≤ ~6 KB). */
  thumbnail?: string;
}

export interface WhiteboardSession extends WhiteboardSessionMetadata {
  /**
   * Ordered list of drawing instructions. New ops are appended on save; the
   * entire array is overwritten on load because client-side state mirrors it.
   */
  ops: WhiteboardOp[];
  /** Save version. Monotonically increasing per session. */
  version: number;
  /** Unix-ms timestamp of last save. */
  updatedAt: number;
  /** Unix-ms timestamp of creation. */
  createdAt: number;
}

export interface WhiteboardSessionSummary {
  id: string;
  ownerId: string;
  title: string;
  courseId?: string;
  roomId?: string;
  width: number;
  height: number;
  opCount: number;
  version: number;
  updatedAt: number;
  createdAt: number;
  thumbnail?: string;
  /** True when a read-only share link has been generated. */
  hasShareToken: boolean;
}

export interface SaveWhiteboardInput {
  title?: string;
  width: number;
  height: number;
  ops: WhiteboardOp[];
  /**
   * Client-provided base version (the version at which the client loaded the
   * session). The server returns 409 when the persisted version is newer.
   */
  baseVersion: number;
  /** Optional PNG data-URL thumbnail (~6 KB target). */
  thumbnail?: string;
  courseId?: string;
  roomId?: string;
}

export interface WhiteboardConflictError {
  code: 'conflict';
  message: string;
  serverVersion: number;
  /**
   * The authoritative server-side ops. We always return them so the client
   * can merge or prompt the user instead of losing data.
   */
  serverOps: WhiteboardOp[];
}

export interface SaveWhiteboardResult {
  session: WhiteboardSession;
  /** True when the save produced a fresh session id. */
  created: boolean;
}
