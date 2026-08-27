/**
 * @jest-environment jsdom
 *
 * Tests for the `usePresence` hook. The Socket.IO client is mocked so we can
 * drive connection and event delivery deterministically without a live server.
 */
import { act, renderHook } from '@testing-library/react';
import { io } from 'socket.io-client';
import { usePresence } from '../usePresence';

jest.mock('socket.io-client', () => ({
  io: jest.fn(),
}));

jest.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_WS_URL: 'ws://test' },
}));

type Handler = (...args: any[]) => void;

interface SocketMock {
  connected: boolean;
  on: jest.Mock;
  emit: jest.Mock;
  disconnect: jest.Mock;
  handlers: Map<string, Handler>;
}

function createSocketMock(): SocketMock {
  const handlers = new Map<string, Handler>();
  const socket: SocketMock = {
    connected: false,
    on: jest.fn((event: string, handler: Handler) => {
      handlers.set(event, handler);
    }),
    emit: jest.fn(),
    disconnect: jest.fn(),
    handlers,
  };
  return socket;
}

const mockIo = io as unknown as jest.Mock;

const baseMember = {
  userId: 'u2',
  displayName: 'Bob',
  role: 'student',
  status: 'available' as const,
  isTyping: false,
  lastActiveAt: 1,
};

describe('usePresence', () => {
  let socket: SocketMock;

  beforeEach(() => {
    socket = createSocketMock();
    mockIo.mockReset().mockReturnValue(socket);
  });

  it('joins the space once connected', () => {
    renderHook(() => usePresence({ spaceId: 'space-1', userId: 'u1', displayName: 'Alice' }));

    act(() => {
      socket.handlers.get('connect')?.();
    });

    expect(socket.emit).toHaveBeenCalledWith(
      'presence:join',
      expect.objectContaining({ spaceId: 'space-1', userId: 'u1', displayName: 'Alice' })
    );
  });

  it('applies presence snapshots to local state', () => {
    const { result } = renderHook(() =>
      usePresence({ spaceId: 'space-1', userId: 'u1', displayName: 'Alice' })
    );

    act(() => {
      socket.handlers.get('presence:updated')?.({
        spaceId: 'space-1',
        members: [baseMember],
        onlineCount: 1,
      });
    });

    expect(result.current.members).toHaveLength(1);
    expect(result.current.onlineCount).toBe(1);
    expect(result.current.members[0].displayName).toBe('Bob');
  });

  it('updates member status and typing from real-time events', () => {
    const { result } = renderHook(() =>
      usePresence({ spaceId: 'space-1', userId: 'u1', displayName: 'Alice' })
    );

    act(() => {
      socket.handlers.get('presence:updated')?.({
        spaceId: 'space-1',
        members: [baseMember],
        onlineCount: 1,
      });
    });

    act(() => {
      socket.handlers.get('presence:status')?.({
        type: 'USER_STATUS_CHANGED',
        userId: 'u2',
        status: 'busy',
        timestamp: 1,
      });
    });
    expect(result.current.members[0].status).toBe('busy');

    act(() => {
      socket.handlers.get('presence:typing')?.({
        type: 'TYPING_STARTED',
        userId: 'u2',
        spaceId: 'space-1',
        isTyping: true,
        timestamp: 1,
      });
    });
    expect(result.current.members[0].isTyping).toBe(true);
    expect(result.current.typingUsers).toHaveLength(1);
  });

  it('emits set-status and optimistically updates own status', () => {
    const { result } = renderHook(() =>
      usePresence({ spaceId: 'space-1', userId: 'u1', displayName: 'Alice' })
    );

    act(() => {
      socket.handlers.get('presence:updated')?.({
        spaceId: 'space-1',
        members: [{ ...baseMember, userId: 'u1', displayName: 'Alice' }],
        onlineCount: 1,
      });
    });

    act(() => {
      result.current.setStatus('busy');
    });

    expect(socket.emit).toHaveBeenCalledWith('presence:set-status', { userId: 'u1', status: 'busy' });
    expect(result.current.members[0].status).toBe('busy');
  });

  it('emits typing and privacy events', () => {
    const { result } = renderHook(() =>
      usePresence({ spaceId: 'space-1', userId: 'u1', displayName: 'Alice' })
    );

    act(() => {
      result.current.setTyping(true);
    });
    expect(socket.emit).toHaveBeenCalledWith('presence:typing', {
      spaceId: 'space-1',
      userId: 'u1',
      isTyping: true,
    });

    act(() => {
      result.current.setHidden(true);
    });
    expect(socket.emit).toHaveBeenCalledWith('presence:set-privacy', {
      spaceId: 'space-1',
      userId: 'u1',
      hidden: true,
    });
  });

  it('leaves the space on unmount', () => {
    const { unmount } = renderHook(() =>
      usePresence({ spaceId: 'space-1', userId: 'u1', displayName: 'Alice' })
    );

    unmount();

    expect(socket.emit).toHaveBeenCalledWith('presence:leave', { spaceId: 'space-1', userId: 'u1' });
    expect(socket.disconnect).toHaveBeenCalled();
  });
});
