import redisConfig from '../config/redis';
import logger from '../utils/logger';
import {
  PRESENCE_CHANNEL,
  PRESENCE_NODE_ID,
  PresenceEvent,
  PresenceEventType,
  PresenceListener,
  PresenceMember,
  PresenceSnapshot,
  PresenceStatus,
  presenceEventBus,
} from '../events/presenceEvents';

/** Valid user-controlled statuses, in canonical order. */
export const PRESENCE_STATUSES: PresenceStatus[] = ['available', 'busy', 'away', 'invisible'];

export interface JoinSpaceInput {
  userId: string;
  displayName: string;
  role?: string;
}

export interface PresenceStats {
  onlineUsers: number;
  spaces: number;
  activeMembers: number;
  hiddenSpaces: number;
}

/**
 * PresenceService tracks, per collaboration space, who is online, what their
 * availability status is, and whether they are actively typing. Privacy is
 * honored per space: a member who hides their presence is removed from that
 * space's snapshot and never appears in typing indicators for it.
 *
 * Scaling: mutations update in-memory state, then publish a normalized event
 * to Redis via the shared pub/sub adapter. Remote nodes replay that event into
 * their own state (and the in-process bus) so a cluster stays consistent
 * without a shared store. If Redis is unavailable the service keeps working
 * single-node and simply logs the publish failure.
 */
class PresenceService {
  private statusByUser = new Map<string, PresenceStatus>();
  private onlineUsers = new Set<string>();
  private lastSeenByUser = new Map<string, number>();
  private membersBySpace = new Map<string, Map<string, PresenceMember>>();
  private hiddenSpaces = new Map<string, Set<string>>();
  private initialized = false;

