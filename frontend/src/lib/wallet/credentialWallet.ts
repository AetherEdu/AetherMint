/**
 * Core credential wallet logic.
 * Handles offline storage, signature verification, and sync operations.
 */

import {
  saveCredentialOffline,
  getCredentialOffline,
  listOfflineCredentials,
  deleteCredentialOffline,
  markCredentialSynced,
  exportCredentialWallet,
  importCredentialWallet,
  verifyCredentialSignature,
  computeContentHash,
  OfflineCredentialRecord,
  CredentialWalletExport,
} from '@/utils/offlineDB';

const SYNC_API_BASE = '/api/credentials';

/** Check if the device is currently online. */
export const isOnline = (): boolean => {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return navigator.onLine;
  }
  return true;
};

/**
 * Add a credential to the offline wallet.
 */
export const addCredential = async (
  credential: Omit<OfflineCredentialRecord, 'signature' | 'contentHash' | 'storedAt'>
): Promise<OfflineCredentialRecord> => {
  return saveCredentialOffline(credential);
};

/**
 * Remove a credential from the offline wallet.
 */
export const removeCredential = async (credentialId: string): Promise<void> => {
  return deleteCredentialOffline(credentialId);
};

/**
 * Get a single credential from the wallet.
 */
export const getCredential = async (credentialId: string): Promise<OfflineCredentialRecord | null> => {
  return getCredentialOffline(credentialId);
};

/**
 * Get all credentials from the wallet.
 */
export const getAllCredentials = async (): Promise<OfflineCredentialRecord[]> => {
  return listOfflineCredentials();
};

/**
 * Verify a credential's signature locally without server round-trip.
 */
export const verifyCredential = async (credentialId: string): Promise<boolean> => {
  const credential = await getCredentialOffline(credentialId);
  if (!credential) return false;

  // Recompute hash and verify
  const { signature, contentHash, storedAt, ...data } = credential;
  const expectedHash = await computeContentHash(data);
  const isValid = await verifyCredentialSignature(data, signature);

  return expectedHash === contentHash && isValid;
};

/**
 * Sync credentials with on-chain state when online.
 * Returns the number of credentials synced.
 */
export const syncWithChain = async (userId?: string): Promise<{
  synced: number;
  updated: OfflineCredentialRecord[];
  errors: string[];
}> => {
  if (!isOnline()) {
    return { synced: 0, updated: [], errors: ['Device is offline'] };
  }

  const errors: string[] = [];
  const updated: OfflineCredentialRecord[] = [];
  let synced = 0;

  try {
    // Get all local credentials
    const localCredentials = await listOfflineCredentials();
    
    // Fetch on-chain state from server
    const response = await fetch(`${SYNC_API_BASE}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        credentials: localCredentials.map((c) => ({
          credentialId: c.credentialId,
          contentHash: c.contentHash,
          lastSyncedAt: c.lastSyncedAt,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.statusText}`);
    }

    const result = await response.json();

    // Process updates from server
    if (result.updated && Array.isArray(result.updated)) {
      for (const serverCredential of result.updated) {
        const localCredential = localCredentials.find(
          (c) => c.credentialId === serverCredential.credentialId
        );

        if (localCredential) {
          // Update local credential with server data
          const updatedCredential = await saveCredentialOffline({
            ...localCredential,
            ...serverCredential,
            locallyVerified: serverCredential.verificationStatus === 'verified',
          });
          await markCredentialSynced(serverCredential.credentialId);
          updated.push(updatedCredential);
          synced++;
        }
      }
    }

    // Process new credentials from server
    if (result.newCredentials && Array.isArray(result.newCredentials)) {
      for (const newCredential of result.newCredentials) {
        const existing = await getCredentialOffline(newCredential.credentialId);
        if (!existing) {
          await saveCredentialOffline(newCredential);
          await markCredentialSynced(newCredential.credentialId);
          synced++;
        }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(message);
  }

  return { synced, updated, errors };
};

/**
 * Export the credential wallet for backup.
 */
export const exportWallet = async (): Promise<Blob> => {
  const walletData = await exportCredentialWallet();
  const jsonString = JSON.stringify(walletData, null, 2);
  return new Blob([jsonString], { type: 'application/json' });
};

/**
 * Import credentials from a wallet backup file.
 */
export const importWallet = async (file: File): Promise<{
  imported: number;
  skipped: number;
  errors: string[];
}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const walletData: CredentialWalletExport = JSON.parse(content);
        const result = await importCredentialWallet(walletData);
        resolve(result);
      } catch (err) {
        reject(new Error(`Failed to parse wallet file: ${err}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read wallet file'));
    reader.readAsText(file);
  });
};

/**
 * Download a wallet backup file.
 */
export const downloadWalletBackup = async (): Promise<void> => {
  const blob = await exportWallet();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aethermint-credential-wallet-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
