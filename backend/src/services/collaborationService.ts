/**
 * Collaboration service
 * In-memory orchestration for virtual classrooms, shared workspaces, peer review, and study groups.
 * This service is intentionally provider-agnostic so WebRTC, Twilio, Agora, or HLS integrations can plug in later.
 */

import { getDefaultStrategy, resolveConflict, type ConflictStrategy } from './conflictResolution';

type CollaborationRole = 'student' | 'instructor' | 'moderator' | 'reviewer';
type ProviderKind = 'webrtc' | 'twilio' | 'agora' | 'hls';
type AttendanceStatus = 'present' | 'late' | 'absent';

export interface CollaborationParticipant {
  userId: string;
  name: string;
  role: CollaborationRole;
  joinedAt: Date;
  lastActiveAt: Date;
  isOnline: boolean;
  handRaised: boolean;
  currentRoomId?: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenShareEnabled?: boolean;
  connectionQuality?: 'excellent' | 'good' | 'fair' | 'poor' | 'offline';
  lastNetworkEvent?: string;
}

export interface SharedFile {
  id: string;
  name: string;
  url: string;
  size?: number;
  type?: string;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface ClassroomMessage {
  id: string;
  userId: string;
  userName: string;
  body: string;
  emojis: string[];
  createdAt: Date;
  files: SharedFile[];
}

export interface WhiteboardStroke {
  id: string;
  userId: string;
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
  createdAt: Date;
}

export interface PollOption {
  id: string;
  label: string;
  votes: string[];
}

export interface ClassroomPoll {
  id: string;
  question: string;
  options: PollOption[];
  createdBy: string;
  createdAt: Date;
  closesAt?: Date;
  isClosed: boolean;
}

export interface BreakoutRoom {
  id: string;
  title: string;
  participantIds: string[];
  createdAt: Date;
}

export interface AttendanceRecord {
  userId: string;
  status: AttendanceStatus;
  checkedInAt: Date;
}

export interface PresenterControls {
  activePresenterId?: string;
  canShareScreen: boolean;
  canUseWhiteboard: boolean;
  canOpenPolls: boolean;
  queue: string[];
}

export interface MediaProviderConfig {
  kind: ProviderKind;
  status: 'active' | 'planned';
  roomName: string;
  screenSharingEnabled: boolean;
  recordingEnabled: boolean;
  liveStreamingEnabled: boolean;
  mediaServer: {
    transport: 'sfu' | 'p2p' | 'hybrid';
    provider: 'native-webrtc' | 'twilio' | 'agora' | 'hls' | 'custom';
    region: string;
    fallbackProviders: ProviderKind[];
  };
}

export interface MediaSignal {
  id: string;
  type: 'offer' | 'answer' | 'ice-candidate' | 'renegotiate' | 'leave';
  classroomId: string;
  fromUserId: string;
  toUserId: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface MediaQualityReport {
  id: string;
  classroomId: string;
  userId: string;
  audioBitrateKbps?: number;
  videoBitrateKbps?: number;
  packetLossPct?: number;
  roundTripTimeMs?: number;
  jitterMs?: number;
  availableOutgoingBitrateKbps?: number;
  frameRate?: number;
  timestamp: Date;
}

export interface InterruptionEvent {
  id: string;
  classroomId: string;
  userId: string;
  reason: 'offline' | 'reconnecting' | 'permissions-denied' | 'device-ended' | 'screen-share-ended' | 'unknown';
  details?: string;
  createdAt: Date;
}

export interface ClassroomSession {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  hostId: string;
  createdAt: Date;
  updatedAt: Date;
  mediaProvider: MediaProviderConfig;
  participants: CollaborationParticipant[];
  messages: ClassroomMessage[];
  whiteboard: WhiteboardStroke[];
  polls: ClassroomPoll[];
  breakoutRooms: BreakoutRoom[];
  attendance: AttendanceRecord[];
  presenterControls: PresenterControls;
  sharedFiles: SharedFile[];
  noteEntries: WorkspaceNote[];
  recording: {
    isRecording: boolean;
    playbackUrl?: string;
    transcript?: string;
  };
  streaming: {
    isLive: boolean;
    streamUrl?: string;
  };
  screenShare: {
    activePresenterId?: string;
    streamLabel?: string;
  };
  signalingQueue: MediaSignal[];
  qualityReports: MediaQualityReport[];
  interruptions: InterruptionEvent[];
}

export interface SharedDocumentVersion {
  id: string;
  userId: string;
  version: number;
  updatedAt: Date;
  strategy: ConflictStrategy;
}

export interface SharedDocument {
  id: string;
  title: string;
  content: Record<string, unknown>;
  version: number;
  updatedAt: Date;
  updatedBy: string;
  history: SharedDocumentVersion[];
}

export interface DiscussionPost {
  id: string;
  userId: string;
  authorName: string;
  body: string;
  createdAt: Date;
}

export interface WorkspaceNote {
  id: string;
  userId: string;
  userName: string;
  body: string;
  createdAt: Date;
}

export interface GroupWorkspace {
  id: string;
  classroomId?: string;
  title: string;
  projectBrief: string;
  members: string[];
  documents: SharedDocument[];
  notes: WorkspaceNote[];
  discussionPosts: DiscussionPost[];
  updatedAt: Date;
}

export interface PeerReviewSubmission {
  reviewerId: string;
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  submittedAt: Date;
}

export interface PeerReviewAssignment {
  id: string;
  workspaceId: string;
  submissionId: string;
  authorId: string;
  reviewerIds: string[];
  rubric: string[];
  dueAt: Date;
  submissions: PeerReviewSubmission[];
}

export interface StudyGroup {
  id: string;
  topic: string;
  focusArea: string;
  members: string[];
  recommendedSchedule: string;
  workspaceId?: string;
  createdAt: Date;
}

interface CreateClassroomInput {
  title: string;
  courseId: string;
  hostId: string;
  description?: string;
  providerKind?: ProviderKind;
}

interface JoinClassroomInput {
  userId: string;
  name: string;
  role?: CollaborationRole;
  currentRoomId?: string;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
}

interface CreateWorkspaceInput {
  title: string;
  projectBrief: string;
  members: string[];
  classroomId?: string;
}

interface SyncDocumentInput {
  workspaceId: string;
  documentId: string;
  title: string;
  userId: string;
  version: number;
  updatedAt?: Date;
  content: Record<string, unknown>;
  strategy?: ConflictStrategy;
}

class CollaborationService {
  private classrooms = new Map<string, ClassroomSession>();
  private workspaces = new Map<string, GroupWorkspace>();
  private peerReviews = new Map<string, PeerReviewAssignment>();
  private studyGroups = new Map<string, StudyGroup>();

