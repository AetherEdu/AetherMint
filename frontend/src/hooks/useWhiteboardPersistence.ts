/**
 * useWhiteboardPersistence
 *
 * Coordinates persistence for the collaborative whiteboard:
 *
 *   - Auto-saves ops to the backend every `autoSaveIntervalMs` (default 30
 *     seconds — matches the DoD on issue #145).
 *   - Provides a manual "Save now" trigger that fires immediately with the
 *     current ops buffer.
 *   - Surfaces conflicts (HTTP 409) by exposing `serverOps` so the UI can
 *     prompt for "load latest" or "force overwrite".
 *   - Mints and revokes read-only share tokens.
 *
 * The hook does not depend on `useAutoSave` because that helper is content-
 * oriented (it tracks the dirty-flag of an internal string) and would not
 * reflect live canvas state. Instead we drive the timer ourselves and gate it
 * with the same retry/backoff semantics.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { whiteboardClient } from '../services/whiteboardClient';
import type {
  SaveWhiteboardRequest,
  SaveWhiteboardResponse,
  WhiteboardConflictResponse,
  WhiteboardOp,
  WhiteboardSession,
} from '../types/whiteboardSession';

export interface UseWhiteboardPersistenceOptions {
  socket: Socket | null;
  roomId: string;
  userId: string;
  /** Canvas width × height — used to stamp sessions with the right metadata. */
  width: number;
  height: number;
  /** Course / room context, if any. */
  courseId?: string;
  /** Auto-save interval in milliseconds (defaults to 30 000 — see DoD). */
  autoSaveIntervalMs?: number;
  /** Replay callback — called once ops are loaded into the hook. */
  onReplay?: (ops: WhiteboardOp[]) => void;
  /** Provider of the live ops buffer. */
  collectOps: () => WhiteboardOp[];
  /** Builder for the thumbnail data-URL — usually `canvas.toDataURL`. */
  collectThumbnail?: () => string | undefined;
}

export interface UseWhiteboardPersistenceResult {
  session: WhiteboardSession | null;
  status: {
    isSaving: boolean;
    lastSaved: number | null;
    saveCount: number;
    lastError: string | null;
    retryCount: number;
  };
  saveState: 'idle' | 'saving' | 'saved' | 'error' | 'conflict';
  saveError: string | null;
  conflict: WhiteboardConflictResponse | null;
  /** Manually flush now (button click). */
  saveNow: () => Promise<void>;
  /** Save under a new session id, e.g. after "Save as..." click. */
  saveAsNew: (title: string) => Promise<void>;
  /** Load an existing session id. */
  load: (id: string) => Promise<void>;
  /** Share link helpers. */
  shareLink: string | null;
  createShareToken: () => Promise<void>;
  revokeShareToken: () => Promise<void>;
  /** True once an initial session has been hydrated (load or first save). */
  isHydrated: boolean;
}

const DEFAULTS = {
  autoSaveIntervalMs: 30_000,
  maxRetries: 3,
  retryBaseDelayMs: 2_000,
};

/**
 * Diff between two op arrays keyed by `seq` plus `ts`. Used to decide
 * whether the buffer has actually changed since the last save — without this
 * gate the auto-save would churn the backend on every tick.
 */
function opsChanged(prev: WhiteboardOp[], next: WhiteboardOp[]): boolean {
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (a.seq !== b.seq || a.ts !== b.ts) return true;
  }
  return false;
}

