/**
 * Whiteboard session REST client
 *
 * Thin fetch wrapper used by both the `useWhiteboard` hook and the
 * `WhiteboardSessionList` component. Centralizing it here means the network
 * shape (paths, headers, response handling) can be tweaked in one place.
 */

import type {
  CreateShareResponse,
  SaveWhiteboardRequest,
  SaveWhiteboardResponse,
  WhiteboardConflictResponse,
  WhiteboardSession,
  WhiteboardSessionSummary,
} from '../types/whiteboardSession';

const BASE = '/api/collaboration/whiteboard';

async function parse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    const error: Error & { status?: number; payload?: unknown } = new Error(
      data?.message ?? `Request failed with status ${response.status}`
    );
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return data.data as T;
}

function headers(extra?: HeadersInit): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(extra ?? {}),
  };
}

export const whiteboardClient = {
  async list(): Promise<WhiteboardSessionSummary[]> {
    const res = await fetch(`${BASE}/sessions`, {
      method: 'GET',
      credentials: 'include',
      headers: headers(),
    });
    return parse<WhiteboardSessionSummary[]>(res);
  },

  async create(input: SaveWhiteboardRequest): Promise<SaveWhiteboardResponse> {
    const res = await fetch(`${BASE}/sessions`, {
      method: 'POST',
      credentials: 'include',
      headers: headers(),
      body: JSON.stringify(input),
    });
    if (res.status === 409) {
      // Surface the conflict structure verbatim so the caller can render it.
      const payload = (await res.json()) as WhiteboardConflictResponse;
      const error: Error & { conflict?: WhiteboardConflictResponse } = new Error(payload.message);
      error.conflict = payload;
      throw error;
    }
    return parse<SaveWhiteboardResponse>(res);
  },

  async save(id: string, input: SaveWhiteboardRequest): Promise<SaveWhiteboardResponse> {
    const res = await fetch(`${BASE}/sessions/${encodeURIComponent(id)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: headers(),
      body: JSON.stringify(input),
    });
    if (res.status === 409) {
      const payload = (await res.json()) as WhiteboardConflictResponse;
      const error: Error & { conflict?: WhiteboardConflictResponse } = new Error(payload.message);
      error.conflict = payload;
      throw error;
    }
    return parse<SaveWhiteboardResponse>(res);
  },

  async get(id: string): Promise<WhiteboardSession> {
    const res = await fetch(`${BASE}/sessions/${encodeURIComponent(id)}`, {
      method: 'GET',
      credentials: 'include',
      headers: headers(),
    });
    return parse<WhiteboardSession>(res);
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${BASE}/sessions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: headers(),
    });
    if (!res.ok) await parse(res);
  },

  async createShare(id: string): Promise<CreateShareResponse> {
    const res = await fetch(`${BASE}/sessions/${encodeURIComponent(id)}/share`, {
      method: 'POST',
      credentials: 'include',
      headers: headers(),
      body: JSON.stringify({}),
    });
    return parse<CreateShareResponse>(res);
  },

  async revokeShare(id: string, token: string): Promise<void> {
    const res = await fetch(`${BASE}/sessions/${encodeURIComponent(id)}/share`, {
      method: 'DELETE',
      credentials: 'include',
      headers: headers(),
      body: JSON.stringify({ token }),
    });
    if (!res.ok) await parse(res);
  },

  async getByShareToken(token: string): Promise<WhiteboardSession> {
    const res = await fetch(`${BASE}/shared?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: headers(),
    });
    return parse<WhiteboardSession>(res);
  },
};
