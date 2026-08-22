/**
 * AetherMint Offline IndexedDB Utility
 * --------------------------------------------------------------------
 * A tiny typed wrapper around IndexedDB for offline-first stores:
 *
 *   • `courses`   — course bodies downloaded for offline study
 *   • `progress`  — learner progress snapshots flushed while offline
 *   • `syncQueue` — outbox for actions queued while offline
 *
 * Every API is fully typed so callers cannot accidentally pass the wrong
 * shape — a common source of corruption in offline stores.
 */

const DB_NAME = 'AetherMintOfflineDB';
const DB_VERSION = 2;

export type OfflineStoreName = 'courses' | 'lessons' | 'progress' | 'syncQueue';

/**
 * Anything stored inside `courses`. Callers can extend this in their own
 * modules; the runtime doesn't care, the types do.
 */
export interface OfflineCourseRecord<T = unknown> {
  id: string;
  data: T;
  downloadedAt: number;
}

/** Individual lesson stored for offline study */
export interface OfflineLessonRecord<T = unknown> {
  id: string; // e.g. `${courseId}_${lessonId}`
  courseId: string;
  lessonId: string;
  title: string;
  content: T;
  mediaUrl?: string;
  sizeBytes: number;
  downloadedAt: number;
}

/** A learner progress snapshot — payload shape is platform-defined. */
export interface OfflineProgressRecord<T = unknown> {
  id: string;
  data: T;
  savedAt: number;
}

/** A pending action queued while offline (enrollments, quiz submits, etc.). */
export interface OfflineQueuedAction<T = unknown> {
  id?: number;
  payload: T;
  queuedAt: number;
}

/** Storage Quota details returned by navigator.storage */
export interface StorageQuotaInfo {
  quota: number; // Bytes total available
  usage: number; // Bytes used
  usagePercentage: number; // 0 - 100
  availableBytes: number;
}

/**
 * Narrow interface for `ServiceWorkerRegistration` augmented with the
 * optional Background Sync API. Used instead of an inline structural cast
 * so callers can grep `SyncCapableRegistration` consistently.
 */
interface SyncCapableRegistration extends ServiceWorkerRegistration {
  readonly sync: { register(tag: string): Promise<void> };
}

/**
 * Open (and if necessary create) the offline database.
 *
 * `initDB()` is idempotent and cached per-process: the same Promise is
 * returned until the connection closes. On failure the cached promise is
 * invalidated so the next call retries cleanly.
 */
let cachedDbPromise: Promise<IDBDatabase> | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(
      new Error('IndexedDB is unavailable in this environment.')
    );
  }
  if (cachedDbPromise) return cachedDbPromise;

  const promise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('courses')) {
        db.createObjectStore('courses', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('lessons')) {
        const lessonStore = db.createObjectStore('lessons', { keyPath: 'id' });
        lessonStore.createIndex('courseId', 'courseId', { unique: false });
      }
      if (!db.objectStoreNames.contains('progress')) {
        db.createObjectStore('progress', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', {
          keyPath: 'id',
          autoIncrement: true,
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB open failed'));
    request.onblocked = () =>
      reject(new Error('IndexedDB upgrade blocked by other tab.'));
  });

  cachedDbPromise = promise.catch((error) => {
    cachedDbPromise = null;
    throw error;
  });

  return cachedDbPromise;
};

/**
 * Lower-level helper that runs an async transaction against a single store
 * and resolves with the resulting IDBRequest result.
 */
async function runRequest<T, S extends OfflineStoreName>(
  store: S,
  mode: IDBTransactionMode,
  action: (objectStore: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await initDB();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const objectStore = transaction.objectStore(store);
    const request = action(objectStore);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error(`IDB ${store} request failed`));
  });
}

// ---------------------------------------------------------------------------
// Public API — `courses`.

/**
 * Persist a course body to the offline store, overwriting any prior copy.
 * `downloadedAt` is stamped automatically.
 */
export const saveCourseOffline = <T>(
  courseId: string,
  courseData: T
): Promise<void> => {
  const record: OfflineCourseRecord<T> = {
    id: courseId,
    data: courseData,
    downloadedAt: Date.now(),
  };
  return runRequest('courses', 'readwrite', (store) => store.put(record));
};

/** Read a single course from offline storage. Returns `null` if absent. */
export const getOfflineCourse = async <T = unknown>(
  courseId: string
): Promise<T | null> => {
  const record = await runRequest<OfflineCourseRecord<T> | undefined>(
    'courses',
    'readonly',
    (store) => store.get(courseId)
  );
  return record ? (record.data as T) : null;
};

/** List every course currently in offline storage, newest first. */
export const listOfflineCourses = async <T = unknown>(): Promise<
  Array<OfflineCourseRecord<T>>
> => {
  const records = await runRequest<OfflineCourseRecord<T>[]>(
    'courses',
    'readonly',
    (store) => store.getAll()
  );
  return (records ?? []).sort(
    (a, b) => b.downloadedAt - a.downloadedAt
  );
};

// ---------------------------------------------------------------------------
// Public API — `progress`.

/**
 * Record a learner-progress snapshot. If the platform's Service Worker is
 * registered and supports the Background Sync API, the snapshot is mirrored
 * to the SW outbox so it can be replayed when connectivity returns.
 */
export const saveOfflineProgress = async <T>(
  id: string,
  progressData: T
): Promise<void> => {
  const record: OfflineProgressRecord<T> = {
    id,
    data: progressData,
    savedAt: Date.now(),
  };
  await runRequest('progress', 'readwrite', (store) => store.put(record));

  if (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'SyncManager' in window
  ) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if ('sync' in registration) {
        await (registration as SyncCapableRegistration).sync.register(
          'sync-progress'
        );
      }
    } catch (error) {
      // Background Sync is best-effort — surface, don't throw.
      // eslint-disable-next-line no-console
      console.warn('[offlineDB] background-sync registration failed:', error);
    }
  }
};