export function useWhiteboardPersistence(options: UseWhiteboardPersistenceOptions): UseWhiteboardPersistenceResult {
  const {
    roomId,
    userId,
    width,
    height,
    courseId,
    autoSaveIntervalMs = DEFAULTS.autoSaveIntervalMs,
    onReplay,
    collectOps,
    collectThumbnail,
  } = options;

  const [session, setSession] = useState<WhiteboardSession | null>(null);
  const [saveState, setSaveState] = useState<UseWhiteboardPersistenceResult['saveState']>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<WhiteboardConflictResponse | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [status, setStatus] = useState<UseWhiteboardPersistenceResult['status']>({
    isSaving: false,
    lastSaved: null,
    saveCount: 0,
    lastError: null,
    retryCount: 0,
  });

  const lastSavedOpsSigRef = useRef<string>('');
  const inflightRef = useRef<Promise<unknown> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildPayload = useCallback(
    (opsSnapshot: WhiteboardOp[]): SaveWhiteboardRequest => ({
      title: session?.title || roomId,
      width,
      height,
      ops: opsSnapshot,
      thumbnail: collectThumbnail?.(),
      courseId,
      roomId,
      baseVersion: session?.version ?? 0,
    }),
    [session, roomId, width, height, courseId, collectThumbnail]
  );

  const performSave = useCallback(
    async (payload: SaveWhiteboardRequest): Promise<SaveWhiteboardResponse> => {
      setSaveState('saving');
      setSaveError(null);
      try {
        const response: SaveWhiteboardResponse = session?.id
          ? await whiteboardClient.save(session.id, payload)
          : await whiteboardClient.create(payload);
        setSession(response.session);
        setSaveState('saved');
        setIsHydrated(true);
        setStatus((s) => ({
          ...s,
          isSaving: false,
          lastSaved: Date.now(),
          saveCount: s.saveCount + 1,
          retryCount: 0,
        }));
        return response;
      } catch (error: any) {
        if (error?.conflict) {
          setConflict(error.conflict);
          setSaveState('conflict');
          setSaveError(error.conflict.message);
        } else {
          setSaveError(error instanceof Error ? error.message : 'Save failed');
          setSaveState('error');
        }
        setStatus((s) => ({
          ...s,
          isSaving: false,
          lastError: error instanceof Error ? error.message : 'Save failed',
          retryCount: s.retryCount + 1,
        }));
        throw error;
      }
    },
    [session?.id]
  );

  // ---------------------------------------------------------------------------
  // Manual save — gated by an in-flight pointer so two clicks in quick
  // succession do not race the same backend write.
  // ---------------------------------------------------------------------------
  const saveNow = useCallback(async () => {
    if (inflightRef.current) return inflightRef.current;
    const ops = collectOps();
    if (ops.length === 0) return;
    setStatus((s) => ({ ...s, isSaving: true }));
    const promise = performSave(buildPayload(ops)).finally(() => {
      inflightRef.current = null;
    });
    inflightRef.current = promise;
    return promise;
  }, [collectOps, performSave, buildPayload]);

  const saveAsNew = useCallback(
    async (title: string) => {
      const ops = collectOps();
      const payload: SaveWhiteboardRequest = {
        title,
        width,
        height,
        ops,
        thumbnail: collectThumbnail?.(),
        courseId,
        roomId,
        baseVersion: 0,
      };
      const response = await whiteboardClient.create(payload);
      setSession(response.session);
      setSaveState('saved');
      setIsHydrated(true);
    },
    [collectOps, collectThumbnail, courseId, roomId, width, height]
  );

  // ---------------------------------------------------------------------------
  // Auto-save loop. We diff the ops buffer against the last-saved signature
  // so silent boards don't hammer the backend.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const interval = window.setInterval(() => {
      // Skip while another save is already in flight.
      if (inflightRef.current) return;
      const ops = collectOps();
      const signature = `${ops.length}:${ops[ops.length - 1]?.seq ?? 0}`;
      if (signature === lastSavedOpsSigRef.current) return;
      if (ops.length === 0) return;
      setStatus((s) => ({ ...s, isSaving: true }));
      const promise = (async () => {
        try {
          await performSave(buildPayload(ops));
          lastSavedOpsSigRef.current = signature;
        } catch {
          // Schedule a retry with exponential backoff.
          setStatus((s) => {
            if (s.retryCount >= DEFAULTS.maxRetries) return s;
            const delay = Math.min(DEFAULTS.retryBaseDelayMs * Math.pow(2, s.retryCount), 30_000);
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            retryTimerRef.current = setTimeout(() => {
              saveNow().catch(() => undefined);
            }, delay);
            return s;
          });
        } finally {
          setStatus((s) => ({ ...s, isSaving: false }));
        }
      })();
      inflightRef.current = promise.finally(() => {
        inflightRef.current = null;
      });
    }, autoSaveIntervalMs);

    return () => {
      window.clearInterval(interval);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [autoSaveIntervalMs, buildPayload, collectOps, performSave, saveNow]);

  // ---------------------------------------------------------------------------
  // Load / share helpers.
  // ---------------------------------------------------------------------------
  const load = useCallback(
    async (id: string) => {
      const loaded = await whiteboardClient.get(id);
      setSession(loaded);
      setIsHydrated(true);
      // Reflect the loaded state in the signature so we don't auto-save the same
      // ops back over the network without a real change.
      lastSavedOpsSigRef.current = `${loaded.ops.length}:${loaded.ops[loaded.ops.length - 1]?.seq ?? 0}`;
      onReplay?.(loaded.ops);
    },
    [onReplay]
  );

  const createShareToken = useCallback(async () => {
    if (!session?.id) return;
    const response = await whiteboardClient.createShare(session.id);
    setShareLink(response.url);
  }, [session?.id]);

  const revokeShareToken = useCallback(async () => {
    if (!session?.id || !shareLink) return;
    const token = new URL(shareLink).searchParams.get('token');
    if (!token) return;
    await whiteboardClient.revokeShareToken(session.id, token);
    setShareLink(null);
  }, [session?.id, shareLink]);

  // Reset state when the live room changes so we don't accidentally save
  // session A's ops into session B.
  useEffect(() => {
    setSession(null);
    setConflict(null);
    setSaveError(null);
    setSaveState('idle');
    setShareLink(null);
    setIsHydrated(false);
    lastSavedOpsSigRef.current = '';
  }, [roomId, userId]);

  return useMemo(
    () => ({
      session,
      status,
      saveState,
      saveError,
      conflict,
      saveNow,
      saveAsNew,
      load,
      shareLink,
      createShareToken,
      revokeShareToken,
      isHydrated,
    }),
    [
      session,
      status,
      saveState,
      saveError,
      conflict,
      saveNow,
      saveAsNew,
      load,
      shareLink,
      createShareToken,
      revokeShareToken,
      isHydrated,
    ]
  );
}
