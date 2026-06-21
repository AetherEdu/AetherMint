'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hand, MousePointer, Move, RotateCw, ZoomIn, Grab, Eye } from 'lucide-react';
import { Pinch, Swipe } from '@/utils/missingIcons';

export type GestureType = 
  | 'point' 
  | 'grab' 
  | 'pinch' 
  | 'swipe' 
  | 'rotate' 
  | 'wave' 
  | 'thumbs-up' 
  | 'thumbs-down'
  | 'peace'
  | 'rock'
  | 'scissors';

export type HandSide = 'left' | 'right';
export type ConfidenceLevel = 'low' | 'medium' | 'high';

interface HandGesture {
  id: string;
  type: GestureType;
  handSide: HandSide;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  timestamp: number;
  duration: number;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  fingers: {
    thumb: { extended: boolean; position: any };
    index: { extended: boolean; position: any };
    middle: { extended: boolean; position: any };
    ring: { extended: boolean; position: any };
    pinky: { extended: boolean; position: any };
  };
  palm: {
    position: any;
    normal: any;
    size: number;
  };
}

interface GesturePattern {
  gesture: GestureType;
  sequence: GestureType[];
  timing: number[];
  confidence: number;
  action: string;
  description: string;
}

interface GestureRecognitionSettings {
  sensitivity: number;
  minConfidence: number;
  smoothingFactor: number;
  gestureTimeout: number;
  enableHandTracking: boolean;
  enableBodyTracking: boolean;
  enableFaceTracking: boolean;
  trackingMode: 'single-hand' | 'both-hands' | 'full-body';
}

interface GestureRecognitionProps {
  onGestureDetected?: (gesture: HandGesture) => void;
  onGesturePattern?: (pattern: GesturePattern) => void;
  onHandDetected?: (hand: HandGesture) => void;
  onHandLost?: (handId: string) => void;
  settings?: GestureRecognitionSettings;
  showVisualization?: boolean;
  enableRealTimeRecognition?: boolean;
  targetFPS?: number;
}

const DEFAULT_SETTINGS: GestureRecognitionSettings = {
  sensitivity: 0.7,
  minConfidence: 0.6,
  smoothingFactor: 0.3,
  gestureTimeout: 2000,
  enableHandTracking: true,
  enableBodyTracking: false,
  enableFaceTracking: false,
  trackingMode: 'single-hand'
};

const GESTURE_PATTERNS: GesturePattern[] = [
  {
    gesture: 'point',
    sequence: ['point'],
    timing: [0],
    confidence: 0.8,
    action: 'select',
    description: 'Point to select or interact with objects'
  },
  {
    gesture: 'grab',
    sequence: ['grab'],
    timing: [0],
    confidence: 0.8,
    action: 'grab',
    description: 'Grab and manipulate objects'
  },
  {
    gesture: 'pinch',
    sequence: ['pinch'],
    timing: [0],
    confidence: 0.8,
    action: 'scale',
    description: 'Pinch to scale objects'
  },
  {
    gesture: 'swipe',
    sequence: ['swipe'],
    timing: [0],
    confidence: 0.7,
    action: 'navigate',
    description: 'Swipe to navigate or scroll'
  },
  {
    gesture: 'rotate',
    sequence: ['rotate'],
    timing: [0],
    confidence: 0.8,
    action: 'rotate',
    description: 'Rotate hand to spin objects'
  },
  {
    gesture: 'wave',
    sequence: ['wave'],
    timing: [0],
    confidence: 0.7,
    action: 'dismiss',
    description: 'Wave to dismiss or cancel'
  },
  {
    gesture: 'thumbs-up',
    sequence: ['thumbs-up'],
    timing: [0],
    confidence: 0.9,
    action: 'confirm',
    description: 'Thumbs up to confirm or approve'
  },
  {
    gesture: 'thumbs-down',
    sequence: ['thumbs-down'],
    timing: [0],
    confidence: 0.9,
    action: 'reject',
    description: 'Thumbs down to reject or decline'
  }
];

