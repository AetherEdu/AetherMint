'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Wifi, WifiOff, Play, Pause, RotateCcw, Zap, Brain } from 'lucide-react';

interface EEGSensorProps {
  isConnected: boolean;
  onDataUpdate: (data: NeuralData) => void;
  onSessionStart: (courseId: string, content: LearningContent) => void;
  onSessionStop: () => void;
  isSessionActive: boolean;
}

interface NeuralData {
  timestamp: number;
  eegData: EEGData;
  emgData: EMGData;
  heartRate: number;
  attention: number;
  meditation: number;
  cognitiveLoad: number;
  signalQuality: number;
}

interface EEGData {
  delta: number;
  theta: number;
  alpha: number;
  beta: number;
  gamma: number;
}

interface EMGData {
  frontal: number;
  temporal: number;
  occipital: number;
}

interface LearningContent {
  id: string;
  title: string;
  type: 'text' | 'video' | 'interactive';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number;
}

export const EEGSensor: React.FC<EEGSensorProps> = ({
  isConnected,
  onDataUpdate,
  onSessionStart,
  onSessionStop,
  isSessionActive
}) => {
  const [sensorStatus, setSensorStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [signalQuality, setSignalQuality] = useState<number>(0);
  const [eegData, setEegData] = useState<EEGData>({
    delta: 0,
    theta: 0,
    alpha: 0,
    beta: 0,
    gamma: 0
  });
  const [availableCourses, setAvailableCourses] = useState<LearningContent[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<LearningContent | null>(null);
  
  const dataIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sensorRef = useRef<any>(null);

  // Mock available courses
  useEffect(() => {
    setAvailableCourses([
      {
        id: 'intro-blockchain',
        title: 'Introduction to Blockchain',
        type: 'interactive',
        difficulty: 'beginner',
        estimatedDuration: 1800
      },
      {
        id: 'stellar-development',
        title: 'Stellar Development Fundamentals',
        type: 'video',
        difficulty: 'intermediate',
        estimatedDuration: 2400
      },
      {
        id: 'advanced-smart-contracts',
        title: 'Advanced Smart Contracts',
        type: 'text',
        difficulty: 'advanced',
        estimatedDuration: 3600
      }
    ]);
  }, []);

  const connectSensor = async () => {
    setSensorStatus('connecting');
    
    try {
      // Simulate sensor connection
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Initialize mock sensor
      sensorRef.current = {
        isConnected: true,
        signalQuality: 95
      };
      
      setSensorStatus('connected');
      setSignalQuality(95);
      
      // Start data collection
      startDataCollection();
    } catch (error) {
      setSensorStatus('error');
      console.error('Sensor connection failed:', error);
    }
  };

  const disconnectSensor = () => {
    if (dataIntervalRef.current) {
      clearInterval(dataIntervalRef.current);
    }
    
    sensorRef.current = null;
    setSensorStatus('disconnected');
    setSignalQuality(0);
  };

  const startDataCollection = () => {
    if (dataIntervalRef.current) {
      clearInterval(dataIntervalRef.current);
    }

    dataIntervalRef.current = setInterval(() => {
      const mockNeuralData = generateMockNeuralData();
      setEegData(mockNeuralData.eegData);
      setSignalQuality(mockNeuralData.signalQuality);
      onDataUpdate(mockNeuralData);
    }, 1000);
  };

  const generateMockNeuralData = (): NeuralData => {
    const time = Date.now();
    const baseSignal = 50;
    
    // Generate realistic EEG data with some variation
    const eegData: EEGData = {
      delta: baseSignal + Math.sin(time / 1000) * 10 + Math.random() * 5,
      theta: baseSignal + Math.cos(time / 800) * 8 + Math.random() * 4,
      alpha: baseSignal + Math.sin(time / 600) * 12 + Math.random() * 6,
      beta: baseSignal + Math.cos(time / 400) * 15 + Math.random() * 7,
      gamma: baseSignal + Math.sin(time / 200) * 10 + Math.random() * 5
    };

    const emgData: EMGData = {
      frontal: Math.random() * 20,
      temporal: Math.random() * 15,
      occipital: Math.random() * 10
    };

    return {
      timestamp: time,
      eegData,
      emgData,
      heartRate: 60 + Math.random() * 40,
      attention: 0.3 + Math.random() * 0.7,
      meditation: 0.2 + Math.random() * 0.6,
      cognitiveLoad: 0.1 + Math.random() * 0.8,
      signalQuality: 85 + Math.random() * 15
    };
  };

  const handleStartSession = () => {
    if (selectedCourse) {
      onSessionStart(selectedCourse.id, selectedCourse);
    }
  };

  const getSignalQualityColor = (quality: number) => {
    if (quality >= 80) return 'text-green-400';
    if (quality >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getFrequencyBandColor = (value: number, band: string) => {
    const normalized = (value / 100) * 255;
    switch (band) {
      case 'delta': return `rgb(${normalized}, 50, 50)`;
      case 'theta': return `rgb(50, ${normalized}, 50)`;
      case 'alpha': return `rgb(50, 50, ${normalized})`;
      case 'beta': return `rgb(${normalized}, ${normalized}, 50)`;
      case 'gamma': return `rgb(${normalized}, 50, ${normalized})`;
      default: return 'rgb(100, 100, 100)';
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-purple-400" />
          <h2 className="text-xl font-semibold">EEG/EMG Sensor</h2>
        </div>
        <div className="flex items-center gap-2">
          {sensorStatus === 'connected' ? (
            <Wifi className="h-5 w-5 text-green-400" />
          ) : (
            <WifiOff className="h-5 w-5 text-gray-400" />
          )}
          <span className={`text-sm font-medium ${
            sensorStatus === 'connected' ? 'text-green-400' :
            sensorStatus === 'connecting' ? 'text-yellow-400' :
            sensorStatus === 'error' ? 'text-red-400' : 'text-gray-400'
          }`}>
            {sensorStatus.charAt(0).toUpperCase() + sensorStatus.slice(1)}
          </span>
        </div>
      </div>

      {/* Signal Quality Indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-300">Signal Quality</span>
          <span className={`text-sm font-medium ${getSignalQualityColor(signalQuality)}`}>
            {Math.round(signalQuality)}%
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              signalQuality >= 80 ? 'bg-green-500' :
              signalQuality >= 60 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${signalQuality}%` }}
          />
        </div>
      </div>

      {/* EEG Frequency Bands */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-300 mb-3">EEG Frequency Bands</h3>
        <div className="space-y-2">
          {Object.entries(eegData).map(([band, value]) => (
            <div key={band} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-12 uppercase">{band}</span>
              <div className="flex-1 bg-gray-700 rounded-full h-4 relative overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${value}%`,
                    backgroundColor: getFrequencyBandColor(value, band)
                  }}
                />
              </div>
              <span className="text-xs text-gray-400 w-12 text-right">
                {Math.round(value)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Course Selection */}
      {!isSessionActive && sensorStatus === 'connected' && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Select Learning Content</h3>
          <div className="space-y-2">
            {availableCourses.map((course) => (
              <div
                key={course.id}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedCourse?.id === course.id
                    ? 'bg-purple-500/20 border-purple-400'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
                onClick={() => setSelectedCourse(course)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{course.title}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {course.difficulty} • {Math.round(course.estimatedDuration / 60)} min
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    course.difficulty === 'beginner' ? 'bg-green-500/20 text-green-400' :
                    course.difficulty === 'intermediate' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {course.type}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex gap-3">
        {sensorStatus === 'disconnected' && (
          <button
            onClick={connectSensor}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
          >
            <Play className="h-4 w-4" />
            Connect Sensor
          </button>
        )}
        
        {sensorStatus === 'connected' && !isSessionActive && (
          <button
            onClick={handleStartSession}
            disabled={!selectedCourse}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
              selectedCourse
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Zap className="h-4 w-4" />
            Start Learning
          </button>
        )}
        
        {isSessionActive && (
          <button
            onClick={onSessionStop}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
          >
            <Pause className="h-4 w-4" />
            Stop Session
          </button>
        )}
        
        {sensorStatus === 'connected' && (
          <button
            onClick={disconnectSensor}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
};