/**
 * Delete a single course from the offline store. No-op when the course
 * isn't present. Used by `useOfflineData.removeCourse`; preserves the
 * `downloadedAt` timestamps on neighbouring records (unlike a
 * clear-then-rewrite approach which would invalidate the sort order).
 */
export const deleteOfflineCourse = (courseId: string): Promise<void> => {
  return runRequest<void, 'courses'>('courses', 'readwrite', (store) =>
    store.delete(courseId)
  );
};

/**
 * Wipe every record in a single object store.
 *
 * Used by the offline-settings UI ("Clear offline data") and by the
 * `useOfflineData` hook when the user wants to reset state without
 * touching other stores.
 */
export const clearStore = async (store: OfflineStoreName): Promise<void> => {
  await runRequest<void, typeof store>(store, 'readwrite', (objectStore) =>
    objectStore.clear()
  );
};

/** Read a single progress record. */
export const getOfflineProgress = async <T = unknown>(
  id: string
): Promise<T | null> => {
  const record = await runRequest<OfflineProgressRecord<T> | undefined>(
    'progress',
    'readonly',
    (store) => store.get(id)
  );
  return record ? (record.data as T) : null;
};

// ---------------------------------------------------------------------------
// Public API — `syncQueue` outbox.

/** Enqueue an action to be retried when the network returns. */
export const queueOfflineAction = async <T>(
  action: T
): Promise<number> => {
  const record: OfflineQueuedAction<T> = {
    payload: action,
    queuedAt: Date.now(),
  };
  return runRequest('syncQueue', 'readwrite', (store) =>
    store.add(record as unknown as Omit<OfflineQueuedAction<T>, 'id'>)
  );
};

/** Drain the outbox — returns the queued actions and clears the store. */
export const drainOfflineActions = async <T = unknown>(): Promise<
  Array<OfflineQueuedAction<T> & { id: number }>
> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('syncQueue', 'readwrite');
    const store = transaction.objectStore('syncQueue');
    const request = store.getAll();
    request.onsuccess = () => {
      const records = (request.result || []) as OfflineQueuedAction<T>[];
      const clearRequest = store.clear();
      clearRequest.onerror = () =>
        reject(
          clearRequest.error ?? new Error('IDB syncQueue clear failed')
        );
      resolve(
        records.map((record) => ({
          id: record.id as number,
          payload: record.payload,
          queuedAt: record.queuedAt,
        }))
      );
    };
    request.onerror = () =>
      reject(request.error ?? new Error('IDB syncQueue read failed'));
  });
};

// ---------------------------------------------------------------------------
// Public API — `lessons` offline storage.

/** Save a lesson for offline reading/playback. */
export const saveLessonOffline = async <T>(
  courseId: string,
  lessonId: string,
  title: string,
  content: T,
  mediaUrl?: string,
  sizeBytes: number = 0
): Promise<void> => {
  const record: OfflineLessonRecord<T> = {
    id: `${courseId}_${lessonId}`,
    courseId,
    lessonId,
    title,
    content,
    mediaUrl,
    sizeBytes: sizeBytes || JSON.stringify(content).length,
    downloadedAt: Date.now(),
  };
  return runRequest('lessons', 'readwrite', (store) => store.put(record));
};

/** Get a downloaded offline lesson. */
export const getOfflineLesson = async <T = unknown>(
  courseId: string,
  lessonId: string
): Promise<OfflineLessonRecord<T> | null> => {
  const id = `${courseId}_${lessonId}`;
  const record = await runRequest<OfflineLessonRecord<T> | undefined>(
    'lessons',
    'readonly',
    (store) => store.get(id)
  );
  return record || null;
};

/** List all offline lessons for a course. */
export const listOfflineLessonsByCourse = async <T = unknown>(
  courseId: string
): Promise<Array<OfflineLessonRecord<T>>> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('lessons', 'readonly');
    const store = transaction.objectStore('lessons');
    const index = store.index('courseId');
    const request = index.getAll(courseId);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error ?? new Error('Failed to fetch offline lessons'));
  });
};

/** Delete a downloaded offline lesson. */
export const deleteOfflineLesson = async (
  courseId: string,
  lessonId: string
): Promise<void> => {
  const id = `${courseId}_${lessonId}`;
  return runRequest<void, 'lessons'>('lessons', 'readwrite', (store) =>
    store.delete(id)
  );
};

/** List all offline lessons stored across all courses. */
export const listAllOfflineLessons = async <T = unknown>(): Promise<
  Array<OfflineLessonRecord<T>>
> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('lessons', 'readonly');
    const store = transaction.objectStore('lessons');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error ?? new Error('Failed to list all offline lessons'));
  });
};

// ---------------------------------------------------------------------------
// Public API — Storage Quota & Storage Management.

/** Get browser storage quota estimate and offline usage calculation. */
export const getStorageQuotaInfo = async (): Promise<StorageQuotaInfo> => {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    const quota = estimate.quota || 1024 * 1024 * 1024; // fallback 1GB
    const usage = estimate.usage || 0;
    const usagePercentage = Math.min(100, (usage / quota) * 100);
    const availableBytes = Math.max(0, quota - usage);

    return {
      quota,
      usage,
      usagePercentage,
      availableBytes,
    };
  }

  // Fallback default estimate
  return {
    quota: 1024 * 1024 * 500, // 500 MB
    usage: 0,
    usagePercentage: 0,
    availableBytes: 1024 * 1024 * 500,
  };
};

