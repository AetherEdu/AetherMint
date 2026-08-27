/**
 * Classroom Session Routes
 *
 * HTTP endpoints for classroom session management including:
 *  - Session lifecycle (create, start, end)
 *  - Participant management (join, leave, list)
 *  - Breakout room management
 *  - Session recording metadata
 *  - Session playback URLs
 *
 * Issue #403 — Live group classrooms with WebRTC
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// ── In-memory session store (replace with DB in production) ────────────────

interface ClassroomSession {
  id: string;
  title: string;
  courseId: string;
  hostId: string;
  status: 'scheduled' | 'live' | 'ended';
  participants: Array<{
    userId: string;
    name: string;
    role: 'student' | 'instructor' | 'moderator';
    joinedAt: string;
    isOnline: boolean;
  }>;
  breakoutRooms: Array<{
    id: string;
    title: string;
    participantIds: string[];
  }>;
  recording: {
    isRecording: boolean;
    playbackUrl?: string;
    startedAt?: string;
  };
  settings: {
    maxParticipants: number;
    allowScreenShare: boolean;
    allowRecording: boolean;
    allowBreakouts: boolean;
  };
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
}

const sessions = new Map<string, ClassroomSession>();

// Seed a demo session
const demoSession: ClassroomSession = {
  id: 'classroom_demo_001',
  title: 'Introduction to WebRTC',
  courseId: 'course_001',
  hostId: 'instructor_1',
  status: 'live',
  participants: [],
  breakoutRooms: [],
  recording: { isRecording: false },
  settings: {
    maxParticipants: 50,
    allowScreenShare: true,
    allowRecording: true,
    allowBreakouts: true,
  },
  createdAt: new Date().toISOString(),
  startedAt: new Date().toISOString(),
};
sessions.set(demoSession.id, demoSession);

// ── Routes ────────────────────────────────────────────────────────────────

/**
 * GET /api/classroom/sessions
 * List all classroom sessions.
 */
router.get('/sessions', (req: Request, res: Response) => {
  const sessionList = Array.from(sessions.values());
  res.json({ success: true, data: sessionList });
});

/**
 * GET /api/classroom/sessions/:sessionId
 * Get a specific classroom session.
 */
router.get('/sessions/:sessionId', (req: Request, res: Response) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  res.json({ success: true, data: session });
});

/**
 * POST /api/classroom/sessions
 * Create a new classroom session.
 */