  constructor() {
    this.seedDemoData();
  }

  /**
   * Seed a realistic classroom so the frontend has a useful default state.
   */
  private seedDemoData(): void {
    const classroomId = this.createId('classroom');
    const workspaceId = this.createId('workspace');
    const now = new Date();

    const classroom: ClassroomSession = {
      id: classroomId,
      courseId: 'course_realtime_101',
      title: 'Realtime Systems Studio',
      description: 'Live collaboration lab for peer learning, quizzes, and breakout coaching.',
      hostId: 'instructor_1',
      createdAt: now,
      updatedAt: now,
      mediaProvider: {
        kind: 'webrtc',
        status: 'active',
        roomName: classroomId,
        screenSharingEnabled: true,
        recordingEnabled: true,
        liveStreamingEnabled: true,
        mediaServer: {
          transport: 'hybrid',
          provider: 'native-webrtc',
          region: 'global-edge',
          fallbackProviders: ['agora', 'twilio', 'hls']
        }
      },
      participants: [
        {
          userId: 'instructor_1',
          name: 'Ada Instructor',
          role: 'instructor',
          joinedAt: now,
          lastActiveAt: now,
          isOnline: true,
          handRaised: false,
          currentRoomId: classroomId,
          audioEnabled: true,
          videoEnabled: true,
          screenShareEnabled: false,
          connectionQuality: 'excellent'
        }
      ],
      messages: [],
      whiteboard: [],
      polls: [],
      breakoutRooms: [],
      attendance: [],
      presenterControls: {
        activePresenterId: 'instructor_1',
        canShareScreen: true,
        canUseWhiteboard: true,
        canOpenPolls: true,
        queue: []
      },
      sharedFiles: [],
      noteEntries: [],
      recording: {
        isRecording: false
      },
      streaming: {
        isLive: false
      },
      screenShare: {},
      signalingQueue: [],
      qualityReports: [],
      interruptions: []
    };

    const workspace: GroupWorkspace = {
      id: workspaceId,
      classroomId,
      title: 'Latency Lab Group Project',
      projectBrief: 'Investigate classroom latency hotspots and propose mitigation strategies.',
      members: ['instructor_1', 'student_1', 'student_2'],
      documents: [
        {
          id: 'doc_roadmap',
          title: 'Shared Session Notes',
          content: {
            blocks: [
              { type: 'heading', text: 'Weekly Sprint' },
              { type: 'paragraph', text: 'Track collaboration quality, participation, and quiz engagement.' }
            ]
          },
          version: 1,
          updatedAt: now,
          updatedBy: 'instructor_1',
          history: []
        }
      ],
      notes: [],
      discussionPosts: [],
      updatedAt: now
    };

    const studyGroup: StudyGroup = {
      id: this.createId('group'),
      topic: 'Distributed Collaboration',
      focusArea: 'Peer review and conflict resolution',
      members: ['student_1', 'student_2', 'student_3'],
      recommendedSchedule: 'Tuesdays and Thursdays at 18:00 WAT',
      workspaceId,
      createdAt: now
    };

    this.classrooms.set(classroomId, classroom);
    this.workspaces.set(workspaceId, workspace);
    this.studyGroups.set(studyGroup.id, studyGroup);
  }

