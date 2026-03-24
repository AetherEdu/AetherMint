/**
 * Conflict resolution for sync
 * Handles divergent changes from multiple devices using configurable strategies.
 */

import logger from '../utils/logger';

export type ConflictStrategy = 'last-write-wins' | 'first-write-wins' | 'server-wins' | 'client-wins' | 'merge';

export interface ConflictInput {
  entityType: string;
  entityId: string;
  serverVersion: number;
  serverUpdatedAt: Date;
  serverPayload: Record<string, unknown>;
  clientVersion: number;
  clientUpdatedAt: Date;
  clientPayload: Record<string, unknown>;
  deviceId: string;
}

export interface ConflictResult {
  resolved: boolean;
  payload: Record<string, unknown>;
  strategy: ConflictStrategy;
  conflictDetected: boolean;
  winningSource: 'server' | 'client' | 'merged';
  message?: string;
}

/**
 * Detect if there is a real conflict (same entity, different versions, both modified).
 */
export function hasConflict(input: ConflictInput): boolean {
  if (input.serverVersion === input.clientVersion) {
    return false;
  }

  return input.clientVersion !== input.serverVersion;
}

/**
 * Resolve conflict using the given strategy.
 * GIVEN conflict, WHEN detected, THEN resolution algorithm handles it.
 */
export function resolveConflict(input: ConflictInput, strategy: ConflictStrategy): ConflictResult {
  const conflictDetected = hasConflict(input);

  if (!conflictDetected) {
    return {
      resolved: true,
      payload: input.clientPayload,
      strategy,
      conflictDetected: false,
      winningSource: 'client',
      message: 'No conflict; accepting client state'
    };
  }

  switch (strategy) {
    case 'last-write-wins': {
      const serverTime = new Date(input.serverUpdatedAt).getTime();
      const clientTime = new Date(input.clientUpdatedAt).getTime();
      const useClient = clientTime >= serverTime;

      return {
        resolved: true,
        payload: useClient ? input.clientPayload : input.serverPayload,
        strategy: 'last-write-wins',
        conflictDetected: true,
        winningSource: useClient ? 'client' : 'server',
        message: useClient ? 'Client has newer timestamp' : 'Server has newer timestamp'
      };
    }

    case 'first-write-wins': {
      const serverTime = new Date(input.serverUpdatedAt).getTime();
      const clientTime = new Date(input.clientUpdatedAt).getTime();
      const useServer = serverTime <= clientTime;

      return {
        resolved: true,
        payload: useServer ? input.serverPayload : input.clientPayload,
        strategy: 'first-write-wins',
        conflictDetected: true,
        winningSource: useServer ? 'server' : 'client',
        message: useServer ? 'Server change landed first' : 'Client change landed first'
      };
    }

    case 'server-wins':
      return {
        resolved: true,
        payload: input.serverPayload,
        strategy: 'server-wins',
        conflictDetected: true,
        winningSource: 'server',
        message: 'Server state retained'
      };

    case 'client-wins':
      return {
        resolved: true,
        payload: input.clientPayload,
        strategy: 'client-wins',
        conflictDetected: true,
        winningSource: 'client',
        message: 'Client state accepted'
      };

    case 'merge':
      return {
        resolved: true,
        payload: mergePayloads(input.serverPayload, input.clientPayload),
        strategy: 'merge',
        conflictDetected: true,
        winningSource: 'merged',
        message: 'Merged server and client changes'
      };

    default:
      logger.warn(`Unknown conflict strategy: ${strategy}, defaulting to last-write-wins`);
      return resolveConflict(input, 'last-write-wins');
  }
}

/**
 * Shallow merge with one-level recursive support for plain objects.
 */
function mergePayloads(
  server: Record<string, unknown>,
  client: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...server };

  for (const key of Object.keys(client)) {
    const serverValue = server[key];
    const clientValue = client[key];

    if (serverValue === undefined) {
      result[key] = clientValue;
      continue;
    }

    if (
      serverValue &&
      typeof serverValue === 'object' &&
      !Array.isArray(serverValue) &&
      clientValue &&
      typeof clientValue === 'object' &&
      !Array.isArray(clientValue)
    ) {
      result[key] = mergePayloads(
        serverValue as Record<string, unknown>,
        clientValue as Record<string, unknown>
      );
      continue;
    }

    result[key] = clientValue;
  }

  return result;
}

/**
 * Get default strategy per entity type.
 */
export function getDefaultStrategy(entityType: string): ConflictStrategy {
  const strategyMap: Record<string, ConflictStrategy> = {
    progress: 'last-write-wins',
    preferences: 'merge',
    course_state: 'last-write-wins',
    notes: 'merge',
    generic: 'last-write-wins',
    collaboration_doc: 'merge',
    whiteboard: 'merge',
    classroom: 'last-write-wins',
    workspace: 'merge'
  };

  return strategyMap[entityType] ?? 'last-write-wins';
}
