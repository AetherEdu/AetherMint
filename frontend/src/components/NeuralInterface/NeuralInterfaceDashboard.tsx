'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Brain, Activity, Shield, Zap, Settings, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
import { EEGSensor } from './EEGSensor';
import { NeurostimulationPanel } from './NeurostimulationPanel';
import { CognitiveMonitor } from './CognitiveMonitor';
import { SafetyMonitor } from './SafetyMonitor';
import { LearningProfile } from './LearningProfile';
import { NeuralDataService } from '@/services/neuralData';
import { SafetyConstraints } from '@/lib/safetyConstraints';
import type {
  NeuralData,
  LearningSession,
  LearningMetrics,
  LearningContent,
} from '@/types/neural';

interface NeuralInterfaceDashboardProps {
  userId: string;
  onLearningComplete?: (data: LearningResult) => void;
}

interface LearningResult {
  efficiency: number;
  comprehension: number;
  retention: number;
  sessionDuration: number;
  cognitiveLoad: number;
}
export const NeuralInterfaceDashboard: React.FC<NeuralInterfaceDashboardProps> = ({
  userId,
  onLearningComplete
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [currentSession, setCurrentSession] = useState<LearningSession | null>(null);
  const [safetyStatus, setSafetyStatus] = useState<'safe' | 'warning' | 'critical'>('safe');
  const [neuralData, setNeuralData] = useState<NeuralData | null>(null);
  const [learningMetrics, setLearningMetrics] = useState<LearningMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const neuralService = new NeuralDataService();
  const safetyConstraints = new SafetyConstraints();

  useEffect(() => {
    initializeNeuralInterface();
    return () => {
      if (isSessionActive) {
        stopLearningSession();
      }
    };
  }, []);

  const initializeNeuralInterface = async () => {
    try {
      await neuralService.initialize();
      setIsConnected(true);
    } catch (err) {
      setError('Failed to initialize neural interface');
      console.error('Neural interface initialization error:', err);
    }
  };

  const startLearningSession = async (courseId: string, content: LearningContent) => {
    try {
      const session = await neuralService.createSession(userId, courseId, content);
      setCurrentSession(session);
      setIsSessionActive(true);
      setError(null);
    } catch (err) {
      setError('Failed to start learning session');
      console.error('Session start error:', err);
    }
  };

  const stopLearningSession = async () => {
    if (!currentSession) return;

    try {
      const result = await neuralService.endSession(currentSession.id);
      setIsSessionActive(false);
      setCurrentSession(null);
      
      if (onLearningComplete) {
        onLearningComplete(result);
      }
    } catch (err) {
      setError('Failed to stop learning session');
      console.error('Session stop error:', err);
    }
  };

  const handleNeuralDataUpdate = useCallback((data: NeuralData) => {
    setNeuralData(data);
    
    // Check safety constraints
    const safetyCheck = safetyConstraints.evaluateSafety(data);
    setSafetyStatus(safetyCheck.status);
    
    if (safetyCheck.status === 'critical') {
      stopLearningSession();
    }
  }, []);

  const handleLearningMetricsUpdate = useCallback((metrics: LearningMetrics) => {
    setLearningMetrics(metrics);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Brain className="h-8 w-8 text-purple-400" />
              <h1 className="text-3xl font-bold">Neural Interface Learning</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${
                safetyStatus === 'safe' ? 'bg-green-500/20 text-green-400' :
                safetyStatus === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {safetyStatus === 'safe' && <CheckCircle className="h-4 w-4" />}
                {safetyStatus === 'warning' && <AlertTriangle className="h-4 w-4" />}
                {safetyStatus === 'critical' && <AlertTriangle className="h-4 w-4" />}
                Safety: {safetyStatus}
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <span className="text-red-300">{error}</span>
              </div>
            </div>
          )}
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* EEG Sensor Panel */}
          <div className="lg:col-span-2">
            <EEGSensor
              isConnected={isConnected}
              onDataUpdate={handleNeuralDataUpdate}
              onSessionStart={startLearningSession}
              onSessionStop={stopLearningSession}
              isSessionActive={isSessionActive}
            />
          </div>

          {/* Safety Monitor */}
          <div>
            <SafetyMonitor
              safetyStatus={safetyStatus}
              neuralData={neuralData}
              constraints={safetyConstraints}
            />
          </div>

          {/* Neurostimulation Panel */}
          <div>
            <NeurostimulationPanel
              isSessionActive={isSessionActive}
              onStimulationChange={(settings) => {
                neuralService.updateStimulationSettings(settings);
              }}
            />
          </div>

          {/* Cognitive Monitor */}
          <div>
            <CognitiveMonitor
              neuralData={neuralData}
              learningMetrics={learningMetrics}
              onMetricsUpdate={handleLearningMetricsUpdate}
            />
          </div>

          {/* Learning Profile */}
          <div>
            <LearningProfile
              userId={userId}
              learningMetrics={learningMetrics}
              sessionData={currentSession}
            />
          </div>
        </div>

        {/* Learning Metrics Overview */}
        {learningMetrics && (
          <div className="mt-8 bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="h-6 w-6 text-purple-400" />
              <h2 className="text-xl font-semibold">Learning Performance</h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-400">
                  {Math.round(learningMetrics.efficiency * 100)}%
                </div>
                <div className="text-sm text-gray-300 mt-1">Efficiency</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400">
                  {Math.round(learningMetrics.comprehension * 100)}%
                </div>
                <div className="text-sm text-gray-300 mt-1">Comprehension</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400">
                  {Math.round(learningMetrics.retention * 100)}%
                </div>
                <div className="text-sm text-gray-300 mt-1">Retention</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-400">
                  {Math.round(learningMetrics.cognitiveLoad * 100)}%
                </div>
                <div className="text-sm text-gray-300 mt-1">Cognitive Load</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
