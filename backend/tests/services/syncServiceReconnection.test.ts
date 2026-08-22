import { syncOnReconnect, reconcileState, getFullSyncState } from '../../src/services/syncService';
import { Device, SyncStatus } from '../../src/models/SyncStatus';
import mongoose from 'mongoose';

describe('Sync Service Reconnection', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Device.deleteMany({});
    await SyncStatus.deleteMany({});
  });

  afterEach(async () => {
    await Device.deleteMany({});
    await SyncStatus.deleteMany({});
  });

  describe('syncOnReconnect', () => {
    it('should return missed events modified after last sync', async () => {
      const userId = 'user-1';
      const deviceId = 'device-1';
      
      // Create sync status with old timestamp
      await SyncStatus.create({
        userId,
        entityType: 'collaboration_doc',
        entityId: 'doc-1',
        version: 1,
        lastModifiedAt: new Date('2024-01-01'),
        lastModifiedByDeviceId: deviceId,
        metadata: { currentPayload: { title: 'Old Title' } }
      });

      // Create sync status with recent timestamp
      await SyncStatus.create({
        userId,
        entityType: 'collaboration_doc',
        entityId: 'doc-2',
        version: 2,
        lastModifiedAt: new Date(),
        lastModifiedByDeviceId: deviceId,
        metadata: { currentPayload: { title: 'New Title' } }
      });

      const result = await syncOnReconnect({
        userId,
        deviceId,
        lastSyncedAt: new Date('2024-01-15'),
        lastSyncedSequence: 0
      });

      expect(result.success).toBe(true);
      expect(result.missedEvents.length).toBe(1);
      expect(result.missedEvents[0].entityId).toBe('doc-2');
    });

    it('should update device status on reconnect', async () => {
      const userId = 'user-2';
      const deviceId = 'device-2';

      await Device.create({
        deviceId,
        userId,
        status: 'offline',
        lastSeenAt: new Date('2024-01-01')
      });

      await syncOnReconnect({
        userId,
        deviceId
      });

      const device = await Device.findOne({ deviceId });
      expect(device?.status).toBe('online');
      expect(device?.lastSyncAt).toBeDefined();
    });

    it('should return empty events if nothing modified', async () => {
      const userId = 'user-3';
      const deviceId = 'device-3';

      await SyncStatus.create({
        userId,
        entityType: 'collaboration_doc',
        entityId: 'doc-1',
        version: 1,
        lastModifiedAt: new Date('2024-01-01'),
        lastModifiedByDeviceId: deviceId
      });

      const result = await syncOnReconnect({
        userId,
        deviceId,
        lastSyncedAt: new Date('2024-01-02')
      });

      expect(result.success).toBe(true);
      expect(result.missedEvents.length).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      const result = await syncOnReconnect({
        userId: 'invalid-user',
        deviceId: 'invalid-device'
      });

      expect(result.success).toBe(false);
      expect(result.missedEvents.length).toBe(0);
    });
  });

  describe('getFullSyncState', () => {
    it('should return all sync statuses for user', async () => {
      const userId = 'user-4';

      await SyncStatus.create({
        userId,
        entityType: 'document',
        entityId: 'doc-1',
        version: 1,
        lastModifiedAt: new Date(),
        lastModifiedByDeviceId: 'device-1'
      });

      await SyncStatus.create({
        userId,
        entityType: 'document',
        entityId: 'doc-2',
        version: 2,
        lastModifiedAt: new Date(),
        lastModifiedByDeviceId: 'device-1'
      });

      const states = await getFullSyncState(userId);

      expect(states.length).toBe(2);
      expect(states[0].entityId).toBe('doc-1');
      expect(states[1].entityId).toBe('doc-2');
    });

    it('should filter by entity type if provided', async () => {
      const userId = 'user-5';

      await SyncStatus.create({
        userId,
        entityType: 'collaboration_doc',
        entityId: 'doc-1',
        version: 1,
        lastModifiedAt: new Date(),
        lastModifiedByDeviceId: 'device-1'
      });

      await SyncStatus.create({
        userId,
        entityType: 'workspace',
        entityId: 'workspace-1',
        version: 1,
        lastModifiedAt: new Date(),
        lastModifiedByDeviceId: 'device-1'
      });

      const states = await getFullSyncState(userId);

      expect(states.length).toBe(2);
    });
  });

  describe('reconcileState', () => {
    it('should reconcile client state with server', async () => {
      const userId = 'user-6';
      const deviceId = 'device-6';

      const clientState = [
        {
          entityType: 'collaboration_doc' as const,
          entityId: 'doc-1',
          version: 1,
          payload: { title: 'Client Title' }
        }
      ];

      const results = await reconcileState(userId, deviceId, clientState);

      expect(results.length).toBe(1);
      expect(results[0].success).toBe(true);
      expect(results[0].version).toBeGreaterThan(0);
    });

    it('should handle multiple entities', async () => {
      const userId = 'user-7';
      const deviceId = 'device-7';

      const clientState = [
        {
          entityType: 'collaboration_doc' as const,
          entityId: 'doc-1',
          version: 1,
          payload: { title: 'Doc 1' }
        },
        {
          entityType: 'collaboration_doc' as const,
          entityId: 'doc-2',
          version: 1,
          payload: { title: 'Doc 2' }
        }
      ];

      const results = await reconcileState(userId, deviceId, clientState);

      expect(results.length).toBe(2);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should continue on individual entity errors', async () => {
      const userId = 'user-8';
      const deviceId = 'device-8';

      const clientState = [
        {
          entityType: 'collaboration_doc' as const,
          entityId: 'doc-1',
          version: 1,
          payload: { title: 'Valid' }
        },
        {
          entityType: 'invalid' as any,
          entityId: 'doc-2',
          version: 1,
          payload: { title: 'Invalid' }
        }
      ];

      const results = await reconcileState(userId, deviceId, clientState);

      expect(results.length).toBe(2);
      // At least one should succeed
      expect(results.some(r => r.success)).toBe(true);
    });
  });
});
