/**
 * Offline Course Download Hook
 * -------------------------------------------------------------------------
 * React hook wrapping the typed IndexedDB helpers in `utils/offlineDB.ts`
 * to give the UI a single ergonomic surface for downloading courses for
 * offline study and clearing local offline storage on user demand.
 *
 * Design notes
 *   • Read-through: `useOfflineCourses` returns the list synchronously
 *     after the IDB promise resolves. Refreshes happen on demand via
 *     `refresh()` so consumers own the lifecycle.
 *   • Best-effort: every method swallows IDB errors and re-throws with a
 *     tagged `OfflineStorageError` so the UI can show actionable toasts.
 *   • No SSR access: every call is gated on `typeof window === 'undefined'`
 *     guards inside the underlying `offlineDB.ts` helpers.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  clearStore,
  deleteOfflineCourse,
  getOfflineCourse,
  listOfflineCourses,
  saveCourseOffline,
  type OfflineCourseRecord,
} from '../utils/offlineDB';

/**
 * Wraps any failure from `offlineDB.ts` (IDB open failures, quota errors,
 * blocked upgrade) with a name so the UI can branch on `error.name`.
 */
export class OfflineStorageError extends Error {
  public override readonly name = 'OfflineStorageError';

  constructor(message: string, public readonly cause?: unknown) {
    super(message);
  }
}

export interface UseOfflineCoursesResult {
  /** Courses currently in offline storage, newest first. */
  courses: Array<OfflineCourseRecord<unknown>>;
  /** Whether the initial load is still in flight. */
  loading: boolean;
  /** Latest error from the last refresh attempt, if any. */
  error: OfflineStorageError | null;
  /** Persist `courseData` under `courseId`, stamping `downloadedAt`. */
  downloadCourse: <T>(courseId: string, courseData: T) => Promise<void>;
  /** Remove a single course; preserves timestamps on others. */
  removeCourse: (courseId: string) => Promise<void>;
  /** Read a single course's payload (raw, not wrapped). */
  getCourse: <T>(courseId: string) => Promise<T | null>;
  /** Re-list offline courses from IDB. */
  refresh: () => Promise<void>;
  /** Wipe every store (courses / progress / syncQueue). Best-effort. */
  clearAll: () => Promise<void>;
}

/**
 * Hook for downloading / inspecting / wiping courses stored for offline
 * study. The hook owns its own reactive state so multiple consumers can
 * subscribe without prop drilling.
 */
export function useOfflineCourses(): UseOfflineCoursesResult {
  const [courses, setCourses] = useState<Array<OfflineCourseRecord<unknown>>>(
    []
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<OfflineStorageError | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const records = await listOfflineCourses();
      setCourses(records);
      setError(null);
    } catch (cause) {
      setError(
        new OfflineStorageError(
          'Failed to read offline courses from IndexedDB.',
          cause
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const downloadCourse = useCallback(
    async <T,>(courseId: string, courseData: T): Promise<void> => {
      try {
        await saveCourseOffline(courseId, courseData);
        await refresh();
      } catch (cause) {
        throw new OfflineStorageError(
          `Could not save course "${courseId}" offline.`,
          cause
        );
      }
    },
    [refresh]
  );

  const removeCourse = useCallback(
    async (courseId: string): Promise<void> => {
      try {
        await deleteOfflineCourse(courseId);
        // Update local state immediately so the UI feels snappy; the IDB
        // delete is the source of truth so no follow-up refresh needed.
        setCourses((current) => current.filter((c) => c.id !== courseId));
      } catch (cause) {
        throw new OfflineStorageError(
          `Could not remove course "${courseId}" offline.`,
          cause
        );
      }
    },
    []
  );

  const getCourse = useCallback(
    async <T,>(courseId: string): Promise<T | null> => {
      try {
        return await getOfflineCourse<T>(courseId);
      } catch (cause) {
        throw new OfflineStorageError(
          `Could not read course "${courseId}" from offline storage.`,
          cause
        );
      }
    },
    []
  );

  const clearAll = useCallback(async (): Promise<void> => {
    // Wipe in parallel — they live in different stores, so serialising
    // would just slow the user-visible spinner.
    try {
      await Promise.all([
        clearStore('courses'),
        clearStore('progress'),
        clearStore('syncQueue'),
      ]);
      setCourses([]);
    } catch (cause) {
      throw new OfflineStorageError(
        'Could not wipe offline storage. Some data may remain in IndexedDB.',
        cause
      );
    }
  }, []);

  return {
    courses,
    loading,
    error,
    downloadCourse,
    removeCourse,
    getCourse,
    refresh,
    clearAll,
  };
}
