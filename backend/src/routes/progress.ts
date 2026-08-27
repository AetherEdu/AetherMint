/**
 * Learner Course Progress Routes
 *
 * Provides APIs for tracking course progress, cross-device resume position,
 * and batch reconciliation of offline progress snapshots upon reconnecting.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// In-memory / MongoDB progress store fallback map
interface ProgressRecord {
  userId: string;
  courseId: string;
  overallProgress: number;
  completedLessons: string[];
  lastActiveLessonId: string;
  playbackPositions: Record<string, { timestamp: number; completed: boolean; lastUpdated: number }>;
  lastUpdated: number;
}

const progressStore = new Map<string, ProgressRecord>();

const getStoreKey = (userId: string, courseId: string) => `${userId}_${courseId}`;

/**
 * Reconcile two progress objects deterministically.
 */
function mergeProgress(existing: ProgressRecord, incoming: Partial<ProgressRecord>): ProgressRecord {
  const completedLessons = Array.from(
    new Set([
      ...(existing.completedLessons || []),
      ...(incoming.completedLessons || []),
    ])
  );

  const playbackPositions = { ...(existing.playbackPositions || {}) };
  const incomingPositions = incoming.playbackPositions || {};

  Object.keys(incomingPositions).forEach((lessonId) => {
    const existingPos = playbackPositions[lessonId];
    const incomingPos = incomingPositions[lessonId];

    if (!existingPos || (incomingPos.lastUpdated || 0) >= (existingPos.lastUpdated || 0)) {
      playbackPositions[lessonId] = incomingPos;
    }
  });

  const overallProgress = Math.max(
    existing.overallProgress || 0,
    incoming.overallProgress || 0
  );

  const incomingLastUpdated = incoming.lastUpdated || Date.now();
  const lastActiveLessonId =
    incomingLastUpdated >= (existing.lastUpdated || 0)
      ? incoming.lastActiveLessonId || existing.lastActiveLessonId
      : existing.lastActiveLessonId || incoming.lastActiveLessonId;

  return {
    userId: existing.userId,
    courseId: existing.courseId,
    overallProgress,
    completedLessons,
    lastActiveLessonId: lastActiveLessonId || '',
    playbackPositions,
    lastUpdated: Math.max(existing.lastUpdated || 0, incomingLastUpdated),
  };
}

/**
 * GET /api/progress/:courseId
 * Retrieve course progress & last playback position
 */
router.get('/:courseId', optionalAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || 'demo_user';
    const { courseId } = req.params;

    const key = getStoreKey(userId, courseId);
    let record = progressStore.get(key);

    if (!record) {
      record = {
        userId,
        courseId,
        overallProgress: 0,
        completedLessons: [],
        lastActiveLessonId: '',
        playbackPositions: {},
        lastUpdated: Date.now(),
      };
      progressStore.set(key, record);
    }

    res.json({
      success: true,
      data: record,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/progress/update
 * Single lesson position/completion update with conflict resolution
 */
router.post('/update', optionalAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || req.body.userId || 'demo_user';
    const { courseId, lessonId, playbackTimestamp, completed, overallProgress } = req.body;

    if (!courseId || !lessonId) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameters courseId or lessonId',
      });
      return;
    }

    const key = getStoreKey(userId, courseId);
    const existing = progressStore.get(key) || {
      userId,
      courseId,
      overallProgress: 0,
      completedLessons: [],
      lastActiveLessonId: lessonId,
      playbackPositions: {},
      lastUpdated: Date.now(),
    };

    const completedLessons = completed
      ? Array.from(new Set([...existing.completedLessons, lessonId]))
      : existing.completedLessons;

    const updatedPos = {
      timestamp: typeof playbackTimestamp === 'number' ? playbackTimestamp : 0,
      completed: !!completed,
      lastUpdated: Date.now(),
    };

    const incomingPartial: Partial<ProgressRecord> = {
      overallProgress: typeof overallProgress === 'number' ? overallProgress : existing.overallProgress,
      completedLessons,
      lastActiveLessonId: lessonId,
      playbackPositions: {
        ...existing.playbackPositions,
        [lessonId]: updatedPos,
      },
      lastUpdated: Date.now(),
    };

    const merged = mergeProgress(existing, incomingPartial);
    progressStore.set(key, merged);

    res.json({
      success: true,
      data: merged,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/progress/sync
 * Batch reconcile offline progress updates upon reconnection
 */
router.post('/sync', optionalAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || req.body.userId || 'demo_user';
    const { items = [] } = req.body; // Array of progress records

    const syncedResults: ProgressRecord[] = [];

    for (const item of items) {
      const courseId = item.courseId || item.data?.courseId;
      if (!courseId) continue;

      const key = getStoreKey(userId, courseId);
      const existing = progressStore.get(key) || {
        userId,
        courseId,
        overallProgress: 0,
        completedLessons: [],
        lastActiveLessonId: '',
        playbackPositions: {},
        lastUpdated: 0,
      };

      const incomingData = item.data || item;
      const merged = mergeProgress(existing, incomingData);
      progressStore.set(key, merged);
      syncedResults.push(merged);
    }

    res.json({
      success: true,
      message: `Successfully reconciled ${syncedResults.length} progress snapshot(s).`,
      data: syncedResults,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
