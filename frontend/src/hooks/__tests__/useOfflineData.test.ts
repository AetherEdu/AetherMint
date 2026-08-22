/**
 * @jest-environment jsdom
 *
 * Smoke tests for the `useOfflineCourses` hook.
 *
 * We mock the underlying `offlineDB` module directly rather than spinning
 * up a fake IndexedDB instance — the hook's behaviour is "wires the
 * right IDB helpers together and surfaces a friendly error class", and
 * exercising that with a real IDB would require installing
 * `fake-indexeddb` (out of scope for this PR).
 */
import { act, renderHook, waitFor } from '@testing-library/react';

jest.mock('../../utils/offlineDB', () => ({
  initDB: jest.fn().mockResolvedValue({}),
  listOfflineCourses: jest.fn(),
  saveCourseOffline: jest.fn().mockResolvedValue(undefined),
  getOfflineCourse: jest.fn(),
  deleteOfflineCourse: jest.fn().mockResolvedValue(undefined),
  clearStore: jest.fn().mockResolvedValue(undefined),
  drainOfflineActions: jest.fn(),
  queueOfflineAction: jest.fn(),
  saveOfflineProgress: jest.fn(),
  getOfflineProgress: jest.fn(),
}));

import {
  OfflineStorageError,
  useOfflineCourses,
} from '../useOfflineData';
import {
  clearStore,
  deleteOfflineCourse,
  getOfflineCourse,
  listOfflineCourses,
  saveCourseOffline,
} from '../../utils/offlineDB';

const mockList = listOfflineCourses as unknown as jest.Mock;
const mockSave = saveCourseOffline as unknown as jest.Mock;
const mockDelete = deleteOfflineCourse as unknown as jest.Mock;
const mockGet = getOfflineCourse as unknown as jest.Mock;
const mockClearStore = clearStore as unknown as jest.Mock;

const mockRecords = [
  { id: 'a', data: { title: 'A' }, downloadedAt: 200 },
  { id: 'b', data: { title: 'B' }, downloadedAt: 100 },
];

describe('useOfflineCourses', () => {
  beforeEach(() => {
    mockList.mockReset().mockResolvedValue(mockRecords);
    mockSave.mockReset().mockResolvedValue(undefined);
    mockDelete.mockReset().mockResolvedValue(undefined);
    mockGet.mockReset().mockResolvedValue({ title: 'A' });
    mockClearStore.mockReset().mockResolvedValue(undefined);
  });

  it('refreshes on mount and resolves to a list sorted newest-first', async () => {
    const { result } = renderHook(() => useOfflineCourses());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.courses).toEqual(mockRecords);
    expect(result.current.error).toBeNull();
  });

  it('downloadCourse writes to IDB then refreshes the list', async () => {
    const { result } = renderHook(() => useOfflineCourses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.downloadCourse('c', { title: 'C' });
    });

    expect(mockSave).toHaveBeenCalledWith('c', { title: 'C' });
    expect(mockList).toHaveBeenCalled();
  });

  it('downloadCourse surfaces a wrapped OfflineStorageError on failure', async () => {
    mockSave.mockRejectedValueOnce(new Error('quota exceeded'));
    const { result } = renderHook(() => useOfflineCourses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      result.current.downloadCourse('boom', { x: 1 })
    ).rejects.toBeInstanceOf(OfflineStorageError);
  });

  it('removeCourse deletes via deleteOfflineCourse and updates local state', async () => {
    const { result } = renderHook(() => useOfflineCourses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.removeCourse('a');
    });

    expect(mockDelete).toHaveBeenCalledWith('a');
    expect(result.current.courses.map((c) => c.id)).not.toContain('a');
  });

  it('getCourse delegates to IDB and returns the unwrapped payload', async () => {
    const { result } = renderHook(() => useOfflineCourses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let resolved: { title: string } | null = null;
    await act(async () => {
      resolved = await result.current.getCourse('a');
    });

    expect(mockGet).toHaveBeenCalledWith('a');
    expect(resolved).toEqual({ title: 'A' });
  });

  it('clearAll wipes every store', async () => {
    const { result } = renderHook(() => useOfflineCourses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.clearAll();
    });

    expect(mockClearStore).toHaveBeenCalledWith('courses');
    expect(mockClearStore).toHaveBeenCalledWith('progress');
    expect(mockClearStore).toHaveBeenCalledWith('syncQueue');
    expect(result.current.courses).toEqual([]);
  });
});
