import { useCallback, useEffect, useMemo, useState } from 'react';

export interface CollaborationParticipant {
  userId: string;
  name: string;
  role: 'student' | 'instructor' | 'moderator' | 'reviewer';
  joinedAt: string;
  lastActiveAt: string;
  isOnline: boolean;
  handRaised: boolean;
  currentRoomId?: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export interface ClassroomMessage {
  id: string;
  userId: string;
  userName: string;
  body: string;
  emojis: string[];
  createdAt: string;
  files: Array<{
    id?: string;
    name: string;
    url: string;
    type?: string;
    size?: number;
  }>;
}

export interface WhiteboardStroke {
  id: string;
  userId: string;
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
  createdAt: string;
}

export interface ClassroomPoll {
  id: string;
  question: string;
  isClosed: boolean;
  options: Array<{
    id: string;
    label: string;
    votes: string[];
  }>;
}

export interface ClassroomState {
  id: string;
  title: string;
  description?: string;
  courseId: string;
  hostId: string;
  mediaProvider: {
    kind: string;
    screenSharingEnabled: boolean;
    recordingEnabled: boolean;
    liveStreamingEnabled: boolean;
  };
  participants: CollaborationParticipant[];
  messages: ClassroomMessage[];
  whiteboard: WhiteboardStroke[];
  polls: ClassroomPoll[];
  breakoutRooms: Array<{
    id: string;
    title: string;
    participantIds: string[];
  }>;
  attendance: Array<{
    userId: string;
    status: string;
    checkedInAt: string;
  }>;
  presenterControls: {
    activePresenterId?: string;
    canShareScreen: boolean;
    canUseWhiteboard: boolean;
    canOpenPolls: boolean;
    queue: string[];
  };
  recording: {
    isRecording: boolean;
    playbackUrl?: string;
  };
  streaming: {
    isLive: boolean;
    streamUrl?: string;
  };
  screenShare: {
    activePresenterId?: string;
    streamLabel?: string;
  };
  qualityReports?: Array<{
    id: string;
    userId: string;
    packetLossPct?: number;
    roundTripTimeMs?: number;
    jitterMs?: number;
    timestamp: string;
  }>;
  interruptions?: Array<{
    id: string;
    userId: string;
    reason: string;
    details?: string;
    createdAt: string;
  }>;
}

export interface WorkspaceState {
  id: string;
  title: string;
  projectBrief: string;
  members: string[];
  documents: Array<{
    id: string;
    title: string;
    version: number;
    updatedAt: string;
    updatedBy: string;
    content: Record<string, unknown>;
  }>;
  notes: Array<{
    id: string;
    userId: string;
    userName: string;
    body: string;
    createdAt: string;
  }>;
  discussionPosts: Array<{
    id: string;
    userId: string;
    authorName: string;
    body: string;
    createdAt: string;
  }>;
}

export interface PeerReviewAssignment {
  id: string;
  workspaceId: string;
  submissionId: string;
  authorId: string;
  reviewerIds: string[];
  rubric: string[];
  submissions: Array<{
    reviewerId: string;
    score: number;
    summary: string;
  }>;
}

export interface StudyGroup {
  id: string;
  topic: string;
  focusArea: string;
  members: string[];
  recommendedSchedule: string;
  workspaceId?: string;
}

export interface MediaSignal {
  id: string;
  type: 'offer' | 'answer' | 'ice-candidate' | 'renegotiate' | 'leave';
  classroomId: string;
  fromUserId: string;
  toUserId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface MediaHealthState {
  latestReports: Array<{
    id: string;
    userId: string;
    packetLossPct?: number;
    roundTripTimeMs?: number;
    jitterMs?: number;
    availableOutgoingBitrateKbps?: number;
    frameRate?: number;
    timestamp: string;
  }>;
  interruptions: Array<{
    id: string;
    userId: string;
    reason: string;
    details?: string;
    createdAt: string;
  }>;
  participantSummary: Array<{
    userId: string;
    name: string;
    connectionQuality?: string;
    audioEnabled: boolean;
    videoEnabled: boolean;
    screenShareEnabled?: boolean;
    lastNetworkEvent?: string;
  }>;
}

interface SessionPayload {
  classroom: ClassroomState;
  workspace?: WorkspaceState;
  summary: {
    summary: string;
    actionItems: string[];
  };
}

const jsonHeaders = {
  'Content-Type': 'application/json'
};

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok || data.success === false) {
    throw new Error(data.message || 'Request failed');
  }

  return data.data ?? data;
}

