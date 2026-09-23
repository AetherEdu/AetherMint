'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hand, Eye, Move, Zap, Settings, Play, Pause, RotateCw, Activity, Target, MousePointer } from 'lucide-react';

export type GestureType = 'point' | 'grab' | 'pinch' | 'swipe' | 'rotate' | 'wave' | 'thumbs-up' | 'thumbs-down' | 'peace' | 'rock' | 'scissors' | 'fist' | 'open-palm';
export type HandSide = 'left' | 'right' | 'both';
export type TrackingMode = 'basic' | 'advanced' | 'precise';
export type ConfidenceLevel = 'low' | 'medium' | 'high' | 'very-high';

export interface HandGesture {
  id: string;
  type: GestureType;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  handSide: HandSide;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  landmarks: Array<{
    x: number; y: number; z: number;
    visibility: number;
    presence: number;
  }>;
  timestamp: number;
  duration: number;
  isActive: boolean;
  isValid: boolean;
}

export interface GesturePattern {
  id: string;
  name: string;
  sequence: GestureType[];
  timing: number[]; // Minimum time between gestures
  tolerance: number; // Timing tolerance in ms
  description: string;
  action: string;
  icon: any;
}

export interface TrackingSettings {
  mode: TrackingMode;
  minConfidence: number;
  maxHands: number;
  enableHandTracking: boolean;
  enableEyeTracking: boolean;
  enableBodyTracking: boolean;
  smoothingFactor: number;
  predictionFrames: number;
  trackingRange: { min: number; max: number };
  calibration: {
    autoCalibrate: boolean;
    sensitivity: number;
    deadZone: number;
  };
}

export interface GestureControlsProps {
  onGestureDetected?: (gesture: HandGesture) => void;
  onPatternDetected?: (pattern: GesturePattern) => void;
  onHandTracked?: (hand: HandGesture) => void;
  onTrackingStart?: () => void;
  onTrackingStop?: () => void;
  enableTracking?: boolean;
  showVisualization?: boolean;
  showControls?: boolean;
  settings?: TrackingSettings;
  customPatterns?: GesturePattern[];
  targetFPS?: number;
}

const DEFAULT_SETTINGS: TrackingSettings = {
  mode: 'advanced',
  minConfidence: 0.7,
  maxHands: 2,
  enableHandTracking: true,
  enableEyeTracking: false,
  enableBodyTracking: false,
  smoothingFactor: 0.8,
  predictionFrames: 3,
  trackingRange: { min: 0.1, max: 2.0 },
  calibration: {
    autoCalibrate: true,
    sensitivity: 0.8,
    deadZone: 0.05
  }
};

const DEFAULT_GESTURE_PATTERNS: GesturePattern[] = [
  {
    id: 'select-object',
    name: 'Select Object',
    sequence: ['point', 'grab'],
    timing: [500],
    tolerance: 200,
    description: 'Point then grab to select',
    action: 'select',
    icon: Target
  },
  {
    id: 'rotate-object',
    name: 'Rotate Object',
    sequence: ['grab', 'rotate'],
    timing: [300],
    tolerance: 200,
    description: 'Grab and rotate to turn',
    action: 'rotate',
    icon: RotateCw
  },
  {
    id: 'confirm-action',
    name: 'Confirm Action',
    sequence: ['thumbs-up'],
    timing: [0],
    tolerance: 500,
    description: 'Thumbs up to confirm',
    action: 'confirm',
    icon: Zap
  },
  {
    id: 'cancel-action',
    name: 'Cancel Action',
    sequence: ['thumbs-down'],
    timing: [0],
    tolerance: 500,
    description: 'Thumbs down to cancel',
    action: 'cancel',
    icon: Activity
  }
];

