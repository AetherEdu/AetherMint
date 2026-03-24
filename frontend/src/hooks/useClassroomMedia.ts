import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CollaborationParticipant, MediaSignal } from './useCollaborationSession';

interface UseClassroomMediaOptions {
  classroomId?: string;
  userId: string;
  participants: CollaborationParticipant[];
  sendSignal: (payload: { type: MediaSignal['type']; fromUserId: string; toUserId: string; payload: Record<string, unknown> }) => Promise<MediaSignal | null>;
  pullSignals: (userId: string) => Promise<MediaSignal[]>;
  updateParticipantMediaState: (payload: {
    userId: string;
    audioEnabled?: boolean;
    videoEnabled?: boolean;
    screenShareEnabled?: boolean;
    connectionQuality?: string;
    lastNetworkEvent?: string;
  }) => Promise<void> | void;
  updateSessionState: (payload: Record<string, unknown>) => Promise<void> | void;
  reportMediaQuality: (payload: {
    userId: string;
    audioBitrateKbps?: number;
    videoBitrateKbps?: number;
    packetLossPct?: number;
    roundTripTimeMs?: number;
    jitterMs?: number;
    availableOutgoingBitrateKbps?: number;
    frameRate?: number;
  }) => Promise<void> | void;
  reportInterruption: (payload: { userId: string; reason: string; details?: string }) => Promise<void> | void;
}

interface RemoteMediaStream {
  userId: string;
  stream: MediaStream;
  quality?: string;
}

