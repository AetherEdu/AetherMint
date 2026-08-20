import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { env } from '@/lib/env';
import type {
  PresenceEvent,
  PresenceMember,
  PresenceSnapshot,
  PresenceStatus,
} from '@/types/presence';

export interface UsePresenceOptions {
  /** Collaboration space (classroom / workspace) to track presence for. */
  spaceId: string;
  /** Authenticated user id. */
  userId: string;
  displayName?: string;
  role?: string;
}

export interface UsePresenceReturn {
  /** Everyone currently visible in the space (privacy applied server-side). */
  members: PresenceMember[];
  /** Members who are actively typing in the space. */
  typingUsers: PresenceMember[];
  /** Number of visible members. */
  onlineCount: number;
  isConnected: boolean;
  /** Update the current user's availability status. */
  setStatus: (status: PresenceStatus) => void;
  /** Broadcast a typing/stopped-typing indicator. */
  setTyping: (isTyping: boolean) => void;
  /** Hide or reveal this user's presence within the space. */
  setHidden: (hidden: boolean) => void;
}

export function usePresence(options: UsePresenceOptions): UsePresenceReturn {
  const { spaceId, userId } = options;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [members, setMembers] = useState<PresenceMember[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const disposedRef = useRef(false);
  const maxReconnectDelay = 30000;

  const connect = useCallback(() => {
    if (disposedRef.current || socketRef.current?.connected) return;

    const wsUrl = env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001';
    const socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      reconnection: false,
    });

    const scheduleReconnect = () => {
      if (disposedRef.current) return;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), maxReconnectDelay);
      reconnectAttemptsRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };

    socket.on('connect', () => {
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      const { displayName, role } = optionsRef.current;
      socket.emit('presence:join', { spaceId, userId, displayName, role });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      scheduleReconnect();
    });

    socket.on('connect_error', () => {
      setIsConnected(false);
      scheduleReconnect();
    });

    socket.on('presence:updated', (snapshot: PresenceSnapshot) => {
      setMembers(snapshot.members ?? []);
    });

    socket.on('presence:status', (event: PresenceEvent) => {
      if (!event.status) return;
      setMembers((prev) =>
        prev.map((member) =>
          member.userId === event.userId ? { ...member, status: event.status as PresenceStatus } : member
        )
      );
    });

    socket.on('presence:typing', (event: PresenceEvent) => {
      setMembers((prev) =>
        prev.map((member) =>
          member.userId === event.userId ? { ...member, isTyping: event.isTyping ?? false } : member
        )
      );
    });

    socketRef.current = socket;
  }, [spaceId, userId]);

  useEffect(() => {
    disposedRef.current = false;
    connect();

    return () => {
      disposedRef.current = true;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      const socket = socketRef.current;
      if (socket) {
        socket.emit('presence:leave', { spaceId, userId });
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [connect, spaceId, userId]);

  const setStatus = useCallback((status: PresenceStatus) => {
    socketRef.current?.emit('presence:set-status', { userId, status });
    setMembers((prev) => prev.map((member) => (member.userId === userId ? { ...member, status } : member)));
  }, [userId]);

  const setTyping = useCallback((isTyping: boolean) => {
    socketRef.current?.emit('presence:typing', { spaceId, userId, isTyping });
  }, [spaceId, userId]);

  const setHidden = useCallback((hidden: boolean) => {
    socketRef.current?.emit('presence:set-privacy', { spaceId, userId, hidden });
  }, [spaceId, userId]);

  const typingUsers = useMemo(() => members.filter((member) => member.isTyping), [members]);

  return {
    members,
    typingUsers,
    onlineCount: members.length,
    isConnected,
    setStatus,
    setTyping,
    setHidden,
  };
}