export function GestureRecognition({
  onGestureDetected,
  onGesturePattern,
  onHandDetected,
  onHandLost,
  settings = DEFAULT_SETTINGS,
  showVisualization = true,
  enableRealTimeRecognition = true,
  targetFPS = 30
}: GestureRecognitionProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [detectedHands, setDetectedHands] = useState<HandGesture[]>([]);
  const [currentGesture, setCurrentGesture] = useState<HandGesture | null>(null);
  const [gestureHistory, setGestureHistory] = useState<HandGesture[]>([]);
  const [recognitionStats, setRecognitionStats] = useState({
    totalGestures: 0,
    recognizedGestures: 0,
    accuracy: 0,
    avgConfidence: 0,
    fps: 0
  });
  const [showSettings, setShowSettings] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const lastFrameTime = useRef<number>(0);

  // Initialize gesture recognition system
  useEffect(() => {
    const initializeGestureRecognition = async () => {
      try {
        // Initialize camera access
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 640,
            height: 480,
            facingMode: 'user'
          }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Initialize MediaPipe or similar gesture recognition library
        await initializeGestureLibraries();
        
        setIsInitialized(true);
        console.log('Gesture recognition initialized successfully');
      } catch (error) {
        console.error('Failed to initialize gesture recognition:', error);
      }
    };

    initializeGestureRecognition();

    return () => {
      // Cleanup camera stream
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Initialize gesture recognition libraries
  const initializeGestureLibraries = async () => {
    // In production, this would load MediaPipe Hands or similar
    // For now, we'll simulate gesture detection
    console.log('Initializing gesture recognition libraries...');
  };

  // Main gesture recognition loop
  const recognizeGestures = useCallback(() => {
    if (!isInitialized || !videoRef.current || !canvasRef.current) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - lastFrameTime.current;
    
    // Frame rate limiting
    if (deltaTime < (1000 / targetFPS)) {
      animationFrameRef.current = requestAnimationFrame(recognizeGestures);
      return;
    }

    lastFrameTime.current = currentTime;

    // Draw video frame to canvas for processing
    const ctx = canvasRef.current.getContext('2d');
    if (ctx && videoRef.current) {
      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      
      // Process frame for gesture detection
      const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      const hands = detectHandsInFrame(imageData);
      
      // Update detected hands
      setDetectedHands(hands);
      
      // Process gestures from detected hands
      hands.forEach(hand => {
        const gesture = recognizeHandGesture(hand);
        if (gesture && gesture.confidence >= settings.minConfidence) {
          setCurrentGesture(gesture);
          setGestureHistory(prev => [...prev.slice(-10), gesture]);
          onGestureDetected?.(gesture);
        }
      });

      // Update performance stats
      updateRecognitionStats();
    }

    animationFrameRef.current = requestAnimationFrame(recognizeGestures);
  }, [isInitialized, settings, targetFPS, onGestureDetected]);

  // Start recognition loop
  useEffect(() => {
    if (enableRealTimeRecognition && isInitialized) {
      recognizeGestures();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enableRealTimeRecognition, isInitialized, recognizeGestures]);

  // Simulate hand detection (in production would use actual computer vision)
  const detectHandsInFrame = (imageData: ImageData): HandGesture[] => {
    // Simulate hand detection with random data
    const hands: HandGesture[] = [];
    
    // Simulate detecting 0-2 hands
    const numHands = Math.floor(Math.random() * 3);
    
    for (let i = 0; i < numHands; i++) {
      const hand: HandGesture = {
        id: `hand-${i}`,
        type: getRandomGesture(),
        handSide: i % 2 === 0 ? 'right' : 'left',
        confidence: Math.random() * 0.4 + 0.6, // 0.6-1.0
        confidenceLevel: getConfidenceLevel(Math.random() * 0.4 + 0.6),
        timestamp: Date.now(),
        duration: Math.random() * 2000 + 500,
        position: {
          x: Math.random() * 640,
          y: Math.random() * 480,
          z: Math.random() * 2 - 1
        },
        rotation: {
          x: Math.random() * 360,
          y: Math.random() * 360,
          z: Math.random() * 360
        },
        fingers: {
          thumb: { extended: Math.random() > 0.3, position: generateRandomPosition() },
          index: { extended: Math.random() > 0.3, position: generateRandomPosition() },
          middle: { extended: Math.random() > 0.3, position: generateRandomPosition() },
          ring: { extended: Math.random() > 0.3, position: generateRandomPosition() },
          pinky: { extended: Math.random() > 0.3, position: generateRandomPosition() }
        },
        palm: {
          position: generateRandomPosition(),
          normal: generateRandomPosition(),
          size: Math.random() * 50 + 30
        }
      };
      
      hands.push(hand);
    }
    
    return hands;
  };

  // Recognize gesture from hand data
  const recognizeHandGesture = (hand: HandGesture): HandGesture | null => {
    // Analyze finger positions to determine gesture type
    const { fingers } = hand;
    
    // Count extended fingers
    const extendedCount = Object.values(fingers).filter(f => f.extended).length;
    
    // Determine gesture based on finger pattern
    let gestureType: GestureType;
    
    if (extendedCount === 1 && fingers.index.extended) {
      gestureType = 'point';
    } else if (extendedCount === 0) {
      gestureType = 'grab';
    } else if (extendedCount === 2 && fingers.thumb.extended && fingers.index.extended) {
      gestureType = 'pinch';
    } else if (extendedCount === 5) {
      gestureType = 'wave';
    } else if (fingers.thumb.extended && !fingers.index.extended && !fingers.middle.extended && !fingers.ring.extended && !fingers.pinky.extended) {
      gestureType = 'thumbs-up';
    } else if (!fingers.thumb.extended && fingers.index.extended && !fingers.middle.extended && !fingers.ring.extended && !fingers.pinky.extended) {
      gestureType = 'thumbs-down';
    } else if (fingers.index.extended && fingers.middle.extended && !fingers.ring.extended && !fingers.pinky.extended) {
      gestureType = 'peace';
    } else {
      gestureType = 'grab'; // Default
    }
    
    return {
      ...hand,
      type: gestureType,
      confidence: calculateGestureConfidence(hand, gestureType),
      confidenceLevel: getConfidenceLevel(calculateGestureConfidence(hand, gestureType))
    };
  };

  // Calculate gesture confidence
  const calculateGestureConfidence = (hand: HandGesture, gestureType: GestureType): number => {
    // Base confidence on finger detection quality
    const fingerQuality = Object.values(hand.fingers).reduce((acc, finger) => {
      return acc + (finger.extended ? 0.8 : 0.2);
    }, 0) / 5;
    
    // Adjust based on gesture type complexity
    const gestureComplexity = {
      'point': 0.9,
      'grab': 0.8,
      'pinch': 0.7,
      'swipe': 0.6,
      'rotate': 0.6,
      'wave': 0.5,
      'thumbs-up': 0.9,
      'thumbs-down': 0.9,
      'peace': 0.7,
      'rock': 0.6,
      'scissors': 0.6
    }[gestureType] || 0.5;
    
    return fingerQuality * gestureComplexity * settings.sensitivity;
  };

  // Get confidence level from numeric value
  const getConfidenceLevel = (confidence: number): ConfidenceLevel => {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  };

  // Get random gesture type
  const getRandomGesture = (): GestureType => {
    const gestures: GestureType[] = ['point', 'grab', 'pinch', 'swipe', 'rotate', 'wave', 'thumbs-up', 'thumbs-down', 'peace', 'rock', 'scissors'];
    return gestures[Math.floor(Math.random() * gestures.length)];
  };

  // Generate random position
  const generateRandomPosition = () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    z: Math.random() * 100
  });

  // Update recognition statistics
  const updateRecognitionStats = () => {
    const totalGestures = gestureHistory.length;
    const recognizedGestures = gestureHistory.filter(g => g.confidence >= settings.minConfidence).length;
    const accuracy = totalGestures > 0 ? recognizedGestures / totalGestures : 0;
    const avgConfidence = gestureHistory.length > 0 
      ? gestureHistory.reduce((sum, g) => sum + g.confidence, 0) / gestureHistory.length 
      : 0;
    
    setRecognitionStats({
      totalGestures,
      recognizedGestures,
      accuracy,
      avgConfidence,
      fps: targetFPS
    });
  };

  // Get gesture icon
  const getGestureIcon = (gestureType: GestureType) => {
    const icons = {
      'point': MousePointer,
      'grab': Grab,
      'pinch': Pinch,
      'swipe': Swipe,
      'rotate': RotateCw,
      'wave': Hand,
      'thumbs-up': Hand,
      'thumbs-down': Hand,
      'peace': Hand,
      'rock': Hand,
      'scissors': Hand
    };
    
    return icons[gestureType] || Hand;
  };

  // Get gesture color based on confidence
  const getGestureColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Initializing gesture recognition...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      {/* Video Feed */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
      />
      
      {/* Canvas for Processing */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        width={640}
        height={480}
      />

      {/* Gesture Visualization Overlay */}
      {showVisualization && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Hand Tracking Visualization */}
          {detectedHands.map((hand, index) => {
            const IconComponent = getGestureIcon(hand.type);
            return (
              <motion.div
                key={hand.id}
                className="absolute"
                style={{
                  left: `${(hand.position.x / 640) * 100}%`,
                  top: `${(hand.position.y / 480) * 100}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
              >
                <div className="relative">
                  {/* Hand Icon */}
                  <IconComponent 
                    className={`h-12 w-12 ${getGestureColor(hand.confidence)}`}
                    style={{
                      filter: `drop-shadow(0 0 10px ${hand.confidence >= 0.8 ? '#10b981' : hand.confidence >= 0.6 ? '#eab308' : '#ef4444'})`
                    }}
                  />
                  
                  {/* Gesture Label */}
                  <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-sm rounded px-2 py-1">
                    <div className="text-white text-xs font-medium capitalize">{hand.type}</div>
                    <div className="text-gray-300 text-xs">{Math.round(hand.confidence * 100)}%</div>
                  </div>
                  
                  {/* Confidence Indicator */}
                  <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-green-500 animate-pulse" />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Control Panel */}
      <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-blue-500/30">
        <div className="flex items-center gap-3 mb-4">
          <Hand className="h-5 w-5 text-blue-400" />
          <h3 className="text-white font-semibold">Gesture Recognition</h3>
        </div>

        {/* Recognition Status */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Status:</span>
            <span className="text-green-400 text-sm font-medium">Active</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Hands Detected:</span>
            <span className="text-blue-400 text-sm font-medium">{detectedHands.length}</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Current Gesture:</span>
            <span className="text-purple-400 text-sm font-medium capitalize">
              {currentGesture?.type || 'None'}
            </span>
          </div>
        </div>

        {/* Recognition Stats */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Accuracy:</span>
            <span className="text-green-400 font-mono">{Math.round(recognitionStats.accuracy * 100)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Avg Confidence:</span>
            <span className="text-blue-400 font-mono">{Math.round(recognitionStats.avgConfidence * 100)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Total Gestures:</span>
            <span className="text-purple-400 font-mono">{recognitionStats.totalGestures}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">FPS:</span>
            <span className="text-orange-400 font-mono">{recognitionStats.fps}</span>
          </div>
        </div>
      </div>

      {/* Gesture History */}
      <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-purple-500/30 max-w-xs">
        <div className="flex items-center gap-3 mb-3">
          <Eye className="h-5 w-5 text-purple-400" />
          <h3 className="text-white font-semibold">Recent Gestures</h3>
        </div>
        
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {gestureHistory.slice(-5).reverse().map((gesture, index) => {
            const IconComponent = getGestureIcon(gesture.type);
            return (
              <div key={index} className="flex items-center gap-2 text-sm">
                <IconComponent className={`h-4 w-4 ${getGestureColor(gesture.confidence)}`} />
                <span className="text-white capitalize">{gesture.type}</span>
                <span className="text-gray-400">{Math.round(gesture.confidence * 100)}%</span>
                <span className="text-purple-300">{gesture.handSide}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Settings Button */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="absolute top-4 right-4 p-2 bg-black/80 backdrop-blur-md rounded-lg border border-gray-500/30 text-white hover:bg-black/90 transition-colors"
      >
        <Settings className="h-5 w-5" />
      </button>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="absolute top-16 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-gray-500/30 w-80"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <h3 className="text-white font-semibold mb-4">Recognition Settings</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm">Sensitivity</label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={settings.sensitivity}
                  onChange={(e) => console.log('Sensitivity changed to:', e.target.value)}
                  className="w-full mt-1"
                />
                <div className="text-right text-gray-500 text-xs">{settings.sensitivity}</div>
              </div>
              
              <div>
                <label className="text-gray-400 text-sm">Min Confidence</label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={settings.minConfidence}
                  onChange={(e) => console.log('Min confidence changed to:', e.target.value)}
                  className="w-full mt-1"
                />
                <div className="text-right text-gray-500 text-xs">{settings.minConfidence}</div>
              </div>
              
              <div>
                <label className="text-gray-400 text-sm">Target FPS</label>
                <select className="w-full mt-1 p-2 bg-black/50 border border-gray-500/30 rounded text-white">
                  <option value="15">15 FPS</option>
                  <option value="30">30 FPS</option>
                  <option value="60">60 FPS</option>
                  <option value="120">120 FPS</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-gray-400 text-sm">Hand Tracking</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-gray-400 text-sm">Body Tracking</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-gray-400 text-sm">Face Tracking</span>
                </label>
              </div>
              
              <div>
                <label className="text-gray-400 text-sm">Tracking Mode</label>
                <select className="w-full mt-1 p-2 bg-black/50 border border-gray-500/30 rounded text-white">
                  <option value="single-hand">Single Hand</option>
                  <option value="both-hands">Both Hands</option>
                  <option value="full-body">Full Body</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current Gesture Display */}
      {currentGesture && (
        <motion.div
          className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-green-500/30"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
        >
          <div className="flex items-center gap-3">
            {(() => {
              const IconComponent = getGestureIcon(currentGesture.type);
              return <IconComponent className={`h-8 w-8 ${getGestureColor(currentGesture.confidence)}`} />;
            })()}
            <div>
              <div className="text-white font-semibold capitalize">{currentGesture.type}</div>
              <div className="text-gray-300 text-sm">{currentGesture.handSide} hand</div>
              <div className="text-green-400 text-sm">{Math.round(currentGesture.confidence * 100)}% confidence</div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
