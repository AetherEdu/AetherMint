import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Hand,
  Mic,
  MicOff,
  MessagesSquare,
  MonitorPlay,
  Phone,
  Radio,
  Save,
  Send,
  Signal,
  Users,
  Video,
  VideoOff,
  Vote
} from 'lucide-react';
import { useCollaborationSession } from '../../hooks/useCollaborationSession';
import { useClassroomMedia } from '../../hooks/useClassroomMedia';

type CollaborationHook = ReturnType<typeof useCollaborationSession>;

interface VirtualClassroomProps {
  session: CollaborationHook;
}

const emojiSuggestions = ['🔥', '👏', '💡', '✅', '🎯'];
const whiteboardPalette = ['#1d4ed8', '#dc2626', '#059669', '#f59e0b', '#111827'];

const sectionCard =
  'rounded-3xl border border-slate-200/70 bg-white/85 p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.45)] backdrop-blur';

const VirtualClassroom: React.FC<VirtualClassroomProps> = ({ session }) => {
  const {
    classroom,
    workspace,
    summary,
    studyGroups,
    peerReviews,
    activeDocument,
    isLoading,
    error,
    joinClassroom,
    sendMessage,
    addWhiteboardStroke,
    createPoll,
    respondToPoll,
    toggleHandRaise,
    advanceQueue,
    updateSessionState,
    createBreakoutRoom,
    syncDocument,
    addWorkspaceNote,
    addDiscussionPost,
    createStudyGroup,
    createPeerReview
  } = session;

  const [currentUserId, setCurrentUserId] = useState('student_1');
  const [currentUserName, setCurrentUserName] = useState('Nia Learner');
  const [chatDraft, setChatDraft] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState('Strongly agree\nNeed more practice\nWant a breakout room');
  const [breakoutTitle, setBreakoutTitle] = useState('Concept Clinic');
  const [noteDraft, setNoteDraft] = useState('Summarize key takeaways and assign owners for follow-up tasks.');
  const [discussionDraft, setDiscussionDraft] = useState('What should we optimize first: chat latency, document sync, or attendance automation?');
  const [documentDraft, setDocumentDraft] = useState('');
  const [groupTopic, setGroupTopic] = useState('Live Assessment Prep');
  const [groupFocus, setGroupFocus] = useState('Quiz reflection and peer coaching');
  const [groupSchedule, setGroupSchedule] = useState('Fridays at 17:30 WAT');
  const [reviewSubmissionId, setReviewSubmissionId] = useState('submission_alpha');
  const [reviewers, setReviewers] = useState('student_2,student_3');
  const [rubric, setRubric] = useState('Clarity\nEvidence\nActionability');
  const [selectedColor, setSelectedColor] = useState(whiteboardPalette[0]);
  const [documentError, setDocumentError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeStroke = useRef<Array<{ x: number; y: number }>>([]);
  const isDrawing = useRef(false);

  const currentParticipant = useMemo(
    () => classroom?.participants.find((participant) => participant.userId === currentUserId),
    [classroom?.participants, currentUserId]
  );
  const media = useClassroomMedia({
    classroomId: classroom?.id,
    userId: currentUserId,
    participants: classroom?.participants || [],
    sendSignal: session.sendSignal,
    pullSignals: session.pullSignals,
    updateParticipantMediaState: session.updateParticipantMediaState,
    updateSessionState: session.updateSessionState,
    reportMediaQuality: session.reportMediaQuality,
    reportInterruption: session.reportInterruption
  });

  useEffect(() => {
    if (activeDocument) {
      setDocumentDraft(JSON.stringify(activeDocument.content, null, 2));
    }
  }, [activeDocument]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#f8fafc';
    context.fillRect(0, 0, canvas.width, canvas.height);

    classroom?.whiteboard.forEach((stroke) => {
      if (stroke.points.length === 0) {
        return;
      }

      context.beginPath();
      context.lineWidth = stroke.width;
      context.strokeStyle = stroke.color;
      context.lineCap = 'round';
      context.moveTo(stroke.points[0].x * canvas.width, stroke.points[0].y * canvas.height);
      stroke.points.slice(1).forEach((point) => {
        context.lineTo(point.x * canvas.width, point.y * canvas.height);
      });
      context.stroke();
    });
  }, [classroom?.whiteboard]);

  const beginStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    isDrawing.current = true;
    activeStroke.current = [];
    canvas.setPointerCapture(event.pointerId);
    collectPoint(event);
  };

  const collectPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !isDrawing.current) return;

    const rect = canvas.getBoundingClientRect();
    const point = {
      x: Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1)
    };

    activeStroke.current = [...activeStroke.current, point];
  };

  const commitStroke = async () => {
    isDrawing.current = false;

    if (activeStroke.current.length < 2) {
      activeStroke.current = [];
      return;
    }

    await addWhiteboardStroke({
      userId: currentUserId,
      color: selectedColor,
      width: 3,
      points: activeStroke.current
    });

    activeStroke.current = [];
  };

  if (isLoading) {
    return <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-slate-600">Loading live classroom…</div>;
  }

  if (error || !classroom) {
    return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-rose-700">{error || 'No classroom available.'}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_35%),linear-gradient(135deg,_#fffaf0_0%,_#ffffff_48%,_#eef6ff_100%)] p-6 shadow-[0_25px_80px_-45px_rgba(15,23,42,0.6)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/70 px-4 py-1 text-sm font-medium text-sky-700">
              <Radio className="h-4 w-4" />
              Virtual Classroom
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{classroom.title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{classroom.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Participants" value={String(classroom.participants.length)} />
            <Metric label="Attendance" value={String(classroom.attendance.length)} />
            <Metric label="Polls" value={String(classroom.polls.length)} />
            <Metric label="Breakouts" value={String(classroom.breakoutRooms.length)} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">
          <div className={sectionCard}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Realtime Communication</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">Streaming, voice, and presenter controls</h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <StatusPill active={classroom.streaming.isLive} label="Live stream" />
                <StatusPill active={classroom.recording.isRecording} label="Recording" />
                <StatusPill active={Boolean(classroom.screenShare.activePresenterId)} label="Screen share" />
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Provider: {classroom.mediaProvider.kind.toUpperCase()}</span>
                  <span>Room: {classroom.id}</span>
                </div>
                <div className="mt-6 grid gap-4 rounded-[1.5rem] border border-white/10 bg-[linear-gradient(135deg,_rgba(56,189,248,0.18),_rgba(15,23,42,0.95))] p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <StreamTile
                      title={`${currentUserName} (You)`}
                      subtitle={media.localStream ? 'Camera and mic active' : 'Camera offline'}
                      stream={media.screenStream || media.localStream}
                      fallbackIcon={<Phone className="h-12 w-12 text-sky-300" />}
                      muted
                    />
                    {media.remoteStreams.length > 0 ? media.remoteStreams.slice(0, 1).map((remote) => (
                      <StreamTile
                        key={remote.userId}
                        title={classroom.participants.find((participant) => participant.userId === remote.userId)?.name || remote.userId}
                        subtitle="Remote participant"
                        stream={remote.stream}
                        fallbackIcon={<MonitorPlay className="h-12 w-12 text-sky-300" />}
                        muted={false}
                      />
                    )) : (
                      <StreamTile
                        title="Waiting for peers"
                        subtitle="Remote streams appear here once another participant joins and answers signaling."
                        fallbackIcon={<MonitorPlay className="h-12 w-12 text-sky-300" />}
                      />
                    )}
                  </div>

                  <div className="grid gap-3 rounded-3xl bg-white/5 p-4 md:grid-cols-3">
                    <MediaInfo
                      label="Connection"
                      value={media.qualityLabel}
                      detail={media.isReconnecting ? 'Reconnecting to peers' : 'Realtime signaling active'}
                    />
                    <MediaInfo
                      label="Media Server"
                      value={classroom.mediaProvider.mediaServer.transport.toUpperCase()}
                      detail={`${classroom.mediaProvider.mediaServer.provider} · ${classroom.mediaProvider.mediaServer.region}`}
                    />
                    <MediaInfo
                      label="Recording"
                      value={media.isRecordingLocally ? 'Local capture on' : 'Idle'}
                      detail={classroom.recording.playbackUrl ? 'Playback ready' : 'No playback yet'}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="space-y-3">
                  <ActionButton
                    label={media.localStream ? 'Stop Camera + Mic' : 'Start Camera + Mic'}
                    onClick={() => media.localStream ? media.stopCameraAndMic() : media.startCameraAndMic()}
                  />
                  <ActionButton
                    label={currentParticipant?.audioEnabled === false ? 'Unmute Voice' : 'Mute Voice'}
                    onClick={media.toggleAudio}
                  />
                  <ActionButton
                    label={currentParticipant?.videoEnabled === false ? 'Turn Video On' : 'Turn Video Off'}
                    onClick={media.toggleVideo}
                  />
                  <ActionButton
                    label={classroom.streaming.isLive ? 'Stop Live Stream' : 'Start Live Stream'}
                    onClick={() => updateSessionState({ isLive: !classroom.streaming.isLive, streamUrl: 'https://stream.starked.example/live/classroom' })}
                  />
                  <ActionButton
                    label={media.isRecordingLocally ? 'Stop Recording' : 'Start Recording'}
                    onClick={() => media.isRecordingLocally ? media.stopLocalRecording() : media.startLocalRecording()}
                  />
                  <ActionButton
                    label={classroom.screenShare.activePresenterId ? 'Stop Screen Share' : 'Share Screen'}
                    onClick={() => classroom.screenShare.activePresenterId ? media.stopScreenShare() : media.startScreenShare()}
                  />
                  <ActionButton
                    label={currentParticipant?.handRaised ? 'Lower Hand' : 'Raise Hand'}
                    onClick={() => toggleHandRaise(currentUserId, !currentParticipant?.handRaised)}
                  />
                  <ActionButton label="Advance Queue" onClick={advanceQueue} />
                </div>

                <div className="mt-5 rounded-2xl bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Presenter Queue</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {classroom.presenterControls.queue.length > 0 ? classroom.presenterControls.queue.map((userId) => (
                      <span key={userId} className="rounded-full bg-sky-100 px-3 py-1 text-sm text-sky-700">{userId}</span>
                    )) : <span className="text-sm text-slate-500">No one in queue</span>}
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Media Status</p>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      {currentParticipant?.audioEnabled === false ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      <span>{currentParticipant?.audioEnabled === false ? 'Voice muted' : 'Voice enabled'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {currentParticipant?.videoEnabled === false ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                      <span>{currentParticipant?.videoEnabled === false ? 'Video off' : 'Video enabled'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Signal className="h-4 w-4" />
                      <span>Quality: {media.qualityLabel}</span>
                    </div>
                    {media.permissionsError && (
                      <div className="flex items-start gap-2 text-rose-600">
                        <AlertTriangle className="mt-0.5 h-4 w-4" />
                        <span>{media.permissionsError}</span>
                      </div>
                    )}
                    {media.recordingUrl && (
                      <a href={media.recordingUrl} className="text-sky-700 underline">
                        Open local recording playback
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={sectionCard}>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-sky-600" />
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Join, attendance, and breakout rooms</h3>
                <p className="text-sm text-slate-600">Hand raising, queue management, breakout support, and study-group formation all live here.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
                <label className="text-sm font-medium text-slate-700">User ID</label>
                <input className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" value={currentUserId} onChange={(event) => setCurrentUserId(event.target.value)} />
                <label className="text-sm font-medium text-slate-700">Display name</label>
                <input className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" value={currentUserName} onChange={(event) => setCurrentUserName(event.target.value)} />
                <button
                  onClick={() => joinClassroom({ userId: currentUserId, name: currentUserName })}
                  className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Join Classroom
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {classroom.participants.map((participant) => (
                  <div key={participant.userId} className="rounded-3xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{participant.name}</p>
                        <p className="text-sm text-slate-500">{participant.role}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${participant.isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {participant.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                      <span className="rounded-full bg-slate-100 px-3 py-1">{participant.audioEnabled ? 'Voice on' : 'Voice muted'}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">{participant.videoEnabled ? 'Video on' : 'Video off'}</span>
                      {participant.handRaised && <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">Hand raised</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 rounded-3xl bg-slate-50 p-4 md:flex-row">
              <input className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm" value={breakoutTitle} onChange={(event) => setBreakoutTitle(event.target.value)} />
              <button
                onClick={() => createBreakoutRoom(breakoutTitle, classroom.participants.slice(0, 3).map((participant) => participant.userId))}
                className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-500"
              >
                Create Breakout Room
              </button>
            </div>
          </div>

          <div className={sectionCard}>
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-sky-600" />
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Whiteboard</h3>
                <p className="text-sm text-slate-600">Draw directly on the canvas to create synchronized whiteboard strokes.</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {whiteboardPalette.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`h-9 w-9 rounded-full border-4 ${selectedColor === color ? 'border-slate-900' : 'border-white'}`}
                  style={{ backgroundColor: color }}
                  aria-label={`Select ${color}`}
                />
              ))}
            </div>

            <canvas
              ref={canvasRef}
              width={800}
              height={340}
              onPointerDown={beginStroke}
              onPointerMove={collectPoint}
              onPointerUp={commitStroke}
              onPointerLeave={commitStroke}
              className="mt-4 h-[340px] w-full rounded-[1.5rem] border border-slate-200 bg-slate-50"
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className={sectionCard}>
            <div className="flex items-center gap-3">
              <MessagesSquare className="h-5 w-5 text-sky-600" />
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Chat and file sharing</h3>
                <p className="text-sm text-slate-600">Emoji reactions, quick links, and peer coordination in one stream.</p>
              </div>
            </div>

            <div className="mt-4 max-h-[320px] space-y-3 overflow-y-auto pr-1">
              {classroom.messages.length > 0 ? classroom.messages.map((message) => (
                <div key={message.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-900">{message.userName}</p>
                    <span className="text-xs text-slate-500">{new Date(message.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{message.body}</p>
                  {message.emojis.length > 0 && <p className="mt-2 text-lg">{message.emojis.join(' ')}</p>}
                  {message.files.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {message.files.map((file) => (
                        <a key={`${message.id}-${file.url}`} href={file.url} className="block text-sm text-sky-700 underline">
                          {file.name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )) : <p className="text-sm text-slate-500">No chat activity yet.</p>}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {emojiSuggestions.map((emoji) => (
                <button key={emoji} onClick={() => setChatDraft((current) => `${current} ${emoji}`.trim())} className="rounded-full bg-slate-100 px-3 py-1 text-sm">
                  {emoji}
                </button>
              ))}
            </div>

            <textarea
              value={chatDraft}
              onChange={(event) => setChatDraft(event.target.value)}
              placeholder="Share context, ask for help, or coordinate the next task..."
              className="mt-4 min-h-[110px] w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm"
            />

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="File label" value={fileName} onChange={(event) => setFileName(event.target.value)} />
              <input className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="https://file-link" value={fileUrl} onChange={(event) => setFileUrl(event.target.value)} />
            </div>

            <button
              onClick={() => {
                sendMessage({
                  userId: currentUserId,
                  userName: currentUserName,
                  body: chatDraft,
                  emojis: emojiSuggestions.filter((emoji) => chatDraft.includes(emoji)),
                  files: fileName && fileUrl ? [{ name: fileName, url: fileUrl, type: 'link' }] : []
                });
                setChatDraft('');
                setFileName('');
                setFileUrl('');
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              <Send className="h-4 w-4" />
              Send Message
            </button>
          </div>

          <div className={sectionCard}>
            <div className="flex items-center gap-3">
              <Vote className="h-5 w-5 text-sky-600" />
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Interactive polls and quizzes</h3>
                <p className="text-sm text-slate-600">Launch classroom checks and capture instant responses.</p>
              </div>
            </div>

            <input className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" value={pollQuestion} onChange={(event) => setPollQuestion(event.target.value)} placeholder="Poll question" />
            <textarea className="mt-3 min-h-[90px] w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm" value={pollOptions} onChange={(event) => setPollOptions(event.target.value)} />
            <button
              onClick={() => createPoll({ question: pollQuestion, options: pollOptions.split('\n').map((option) => option.trim()).filter(Boolean), createdBy: currentUserId })}
              className="mt-3 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-500"
            >
              Launch Poll
            </button>

            <div className="mt-5 space-y-4">
              {classroom.polls.length > 0 ? classroom.polls.map((poll) => (
                <div key={poll.id} className="rounded-3xl bg-slate-50 p-4">
                  <p className="font-medium text-slate-900">{poll.question}</p>
                  <div className="mt-3 space-y-2">
                    {poll.options.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => respondToPoll(poll.id, option.id, currentUserId)}
                        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm transition hover:border-sky-300"
                      >
                        <span>{option.label}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{option.votes.length} votes</span>
                      </button>
                    ))}
                  </div>
                </div>
              )) : <p className="text-sm text-slate-500">No live polls yet.</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr_0.9fr]">
        <div className={sectionCard}>
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-sky-600" />
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Shared documents and notes</h3>
              <p className="text-sm text-slate-600">Conflict-aware collaborative editing for shared learning materials.</p>
            </div>
          </div>

          <div className="mt-4 rounded-3xl bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-700">{activeDocument?.title || 'No shared document yet'}</p>
            <p className="mt-1 text-xs text-slate-500">Version {activeDocument?.version || 0}</p>
          </div>

          <textarea className="mt-4 min-h-[240px] w-full rounded-3xl border border-slate-200 px-4 py-3 font-mono text-sm" value={documentDraft} onChange={(event) => setDocumentDraft(event.target.value)} />
          <button
            onClick={() => {
              try {
                const parsed = JSON.parse(documentDraft || '{}');
                setDocumentError('');
                syncDocument({
                  documentId: activeDocument?.id || 'doc_live_notes',
                  title: activeDocument?.title || 'Live Notes',
                  userId: currentUserId,
                  version: activeDocument?.version || 0,
                  content: parsed,
                  strategy: 'merge'
                });
              } catch (error) {
                setDocumentError(error instanceof Error ? error.message : 'Document must be valid JSON');
              }
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <Save className="h-4 w-4" />
            Sync Shared Document
          </button>
          {documentError && <p className="mt-3 text-sm text-rose-600">{documentError}</p>}

          <textarea className="mt-4 min-h-[90px] w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} />
          <button
            onClick={() => addWorkspaceNote({ userId: currentUserId, userName: currentUserName, body: noteDraft })}
            className="mt-3 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-amber-400"
          >
            Add Collaborative Note
          </button>

          <div className="mt-5 space-y-2">
            {workspace?.notes.map((note) => (
              <div key={note.id} className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">{note.userName}</p>
                <p className="mt-1">{note.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={sectionCard}>
          <div className="flex items-center gap-3">
            <GraduationCap className="h-5 w-5 text-sky-600" />
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Discussion forum and peer review</h3>
              <p className="text-sm text-slate-600">Asynchronous collaboration stays aligned with the live session.</p>
            </div>
          </div>

          <textarea className="mt-4 min-h-[100px] w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm" value={discussionDraft} onChange={(event) => setDiscussionDraft(event.target.value)} />
          <button
            onClick={() => addDiscussionPost({ userId: currentUserId, authorName: currentUserName, body: discussionDraft })}
            className="mt-3 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-500"
          >
            Post Discussion Topic
          </button>

          <div className="mt-5 space-y-3">
            {workspace?.discussionPosts.map((post) => (
              <div key={post.id} className="rounded-2xl bg-slate-50 p-4">
                <p className="font-medium text-slate-900">{post.authorName}</p>
                <p className="mt-2 text-sm text-slate-700">{post.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-900">
              <ClipboardCheck className="h-5 w-5 text-sky-600" />
              <p className="font-semibold">Create Peer Review Assignment</p>
            </div>
            <input className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" value={reviewSubmissionId} onChange={(event) => setReviewSubmissionId(event.target.value)} placeholder="Submission ID" />
            <input className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" value={reviewers} onChange={(event) => setReviewers(event.target.value)} placeholder="reviewer_1,reviewer_2" />
            <textarea className="mt-3 min-h-[80px] w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm" value={rubric} onChange={(event) => setRubric(event.target.value)} />
            <button
              onClick={() => workspace && createPeerReview({
                workspaceId: workspace.id,
                submissionId: reviewSubmissionId,
                authorId: currentUserId,
                reviewerIds: reviewers.split(',').map((entry) => entry.trim()).filter(Boolean),
                rubric: rubric.split('\n').map((entry) => entry.trim()).filter(Boolean),
                dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString()
              })}
              className="mt-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Create Review
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {peerReviews.map((assignment) => (
              <div key={assignment.id} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-medium text-slate-900">{assignment.submissionId}</p>
                <p className="mt-1">Reviewers: {assignment.reviewerIds.join(', ')}</p>
                <p className="mt-1">Rubric: {assignment.rubric.join(', ')}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={sectionCard}>
          <div className="flex items-center gap-3">
            <Hand className="h-5 w-5 text-sky-600" />
            <div>
              <h3 className="text-xl font-semibold text-slate-900">AI summary and study groups</h3>
              <p className="text-sm text-slate-600">Keep the session actionable after class ends.</p>
            </div>
          </div>

          <div className="mt-4 rounded-3xl bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-900">Meeting Summary</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{summary?.summary}</p>
            <div className="mt-3 space-y-2">
              {summary?.actionItems.map((item) => (
                <div key={item} className="rounded-2xl bg-white px-3 py-2 text-sm text-slate-700">{item}</div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-3xl bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-900">Network and interruption log</p>
            <div className="mt-3 space-y-2">
              {session.mediaHealth?.interruptions?.length ? session.mediaHealth.interruptions.slice(-4).map((entry) => (
                <div key={entry.id} className="rounded-2xl bg-white px-3 py-2 text-sm text-slate-700">
                  {entry.userId}: {entry.reason}{entry.details ? ` - ${entry.details}` : ''}
                </div>
              )) : <p className="text-sm text-slate-500">No interruption reports yet.</p>}
            </div>
          </div>

          <input className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" value={groupTopic} onChange={(event) => setGroupTopic(event.target.value)} />
          <input className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" value={groupFocus} onChange={(event) => setGroupFocus(event.target.value)} />
          <input className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" value={groupSchedule} onChange={(event) => setGroupSchedule(event.target.value)} />
          <button
            onClick={() => createStudyGroup({
              topic: groupTopic,
              focusArea: groupFocus,
              members: classroom.participants.slice(0, 4).map((participant) => participant.userId),
              recommendedSchedule: groupSchedule,
              workspaceId: workspace?.id
            })}
            className="mt-3 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-500"
          >
            Create Study Group
          </button>

          <div className="mt-5 space-y-3">
            {studyGroups.map((group) => (
              <div key={group.id} className="rounded-2xl bg-emerald-50 p-4">
                <p className="font-medium text-emerald-900">{group.topic}</p>
                <p className="mt-1 text-sm text-emerald-800">{group.focusArea}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-emerald-700">{group.recommendedSchedule}</p>
                <p className="mt-2 text-sm text-emerald-900">Members: {group.members.join(', ')}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-3xl border border-white/70 bg-white/80 px-4 py-3">
    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
    <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
  </div>
);

const StatusPill: React.FC<{ active: boolean; label: string }> = ({ active, label }) => (
  <span className={`rounded-full px-4 py-2 text-sm font-medium ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
    {label}
  </span>
);

const ActionButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button onClick={onClick} className="w-full rounded-2xl bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100">
    {label}
  </button>
);

const MediaInfo: React.FC<{ label: string; value: string; detail: string }> = ({ label, value, detail }) => (
  <div className="rounded-2xl bg-black/15 p-3">
    <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{label}</p>
    <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    <p className="mt-1 text-xs text-slate-300">{detail}</p>
  </div>
);

const StreamTile: React.FC<{ title: string; subtitle: string; stream?: MediaStream | null; fallbackIcon: React.ReactNode; muted?: boolean }> = ({ title, subtitle, stream, fallbackIcon, muted = true }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
      <div className="mb-3">
        <p className="font-medium text-white">{title}</p>
        <p className="text-xs text-slate-300">{subtitle}</p>
      </div>
      {stream ? (
        <video ref={videoRef} autoPlay playsInline muted={muted} className="h-[180px] w-full rounded-2xl bg-black object-cover" />
      ) : (
        <div className="grid h-[180px] place-items-center rounded-2xl border border-dashed border-white/15 bg-black/20 text-center">
          <div>
            {fallbackIcon}
            <p className="mt-3 text-sm text-slate-300">Stream inactive</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VirtualClassroom;
