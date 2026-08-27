import { EventEmitter } from 'events';

/**
 * Presence & availability system — shared event contracts.
 *
 * The presence service (services/presence.ts) mutates in-memory state and
 * publishes these events over Redis pub/sub so that every node in a scaled
 * deployment converges on the same view. Locally, the same events are
 * dispatched through {@link presenceEventBus} so that in-process consumers
 * (notably the Socket.IO layer) can forward them to connected clients without
 * waiting on a Redis round-trip.
 */

/** Redis channel used to fan presence events out across nodes. */
export const PRESENCE_CHANNEL = 'presence:events';

/**
 * Stable identifier for this process. Because the Redis publisher and
 * subscriber are separate connections, a node's own publishes echo back to
 * its subscriber; the origin marker lets the service skip that self-echo.
 */
export const PRESENCE_NODE_ID = `${process.pid}-${Math.random().toString(36).slice(2, 10)}`;

/** User-controlled availability status. */
export type PresenceStatus = 'available' | 'busy' | 'away' | 'invisible';

/** Every event the presence system emits, locally and across the cluster. */
export type PresenceEventType =
  | 'USER_STATUS_CHANGED'
  | 'USER_ONLINE'
  | 'USER_OFFLINE'
  | 'SPACE_JOINED'
  | 'SPACE_LEFT'
  | 'TYPING_STARTED'
  | 'TYPING_STOPPED'
  | 'PRESENCE_HIDDEN'
  | 'PRESENCE_SHOWN';

/** Normalized, serializable payload published over Redis and to the bus. */
export interface PresenceEvent {
  type: PresenceEventType;
  userId: string;
  spaceId?: string;
  status?: PresenceStatus;
  isTyping?: boolean;
  hidden?: boolean;
  timestamp: number;
  /** Process that published the event; used to ignore self-echoed events. */
  origin?: string;
}

/** A member as surfaced to clients for a given collaboration space. */
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

export type PresenceListener = (event: PresenceEvent) => void;

/**
 * In-process event bus for presence. Consumers subscribe with
 * {@link PresenceEventBus.onEvent} and may pass `'*'` to receive every event.
 */
class PresenceEventBus extends EventEmitter {
  /** Dispatch an event to typed listeners and the wildcard channel. */
  dispatch(event: PresenceEvent): void {
    this.emit(event.type, event);
    this.emit('*', event);
  }

  onEvent(type: PresenceEventType | '*', listener: PresenceListener): this {
    return this.on(type, listener);
  }

  offEvent(type: PresenceEventType | '*', listener: PresenceListener): this {
    return this.off(type, listener);
  }
}

export const presenceEventBus = new PresenceEventBus();
