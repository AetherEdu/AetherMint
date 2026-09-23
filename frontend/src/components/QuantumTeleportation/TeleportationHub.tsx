/**
 * TeleportationHub Component
 * Main control panel for quantum teleportation system
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useQuantumEntanglement } from '@/hooks/useQuantumEntanglement';
import { useStateTeleportation } from '@/hooks/useStateTeleportation';
import { useQuantumNetworking } from '@/hooks/useQuantumNetworking';
import { quantumTeleportation } from '@/services/quantumTeleportation';

export interface TeleportationHubProps {
  userId: string;
  locationId: string;
  courseId: string;
  moduleId: string;
}

export function TeleportationHub({
  userId,
  locationId,
  courseId,
  moduleId
}: TeleportationHubProps) {
  const { connections, isConnecting, createEntanglement, getConnectionQuality } =
    useQuantumEntanglement();
  const { isTransferring, lastTransferStatus, teleportState, getStats } =
    useStateTeleportation();
  const { topology, getPeerList, getNetworkHealth } = useQuantumNetworking();

  const [stats, setStats] = useState(quantumTeleportation.getStats());
  const [initialized, setInitialized] = useState(false);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      await quantumTeleportation.initialize(userId, locationId, courseId, moduleId);

      setInitialized(true);
    };

    init();

    // Update stats periodically
    const interval = setInterval(() => {
      setStats(quantumTeleportation.getStats());
    }, 1000);

    return () => {
      clearInterval(interval);
      quantumTeleportation.shutdown();
    };
  }, [userId, locationId, courseId, moduleId]);

  const handleCreateEntanglement = async (targetLocationId: string) => {
    try {
      await createEntanglement(locationId, targetLocationId);
    } catch (err) {
      console.error('Failed to create entanglement:', err);
    }
  };

  const handleTeleportState = async () => {
    try {
      const currentState = quantumTeleportation.getCurrentState() as any;
      const peers = getPeerList();

      if (peers.length === 0) {
        console.warn('No peer locations available');
        return;
      }

      await teleportState(currentState, peers[0].id);
    } catch (err) {
      console.error('Failed to teleport state:', err);
    }
  };

  if (!initialized) {
    return (
      <div className="p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-xl text-white">
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-3 h-3 bg-cyan-400 rounded-full animate-ping"></div>
          <span>Initializing Quantum Teleportation System...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-black rounded-xl border border-cyan-500">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
          <span className="text-3xl">⚛️</span>
          Quantum Teleportation Hub
        </h2>
        <p className="text-gray-400 text-sm">
          {locationId.slice(0, 8)} → Telepathic State Synchronization Network
        </p>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-900 to-green-800 p-4 rounded-lg border border-green-500">
          <div className="text-xs text-green-400 mb-1">System Status</div>
          <div className="text-xl font-bold text-green-300">
            {initialized ? '✓ Online' : '✗ Offline'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-900 to-blue-800 p-4 rounded-lg border border-blue-500">
          <div className="text-xs text-blue-400 mb-1">Connected Peers</div>
          <div className="text-xl font-bold text-blue-300">{topology.totalPeers}</div>
        </div>

        <div className="bg-gradient-to-br from-purple-900 to-purple-800 p-4 rounded-lg border border-purple-500">
          <div className="text-xs text-purple-400 mb-1">Network Health</div>
          <div className="text-xl font-bold text-purple-300">{getNetworkHealth()}%</div>
        </div>

        <div className="bg-gradient-to-br from-yellow-900 to-yellow-800 p-4 rounded-lg border border-yellow-500">
          <div className="text-xs text-yellow-400 mb-1">Entanglements</div>
          <div className="text-xl font-bold text-yellow-300">{connections.length}</div>
        </div>
      </div>

      {/* Statistics */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-3">
        <h3 className="text-cyan-400 font-semibold text-sm">Teleportation Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div>
            <span className="text-gray-500">Total Transfers:</span>
            <br />
            <span className="text-white font-mono">{stats.totalStateTransfers}</span>
          </div>
          <div>
            <span className="text-gray-500">Success Rate:</span>
            <br />
            <span className="text-green-400 font-mono">
              {stats.totalStateTransfers > 0
                ? (
                  (stats.successfulTransfers / stats.totalStateTransfers) *
                  100
                ).toFixed(1)
                : 0}
              %
            </span>
          </div>
          <div>
            <span className="text-gray-500">Error Rate:</span>
            <br />
            <span className={`${stats.errorRate < 0.0001 ? 'text-green-400' : 'text-red-400'} font-mono`}>
              {stats.errorRate.toFixed(4)}%
            </span>
          </div>
          <div>
            <span className="text-gray-500">Avg Transfer Time:</span>
            <br />
            <span className="text-blue-400 font-mono">{stats.averageTransferTime.toFixed(0)}ms</span>
          </div>
          <div>
            <span className="text-gray-500">Last Transfer:</span>
            <br />
            <span className="text-blue-400 font-mono">
              {stats.lastTransferTime > 0 ? `${stats.lastTransferTime.toFixed(0)}ms` : 'none'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Last Error:</span>
            <br />
            <span className="text-gray-400 font-mono text-xs truncate">{stats.lastError || 'none'}</span>
          </div>
        </div>
      </div>

      {/* Active Entanglements */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-3">
        <h3 className="text-cyan-400 font-semibold text-sm">Active Entanglements</h3>
        {connections.length === 0 ? (
          <p className="text-gray-500 text-sm">No active entanglements</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {connections.map(conn => (
              <div key={conn.id} className="bg-black rounded border border-gray-700 p-3 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-cyan-400">
                    {conn.sourceLocationId.slice(0, 4)} ↔ {conn.targetLocationId.slice(0, 4)}
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-mono ${
                      conn.status === 'entangled'
                        ? 'bg-green-900 text-green-400'
                        : conn.status === 'error'
                        ? 'bg-red-900 text-red-400'
                        : 'bg-yellow-900 text-yellow-400'
                    }`}
                  >
                    {conn.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-gray-400">
                  <div>Strength: {(conn.entanglementStrength * 100).toFixed(0)}%</div>
                  <div>↑ {conn.messagesSent}</div>
                  <div>↓ {conn.messagesReceived}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Peer Locations */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-3">
        <h3 className="text-cyan-400 font-semibold text-sm">Available Peers</h3>
        {getPeerList().length === 0 ? (
          <p className="text-gray-500 text-sm">No peer locations available</p>
        ) : (
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {getPeerList().map(peer => (
              <div key={peer.id} className="flex items-center justify-between bg-black rounded border border-gray-700 p-3">
                <div className="text-sm">
                  <span className="text-white font-mono">{peer.name}</span>
                  <br />
                  <span className="text-gray-500 text-xs">{peer.activeUsers.length} users</span>
                </div>
                <button
                  onClick={() => handleCreateEntanglement(peer.id)}
                  disabled={isConnecting}
                  className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white rounded text-xs font-semibold transition"
                >
                  {isConnecting ? 'Connecting...' : 'Entangle'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* State Teleportation */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-3">
        <h3 className="text-cyan-400 font-semibold text-sm">State Teleportation</h3>
        <button
          onClick={handleTeleportState}
          disabled={isTransferring || topology.totalPeers === 0}
          className="w-full px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white rounded font-semibold transition"
        >
          {isTransferring ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse"></span>
              Teleporting State...
            </span>
          ) : (
            'Teleport Current State'
          )}
        </button>

        {lastTransferStatus && (
          <div
            className={`p-2 rounded text-sm font-mono text-center ${
              lastTransferStatus === 'success'
                ? 'bg-green-900 text-green-400'
                : lastTransferStatus === 'failed'
                ? 'bg-red-900 text-red-400'
                : 'bg-yellow-900 text-yellow-400'
            }`}
          >
            Last Transfer: {lastTransferStatus.toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}
