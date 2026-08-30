'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getAllCredentials,
  addCredential as addCredentialToWallet,
  removeCredential as removeCredentialFromWallet,
  verifyCredential as verifyCredentialInWallet,
  syncWithChain as syncWalletWithChain,
  exportWallet as exportWalletBlob,
  importWallet as importWalletFromFile,
  isOnline,
} from './credentialWallet';
import {
  UseCredentialWallet,
  UseCredentialWalletOptions,
  SyncState,
} from './types';
import { OfflineCredentialRecord } from '@/utils/offlineDB';

/**
 * React hook for managing the offline credential wallet.
 */
export const useCredentialWallet = (
  options: UseCredentialWalletOptions = {}
): UseCredentialWallet => {
  const {
    autoSyncOnReconnect = true,
    syncInterval = 0,
    userId,
  } = options;

  const [credentials, setCredentials] = useState<OfflineCredentialRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({
    isOnline: isOnline(),
    isSyncing: false,
    lastSyncTime: null,
    pendingSyncCount: 0,
    syncError: null,
  });

  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load credentials on mount
  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const creds = await getAllCredentials();
      setCredentials(creds);
      setSyncState((prev: SyncState) => ({
        ...prev,
        pendingSyncCount: creds.filter((c: OfflineCredentialRecord) => !c.lastSyncedAt).length,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setSyncState((prev: SyncState) => ({ ...prev, isOnline: true, syncError: null }));
      if (autoSyncOnReconnect) {
        syncWithChain();
      }
    };

    const handleOffline = () => {
      setSyncState((prev: SyncState) => ({ ...prev, isOnline: false }));
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [autoSyncOnReconnect]);

  // Sync interval
  useEffect(() => {
    if (syncInterval > 0 && isOnline()) {
      syncIntervalRef.current = setInterval(() => {
        if (isOnline() && !syncState.isSyncing) {
          syncWithChain();
        }
      }, syncInterval);
      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
        }
      };
    }
  }, [syncInterval, syncState.isSyncing]);

  // Add credential
  const addCredential = useCallback(
    async (
      credential: Omit<OfflineCredentialRecord, 'signature' | 'contentHash' | 'storedAt'>
    ): Promise<OfflineCredentialRecord> => {
      try {
        setError(null);
        const record = await addCredentialToWallet(credential);
        await refresh();
        return record;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      }
    },
    [refresh]
  );

  // Remove credential
  const removeCredential = useCallback(
    async (credentialId: string): Promise<void> => {
      try {
        setError(null);
        await removeCredentialFromWallet(credentialId);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      }
    },
    [refresh]
  );

  // Verify credential
  const verifyCredential = useCallback(
    async (credentialId: string): Promise<boolean> => {
      try {
        setError(null);
        return await verifyCredentialInWallet(credentialId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        return false;
      }
    },
    []
  );

  // Sync with chain
  const syncWithChain = useCallback(async (): Promise<void> => {
    if (syncState.isSyncing) return;

    try {
      setSyncState((prev: SyncState) => ({ ...prev, isSyncing: true, syncError: null }));
      const result = await syncWalletWithChain(userId);
      
      if (result.errors.length > 0) {
        setSyncState((prev: SyncState) => ({
          ...prev,
          syncError: result.errors.join(', '),
        }));
      } else {
        setSyncState((prev: SyncState) => ({
          ...prev,
          lastSyncTime: Date.now(),
          pendingSyncCount: Math.max(0, prev.pendingSyncCount - result.synced),
        }));
      }

      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSyncState((prev: SyncState) => ({ ...prev, syncError: message }));
    } finally {
      setSyncState((prev: SyncState) => ({ ...prev, isSyncing: false }));
    }
  }, [userId, syncState.isSyncing, refresh]);

  // Export wallet
  const exportWallet = useCallback(async (): Promise<Blob> => {
    try {
      setError(null);
      return await exportWalletBlob();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    }
  }, []);

  // Import wallet
  const importWallet = useCallback(
    async (file: File): Promise<{ imported: number; skipped: number; errors: string[] }> => {
      try {
        setError(null);
        const result = await importWalletFromFile(file);
        await refresh();
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      }
    },
    [refresh]
  );

  // Determine overall status
  const status = isLoading ? 'connecting' : error ? 'error' : 'connected';

  return {
    credentials,
    status,
    syncState,
    isLoading,
    error,
    addCredential,
    removeCredential,
    verifyCredential,
    syncWithChain,
    exportWallet,
    importWallet,
    refresh,
  };
};