router.post('/sessions', authenticateToken, (req: Request, res: Response) => {
  const { title, courseId, settings } = req.body;

  if (!title) {
    return res.status(400).json({ success: false, message: 'Title is required' });
  }

  const session: ClassroomSession = {
    id: `classroom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    courseId: courseId || '',
    hostId: req.user!.id,
    status: 'scheduled',
    participants: [],
    breakoutRooms: [],
    recording: { isRecording: false },
    settings: {
      maxParticipants: settings?.maxParticipants || 50,
      allowScreenShare: settings?.allowScreenShare !== false,
      allowRecording: settings?.allowRecording !== false,
      allowBreakouts: settings?.allowBreakouts !== false,
    },
    createdAt: new Date().toISOString(),
  };

  sessions.set(session.id, session);
  res.status(201).json({ success: true, data: session });
});

/**
 * POST /api/classroom/sessions/:sessionId/start
 * Start a classroom session (set status to 'live').
 */
router.post('/sessions/:sessionId/start', authenticateToken, (req: Request, res: Response) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  if (session.hostId !== req.user!.id) {
    return res.status(403).json({ success: false, message: 'Only the host can start the session' });
  }

  session.status = 'live';
  session.startedAt = new Date().toISOString();
  res.json({ success: true, data: session });
});

/**
 * POST /api/classroom/sessions/:sessionId/end
 * End a classroom session.
 */
router.post('/sessions/:sessionId/end', authenticateToken, (req: Request, res: Response) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  if (session.hostId !== req.user!.id) {
    return res.status(403).json({ success: false, message: 'Only the host can end the session' });
  }

  session.status = 'ended';
  session.endedAt = new Date().toISOString();
  session.recording.isRecording = false;
  res.json({ success: true, data: session });
});

/**
 * POST /api/classroom/sessions/:sessionId/join
 * Join a classroom session.
 */
router.post('/sessions/:sessionId/join', (req: Request, res: Response) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  if (session.status !== 'live') {
    return res.status(400).json({ success: false, message: 'Session is not live' });
  }

  if (session.participants.length >= session.settings.maxParticipants) {
    return res.status(400).json({ success: false, message: 'Session is full' });
  }

  const { userId, name, role } = req.body;
  if (!userId || !name) {
    return res.status(400).json({ success: false, message: 'userId and name are required' });
  }

  // Check if already joined
  const existing = session.participants.find((p) => p.userId === userId);
  if (existing) {
    existing.isOnline = true;
    return res.json({ success: true, data: session });
  }

  session.participants.push({
    userId,
    name,
    role: role || 'student',
    joinedAt: new Date().toISOString(),
    isOnline: true,
  });

  res.json({ success: true, data: session });
});

/**
 * POST /api/classroom/sessions/:sessionId/leave
 * Leave a classroom session.
 */
router.post('/sessions/:sessionId/leave', (req: Request, res: Response) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId is required' });
  }

  session.participants = session.participants.filter((p) => p.userId !== userId);
  res.json({ success: true, data: session });
});

/**
 * POST /api/classroom/sessions/:sessionId/breakout-rooms
 * Create a breakout room.
 */
router.post('/sessions/:sessionId/breakout-rooms', authenticateToken, (req: Request, res: Response) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  if (!session.settings.allowBreakouts) {
    return res.status(400).json({ success: false, message: 'Breakout rooms are disabled for this session' });
  }

  const { title, participantIds } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, message: 'title is required' });
  }

  const breakoutRoom = {
    id: `breakout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    participantIds: participantIds || [],
  };

  session.breakoutRooms.push(breakoutRoom);
  res.status(201).json({ success: true, data: breakoutRoom });
});

/**
 * DELETE /api/classroom/sessions/:sessionId/breakout-rooms/:breakoutId
 * Remove a breakout room.
 */
router.delete('/sessions/:sessionId/breakout-rooms/:breakoutId', authenticateToken, (req: Request, res: Response) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const before = session.breakoutRooms.length;
  session.breakoutRooms = session.breakoutRooms.filter((r) => r.id !== req.params.breakoutId);

  if (session.breakoutRooms.length === before) {
    return res.status(404).json({ success: false, message: 'Breakout room not found' });
  }

  res.json({ success: true, message: 'Breakout room removed' });
});

/**
 * POST /api/classroom/sessions/:sessionId/recording/start
 * Start session recording (marks recording metadata).
 */
router.post('/sessions/:sessionId/recording/start', authenticateToken, (req: Request, res: Response) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  if (!session.settings.allowRecording) {
    return res.status(400).json({ success: false, message: 'Recording is disabled for this session' });
  }

  session.recording = {
    isRecording: true,
    startedAt: new Date().toISOString(),
  };

  res.json({ success: true, data: session.recording });
});

/**
 * POST /api/classroom/sessions/:sessionId/recording/stop
 * Stop session recording and set playback URL.
 */
router.post('/sessions/:sessionId/recording/stop', authenticateToken, (req: Request, res: Response) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const { playbackUrl } = req.body;

  session.recording = {
    isRecording: false,
    playbackUrl: playbackUrl || `https://recordings.aethermint.example/${session.id}/recording.webm`,
  };

  res.json({ success: true, data: session.recording });
});

/**
 * GET /api/classroom/sessions/:sessionId/playback
 * Get session recording playback URL.
 */
router.get('/sessions/:sessionId/playback', (req: Request, res: Response) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  if (!session.recording.playbackUrl) {
    return res.status(404).json({ success: false, message: 'No recording available' });
  }

  res.json({
    success: true,
    data: {
      playbackUrl: session.recording.playbackUrl,
      duration: session.endedAt && session.startedAt
        ? Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)
        : null,
    },
  });
});

export default router;