  createClassroom(input: CreateClassroomInput): ClassroomSession {
    const now = new Date();
    const classroom: ClassroomSession = {
      id: this.createId('classroom'),
      courseId: input.courseId,
      title: input.title,
      description: input.description,
      hostId: input.hostId,
      createdAt: now,
      updatedAt: now,
      mediaProvider: {
        kind: input.providerKind ?? 'webrtc',
        status: 'active',
        roomName: `${input.courseId}-${Date.now()}`,
        screenSharingEnabled: true,
        recordingEnabled: true,
        liveStreamingEnabled: true,
        mediaServer: {
          transport: 'hybrid',
          provider: input.providerKind === 'webrtc' ? 'native-webrtc' : input.providerKind ?? 'custom',
          region: 'global-edge',
          fallbackProviders: ['webrtc', 'agora', 'twilio', 'hls']
        }
      },
      participants: [],
      messages: [],
      whiteboard: [],
      polls: [],
      breakoutRooms: [],
      attendance: [],
      presenterControls: {
        activePresenterId: input.hostId,
        canShareScreen: true,
        canUseWhiteboard: true,
        canOpenPolls: true,
        queue: []
      },
      sharedFiles: [],
      noteEntries: [],
      recording: { isRecording: false },
      streaming: { isLive: false },
      screenShare: {},
      signalingQueue: [],
      qualityReports: [],
      interruptions: []
    };

    this.classrooms.set(classroom.id, classroom);
    return classroom;
  }

  listClassrooms(): ClassroomSession[] {
    return Array.from(this.classrooms.values()).sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  }

  getClassroom(classroomId: string): ClassroomSession {
    const classroom = this.classrooms.get(classroomId);

    if (!classroom) {
      throw new Error('Classroom not found');
    }

    return classroom;
  }

  joinClassroom(classroomId: string, input: JoinClassroomInput): ClassroomSession {
    const classroom = this.getClassroom(classroomId);
    const existing = classroom.participants.find((participant) => participant.userId === input.userId);
    const now = new Date();

    if (existing) {
      existing.name = input.name;
      existing.role = input.role ?? existing.role;
      existing.currentRoomId = input.currentRoomId ?? classroomId;
      existing.audioEnabled = input.audioEnabled ?? existing.audioEnabled;
      existing.videoEnabled = input.videoEnabled ?? existing.videoEnabled;
      existing.isOnline = true;
      existing.lastActiveAt = now;
    } else {
      classroom.participants.push({
        userId: input.userId,
        name: input.name,
        role: input.role ?? 'student',
        joinedAt: now,
        lastActiveAt: now,
        isOnline: true,
        handRaised: false,
        currentRoomId: input.currentRoomId ?? classroomId,
        audioEnabled: input.audioEnabled ?? true,
        videoEnabled: input.videoEnabled ?? true,
        screenShareEnabled: false,
        connectionQuality: 'good'
      });
    }

    this.recordAttendance(classroomId, input.userId, 'present');
    classroom.updatedAt = now;

    return classroom;
  }

