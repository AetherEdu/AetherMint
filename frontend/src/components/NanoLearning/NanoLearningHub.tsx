/**
 * NanoLearningHub Component
 * Main control panel for nanotechnology learning system
 * Integrates all components and provides overall control interface
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useNeuralInterface } from '../../hooks/useNeuralInterface';
import { useSkillAcquisition } from '../../hooks/useSkillAcquisition';
import { useNanotechMonitoring } from '../../hooks/useNanotechMonitoring';
import type { Skill } from '../../types/nanotech';

interface NanoLearningHubProps {
  userId: string;
  availableSkills?: Skill[];
  onSessionComplete?: (skillId: string, masteryLevel: number) => void;
}

export function NanoLearningHub({
  userId,
  availableSkills = [],
  onSessionComplete
}: NanoLearningHubProps) {
  const neural = useNeuralInterface(userId);
  const skillAcq = useSkillAcquisition(userId);
  const safety = useNanotechMonitoring();

  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [progress, setProgress] = useState(0);

  // Auto-start monitoring when skill is selected
  useEffect(() => {
    if (sessionActive && skillAcq.swarmStatus) {
      safety.startMonitoring(skillAcq.swarmStatus.id);
    }

    return () => {
      if (sessionActive) {
        safety.stopMonitoring();
      }
    };
  }, [sessionActive, skillAcq.swarmStatus, safety]);

  const handleSkillSelect = (skill: Skill) => {
    setSelectedSkill(skill);
  };

  const handleStartSession = async () => {
    if (!selectedSkill) return;

    try {
      setSessionActive(true);
      await skillAcq.initiateTransfer(selectedSkill.id, selectedSkill);

      // Start neural monitoring
      const skillCategory =
        selectedSkill.category === 'technical' ? 'problem-solving' : selectedSkill.category;
      await neural.startMonitoring(skillCategory);
    } catch (error) {
      console.error('Failed to start session:', error);
      setSessionActive(false);
    }
  };

  const handleStopSession = async () => {
    try {
      await skillAcq.stopTransfer();
      await neural.stopMonitoring();
      setSessionActive(false);
      setProgress(0);
    } catch (error) {
      console.error('Failed to stop session:', error);
    }
  };

  const handleEmergencyStop = async () => {
    try {
      await safety.emergencyShutdown();
      await neural.stopMonitoring();
      setSessionActive(false);
      setProgress(0);
    } catch (error) {
      console.error('Emergency shutdown failed:', error);
    }
  };

  const isSafetyCompromised = safety.safetyStatus && safety.safetyStatus.status !== 'safe';

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-cyan-500/20 shadow-2xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
          🧬 Nanotechnology Learning Hub
        </h1>
        <p className="text-cyan-300/80 text-sm">
          Direct knowledge transfer through nano-scale neural interfaces
        </p>
      </div>

      {/* Status Bar */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800/50 border border-cyan-500/30 rounded-lg p-4">
          <div className="text-cyan-400 text-xs font-semibold uppercase mb-2">Session</div>
          <div className={`text-lg font-bold ${sessionActive ? 'text-green-400' : 'text-gray-400'}`}>
            {sessionActive ? '🟢 Active' : '⚬ Inactive'}
          </div>
        </div>

        <div className="bg-slate-800/50 border border-cyan-500/30 rounded-lg p-4">
          <div className="text-cyan-400 text-xs font-semibold uppercase mb-2">Progress</div>
          <div className="text-lg font-bold text-blue-400">{Math.round(progress)}%</div>
        </div>

        <div className="bg-slate-800/50 border border-cyan-500/30 rounded-lg p-4">
          <div className="text-cyan-400 text-xs font-semibold uppercase mb-2">Neural State</div>
          <div className={`text-lg font-bold ${neural.neuralPattern ? 'text-green-400' : 'text-gray-400'}`}>
            {neural.neuralPattern ? '🧠 Active' : '⚬ Idle'}
          </div>
        </div>

        <div className="bg-slate-800/50 border border-cyan-500/30 rounded-lg p-4">
          <div className="text-cyan-400 text-xs font-semibold uppercase mb-2">Safety</div>
          <div
            className={`text-lg font-bold ${
              isSafetyCompromised ? 'text-red-400' : 'text-green-400'
            }`}
          >
            {isSafetyCompromised ? '⚠️ Alert' : '✓ Safe'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Skill Selection Panel */}
        <div className="lg:col-span-1 bg-slate-800/30 border border-cyan-500/20 rounded-xl p-6">
          <h2 className="text-xl font-bold text-cyan-400 mb-4">📚 Available Skills</h2>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {availableSkills.length === 0 ? (
              <div className="text-gray-400 text-sm p-4 text-center">
                No skills available. Create some skills to begin.
              </div>
            ) : (
              availableSkills.map(skill => (
                <button
                  key={skill.id}
                  onClick={() => handleSkillSelect(skill)}
                  disabled={sessionActive}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    selectedSkill?.id === skill.id
                      ? 'bg-cyan-500/30 border border-cyan-400 text-cyan-300'
                      : 'bg-slate-700/50 border border-slate-600 text-gray-300 hover:bg-slate-700 disabled:opacity-50'
                  }`}
                >
                  <div className="font-semibold text-sm">{skill.name}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Difficulty: {'⭐'.repeat(skill.difficulty)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main Control Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Neural Data Display */}
          <div className="bg-slate-800/30 border border-cyan-500/20 rounded-xl p-6">
            <h2 className="text-lg font-bold text-cyan-400 mb-4">🧠 Neural Monitoring</h2>

            {neural.neuralPattern ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-cyan-400/70 uppercase mb-1">Focus Level</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-700 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-cyan-400 h-2 rounded-full transition-all"
                          style={{ width: `${neural.neuralPattern.focusLevel}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-blue-400">
                        {neural.neuralPattern.focusLevel.toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-cyan-400/70 uppercase mb-1">Neuroplasticity</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-700 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-pink-400 h-2 rounded-full transition-all"
                          style={{ width: `${neural.neuralPattern.neuroplasticity}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-purple-400">
                        {neural.neuralPattern.neuroplasticity.toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-cyan-400/70 uppercase mb-1">Learning Velocity</div>
                    <div className="text-sm font-semibold text-green-400">
                      {neural.neuralPattern.learningVelocity.toFixed(1)}x
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-cyan-400/70 uppercase mb-1">Dominant Wave</div>
                    <div className="text-sm font-semibold text-orange-400">
                      {neural.neuralPattern.dominantFrequency}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-400 text-sm p-4 text-center">
                Neural monitoring inactive. Start a session to begin monitoring.
              </div>
            )}
          </div>

          {/* Safety Status */}
          {safety.safetyStatus && (
            <div
              className={`border rounded-xl p-6 ${
                isSafetyCompromised
                  ? 'bg-red-950/30 border-red-500/50'
                  : 'bg-slate-800/30 border-cyan-500/20'
              }`}
            >
              <h2 className="text-lg font-bold text-cyan-400 mb-4">🛡️ Safety Status</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-cyan-400/70 uppercase mb-1">Neurotoxicity</div>
                  <div className="text-sm font-semibold text-orange-400">
                    {safety.safetyStatus.neurotoxicity.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-cyan-400/70 uppercase mb-1">Containment</div>
                  <div className="text-sm font-semibold text-green-400">
                    {safety.safetyStatus.nanobotContainment.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-cyan-400/70 uppercase mb-1">Overall Score</div>
                  <div className="text-sm font-semibold text-cyan-400">
                    {safety.safetyStatus.overallSafetyScore.toFixed(0)}/100
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleStartSession}
              disabled={!selectedSkill || sessionActive}
              className="flex-1 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-all"
            >
              ▶️ Start Session {selectedSkill ? `(${selectedSkill.name})` : ''}
            </button>

            <button
              onClick={handleStopSession}
              disabled={!sessionActive}
              className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-all"
            >
              ⏹️ Stop Session
            </button>

            <button
              onClick={handleEmergencyStop}
              disabled={!sessionActive}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-all"
            >
              🚨 Emergency Stop
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {(neural.error || skillAcq.error || safety.error) && (
        <div className="mt-6 p-4 bg-red-950/50 border border-red-500/50 rounded-lg">
          <div className="text-red-400 text-sm font-semibold">⚠️ Error</div>
          <div className="text-red-300 text-xs mt-1">
            {(neural.error?.message || skillAcq.error?.message || safety.error?.message) ??
              'Unknown error occurred'}
          </div>
        </div>
      )}
    </div>
  );
}
