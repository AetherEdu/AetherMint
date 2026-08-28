/**
 * Type definitions for the offline credential wallet.
 */

import { OfflineCredentialRecord } from '@/utils/offlineDB';

/** Wallet connection status. */
export type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'syncing' | 'error';

/** Sync state for credentials. */
export interface SyncState {
  /** Whether the device is currently online */
  isOnline: boolean;
  /** Whether a sync operation is in progress */
  isSyncing: boolean;
  /** Timestamp of last successful sync */
  lastSyncTime: number | null;
  /** Number of credentials pending sync */
  pendingSyncCount: number;
  /** Any sync error message */
  syncError: string | null;
}

/** Credential wallet state. */
export interface CredentialWalletState {
  /** All credentials in the wallet */
  credentials: OfflineCredentialRecord[];
  /** Current wallet status */
  status: WalletStatus;
  /** Current sync state */
  syncState: SyncState;
  /** Whether the wallet is loading */
  isLoading: boolean;
  /** Any error message */
  error: string | null;
}

/** Actions available on the credential wallet. */
export interface CredentialWalletActions {
  /** Add a credential to the wallet */
  addCredential: (credential: Omit<OfflineCredentialRecord, 'signature' | 'contentHash' | 'storedAt'>) => Promise<OfflineCredentialRecord>;
  /** Remove a credential from the wallet */
  removeCredential: (credentialId: string) => Promise<void>;
  /** Verify a credential's signature locally */
  verifyCredential: (credentialId: string) => Promise<boolean>;
  /** Sync credentials with on-chain state */
  syncWithChain: () => Promise<void>;
  /** Export the wallet for backup */
  exportWallet: () => Promise<Blob>;
  /** Import credentials from a backup */
  importWallet: (file: File) => Promise<{ imported: number; skipped: number; errors: string[] }>;
  /** Refresh the wallet state */
  refresh: () => Promise<void>;
}

/** Complete hook return type. */
export interface UseCredentialWallet extends CredentialWalletState, CredentialWalletActions {}

/** Options for the useCredentialWallet hook. */
export interface UseCredentialWalletOptions {
  /** Whether to auto-sync when coming online */
  autoSyncOnReconnect?: boolean;
  /** Auto-sync interval in milliseconds (0 to disable) */
  syncInterval?: number;
  /** User ID for sync operations */
  userId?: string;
}