  leaveClassroom(classroomId: string, userId: string): ClassroomSession {
    const classroom = this.getClassroom(classroomId);
    const participant = classroom.participants.find((entry) => entry.userId === userId);

    if (participant) {
      participant.isOnline = false;
      participant.currentRoomId = undefined;
      participant.lastActiveAt = new Date();
    }

    classroom.updatedAt = new Date();
    return classroom;
  }

  recordAttendance(classroomId: string, userId: string, status: AttendanceStatus): ClassroomSession {
    const classroom = this.getClassroom(classroomId);
    const existing = classroom.attendance.find((entry) => entry.userId === userId);

    if (existing) {
      existing.status = status;
      existing.checkedInAt = new Date();
    } else {
      classroom.attendance.push({
        userId,
        status,
        checkedInAt: new Date()
      });
    }

    classroom.updatedAt = new Date();
    return classroom;
  }

  setHandRaise(classroomId: string, userId: string, raised: boolean): ClassroomSession {
    const classroom = this.getClassroom(classroomId);
    const participant = classroom.participants.find((entry) => entry.userId === userId);

    if (!participant) {
      throw new Error('Participant not found');
    }

    participant.handRaised = raised;
    participant.lastActiveAt = new Date();

    if (raised && !classroom.presenterControls.queue.includes(userId)) {
      classroom.presenterControls.queue.push(userId);
    }

    if (!raised) {
      classroom.presenterControls.queue = classroom.presenterControls.queue.filter((entry) => entry !== userId);
    }

    classroom.updatedAt = new Date();
    return classroom;
  }

  advanceQueue(classroomId: string): ClassroomSession {
    const classroom = this.getClassroom(classroomId);
    const nextSpeaker = classroom.presenterControls.queue.shift();
    classroom.presenterControls.activePresenterId = nextSpeaker ?? classroom.hostId;
    classroom.updatedAt = new Date();
    return classroom;
  }

  setPresenterControls(classroomId: string, controls: Partial<PresenterControls>): ClassroomSession {
    const classroom = this.getClassroom(classroomId);
    classroom.presenterControls = {
      ...classroom.presenterControls,
      ...controls
    };
    classroom.updatedAt = new Date();
    return classroom;
  }

  updateParticipantMediaState(
    classroomId: string,
    userId: string,
    state: Partial<Pick<CollaborationParticipant, 'audioEnabled' | 'videoEnabled' | 'screenShareEnabled' | 'connectionQuality' | 'lastNetworkEvent'>>
  ): ClassroomSession {
    const classroom = this.getClassroom(classroomId);
    const participant = classroom.participants.find((entry) => entry.userId === userId);

    if (!participant) {
      throw new Error('Participant not found');
    }

    Object.assign(participant, state);
    participant.lastActiveAt = new Date();

    if (state.screenShareEnabled === false && classroom.screenShare.activePresenterId === userId) {
      classroom.screenShare = {};
    }

    classroom.updatedAt = new Date();
    return classroom;
  }

  setRecordingStatus(classroomId: string, isRecording: boolean, playbackUrl?: string): ClassroomSession {
    const classroom = this.getClassroom(classroomId);
    classroom.recording = {
      ...classroom.recording,
      isRecording,
      playbackUrl
    };
    classroom.updatedAt = new Date();
    return classroom;
  }

  setStreamingStatus(classroomId: string, isLive: boolean, streamUrl?: string): ClassroomSession {
    const classroom = this.getClassroom(classroomId);
    classroom.streaming = {
      isLive,
      streamUrl
    };
    classroom.updatedAt = new Date();
    return classroom;
  }

  setScreenShare(classroomId: string, userId: string, streamLabel?: string): ClassroomSession {
    const classroom = this.getClassroom(classroomId);
    const participant = classroom.participants.find((entry) => entry.userId === userId);
    if (participant) {
      participant.screenShareEnabled = true;
    }
    classroom.screenShare = {
      activePresenterId: userId,
      streamLabel
    };
    classroom.updatedAt = new Date();
    return classroom;
  }

  clearScreenShare(classroomId: string): ClassroomSession {
    const classroom = this.getClassroom(classroomId);
    if (classroom.screenShare.activePresenterId) {
      const participant = classroom.participants.find((entry) => entry.userId === classroom.screenShare.activePresenterId);
      if (participant) {
        participant.screenShareEnabled = false;
      }
    }
    classroom.screenShare = {};
    classroom.updatedAt = new Date();
    return classroom;
  }