export function useCollaborationSession() {
  const [classrooms, setClassrooms] = useState<ClassroomState[]>([]);
  const [classroom, setClassroom] = useState<ClassroomState | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [summary, setSummary] = useState<{ summary: string; actionItems: string[] } | null>(null);
  const [studyGroups, setStudyGroups] = useState<StudyGroup[]>([]);
  const [peerReviews, setPeerReviews] = useState<PeerReviewAssignment[]>([]);
  const [mediaHealth, setMediaHealth] = useState<MediaHealthState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeDocument = useMemo(() => workspace?.documents?.[0] ?? null, [workspace]);

  const loadReferenceData = useCallback(async () => {
    const [groupData, reviewData] = await Promise.all([
      requestJson<StudyGroup[]>('/api/collaboration/study-groups'),
      requestJson<PeerReviewAssignment[]>('/api/collaboration/peer-review')
    ]);

    setStudyGroups(groupData);
    setPeerReviews(reviewData);
  }, []);

  const loadClassroom = useCallback(async (classroomId?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const list = await requestJson<ClassroomState[]>('/api/collaboration/classrooms');
      setClassrooms(list);

      const targetId = classroomId || list[0]?.id;

      if (!targetId) {
        setClassroom(null);
        setWorkspace(null);
        setSummary(null);
        return;
      }

      const payload = await requestJson<SessionPayload>(`/api/collaboration/classrooms/${targetId}`);
      setClassroom(payload.classroom);
      setWorkspace(payload.workspace || null);
      setSummary(payload.summary);
      setMediaHealth(await requestJson<MediaHealthState>(`/api/collaboration/classrooms/${targetId}/media-health`));
      await loadReferenceData();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load collaboration session');
    } finally {
      setIsLoading(false);
    }
  }, [loadReferenceData]);

  useEffect(() => {
    loadClassroom();
  }, [loadClassroom]);

  useEffect(() => {
    if (!classroom?.id) {
      return;
    }

    // Polling keeps the demo page in sync without forcing an extra socket client dependency.
    const interval = window.setInterval(() => {
      loadClassroom(classroom.id);
    }, 8000);

    return () => window.clearInterval(interval);
  }, [classroom?.id, loadClassroom]);

  const refresh = useCallback(async () => {
    await loadClassroom(classroom?.id);
  }, [classroom?.id, loadClassroom]);

  const joinClassroom = useCallback(async (user: { userId: string; name: string; role?: string }) => {
    if (!classroom?.id) return;

    await requestJson(`/api/collaboration/classrooms/${classroom.id}/join`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(user)
    });

    await refresh();
  }, [classroom?.id, refresh]);

  const sendMessage = useCallback(async (payload: { userId: string; userName: string; body: string; emojis?: string[]; files?: Array<{ name: string; url: string; type?: string }> }) => {
    if (!classroom?.id) return;

    await requestJson(`/api/collaboration/classrooms/${classroom.id}/messages`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload)
    });

    await refresh();
  }, [classroom?.id, refresh]);

  const addWhiteboardStroke = useCallback(async (payload: { userId: string; color: string; width: number; points: Array<{ x: number; y: number }> }) => {
    if (!classroom?.id) return;

    await requestJson(`/api/collaboration/classrooms/${classroom.id}/whiteboard`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload)
    });

    await refresh();
  }, [classroom?.id, refresh]);

  const createPoll = useCallback(async (payload: { question: string; options: string[]; createdBy: string }) => {
    if (!classroom?.id) return;

    await requestJson(`/api/collaboration/classrooms/${classroom.id}/polls`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload)
    });

    await refresh();
  }, [classroom?.id, refresh]);

  const respondToPoll = useCallback(async (pollId: string, optionId: string, userId: string) => {
    if (!classroom?.id) return;

    await requestJson(`/api/collaboration/classrooms/${classroom.id}/polls/${pollId}/respond`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ optionId, userId })
    });

    await refresh();
  }, [classroom?.id, refresh]);

  const toggleHandRaise = useCallback(async (userId: string, raised: boolean) => {
    if (!classroom?.id) return;

    await requestJson(`/api/collaboration/classrooms/${classroom.id}/hand-raise`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ userId, raised })
    });

    await refresh();
  }, [classroom?.id, refresh]);

  const advanceQueue = useCallback(async () => {
    if (!classroom?.id) return;

    await requestJson(`/api/collaboration/classrooms/${classroom.id}/queue/advance`, {
      method: 'POST'
    });

    await refresh();
  }, [classroom?.id, refresh]);

  const updateSessionState = useCallback(async (payload: Record<string, unknown>) => {
    if (!classroom?.id) return;

    await requestJson(`/api/collaboration/classrooms/${classroom.id}/session`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(payload)
    });

    await refresh();
  }, [classroom?.id, refresh]);

  const createBreakoutRoom = useCallback(async (title: string, participantIds: string[]) => {
    if (!classroom?.id) return;

    await requestJson(`/api/collaboration/classrooms/${classroom.id}/breakout-rooms`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ title, participantIds })
    });

    await refresh();
  }, [classroom?.id, refresh]);

  const updateParticipantMediaState = useCallback(async (payload: { userId: string; audioEnabled?: boolean; videoEnabled?: boolean; screenShareEnabled?: boolean; connectionQuality?: string; lastNetworkEvent?: string }) => {
    if (!classroom?.id) return;

    const updated = await requestJson<ClassroomState>(`/api/collaboration/classrooms/${classroom.id}/media-state`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(payload)
    });

    setClassroom(updated);
  }, [classroom?.id]);

  const sendSignal = useCallback(async (payload: { type: MediaSignal['type']; fromUserId: string; toUserId: string; payload: Record<string, unknown> }) => {
    if (!classroom?.id) return null;

    return requestJson<MediaSignal>(`/api/collaboration/classrooms/${classroom.id}/signals`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload)
    });
  }, [classroom?.id]);

  const pullSignals = useCallback(async (userId: string) => {
    if (!classroom?.id) return [];

    return requestJson<MediaSignal[]>(`/api/collaboration/classrooms/${classroom.id}/signals?userId=${encodeURIComponent(userId)}`);
  }, [classroom?.id]);

  const reportMediaQuality = useCallback(async (payload: {
    userId: string;
    audioBitrateKbps?: number;
    videoBitrateKbps?: number;
    packetLossPct?: number;
    roundTripTimeMs?: number;
    jitterMs?: number;
    availableOutgoingBitrateKbps?: number;
    frameRate?: number;
  }) => {
    if (!classroom?.id) return;

    await requestJson(`/api/collaboration/classrooms/${classroom.id}/media-quality`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload)
    });

    setMediaHealth(await requestJson<MediaHealthState>(`/api/collaboration/classrooms/${classroom.id}/media-health`));
  }, [classroom?.id]);

  const reportInterruption = useCallback(async (payload: { userId: string; reason: string; details?: string }) => {
    if (!classroom?.id) return;

    await requestJson(`/api/collaboration/classrooms/${classroom.id}/interruptions`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload)
    });

    setMediaHealth(await requestJson<MediaHealthState>(`/api/collaboration/classrooms/${classroom.id}/media-health`));
  }, [classroom?.id]);

  const syncDocument = useCallback(async (payload: { documentId: string; title: string; userId: string; version: number; content: Record<string, unknown>; strategy?: string }) => {
    if (!workspace?.id) return;

    const document = await requestJson(`/api/collaboration/workspaces/${workspace.id}/documents/${payload.documentId}/sync`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload)
    });

    setWorkspace((current) => {
      if (!current) return current;

      const documents = current.documents.some((entry) => entry.id === payload.documentId)
        ? current.documents.map((entry) => entry.id === payload.documentId ? document : entry)
        : [...current.documents, document];

      return {
        ...current,
        documents
      };
    });
  }, [workspace?.id]);

  const addWorkspaceNote = useCallback(async (payload: { userId: string; userName: string; body: string }) => {
    if (!workspace?.id) return;

    const note = await requestJson(`/api/collaboration/workspaces/${workspace.id}/notes`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload)
    });

    setWorkspace((current) => current ? { ...current, notes: [...current.notes, note] } : current);
  }, [workspace?.id]);

  const addDiscussionPost = useCallback(async (payload: { userId: string; authorName: string; body: string }) => {
    if (!workspace?.id) return;

    const post = await requestJson(`/api/collaboration/workspaces/${workspace.id}/discussions`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload)
    });

    setWorkspace((current) => current ? { ...current, discussionPosts: [...current.discussionPosts, post] } : current);
  }, [workspace?.id]);

  const createStudyGroup = useCallback(async (payload: { topic: string; focusArea: string; members: string[]; recommendedSchedule: string; workspaceId?: string }) => {
    const group = await requestJson<StudyGroup>('/api/collaboration/study-groups', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload)
    });

    setStudyGroups((current) => [group, ...current]);
  }, []);

  const createPeerReview = useCallback(async (payload: { workspaceId: string; submissionId: string; authorId: string; reviewerIds: string[]; rubric: string[]; dueAt: string }) => {
    const assignment = await requestJson<PeerReviewAssignment>('/api/collaboration/peer-review', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload)
    });

    setPeerReviews((current) => [assignment, ...current]);
  }, []);

  return {
    classrooms,
    classroom,
    workspace,
    summary,
    studyGroups,
    peerReviews,
    mediaHealth,
    activeDocument,
    isLoading,
    error,
    loadClassroom,
    refresh,
    joinClassroom,
    sendMessage,
    addWhiteboardStroke,
    createPoll,
    respondToPoll,
    toggleHandRaise,
    advanceQueue,
    updateSessionState,
    updateParticipantMediaState,
    createBreakoutRoom,
    sendSignal,
    pullSignals,
    reportMediaQuality,
    reportInterruption,
    syncDocument,
    addWorkspaceNote,
    addDiscussionPost,
    createStudyGroup,
    createPeerReview
  };
}
