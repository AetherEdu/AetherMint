/**
 * SkillAcquisitionTracker Component
 * Displays skill transfer progress and performance metrics
 */

'use client';

import React from 'react';
import type { SkillTracking } from '../../types/nanotech';

interface SkillAcquisitionTrackerProps {
  skillName: string;
  tracking: SkillTracking | null;
  isTransferring: boolean;
}

export function SkillAcquisitionTracker({
  skillName,
  tracking,
  isTransferring
}: SkillAcquisitionTrackerProps) {
  if (!tracking) {
    return (
      <div className="bg-slate-800/30 border border-cyan-500/20 rounded-xl p-6">
        <h2 className="text-lg font-bold text-cyan-400 mb-4">📊 Skill Progress</h2>
        <div className="text-gray-400 text-center py-8">No active skill transfer</div>
      </div>
    );
  }

  const testPassRate =
    tracking.testsPassed + tracking.testsFailed > 0
      ? (tracking.testsPassed / (tracking.testsPassed + tracking.testsFailed)) * 100
      : 0;

  return (
    <div className="bg-slate-800/30 border border-cyan-500/20 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-cyan-400">📊 Skill Progress: {skillName}</h2>
        <div
          className={`text-sm font-semibold ${isTransferring ? 'text-green-400' : 'text-orange-400'}`}
        >
          {isTransferring ? '🔄 Transferring' : '⏸️ Paused'}
        </div>
      </div>

      {/* Progress Bars */}
      <div className="space-y-4 mb-6">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-cyan-300">Acquisition Progress</span>
            <span className="text-sm font-semibold text-cyan-400">
              {tracking.acquisitionProgress.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-cyan-500 to-blue-500 h-3 rounded-full transition-all"
              style={{ width: `${tracking.acquisitionProgress}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-purple-300">Mastery Level</span>
            <span className="text-sm font-semibold text-purple-400">
              {tracking.masteryLevel.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all"
              style={{ width: `${tracking.masteryLevel}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-green-300">Test Pass Rate</span>
            <span className="text-sm font-semibold text-green-400">{testPassRate.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full transition-all"
              style={{ width: `${testPassRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="text-xs text-cyan-400/70 uppercase mb-2">Tests Passed</div>
          <div className="text-2xl font-bold text-green-400">{tracking.testsPassed}</div>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="text-xs text-cyan-400/70 uppercase mb-2">Tests Failed</div>
          <div className="text-2xl font-bold text-red-400">{tracking.testsFailed}</div>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="text-xs text-cyan-400/70 uppercase mb-2">Average Score</div>
          <div className="text-2xl font-bold text-blue-400">{tracking.averageScore.toFixed(1)}</div>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="text-xs text-cyan-400/70 uppercase mb-2">Neuroplasticity Gain</div>
          <div className="text-2xl font-bold text-purple-400">+{tracking.neuroplasticityGain.toFixed(1)}</div>
        </div>
      </div>

      {/* Verification Status */}
      <div
        className={`rounded-lg p-4 border ${
          tracking.verified
            ? 'bg-green-950/30 border-green-500/50'
            : 'bg-slate-700/50 border border-slate-600'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-cyan-400/70 uppercase mb-1">Verification Status</div>
            <div className="font-semibold">
              {tracking.verified ? (
                <span className="text-green-400">
                  ✓ Skill Mastered
                  {tracking.certificateId && (
                    <span className="text-xs text-green-300 ml-2">({tracking.certificateId.slice(0, 8)}...)</span>
                  )}
                </span>
              ) : (
                <span className="text-orange-400">⏳ Pending Verification</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