  enqueueSignal(classroomId: string, signal: Omit<MediaSignal, 'id' | 'classroomId' | 'createdAt'>): MediaSignal {
    const classroom = this.getClassroom(classroomId);
    const entry: MediaSignal = {
      ...signal,
      id: this.createId('signal'),
      classroomId,
      createdAt: new Date()
    };
    classroom.signalingQueue.push(entry);
    classroom.updatedAt = new Date();
    return entry;
  }

  pullSignals(classroomId: string, userId: string): MediaSignal[] {
    const classroom = this.getClassroom(classroomId);
    const ready = classroom.signalingQueue.filter((signal) => signal.toUserId === userId);
    classroom.signalingQueue = classroom.signalingQueue.filter((signal) => signal.toUserId !== userId);
    classroom.updatedAt = new Date();
    return ready;
  }

  reportMediaQuality(
    classroomId: string,
    quality: Omit<MediaQualityReport, 'id' | 'classroomId' | 'timestamp'>
  ): MediaQualityReport {
    const classroom = this.getClassroom(classroomId);
    const report: MediaQualityReport = {
      ...quality,
      id: this.createId('quality'),
      classroomId,
      timestamp: new Date()
    };
    classroom.qualityReports.push(report);
    classroom.qualityReports = classroom.qualityReports.slice(-100);
    const participant = classroom.participants.find((entry) => entry.userId === quality.userId);
    if (participant) {
      participant.connectionQuality = this.gradeQuality(report);
      participant.lastActiveAt = new Date();
    }
    classroom.updatedAt = new Date();
    return report;
  }

  reportInterruption(
    classroomId: string,
    interruption: Omit<InterruptionEvent, 'id' | 'classroomId' | 'createdAt'>
  ): InterruptionEvent {
    const classroom = this.getClassroom(classroomId);
    const event: InterruptionEvent = {
      ...interruption,
      id: this.createId('interrupt'),
      classroomId,
      createdAt: new Date()
    };
    classroom.interruptions.push(event);
    classroom.interruptions = classroom.interruptions.slice(-100);
    const participant = classroom.participants.find((entry) => entry.userId === interruption.userId);
    if (participant) {
      participant.lastNetworkEvent = interruption.reason;
      participant.connectionQuality = interruption.reason === 'offline' ? 'offline' : participant.connectionQuality ?? 'fair';
    }
    classroom.updatedAt = new Date();
    return event;
  }

  getMediaHealth(classroomId: string): {
    latestReports: MediaQualityReport[];
    interruptions: InterruptionEvent[];
    participantSummary: Array<Pick<CollaborationParticipant, 'userId' | 'name' | 'connectionQuality' | 'audioEnabled' | 'videoEnabled' | 'screenShareEnabled' | 'lastNetworkEvent'>>;
  } {
    const classroom = this.getClassroom(classroomId);
    return {
      latestReports: classroom.qualityReports.slice(-10),
      interruptions: classroom.interruptions.slice(-10),
      participantSummary: classroom.participants.map((participant) => ({
        userId: participant.userId,
        name: participant.name,
        connectionQuality: participant.connectionQuality,
        audioEnabled: participant.audioEnabled,
        videoEnabled: participant.videoEnabled,
        screenShareEnabled: participant.screenShareEnabled,
        lastNetworkEvent: participant.lastNetworkEvent
      }))
    };
  }

  addMessage(classroomId: string, message: Omit<ClassroomMessage, 'id' | 'createdAt'>): ClassroomMessage {
    const classroom = this.getClassroom(classroomId);
    const entry: ClassroomMessage = {
      ...message,
      id: this.createId('msg'),
      createdAt: new Date()
    };

    classroom.messages.push(entry);
    classroom.updatedAt = new Date();
    return entry;
  }

  shareFile(classroomId: string, file: Omit<SharedFile, 'id' | 'uploadedAt'>): SharedFile {
    const classroom = this.getClassroom(classroomId);
    const entry: SharedFile = {
      ...file,
      id: this.createId('file'),
      uploadedAt: new Date()
    };

    classroom.sharedFiles.push(entry);
    classroom.updatedAt = new Date();
    return entry;
  }

