/**
 * Whiteboard session client-side types.
 *
 * Mirror of `backend/src/models/WhiteboardSession.ts`. Kept here (not
 * imported from the backend) so the frontend stays a self-contained package.
 */

export type WhiteboardTool =
  | 'pen'
  | 'eraser'
  | 'line'
  | 'rectangle'
  | 'circle'
  | 'text';

export interface WhiteboardOp {
  tool: WhiteboardTool;
  userId: string;
  /** Unix-ms timestamp of the op's local creation. */
  ts: number;
  /** Sequential replay number; assigned client-side via a small counter. */
  seq?: number;
  color: string | null;
  width: number;
  /** A list of `{x, y}` points (canvas coordinates). */
  points: Array<{ x: number; y: number }>;
  text?: string;
}

export interface WhiteboardSession {
  id: string;
  ownerId: string;
  title: string;
  courseId?: string;
  roomId?: string;
  width: number;
  height: number;
  thumbnail?: string;
  ops: WhiteboardOp[];
  version: number;
  updatedAt: number;
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
  hasShareToken: boolean;
}

export interface SaveWhiteboardRequest {
  title?: string;
  width: number;
  height: number;
  ops: WhiteboardOp[];
  thumbnail?: string;
  courseId?: string;
  roomId?: string;
  /** Client's last-known version. Server returns 409 if it differs. */
  baseVersion: number;
}

export interface SaveWhiteboardResponse {
  session: WhiteboardSession;
  created: boolean;
}

export interface WhiteboardConflictResponse {
  success: false;
  code: 'conflict';
  message: string;
  serverVersion: number;
  /** Authoritative server-side ops — handed back so the client can merge. */
  serverOps: WhiteboardOp[];
}

export interface CreateShareResponse {
  token: string;
  url: string;
}
