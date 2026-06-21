/**
 * NeuralInterfaceViewer Component
 * Visualizes neural patterns and brain wave activity
 */

'use client';

import React from 'react';
import type { NeuralPattern } from '../../types/nanotech';

interface NeuralInterfaceViewerProps {
  pattern: NeuralPattern | null;
  isMonitoring: boolean;
}

export function NeuralInterfaceViewer({ pattern, isMonitoring }: NeuralInterfaceViewerProps) {
  if (!pattern) {
    return (
      <div className="bg-slate-800/30 border border-cyan-500/20 rounded-xl p-6">
        <h2 className="text-lg font-bold text-cyan-400 mb-4">🧠 Neural Pattern</h2>
        <div className="text-gray-400 text-center py-8">Neural monitoring inactive</div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/30 border border-cyan-500/20 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-cyan-400">🧠 Neural Pattern Analysis</h2>
        <div className={`text-sm font-semibold ${isMonitoring ? 'text-green-400' : 'text-gray-400'}`}>
          {isMonitoring ? '🟢 Monitoring' : '⚬ Inactive'}
        </div>
      </div>

      {/* Brain Waves Visualization */}
      <div className="space-y-4 mb-6">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-cyan-300">Delta (Sleep) - {pattern.brainWaveFrequency.delta.toFixed(1)} Hz</span>
            <span className="text-xs text-gray-500">{pattern.brainWaveFrequency.delta.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full"
              style={{ width: `${Math.min(100, pattern.brainWaveFrequency.delta * 5)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-cyan-300">Theta (Meditation) - {pattern.brainWaveFrequency.theta.toFixed(1)} Hz</span>
            <span className="text-xs text-gray-500">{pattern.brainWaveFrequency.theta.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${Math.min(100, pattern.brainWaveFrequency.theta * 5)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-cyan-300">Alpha (Relaxed) - {pattern.brainWaveFrequency.alpha.toFixed(1)} Hz</span>
            <span className="text-xs text-gray-500">{pattern.brainWaveFrequency.alpha.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-cyan-600 h-2 rounded-full"
              style={{ width: `${Math.min(100, pattern.brainWaveFrequency.alpha * 5)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-cyan-300">Beta (Focused) - {pattern.brainWaveFrequency.beta.toFixed(1)} Hz</span>
            <span className="text-xs text-gray-500">{pattern.brainWaveFrequency.beta.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full"
              style={{ width: `${Math.min(100, pattern.brainWaveFrequency.beta * 2)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-cyan-300">Gamma (Insight) - {pattern.brainWaveFrequency.gamma.toFixed(1)} Hz</span>
            <span className="text-xs text-gray-500">{pattern.brainWaveFrequency.gamma.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-orange-600 h-2 rounded-full"
              style={{ width: `${Math.min(100, pattern.brainWaveFrequency.gamma * 1.5)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Neural Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="text-xs text-cyan-400/70 uppercase mb-2">Learning Readiness</div>
          <div className="text-2xl font-bold text-cyan-400">{pattern.learningReadiness.toFixed(0)}%</div>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="text-xs text-cyan-400/70 uppercase mb-2">Memory Capacity</div>
          <div className="text-2xl font-bold text-blue-400">{pattern.memoryCapacity.toFixed(0)}%</div>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="text-xs text-cyan-400/70 uppercase mb-2">Dominant Frequency</div>
          <div className="text-lg font-bold text-purple-400">{pattern.dominantFrequency}</div>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="text-xs text-cyan-400/70 uppercase mb-2">Pattern Hash</div>
          <div className="text-xs font-mono text-gray-400">{pattern.patternHash.slice(0, 12)}...</div>
        </div>
      </div>
    </div>
  );
}