  addWhiteboardStroke(classroomId: string, stroke: Omit<WhiteboardStroke, 'id' | 'createdAt'>): WhiteboardStroke {
    const classroom = this.getClassroom(classroomId);
    const entry: WhiteboardStroke = {
      ...stroke,
      id: this.createId('stroke'),
      createdAt: new Date()
    };

    classroom.whiteboard.push(entry);
    classroom.updatedAt = new Date();
    return entry;
  }

  createPoll(classroomId: string, question: string, options: string[], createdBy: string, closesAt?: Date): ClassroomPoll {
    const classroom = this.getClassroom(classroomId);
    const poll: ClassroomPoll = {
      id: this.createId('poll'),
      question,
      options: options.map((label) => ({
        id: this.createId('option'),
        label,
        votes: []
      })),
      createdBy,
      createdAt: new Date(),
      closesAt,
      isClosed: false
    };

    classroom.polls.push(poll);
    classroom.updatedAt = new Date();
    return poll;
  }

  respondToPoll(classroomId: string, pollId: string, optionId: string, userId: string): ClassroomPoll {
    const classroom = this.getClassroom(classroomId);
    const poll = classroom.polls.find((entry) => entry.id === pollId);

    if (!poll) {
      throw new Error('Poll not found');
    }

    if (poll.isClosed) {
      throw new Error('Poll is already closed');
    }

    poll.options.forEach((option) => {
      option.votes = option.votes.filter((vote) => vote !== userId);
    });

    const targetOption = poll.options.find((entry) => entry.id === optionId);

    if (!targetOption) {
      throw new Error('Poll option not found');
    }

    targetOption.votes.push(userId);
    classroom.updatedAt = new Date();

    return poll;
  }

  createBreakoutRoom(classroomId: string, title: string, participantIds: string[]): BreakoutRoom {
    const classroom = this.getClassroom(classroomId);
    const room: BreakoutRoom = {
      id: this.createId('breakout'),
      title,
      participantIds,
      createdAt: new Date()
    };

    classroom.breakoutRooms.push(room);
    classroom.participants.forEach((participant) => {
      if (participantIds.includes(participant.userId)) {
        participant.currentRoomId = room.id;
      }
    });
    classroom.updatedAt = new Date();

    return room;
  }

  createWorkspace(input: CreateWorkspaceInput): GroupWorkspace {
    const workspace: GroupWorkspace = {
      id: this.createId('workspace'),
      classroomId: input.classroomId,
      title: input.title,
      projectBrief: input.projectBrief,
      members: input.members,
      documents: [],
      notes: [],
      discussionPosts: [],
      updatedAt: new Date()
    };

    this.workspaces.set(workspace.id, workspace);
    return workspace;
  }

  listWorkspaces(): GroupWorkspace[] {
    return Array.from(this.workspaces.values()).sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  }

  getWorkspace(workspaceId: string): GroupWorkspace {
    const workspace = this.workspaces.get(workspaceId);

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    return workspace;
  }

  syncDocument(input: SyncDocumentInput): SharedDocument {
    const workspace = this.getWorkspace(input.workspaceId);
    const now = input.updatedAt ?? new Date();
    const strategy = input.strategy ?? getDefaultStrategy('collaboration_doc');
    const existing = workspace.documents.find((document) => document.id === input.documentId);

    if (!existing) {
      const created: SharedDocument = {
        id: input.documentId,
        title: input.title,
        content: input.content,
        version: 1,
        updatedAt: now,
        updatedBy: input.userId,
        history: [
          {
            id: this.createId('docv'),
            userId: input.userId,
            version: 1,
            updatedAt: now,
            strategy
          }
        ]
      };

      workspace.documents.push(created);
      workspace.updatedAt = now;
      return created;
    }

    const resolution = resolveConflict(
      {
        entityType: 'collaboration_doc',
        entityId: existing.id,
        serverVersion: existing.version,
        serverUpdatedAt: existing.updatedAt,
        serverPayload: existing.content,
        clientVersion: input.version,
        clientUpdatedAt: now,
        clientPayload: input.content,
        deviceId: input.userId
      },
      strategy
    );

    existing.title = input.title;
    existing.content = resolution.payload;
    existing.version += 1;
    existing.updatedAt = now;
    existing.updatedBy = input.userId;
    existing.history.push({
      id: this.createId('docv'),
      userId: input.userId,
      version: existing.version,
      updatedAt: now,
      strategy
    });
    workspace.updatedAt = now;

    return existing;
  }

