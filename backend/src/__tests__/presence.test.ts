import presenceService from '../services/presence';
import { PresenceEvent } from '../events/presenceEvents';

describe('PresenceService', () => {
  beforeEach(() => {
    presenceService.destroy();
  });

  afterAll(() => {
    presenceService.destroy();
  });

  describe('status', () => {
    it('defaults to available and accepts a valid status change', () => {
      expect(presenceService.getUserStatus('u1')).toBe('available');

      presenceService.setStatus('u1', 'busy');
      expect(presenceService.getUserStatus('u1')).toBe('busy');
    });

    it('ignores unknown statuses', () => {
      presenceService.setStatus('u1', 'napping' as any);
      expect(presenceService.getUserStatus('u1')).toBe('available');
    });

    it('does not emit when the status is unchanged', () => {
      const events: PresenceEvent[] = [];
      presenceService.on('*', (e) => events.push(e));

      presenceService.setStatus('u1', 'available');
      expect(events).toHaveLength(0);
    });
  });

  describe('online / offline', () => {
    it('tracks online state and last-seen timestamps', () => {
      presenceService.setOnline('u1');
      expect(presenceService.isOnline('u1')).toBe(true);
      expect(presenceService.getOnlineUserIds()).toContain('u1');
      expect(presenceService.getUserPresence('u1').online).toBe(true);
    });

    it('removes a user from every space when they go offline', () => {
      presenceService.joinSpace('space-1', { userId: 'u1', displayName: 'Alice' });
      presenceService.joinSpace('space-2', { userId: 'u1', displayName: 'Alice' });

      presenceService.setOffline('u1');

      expect(presenceService.isOnline('u1')).toBe(false);
      expect(presenceService.getPresence('space-1').members).toHaveLength(0);
      expect(presenceService.getPresence('space-2').members).toHaveLength(0);
    });
  });

  describe('space membership', () => {
    it('adds a member and returns them in the snapshot', () => {
      presenceService.joinSpace('space-1', { userId: 'u1', displayName: 'Alice', role: 'instructor' });

      const snapshot = presenceService.getPresence('space-1');
      expect(snapshot.spaceId).toBe('space-1');
      expect(snapshot.onlineCount).toBe(1);
      expect(snapshot.members[0]).toMatchObject({
        userId: 'u1',
        displayName: 'Alice',
        role: 'instructor',
        status: 'available',
      });
    });

    it('removes a member when they leave the space', () => {
      presenceService.joinSpace('space-1', { userId: 'u1', displayName: 'Alice' });
      presenceService.leaveSpace('space-1', 'u1');

      expect(presenceService.getPresence('space-1').members).toHaveLength(0);
    });

    it('preserves typing state across re-joins', () => {
      presenceService.joinSpace('space-1', { userId: 'u1', displayName: 'Alice' });
      presenceService.setTyping('space-1', 'u1', true);
      presenceService.joinSpace('space-1', { userId: 'u1', displayName: 'Alice' });

      expect(presenceService.getPresence('space-1').members[0].isTyping).toBe(true);
    });
  });

  describe('typing indicators', () => {
    it('reflects typing state in the snapshot', () => {
      presenceService.joinSpace('space-1', { userId: 'u1', displayName: 'Alice' });
      presenceService.setTyping('space-1', 'u1', true);

      const member = presenceService.getPresence('space-1').members[0];
      expect(member.isTyping).toBe(true);
    });

    it('ignores typing updates for members not in the space', () => {
      presenceService.setTyping('space-1', 'ghost', true);
      expect(presenceService.getPresence('space-1').members).toHaveLength(0);
    });
  });

  describe('privacy', () => {
    it('hides a member from a space snapshot', () => {
      presenceService.joinSpace('space-1', { userId: 'u1', displayName: 'Alice' });
      presenceService.joinSpace('space-1', { userId: 'u2', displayName: 'Bob' });

      presenceService.setHidden('space-1', 'u1', true);

      const snapshot = presenceService.getPresence('space-1');
      expect(snapshot.members.map((m) => m.userId)).toEqual(['u2']);
      expect(presenceService.isHidden('space-1', 'u1')).toBe(true);
      expect(presenceService.getHiddenSpaces('u1')).toEqual(['space-1']);
    });

    it('reveals a member when privacy is disabled', () => {
      presenceService.joinSpace('space-1', { userId: 'u1', displayName: 'Alice' });
      presenceService.setHidden('space-1', 'u1', true);
      presenceService.setHidden('space-1', 'u1', false);

      expect(presenceService.getPresence('space-1').members.map((m) => m.userId)).toEqual(['u1']);
    });

    it('treats the invisible status as hidden across all spaces', () => {
      presenceService.joinSpace('space-1', { userId: 'u1', displayName: 'Alice' });
      presenceService.setStatus('u1', 'invisible');

      expect(presenceService.getPresence('space-1').members).toHaveLength(0);
    });
  });

  describe('events', () => {
    it('emits a USER_STATUS_CHANGED event on the shared bus', () => {
      const events: PresenceEvent[] = [];
      const unsubscribe = presenceService.on('USER_STATUS_CHANGED', (e) => events.push(e));

      presenceService.setStatus('u1', 'busy');

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ type: 'USER_STATUS_CHANGED', userId: 'u1', status: 'busy' });
      unsubscribe();
    });

    it('emits SPACE_JOINED and SPACE_LEFT events', () => {
      const events: PresenceEvent[] = [];
      presenceService.on('*', (e) => events.push(e));

      presenceService.joinSpace('space-1', { userId: 'u1', displayName: 'Alice' });
      presenceService.leaveSpace('space-1', 'u1');

      const types = events.map((e) => e.type);
      expect(types).toContain('SPACE_JOINED');
      expect(types).toContain('SPACE_LEFT');
    });
  });

  describe('stats', () => {
    it('reports online users, spaces, and active members', () => {
      presenceService.joinSpace('space-1', { userId: 'u1', displayName: 'Alice' });
      presenceService.joinSpace('space-1', { userId: 'u2', displayName: 'Bob' });

      expect(presenceService.getStats()).toEqual({
        onlineUsers: 2,
        spaces: 1,
        activeMembers: 2,
        hiddenSpaces: 0,
      });
    });
  });
});