export function GestureControls({
  onGestureDetected,
  onPatternDetected,
  onHandTracked,
  onTrackingStart,
  onTrackingStop,
  enableTracking = true,
  showVisualization = true,
  showControls = true,
  settings = DEFAULT_SETTINGS,
  customPatterns = [],
  targetFPS = 30
}: GestureControlsProps) {
  const [isTracking, setIsTracking] = useState(false);
  const [trackedHands, setTrackedHands] = useState<HandGesture[]>([]);
  const [detectedGestures, setDetectedGestures] = useState<HandGesture[]>([]);
  const [activePatterns, setActivePatterns] = useState<GesturePattern[]>([]);
  const [trackingStats, setTrackingStats] = useState({
    fps: 0,
    latency: 0,
    accuracy: 0,
    handsTracked: 0,
    gesturesDetected: 0,
    patternsCompleted: 0
  });
  const [showSettings, setShowSettings] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const gestureHistoryRef = useRef<HandGesture[]>([]);
  const patternSequenceRef = useRef<GestureType[]>([]);
  const patternTimestampRef = useRef<number>(0);

  // Initialize tracking
  useEffect(() => {
    if (enableTracking) {
      initializeTracking();
    }
    
    return () => {
      cleanupTracking();
    };
  }, [enableTracking]);

  // Initialize hand tracking
  const initializeTracking = async () => {
    try {
      // Get camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: 'user',
          frameRate: targetFPS
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Start tracking loop
      setIsTracking(true);
      onTrackingStart?.();
      
      console.log('Hand tracking initialized');
    } catch (error) {
      console.error('Failed to initialize hand tracking:', error);
    }
  };

  // Cleanup tracking
  const cleanupTracking = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    setIsTracking(false);
    onTrackingStop?.();
    
    console.log('Hand tracking cleaned up');
  };

  // Tracking loop
  useEffect(() => {
    if (isTracking && videoRef.current && canvasRef.current) {
      trackingLoop();
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isTracking]);

  // Main tracking loop
  const trackingLoop = useCallback(() => {
    if (!isTracking || !videoRef.current || !canvasRef.current) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - lastFrameTimeRef.current;
    const targetFrameTime = 1000 / targetFPS;

    if (deltaTime >= targetFrameTime) {
      lastFrameTimeRef.current = currentTime;

      // Process frame
      processFrame();
      
      // Update stats
      updateTrackingStats(deltaTime);
    }

    animationFrameRef.current = requestAnimationFrame(trackingLoop);
  }, [isTracking, targetFPS]);

  // Process video frame
  const processFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx || video.readyState !== 4) return;

    // Draw video frame to canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Simulate hand detection (in production, would use MediaPipe or similar)
    const hands = detectHands();
    
    // Process gestures
    const gestures = processGestures(hands);
    
    // Update state
    setTrackedHands(hands);
    setDetectedGestures(gestures);
    
    // Notify callbacks
    hands.forEach(hand => onHandTracked?.(hand));
    gestures.forEach(gesture => onGestureDetected?.(gesture));
    
    // Check for patterns
    checkPatterns(gestures);
  }, [onHandTracked, onGestureDetected]);

  // Simulate hand detection
  const detectHands = (): HandGesture[] => {
    const hands: HandGesture[] = [];
    
    // Simulate left hand
    if (Math.random() > 0.3) {
      const leftHand: HandGesture = {
        id: 'left-hand',
        type: getRandomGesture(),
        confidence: 0.7 + Math.random() * 0.3,
        confidenceLevel: 'high',
        handSide: 'left',
        position: {
          x: 0.3 + Math.random() * 0.2,
          y: 0.4 + Math.random() * 0.2,
          z: 0.5 + Math.random() * 0.5
        },
        rotation: {
          x: Math.random() * 0.5 - 0.25,
          y: Math.random() * 0.5 - 0.25,
          z: Math.random() * 0.5 - 0.25
        },
        velocity: {
          x: (Math.random() - 0.5) * 0.1,
          y: (Math.random() - 0.5) * 0.1,
          z: (Math.random() - 0.5) * 0.1
        },
        landmarks: generateLandmarks(),
        timestamp: Date.now(),
        duration: 1000 + Math.random() * 2000,
        isActive: true,
        isValid: true
      };
      
      hands.push(leftHand);
    }
    
    // Simulate right hand
    if (Math.random() > 0.3) {
      const rightHand: HandGesture = {
        id: 'right-hand',
        type: getRandomGesture(),
        confidence: 0.7 + Math.random() * 0.3,
        confidenceLevel: 'high',
        handSide: 'right',
        position: {
          x: 0.5 + Math.random() * 0.2,
          y: 0.4 + Math.random() * 0.2,
          z: 0.5 + Math.random() * 0.5
        },
        rotation: {
          x: Math.random() * 0.5 - 0.25,
          y: Math.random() * 0.5 - 0.25,
          z: Math.random() * 0.5 - 0.25
        },
        velocity: {
          x: (Math.random() - 0.5) * 0.1,
          y: (Math.random() - 0.5) * 0.1,
          z: (Math.random() - 0.5) * 0.1
        },
        landmarks: generateLandmarks(),
        timestamp: Date.now(),
        duration: 1000 + Math.random() * 2000,
        isActive: true,
        isValid: true
      };
      
      hands.push(rightHand);
    }
    
    return hands;
  };

  // Generate random landmarks
  const generateLandmarks = () => {
    const landmarks = [];
    for (let i = 0; i < 21; i++) {
      landmarks.push({
        x: Math.random(),
        y: Math.random(),
        z: Math.random(),
        visibility: 0.8 + Math.random() * 0.2,
        presence: 0.8 + Math.random() * 0.2
      });
    }
    return landmarks;
  };

  // Get random gesture type
  const getRandomGesture = (): GestureType => {
    const gestures: GestureType[] = ['point', 'grab', 'pinch', 'swipe', 'rotate', 'wave', 'thumbs-up', 'thumbs-down', 'peace', 'rock', 'scissors', 'fist', 'open-palm'];
    return gestures[Math.floor(Math.random() * gestures.length)];
  };

  // Process gestures from hands
  const processGestures = (hands: HandGesture[]): HandGesture[] => {
    const gestures: HandGesture[] = [];
    
    hands.forEach(hand => {
      if (hand.confidence >= settings.minConfidence) {
        gestures.push(hand);
      }
    });
    
    return gestures;
  };

  // Check for gesture patterns
  const checkPatterns = (gestures: HandGesture[]) => {
    const allPatterns = [...DEFAULT_GESTURE_PATTERNS, ...customPatterns];
    
    gestures.forEach(gesture => {
      // Add to history
      gestureHistoryRef.current.push(gesture);
      
      // Keep only recent gestures
      gestureHistoryRef.current = gestureHistoryRef.current.slice(-20);
      
      // Check patterns
      allPatterns.forEach(pattern => {
        if (checkPatternMatch(pattern, gestureHistoryRef.current)) {
          onPatternDetected?.(pattern);
          setActivePatterns(prev => [...prev, pattern]);
          
          // Clear pattern after detection
          setTimeout(() => {
            setActivePatterns(prev => prev.filter(p => p.id !== pattern.id));
          }, 2000);
        }
      });
    });
  };

  // Check if pattern matches gesture history
  const checkPatternMatch = (pattern: GesturePattern, history: HandGesture[]): boolean => {
    if (history.length < pattern.sequence.length) return false;
    
    const recentGestures = history.slice(-pattern.sequence.length);
    
    for (let i = 0; i < pattern.sequence.length; i++) {
      if (recentGestures[i].type !== pattern.sequence[i]) return false;
      
      // Check timing
      if (i > 0) {
        const timeDiff = recentGestures[i].timestamp - recentGestures[i - 1].timestamp;
        if (timeDiff < pattern.timing[i - 1] - pattern.tolerance || 
            timeDiff > pattern.timing[i - 1] + pattern.tolerance) {
          return false;
        }
      }
    }
    
    return true;
  };

  // Update tracking statistics
  const updateTrackingStats = (deltaTime: number) => {
    const fps = Math.round(1000 / deltaTime);
    const latency = Math.round(deltaTime);
    
    setTrackingStats({
      fps,
      latency,
      accuracy: 0.85 + Math.random() * 0.15, // Simulated accuracy
      handsTracked: trackedHands.length,
      gesturesDetected: detectedGestures.length,
      patternsCompleted: activePatterns.length
    });
  };

  // Start calibration
  const startCalibration = useCallback(async () => {
    setIsCalibrating(true);
    setCalibrationProgress(0);
    
    // Simulate calibration process
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      setCalibrationProgress(i);
    }
    
    setIsCalibrating(false);
    console.log('Hand tracking calibration completed');
  }, []);

  // Get gesture icon
  const getGestureIcon = (type: GestureType) => {
    const icons = {
      'point': MousePointer,
      'grab': Hand,
      'pinch': Hand,
      'swipe': Move,
      'rotate': RotateCw,
      'wave': Hand,
      'thumbs-up': Zap,
      'thumbs-down': Activity,
      'peace': Hand,
      'rock': Hand,
      'scissors': Hand,
      'fist': Hand,
      'open-palm': Hand
    };
    return icons[type] || Hand;
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-400';
    if (confidence >= 0.7) return 'text-yellow-400';
    if (confidence >= 0.5) return 'text-orange-400';
    return 'text-red-400';
  };

  // Get confidence level color
  const getConfidenceLevelColor = (level: ConfidenceLevel) => {
    const colors = {
      'low': 'text-red-400',
      'medium': 'text-orange-400',
      'high': 'text-yellow-400',
      'very-high': 'text-green-400'
    };
    return colors[level] || 'text-gray-400';
  };

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      {/* Video and Canvas */}
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
      </div>

      {/* Hand Visualization */}
      {showVisualization && trackedHands.map((hand, index) => (
        <motion.div
          key={hand.id}
          className="absolute"
          style={{
            left: `${hand.position.x * 100}%`,
            top: `${hand.position.y * 100}%`,
            transform: 'translate(-50%, -50%)'
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.1 }}
        >
          <div className="relative">
            {/* Hand indicator */}
            <div 
              className={`w-12 h-12 rounded-full border-2 shadow-lg ${getConfidenceColor(hand.confidence)}`}
              style={{
                borderColor: hand.confidence >= settings.minConfidence ? '#10b981' : '#ef4444',
                backgroundColor: hand.confidence >= settings.minConfidence ? '#10b98120' : '#ef444420'
              }}
            >
              {/* Gesture icon */}
              <div className="w-full h-full rounded-full flex items-center justify-center">
                {(() => {
                  const IconComponent = getGestureIcon(hand.type);
                  return <IconComponent className="h-6 w-6 text-white" />;
                })()}
              </div>
            </div>
            
            {/* Hand side indicator */}
            <div className={`absolute -top-2 -right-2 w-4 h-4 rounded-full ${
              hand.handSide === 'left' ? 'bg-blue-500' : 'bg-purple-500'
            } flex items-center justify-center text-white text-xs font-bold`}>
              {hand.handSide === 'left' ? 'L' : 'R'}
            </div>
            
            {/* Confidence indicator */}
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-sm rounded px-2 py-1">
              <div className={`text-xs font-medium ${getConfidenceColor(hand.confidence)}`}>
                {Math.round(hand.confidence * 100)}%
              </div>
              <div className="text-gray-300 text-xs capitalize">{hand.type}</div>
            </div>
            
            {/* Velocity indicator */}
            {(Math.abs(hand.velocity.x) > 0.01 || Math.abs(hand.velocity.y) > 0.01) && (
              <div
                className="absolute top-1/2 left-1/2 w-6 h-0.5 bg-yellow-400 origin-left"
                style={{
                  transform: `translate(-50%, -50%) rotate(${Math.atan2(hand.velocity.y, hand.velocity.x) * 180 / Math.PI}deg)`,
                  width: `${Math.sqrt(hand.velocity.x ** 2 + hand.velocity.y ** 2) * 100}px`
                }}
              />
            )}
          </div>
        </motion.div>
      ))}

      {/* Pattern Indicators */}
      <AnimatePresence>
        {activePatterns.map((pattern) => (
          <motion.div
            key={pattern.id}
            className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-green-500/20 backdrop-blur-sm rounded-lg p-3 border border-green-500/50"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="flex items-center gap-3">
              {(() => {
                const IconComponent = pattern.icon;
                return <IconComponent className="h-5 w-5 text-green-400" />;
              })()}
              <div>
                <div className="text-green-400 text-sm font-medium">{pattern.name}</div>
                <div className="text-green-300 text-xs">{pattern.description}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Control Panel */}
      {showControls && (
        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-blue-500/30">
          <div className="flex items-center gap-3 mb-4">
            <Hand className="h-5 w-5 text-blue-400" />
            <h3 className="text-white font-semibold">Gesture Controls</h3>
          </div>

          {/* Tracking Status */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Status:</span>
              <span className={isTracking ? 'text-green-400' : 'text-red-400'}>
                {isTracking ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Mode:</span>
              <span className="text-blue-300 capitalize">{settings.mode}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Hands:</span>
              <span className="text-purple-300">{trackedHands.length}/{settings.maxHands}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Gestures:</span>
              <span className="text-orange-300">{detectedGestures.length}</span>
            </div>
          </div>

          {/* Tracking Controls */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => isTracking ? cleanupTracking() : initializeTracking()}
              className={`px-4 py-2 rounded text-sm transition-colors ${
                isTracking 
                  ? 'bg-red-600 text-white hover:bg-red-700' 
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isTracking ? 'Stop' : 'Start'}
            </button>
            <button
              onClick={startCalibration}
              disabled={isCalibrating}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isCalibrating ? 'Calibrating...' : 'Calibrate'}
            </button>
          </div>

          {/* Calibration Progress */}
          {isCalibrating && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-400 text-sm">Calibration</span>
                <span className="text-blue-300 text-sm">{calibrationProgress}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-100"
                  style={{ width: `${calibrationProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Performance Stats */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">FPS:</span>
              <span className={`font-mono ${
                trackingStats.fps >= targetFPS * 0.9 ? 'text-green-400' :
                trackingStats.fps >= targetFPS * 0.7 ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {trackingStats.fps}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Latency:</span>
              <span className="text-blue-400 font-mono">{trackingStats.latency}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Accuracy:</span>
              <span className="text-green-400 font-mono">{Math.round(trackingStats.accuracy * 100)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Gesture History */}
      {showControls && detectedGestures.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-green-500/30 max-w-xs max-h-48 overflow-y-auto">
          <div className="flex items-center gap-3 mb-3">
            <Eye className="h-5 w-5 text-green-400" />
            <h3 className="text-white font-semibold">Recent Gestures</h3>
          </div>

          <div className="space-y-2">
            {detectedGestures.slice(-5).map((gesture, index) => (
              <div key={`${gesture.id}-${index}`} className="flex items-center gap-3 p-2 bg-green-900/20 rounded border border-green-500/30">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getConfidenceColor(gesture.confidence)}`}>
                  {(() => {
                    const IconComponent = getGestureIcon(gesture.type);
                    return <IconComponent className="h-4 w-4" />;
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium capitalize">{gesture.type}</div>
                  <div className="text-gray-300 text-xs">{gesture.handSide} hand</div>
                </div>
                <div className="text-right">
                  <div className={`text-xs font-medium ${getConfidenceColor(gesture.confidence)}`}>
                    {Math.round(gesture.confidence * 100)}%
                  </div>
                  <div className="text-gray-400 text-xs">{getConfidenceLevelColor(gesture.confidenceLevel)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings Button */}
      {showControls && (
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="absolute bottom-4 right-4 p-2 bg-black/80 backdrop-blur-md rounded-lg border border-gray-500/30 text-white hover:bg-black/90 transition-colors"
        >
          <Settings className="h-5 w-5" />
        </button>
      )}

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="absolute bottom-16 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-gray-500/30 w-80"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <h3 className="text-white font-semibold mb-4">Tracking Settings</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm">Tracking Mode</label>
                <select className="w-full mt-1 p-2 bg-black/50 border border-gray-500/30 rounded text-white">
                  <option value="basic">Basic</option>
                  <option value="advanced">Advanced</option>
                  <option value="precise">Precise</option>
                </select>
              </div>
              
              <div>
                <label className="text-gray-400 text-sm">Min Confidence</label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={settings.minConfidence}
                  onChange={(e) => {
                    // Update min confidence
                    console.log('Min confidence:', e.target.value);
                  }}
                  className="w-full mt-1"
                />
                <div className="text-right text-gray-500 text-xs">
                  {settings.minConfidence.toFixed(1)}
                </div>
              </div>
              
              <div>
                <label className="text-gray-400 text-sm">Max Hands</label>
                <input
                  type="number"
                  min="1"
                  max="4"
                  value={settings.maxHands}
                  onChange={(e) => {
                    // Update max hands
                    console.log('Max hands:', e.target.value);
                  }}
                  className="w-full mt-1 p-2 bg-black/50 border border-gray-500/30 rounded text-white"
                />
              </div>
              
              <div>
                <label className="text-gray-400 text-sm">Target FPS</label>
                <input
                  type="number"
                  min="15"
                  max="60"
                  value={targetFPS}
                  onChange={(e) => {
                    // Update target FPS
                    console.log('Target FPS:', e.target.value);
                  }}
                  className="w-full mt-1 p-2 bg-black/50 border border-gray-500/30 rounded text-white"
                />
              </div>
              
              <div>
                <label className="text-gray-400 text-sm">Smoothing Factor</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.smoothingFactor}
                  onChange={(e) => {
                    // Update smoothing
                    console.log('Smoothing:', e.target.value);
                  }}
                  className="w-full mt-1"
                />
                <div className="text-right text-gray-500 text-xs">
                  {settings.smoothingFactor.toFixed(1)}
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.enableHandTracking}
                    onChange={(e) => {
                      // Toggle hand tracking
                      console.log('Hand tracking:', e.target.checked);
                    }}
                    className="rounded"
                  />
                  <span className="text-gray-400 text-sm">Hand Tracking</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.enableEyeTracking}
                    onChange={(e) => {
                      // Toggle eye tracking
                      console.log('Eye tracking:', e.target.checked);
                    }}
                    className="rounded"
                  />
                  <span className="text-gray-400 text-sm">Eye Tracking</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.enableBodyTracking}
                    onChange={(e) => {
                      // Toggle body tracking
                      console.log('Body tracking:', e.target.checked);
                    }}
                    className="rounded"
                  />
                  <span className="text-gray-400 text-sm">Body Tracking</span>
                </label>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tracking Status Indicator */}
      <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md rounded-lg p-3 border border-blue-500/30">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isTracking ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-white text-sm">
            {isTracking ? 'Tracking Active' : 'Tracking Inactive'}
          </span>
        </div>
      </div>
    </div>
  );
}