  addWorkspaceNote(workspaceId: string, userId: string, userName: string, body: string): WorkspaceNote {
    const workspace = this.getWorkspace(workspaceId);
    const note: WorkspaceNote = {
      id: this.createId('note'),
      userId,
      userName,
      body,
      createdAt: new Date()
    };

    workspace.notes.push(note);
    workspace.updatedAt = new Date();
    return note;
  }

  addDiscussionPost(workspaceId: string, userId: string, authorName: string, body: string): DiscussionPost {
    const workspace = this.getWorkspace(workspaceId);
    const post: DiscussionPost = {
      id: this.createId('post'),
      userId,
      authorName,
      body,
      createdAt: new Date()
    };

    workspace.discussionPosts.push(post);
    workspace.updatedAt = new Date();
    return post;
  }

  createPeerReviewAssignment(
    workspaceId: string,
    submissionId: string,
    authorId: string,
    reviewerIds: string[],
    rubric: string[],
    dueAt: Date
  ): PeerReviewAssignment {
    const assignment: PeerReviewAssignment = {
      id: this.createId('review'),
      workspaceId,
      submissionId,
      authorId,
      reviewerIds,
      rubric,
      dueAt,
      submissions: []
    };

    this.peerReviews.set(assignment.id, assignment);
    return assignment;
  }

  submitPeerReview(
    assignmentId: string,
    reviewerId: string,
    score: number,
    summary: string,
    strengths: string[],
    improvements: string[]
  ): PeerReviewAssignment {
    const assignment = this.peerReviews.get(assignmentId);

    if (!assignment) {
      throw new Error('Peer review assignment not found');
    }

    assignment.submissions = assignment.submissions.filter((submission) => submission.reviewerId !== reviewerId);
    assignment.submissions.push({
      reviewerId,
      score,
      summary,
      strengths,
      improvements,
      submittedAt: new Date()
    });

    return assignment;
  }

  listPeerReviews(): PeerReviewAssignment[] {
    return Array.from(this.peerReviews.values());
  }

  createStudyGroup(topic: string, focusArea: string, members: string[], recommendedSchedule: string, workspaceId?: string): StudyGroup {
    const group: StudyGroup = {
      id: this.createId('group'),
      topic,
      focusArea,
      members,
      recommendedSchedule,
      workspaceId,
      createdAt: new Date()
    };

    this.studyGroups.set(group.id, group);
    return group;
  }

  listStudyGroups(): StudyGroup[] {
    return Array.from(this.studyGroups.values());
  }

  generateMeetingSummary(classroomId: string): { summary: string; actionItems: string[] } {
    const classroom = this.getClassroom(classroomId);
    const recentMessages = classroom.messages.slice(-5).map((message) => `${message.userName}: ${message.body}`);
    const linkedWorkspace = this.getDefaultWorkspaceForClassroom(classroomId);
    const actionItems = [
      ...classroom.noteEntries.slice(-3).map((note) => note.body),
      ...(linkedWorkspace?.notes.slice(-3).map((note) => note.body) ?? [])
    ].filter(Boolean);

    return {
      summary: recentMessages.length > 0
        ? `Recent classroom activity focused on ${recentMessages.join(' | ')}.`
        : 'No live discussion yet. Start the session to generate an AI-ready summary input stream.',
      actionItems: actionItems.length > 0 ? actionItems : ['Capture next steps from discussion notes or peer review feedback.']
    };
  }

  private gradeQuality(report: Omit<MediaQualityReport, 'id' | 'classroomId' | 'timestamp'>): CollaborationParticipant['connectionQuality'] {
    const packetLoss = report.packetLossPct ?? 0;
    const rtt = report.roundTripTimeMs ?? 0;

    if (packetLoss > 12 || rtt > 900) return 'poor';
    if (packetLoss > 6 || rtt > 500) return 'fair';
    if (packetLoss > 2 || rtt > 250) return 'good';
    return 'excellent';
  }

  getDefaultWorkspaceForClassroom(classroomId: string): GroupWorkspace | undefined {
    return this.listWorkspaces().find((workspace) => workspace.classroomId === classroomId);
  }

  private createId(prefix: string): string {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

let collaborationService: CollaborationService | null = null;

export function getCollaborationService(): CollaborationService {
  if (!collaborationService) {
    collaborationService = new CollaborationService();
  }

  return collaborationService;
}

export default getCollaborationService();