const rtcConfiguration: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export function useClassroomMedia({
  classroomId,
  userId,
  participants,
  sendSignal,
  pullSignals,
  updateParticipantMediaState,
  updateSessionState,
  reportMediaQuality,
  reportInterruption
}: UseClassroomMediaOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteMediaStream[]>([]);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [isRecordingLocally, setIsRecordingLocally] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const [qualityLabel, setQualityLabel] = useState<'excellent' | 'good' | 'fair' | 'poor' | 'offline'>('good');
  const [connectionRevision, setConnectionRevision] = useState(0);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const qualityTimer = useRef<number | null>(null);
  const signalingTimer = useRef<number | null>(null);

  const onlineParticipants = useMemo(
    () => participants.filter((participant) => participant.userId !== userId && participant.isOnline),
    [participants, userId]
  );

  const attachTracksToPeer = useCallback((connection: RTCPeerConnection) => {
    const tracks = [...(localStream?.getTracks() || []), ...(screenStream?.getTracks() || [])];

    const existingTrackIds = connection.getSenders().map((sender) => sender.track?.id).filter(Boolean);
    tracks.forEach((track) => {
      if (!existingTrackIds.includes(track.id)) {
        connection.addTrack(track, screenStream && screenStream.getTracks().includes(track) ? screenStream : (localStream as MediaStream));
      }
    });
  }, [localStream, screenStream]);

  const getPeerConnection = useCallback((peerUserId: string) => {
    let connection = peerConnections.current.get(peerUserId);

    if (connection) {
      attachTracksToPeer(connection);
      return connection;
    }

    connection = new RTCPeerConnection(rtcConfiguration);
    attachTracksToPeer(connection);

    connection.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;

      setRemoteStreams((current) => {
        const existing = current.find((entry) => entry.userId === peerUserId);
        if (existing) {
          return current.map((entry) => entry.userId === peerUserId ? { ...entry, stream } : entry);
        }
        return [...current, { userId: peerUserId, stream }];
      });
    };

    connection.onicecandidate = (event) => {
      if (!event.candidate) return;
      sendSignal({
        type: 'ice-candidate',
        fromUserId: userId,
        toUserId: peerUserId,
        payload: { candidate: event.candidate.toJSON() }
      });
    };

    connection.onconnectionstatechange = () => {
      const state = connection?.connectionState;

      if (state === 'connected') {
        setIsReconnecting(false);
      }

      if (state === 'failed' || state === 'disconnected') {
        setIsReconnecting(true);
        reportInterruption({
          userId,
          reason: 'reconnecting',
          details: `Peer connection ${state} for ${peerUserId}`
        });
      }
    };

    peerConnections.current.set(peerUserId, connection);
    setConnectionRevision((current) => current + 1);
    return connection;
  }, [attachTracksToPeer, reportInterruption, sendSignal, userId]);

  const startCameraAndMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        },
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24, max: 30 }
        }
      });

      setPermissionsError(null);
      setLocalStream(stream);
      await updateParticipantMediaState({
        userId,
        audioEnabled: true,
        videoEnabled: true
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to access camera or microphone';
      setPermissionsError(message);
      await reportInterruption({
        userId,
        reason: 'permissions-denied',
        details: message
      });
    }
  }, [reportInterruption, updateParticipantMediaState, userId]);

  const stopCameraAndMic = useCallback(async () => {
    localStream?.getTracks().forEach((track) => track.stop());
    setLocalStream(null);
    await updateParticipantMediaState({
      userId,
      audioEnabled: false,
      videoEnabled: false
    });
  }, [localStream, updateParticipantMediaState, userId]);

  const toggleAudio = useCallback(async () => {
    if (!localStream) return;
    const enabled = !localStream.getAudioTracks().every((track) => track.enabled === false);
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !enabled;
    });
    await updateParticipantMediaState({ userId, audioEnabled: !enabled });
  }, [localStream, updateParticipantMediaState, userId]);

  const toggleVideo = useCallback(async () => {
    if (!localStream) return;
    const enabled = !localStream.getVideoTracks().every((track) => track.enabled === false);
    localStream.getVideoTracks().forEach((track) => {
      track.enabled = !enabled;
    });
    await updateParticipantMediaState({ userId, videoEnabled: !enabled });
  }, [localStream, updateParticipantMediaState, userId]);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        reportInterruption({
          userId,
          reason: 'screen-share-ended',
          details: 'Presenter stopped screen sharing'
        });
        setScreenStream(null);
        updateSessionState({ screenShareUserId: null });
        updateParticipantMediaState({ userId, screenShareEnabled: false });
      });

      setScreenStream(stream);
      await updateSessionState({
        screenShareUserId: userId,
        screenLabel: 'Screen share active'
      });
      await updateParticipantMediaState({
        userId,
        screenShareEnabled: true
      });
    } catch (error) {
      await reportInterruption({
        userId,
        reason: 'permissions-denied',
        details: error instanceof Error ? error.message : 'Unable to start screen share'
      });
    }
  }, [reportInterruption, updateParticipantMediaState, updateSessionState, userId]);

  const stopScreenShare = useCallback(async () => {
    screenStream?.getTracks().forEach((track) => track.stop());
    setScreenStream(null);
    await updateSessionState({ screenShareUserId: null });
    await updateParticipantMediaState({ userId, screenShareEnabled: false });
  }, [screenStream, updateParticipantMediaState, updateSessionState, userId]);

  const startLocalRecording = useCallback(async () => {
    if (!localStream) return;

    const composite = new MediaStream([
      ...localStream.getTracks(),
      ...(screenStream?.getTracks() || [])
    ]);

    recordedChunks.current = [];
    mediaRecorder.current = new MediaRecorder(composite, {
      mimeType: 'video/webm'
    });
    mediaRecorder.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.current.push(event.data);
      }
    };
    mediaRecorder.current.onstop = async () => {
      const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setRecordingUrl(url);
      setIsRecordingLocally(false);
      await updateSessionState({
        isRecording: false,
        playbackUrl: url
      });
    };
    mediaRecorder.current.start(1000);
    setIsRecordingLocally(true);
    await updateSessionState({ isRecording: true });
  }, [localStream, screenStream, updateSessionState]);

  const stopLocalRecording = useCallback(() => {
    mediaRecorder.current?.stop();
  }, []);

  const createOfferForPeer = useCallback(async (peerUserId: string) => {
    const connection = getPeerConnection(peerUserId);
    const offer = await connection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    await connection.setLocalDescription(offer);
    await sendSignal({
      type: 'offer',
      fromUserId: userId,
      toUserId: peerUserId,
      payload: { sdp: offer.sdp, type: offer.type }
    });
  }, [getPeerConnection, sendSignal, userId]);

  const handleSignal = useCallback(async (signal: MediaSignal) => {
    const connection = getPeerConnection(signal.fromUserId);

    if (signal.type === 'offer') {
      await connection.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit));
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      await sendSignal({
        type: 'answer',
        fromUserId: userId,
        toUserId: signal.fromUserId,
        payload: { sdp: answer.sdp, type: answer.type }
      });
      return;
    }

    if (signal.type === 'answer') {
      await connection.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit));
      return;
    }

    if (signal.type === 'ice-candidate' && signal.payload.candidate) {
      await connection.addIceCandidate(new RTCIceCandidate(signal.payload.candidate as RTCIceCandidateInit));
      return;
    }

    if (signal.type === 'leave') {
      peerConnections.current.get(signal.fromUserId)?.close();
      peerConnections.current.delete(signal.fromUserId);
      setConnectionRevision((current) => current + 1);
      setRemoteStreams((current) => current.filter((entry) => entry.userId !== signal.fromUserId));
    }
  }, [getPeerConnection, sendSignal, userId]);

  useEffect(() => {
    if (!classroomId || !userId) return;

    signalingTimer.current = window.setInterval(async () => {
      const signals = await pullSignals(userId);
      for (const signal of signals) {
        await handleSignal(signal);
      }
    }, 1500);

    return () => {
      if (signalingTimer.current) window.clearInterval(signalingTimer.current);
    };
  }, [classroomId, handleSignal, pullSignals, userId]);

  useEffect(() => {
    if (!localStream && !screenStream) return;

    onlineParticipants.forEach((participant) => {
      const connection = getPeerConnection(participant.userId);
      attachTracksToPeer(connection);
      if (!connection.currentRemoteDescription && connection.signalingState === 'stable') {
        createOfferForPeer(participant.userId);
      }
    });
  }, [attachTracksToPeer, createOfferForPeer, getPeerConnection, localStream, onlineParticipants, screenStream]);

  useEffect(() => {
    const handleOnline = () => {
      setIsReconnecting(false);
      setQualityLabel('good');
      updateParticipantMediaState({ userId, lastNetworkEvent: 'online', connectionQuality: 'good' });
    };

    const handleOffline = () => {
      setIsReconnecting(true);
      setQualityLabel('offline');
      reportInterruption({
        userId,
        reason: 'offline',
        details: 'Browser reported offline state'
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [reportInterruption, updateParticipantMediaState, userId]);

  useEffect(() => {
    if (peerConnections.current.size === 0) return;

    // Gather lightweight transport health so the classroom can reflect network quality in near-real time.
    qualityTimer.current = window.setInterval(async () => {
      const connection = Array.from(peerConnections.current.values())[0];
      if (!connection) return;

      const stats = await connection.getStats();
      let packetLossPct = 0;
      let roundTripTimeMs = 0;
      let jitterMs = 0;
      let frameRate = 0;
      let availableOutgoingBitrateKbps = 0;

      stats.forEach((report) => {
        if (report.type === 'remote-inbound-rtp') {
          packetLossPct = Number(report.packetsLost || 0);
          roundTripTimeMs = Math.round(Number(report.roundTripTime || 0) * 1000);
          jitterMs = Math.round(Number(report.jitter || 0) * 1000);
        }

        if (report.type === 'outbound-rtp' && typeof (report as any).framesPerSecond === 'number') {
          frameRate = Math.round((report as any).framesPerSecond);
        }

        if (report.type === 'candidate-pair' && (report as any).availableOutgoingBitrate) {
          availableOutgoingBitrateKbps = Math.round(Number((report as any).availableOutgoingBitrate) / 1000);
        }
      });

      const nextQuality =
        packetLossPct > 12 || roundTripTimeMs > 900 ? 'poor' :
        packetLossPct > 6 || roundTripTimeMs > 500 ? 'fair' :
        packetLossPct > 2 || roundTripTimeMs > 250 ? 'good' :
        'excellent';

      setQualityLabel(nextQuality);
      await updateParticipantMediaState({
        userId,
        connectionQuality: nextQuality
      });
      await reportMediaQuality({
        userId,
        packetLossPct,
        roundTripTimeMs,
        jitterMs,
        frameRate,
        availableOutgoingBitrateKbps
      });
    }, 5000);

    return () => {
      if (qualityTimer.current) window.clearInterval(qualityTimer.current);
    };
  }, [connectionRevision, reportMediaQuality, updateParticipantMediaState, userId]);

  useEffect(() => () => {
    peerConnections.current.forEach((connection, peerUserId) => {
      sendSignal({
        type: 'leave',
        fromUserId: userId,
        toUserId: peerUserId,
        payload: {}
      });
      connection.close();
    });
    localStream?.getTracks().forEach((track) => track.stop());
    screenStream?.getTracks().forEach((track) => track.stop());
  }, [localStream, screenStream, sendSignal, userId]);

  return {
    localStream,
    screenStream,
    remoteStreams,
    recordingUrl,
    isRecordingLocally,
    isReconnecting,
    permissionsError,
    qualityLabel,
    startCameraAndMic,
    stopCameraAndMic,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    startLocalRecording,
    stopLocalRecording
  };
}
