export type PresenceStatus = 'available' | 'busy' | 'away' | 'invisible';

/** A single member as surfaced for a collaboration space. */
export interface PresenceMember {
  userId: string;
  displayName: string;
  role?: string;
  status: PresenceStatus;
  isTyping: boolean;
  lastActiveAt: number;
}

/** Read-only snapshot of everyone present in a single space. */
export interface PresenceSnapshot {
  spaceId: string;
  members: PresenceMember[];
  onlineCount: number;
}

/** Normalized presence event emitted by the server over Socket.IO. */
export interface PresenceEvent {
  type:
    | 'USER_STATUS_CHANGED'
    | 'USER_ONLINE'
    | 'USER_OFFLINE'
    | 'SPACE_JOINED'
    | 'SPACE_LEFT'
    | 'TYPING_STARTED'
    | 'TYPING_STOPPED'
    | 'PRESENCE_HIDDEN'
    | 'PRESENCE_SHOWN';
  userId: string;
  spaceId?: string;
  status?: PresenceStatus;
  isTyping?: boolean;
  hidden?: boolean;
  timestamp: number;
}
