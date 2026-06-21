/**
 * SafetyMonitor Component
 * Displays safety status, health metrics, and containment information
 */

'use client';

import React from 'react';
import type { SafetyStatus } from '../../types/nanotech';

interface SafetyMonitorProps {
  safetyStatus: SafetyStatus | null;
  swarmHealth: number;
  containmentStatus: number;
  onEmergencyStop?: () => void;
}

export function SafetyMonitor({
  safetyStatus,
  swarmHealth,
  containmentStatus,
  onEmergencyStop
}: SafetyMonitorProps) {
  if (!safetyStatus) {
    return (
      <div className="bg-slate-800/30 border border-cyan-500/20 rounded-xl p-6">
        <h2 className="text-lg font-bold text-cyan-400 mb-4">🛡️ Safety Monitor</h2>
        <div className="text-gray-400 text-center py-8">Safety monitoring inactive</div>
      </div>
    );
  }

  const isCritical = safetyStatus.status === 'critical';
  const isWarning = safetyStatus.status === 'caution';
  const isSafe = safetyStatus.status === 'safe';

  return (
    <div
      className={`border rounded-xl p-6 ${
        isCritical
          ? 'bg-red-950/30 border-red-500/50'
          : isWarning
            ? 'bg-yellow-950/30 border-yellow-500/50'
            : 'bg-slate-800/30 border-cyan-500/20'
      }`}
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-cyan-400">🛡️ Safety Monitor</h2>
        <div
          className={`text-sm font-bold px-3 py-1 rounded-full ${
            isCritical
              ? 'bg-red-500/30 text-red-400'
              : isWarning
                ? 'bg-yellow-500/30 text-yellow-400'
                : 'bg-green-500/30 text-green-400'
          }`}
        >
          {isCritical ? '🚨 CRITICAL' : isWarning ? '⚠️ WARNING' : '✓ SAFE'}
        </div>
      </div>

      {/* Safety Score */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-cyan-300">Overall Safety Score</span>
          <span className={`text-2xl font-bold ${isCritical ? 'text-red-400' : isSafe ? 'text-green-400' : 'text-yellow-400'}`}>
            {safetyStatus.overallSafetyScore.toFixed(0)}/100
          </span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-4">
          <div
            className={`h-4 rounded-full transition-all ${
              isCritical
                ? 'bg-red-600'
                : isSafe
                  ? 'bg-green-600'
                  : 'bg-yellow-600'
            }`}
            style={{ width: `${safetyStatus.overallSafetyScore}%` }}
          />
        </div>
      </div>

      {/* Biomarkers */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="text-xs text-cyan-400/70 uppercase mb-2">Neurotoxicity</div>
          <div className="text-2xl font-bold text-orange-400">{safetyStatus.neurotoxicity.toFixed(1)}%</div>
          <div className="text-xs text-gray-400 mt-1">Target: &lt; 40%</div>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="text-xs text-cyan-400/70 uppercase mb-2">Inflammation</div>
          <div className="text-2xl font-bold text-red-400">{safetyStatus.inflammationLevel.toFixed(1)}%</div>
          <div className="text-xs text-gray-400 mt-1">Target: &lt; 35%</div>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="text-xs text-cyan-400/70 uppercase mb-2">Immune Response</div>
          <div className="text-2xl font-bold text-purple-400">{safetyStatus.immuneResponse.toFixed(1)}%</div>
          <div className="text-xs text-gray-400 mt-1">Optimal: 30-50%</div>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="text-xs text-cyan-400/70 uppercase mb-2">System Integrity</div>
          <div className="text-2xl font-bold text-cyan-400">{safetyStatus.systemIntegrity.toFixed(1)}%</div>
          <div className="text-xs text-gray-400 mt-1">Target: &gt; 95%</div>
        </div>
      </div>

      {/* Containment Status */}
      <div className="mb-6 bg-slate-700/50 rounded-lg p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-cyan-300">Nanobot Containment</span>
          <span className="text-sm font-semibold text-green-400">
            {safetyStatus.nanobotContainment.toFixed(2)}%
          </span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${
              safetyStatus.nanobotContainment > 95
                ? 'bg-green-600'
                : safetyStatus.nanobotContainment > 90
                  ? 'bg-yellow-600'
                  : 'bg-red-600'
            }`}
            style={{ width: `${safetyStatus.nanobotContainment}%` }}
          />
        </div>
        <div className="text-xs text-gray-400 mt-2">
          Escapes Detected: {safetyStatus.escapeDetections}
          {safetyStatus.escapeDetections > 0 && (
            <span className="text-orange-400 ml-2">
              Recovery Rate: {safetyStatus.recoverySuccessRate.toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {/* Error Rate */}
      <div className="mb-6 bg-slate-700/50 rounded-lg p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-cyan-300">System Error Rate</span>
          <span className="text-sm font-semibold text-cyan-400">
            {(safetyStatus.errorRate * 100).toFixed(3)}%
          </span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className="bg-cyan-600 h-2 rounded-full transition-all"
            style={{ width: `${Math.min(100, safetyStatus.errorRate * 100000)}%` }}
          />
        </div>
      </div>

      {/* Recommendations */}
      {safetyStatus.recommendations.length > 0 && (
        <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
          <div className="text-xs text-cyan-400/70 uppercase mb-2 font-semibold">Recommendations</div>
          <ul className="space-y-1">
            {safetyStatus.recommendations.slice(0, 3).map((rec, i) => (
              <li key={i} className="text-sm text-gray-300">
                • {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Emergency Button */}
      {isCritical && onEmergencyStop && (
        <button
          onClick={onEmergencyStop}
          className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-4 rounded-lg transition-all animate-pulse"
        >
          🚨 EMERGENCY SHUTDOWN - CLICK TO CONFIRM
        </button>
      )}
    </div>
  );
}