  /** Subscribe to cross-node presence events. Idempotent. */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    try {
      await redisConfig.initialize();
      const subscribed = await redisConfig.subscribe(PRESENCE_CHANNEL, (message: PresenceEvent) => {
        this.applyRemoteEvent(message);
      });

      if (!subscribed) {
        logger.warn('Presence service started without cross-node pub/sub (Redis unavailable)');
      }

      this.initialized = true;
      logger.info('Presence service initialized');
      return true;
    } catch (error) {
      logger.error('Failed to initialize presence service', error as Error);
      // Fail open: single-node presence still works without Redis.
      this.initialized = true;
      return false;
    }
  }

  /** Subscribe to a presence event type (or '*' for all). Returns an unsubscribe fn. */
  on(type: PresenceEventType | '*', listener: PresenceListener): () => void {
    presenceEventBus.onEvent(type, listener);
    return () => presenceEventBus.offEvent(type, listener);
  }

  // ── Status ────────────────────────────────────────────────────────────────

  setStatus(userId: string, status: PresenceStatus): void {
    if (!PRESENCE_STATUSES.includes(status)) {
      logger.warn('Ignoring unknown presence status', { userId, status });
      return;
    }

    const previous = this.statusByUser.get(userId) ?? 'available';
    if (previous === status) {
      return;
    }

    this.statusByUser.set(userId, status);
    this.touch(userId);

    // "Invisible" is equivalent to hiding from every space for privacy
    // purposes; handled lazily by getPresence(), so no per-space fan-out here.
    this.dispatch({
      type: 'USER_STATUS_CHANGED',
      userId,
      status,
      timestamp: Date.now(),
    });
  }

  getUserStatus(userId: string): PresenceStatus {
    return this.statusByUser.get(userId) ?? 'available';
  }

  // ── Online / offline ──────────────────────────────────────────────────────

  setOnline(userId: string): void {
    if (this.onlineUsers.has(userId)) {
      this.touch(userId);
      return;
    }

    this.onlineUsers.add(userId);
    this.touch(userId);
    this.dispatch({ type: 'USER_ONLINE', userId, timestamp: Date.now() });
  }

  setOffline(userId: string): void {
    if (!this.onlineUsers.delete(userId)) {
      return;
    }

    // A member who goes offline is removed from every space snapshot.
    let leftSpaces = 0;
    for (const [spaceId, members] of this.membersBySpace) {
      if (members.delete(userId)) {
        leftSpaces += 1;
        this.dispatch({ type: 'SPACE_LEFT', userId, spaceId, timestamp: Date.now() });
      }
    }

    this.dispatch({ type: 'USER_OFFLINE', userId, timestamp: Date.now() });
    if (leftSpaces > 0) {
      logger.debug('User removed from spaces on going offline', { userId, leftSpaces });
    }
  }

  isOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  /** Refresh a user's last-active timestamp (optionally within a space). */
  heartbeat(userId: string, spaceId?: string): void {
    this.touch(userId);
    if (spaceId) {
      const member = this.membersBySpace.get(spaceId)?.get(userId);
      if (member) {
        member.lastActiveAt = Date.now();
      }
    }
  }

  // ── Space membership ──────────────────────────────────────────────────────

  joinSpace(spaceId: string, input: JoinSpaceInput): void {
    if (!input.userId) {
      logger.warn('Ignoring joinSpace without a userId', { spaceId });
      return;
    }

    this.setOnline(input.userId);

    let members = this.membersBySpace.get(spaceId);
    if (!members) {
      members = new Map<string, PresenceMember>();
      this.membersBySpace.set(spaceId, members);
    }

    const existing = members.get(input.userId);
    const member: PresenceMember = {
      userId: input.userId,
      displayName: input.displayName || input.userId,
      role: input.role,
      status: this.getUserStatus(input.userId),
      isTyping: existing?.isTyping ?? false,
      lastActiveAt: Date.now(),
    };

    const isRejoin = Boolean(existing);
    members.set(input.userId, member);

    if (!isRejoin) {
      this.dispatch({
        type: 'SPACE_JOINED',
        userId: input.userId,
        spaceId,
        timestamp: Date.now(),
      });
    }
  }

  leaveSpace(spaceId: string, userId: string): void {
    const members = this.membersBySpace.get(spaceId);
    if (!members || !members.delete(userId)) {
      return;
    }

    this.dispatch({ type: 'SPACE_LEFT', userId, spaceId, timestamp: Date.now() });

    if (members.size === 0) {
      this.membersBySpace.delete(spaceId);
    }
  }

  // ── Typing / activity ─────────────────────────────────────────────────────

  setTyping(spaceId: string, userId: string, isTyping: boolean): void {
    const member = this.membersBySpace.get(spaceId)?.get(userId);
    if (!member) {
      return;
    }

    if (member.isTyping === isTyping) {
      return;
    }

    member.isTyping = isTyping;
    member.lastActiveAt = Date.now();
    this.dispatch({
      type: isTyping ? 'TYPING_STARTED' : 'TYPING_STOPPED',
      userId,
      spaceId,
      isTyping,
      timestamp: Date.now(),
    });
  }

  // ── Privacy ───────────────────────────────────────────────────────────────

  /** Hide (or reveal) the caller's presence within a single space. */
  setHidden(spaceId: string, userId: string, hidden: boolean): void {
    let spaces = this.hiddenSpaces.get(userId);
    if (hidden) {
      if (!spaces) {
        spaces = new Set<string>();
        this.hiddenSpaces.set(userId, spaces);
      }
      if (spaces.has(spaceId)) {
        return;
      }
      spaces.add(spaceId);
    } else {
      if (!spaces || !spaces.delete(spaceId)) {
        return;
      }
      if (spaces.size === 0) {
        this.hiddenSpaces.delete(userId);
      }
    }

    this.dispatch({
      type: hidden ? 'PRESENCE_HIDDEN' : 'PRESENCE_SHOWN',
      userId,
      spaceId,
      hidden,
      timestamp: Date.now(),
    });
  }

  isHidden(spaceId: string, userId: string): boolean {
    return this.hiddenSpaces.get(userId)?.has(spaceId) ?? false;
  }

  /** The spaces the user has chosen to hide from (copy, safe to mutate). */
  getHiddenSpaces(userId: string): string[] {
    return Array.from(this.hiddenSpaces.get(userId) ?? []);
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /**
   * Build a snapshot of a space, honoring per-space privacy and the global
   * "invisible" status. Offline members are dropped as they are surfaced.
   */
  getPresence(spaceId: string): PresenceSnapshot {
    const members = this.membersBySpace.get(spaceId);
    const visible: PresenceMember[] = [];

    if (members) {
      for (const [userId, member] of members) {
        if (!this.onlineUsers.has(userId)) {
          continue;
        }
        if (this.isHidden(spaceId, userId)) {
          continue;
        }
        if (this.getUserStatus(userId) === 'invisible') {
          continue;
        }
        visible.push({ ...member, status: this.getUserStatus(userId) });
      }
    }

    return {
      spaceId,
      members: visible,
      onlineCount: visible.length,
    };
  }

  /** Full presence for one user across the cluster view. */
  getUserPresence(userId: string) {
    const spaces: string[] = [];
    for (const [spaceId, members] of this.membersBySpace) {
      if (members.has(userId) && !this.isHidden(spaceId, userId)) {
        spaces.push(spaceId);
      }
    }

    return {
      userId,
      online: this.isOnline(userId),
      status: this.getUserStatus(userId),
      lastSeenAt: this.lastSeenByUser.get(userId) ?? null,
      spaces,
      hiddenSpaces: this.getHiddenSpaces(userId),
    };
  }

  getOnlineUserIds(): string[] {
    return Array.from(this.onlineUsers);
  }

  getStats(): PresenceStats {
    let activeMembers = 0;
    for (const members of this.membersBySpace.values()) {
      activeMembers += members.size;
    }

    let hiddenSpaces = 0;
    for (const spaces of this.hiddenSpaces.values()) {
      hiddenSpaces += spaces.size;
    }

    return {
      onlineUsers: this.onlineUsers.size,
      spaces: this.membersBySpace.size,
      activeMembers,
      hiddenSpaces,
    };
  }

  /** Release Redis subscription. In-memory state is cleared implicitly. */
  async destroy(): Promise<void> {
    this.onlineUsers.clear();
    this.statusByUser.clear();
    this.lastSeenByUser.clear();
    this.membersBySpace.clear();
    this.hiddenSpaces.clear();
    this.initialized = false;
    presenceEventBus.removeAllListeners();
    logger.info('Presence service destroyed');
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private touch(userId: string): void {
    this.lastSeenByUser.set(userId, Date.now());
  }

  private dispatch(event: PresenceEvent): void {
    event.origin = PRESENCE_NODE_ID;
    presenceEventBus.dispatch(event);
    // Fire-and-forget cross-node publish. Failures degrade to single-node
    // behavior rather than breaking the caller.
    void redisConfig.publish(PRESENCE_CHANNEL, event).catch(() => undefined);
  }

  /**
   * Replay a remote node's event into local state and the bus. This is what
   * keeps every node consistent without a shared presence store.
   */
  private applyRemoteEvent(event: PresenceEvent): void {
    // Ignore the echo of our own publishes: the local mutation has already
    // updated state and dispatched to in-process consumers.
    if (event.origin === PRESENCE_NODE_ID) {
      return;
    }

    switch (event.type) {
      case 'USER_STATUS_CHANGED':
        if (event.status) {
          this.statusByUser.set(event.userId, event.status);
        }
        break;
      case 'USER_ONLINE':
        this.onlineUsers.add(event.userId);
        this.touch(event.userId);
        break;
      case 'USER_OFFLINE':
        this.onlineUsers.delete(event.userId);
        break;
      case 'SPACE_JOINED':
        if (event.spaceId) {
          let members = this.membersBySpace.get(event.spaceId);
          if (!members) {
            members = new Map<string, PresenceMember>();
            this.membersBySpace.set(event.spaceId, members);
          }
          if (!members.has(event.userId)) {
            members.set(event.userId, {
              userId: event.userId,
              displayName: event.userId,
              status: this.getUserStatus(event.userId),
              isTyping: false,
              lastActiveAt: event.timestamp,
            });
          }
        }
        break;
      case 'SPACE_LEFT':
        if (event.spaceId) {
          this.membersBySpace.get(event.spaceId)?.delete(event.userId);
        }
        break;
      case 'TYPING_STARTED':
      case 'TYPING_STOPPED':
        if (event.spaceId) {
          const member = this.membersBySpace.get(event.spaceId)?.get(event.userId);
          if (member) {
            member.isTyping = event.type === 'TYPING_STARTED';
            member.lastActiveAt = event.timestamp;
          }
        }
        break;
      case 'PRESENCE_HIDDEN':
        if (event.spaceId) {
          let spaces = this.hiddenSpaces.get(event.userId);
          if (!spaces) {
            spaces = new Set<string>();
            this.hiddenSpaces.set(event.userId, spaces);
          }
          spaces.add(event.spaceId);
        }
        break;
      case 'PRESENCE_SHOWN':
        if (event.spaceId) {
          this.hiddenSpaces.get(event.userId)?.delete(event.spaceId);
        }
        break;
      default:
        logger.debug('Unknown presence event ignored', { type: event.type });
        return;
    }

    // Forward to in-process consumers (e.g. Socket.IO) on this node.
    presenceEventBus.dispatch(event);
  }
}

export const presenceService = new PresenceService();

export default presenceService;
