'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Volume2, VolumeX, Keyboard, Mouse, Zap, Settings, Moon, Sun, Contrast, Brain } from 'lucide-react';

export type AccessibilityMode = 'none' | 'visual' | 'hearing' | 'motor' | 'cognitive' | 'comprehensive';
export type AdaptationLevel = 'minimal' | 'moderate' | 'extensive';

interface AccessibilityProfile {
  userId: string;
  currentMode: AccessibilityMode;
  adaptationLevel: AdaptationLevel;
  autoSwitchEnabled: boolean;
  detectionHistory: DetectionEvent[];
  preferences: {
    fontSize: number;
    contrast: 'normal' | 'high' | 'low';
    colorBlindness: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
    motionReduction: boolean;
    screenReader: boolean;
    keyboardNavigation: boolean;
    voiceControl: boolean;
  };
  performance: {
    detectionAccuracy: number;
    adaptationSuccess: number;
    userSatisfaction: number;
    falsePositives: number;
  };
}

interface DetectionEvent {
  timestamp: string;
  trigger: string;
  detectedMode: AccessibilityMode;
  confidence: number;
  applied: boolean;
  userFeedback?: 'positive' | 'negative' | 'neutral';
}

interface AccessibilityMetrics {
  readingSpeed: number;
  clickAccuracy: number;
  scrollBehavior: 'smooth' | 'jerky' | 'normal';
  mouseMovement: 'precise' | 'tremor' | 'slow';
  keyboardUsage: number;
  voiceCommands: number;
  eyeTracking?: {
    fixationDuration: number;
    saccadeFrequency: number;
    readingPattern: 'linear' | 'scattered' | 'regressive';
  };
}

interface AccessibilityAutoSwitchProps {
  userId: string;
  onModeChange?: (mode: AccessibilityMode, adaptations: any) => void;
  onDetectionEvent?: (event: DetectionEvent) => void;
  enableAutoDetection?: boolean;
  detectionSensitivity?: number;
  allowUserOverride?: boolean;
  showControls?: boolean;
}

const ACCESSIBILITY_MODES: Record<AccessibilityMode, {
  name: string;
  icon: any;
  triggers: string[];
  adaptations: {
    visual: string[];
    audio: string[];
    interaction: string[];
    content: string[];
  };
  indicators: {
    readingSpeed: number;
    clickAccuracy: number;
    scrollBehavior: string[];
    mouseMovement: string[];
    keyboardUsage: number;
  };
}> = {
  none: {
    name: 'Standard',
    icon: Settings,
    triggers: [],
    adaptations: {
      visual: [],
      audio: [],
      interaction: [],
      content: []
    },
    indicators: {
      readingSpeed: 200,
      clickAccuracy: 0.95,
      scrollBehavior: ['smooth'],
      mouseMovement: ['precise'],
      keyboardUsage: 0.1
    }
  },
  visual: {
    name: 'Visual Impairment',
    icon: Eye,
    triggers: ['slow-reading', 'large-font-preference', 'high-contrast-need', 'screen-reader-usage'],
    adaptations: {
      visual: ['increased-font-size', 'high-contrast', 'reduced-motion', 'focus-indicators'],
      audio: ['screen-reader', 'audio-descriptions'],
      interaction: ['keyboard-navigation', 'voice-control'],
      content: ['simplified-layout', 'alt-text-enhanced']
    },
    indicators: {
      readingSpeed: 100,
      clickAccuracy: 0.7,
      scrollBehavior: ['jerky'],
      mouseMovement: ['slow', 'tremor'],
      keyboardUsage: 0.6
    }
  },
  hearing: {
    name: 'Hearing Impairment',
    icon: Volume2,
    triggers: ['volume-max', 'caption-preference', 'visual-cues-needed', 'no-audio-usage'],
    adaptations: {
      visual: ['visual-notifications', 'enhanced-captions', 'sign-language-overlay'],
      audio: ['vibration-feedback', 'visual-alerts'],
      interaction: ['text-based-communication'],
      content: ['transcripts', 'visual-aids']
    },
    indicators: {
      readingSpeed: 180,
      clickAccuracy: 0.9,
      scrollBehavior: ['smooth'],
      mouseMovement: ['precise'],
      keyboardUsage: 0.3
    }
  },
  motor: {
    name: 'Motor Impairment',
    icon: Mouse,
    triggers: ['click-difficulty', 'slow-movement', 'keyboard-heavy', 'gesture-issues'],
    adaptations: {
      visual: ['larger-targets', 'reduced-precision'],
      audio: ['voice-commands', 'audio-feedback'],
      interaction: ['keyboard-shortcuts', 'alternative-input', 'auto-complete'],
      content: ['simplified-interactions', 'reduced-clicks']
    },
    indicators: {
      readingSpeed: 150,
      clickAccuracy: 0.6,
      scrollBehavior: ['jerky'],
      mouseMovement: ['tremor', 'slow'],
      keyboardUsage: 0.8
    }
  },
  cognitive: {
    name: 'Cognitive Support',
    icon: Brain,
    triggers: ['repetition-needed', 'simplified-preference', 'focus-issues', 'memory-aids'],
    adaptations: {
      visual: ['reduced-clutter', 'clear-structure', 'consistent-layout'],
      audio: ['repetition', 'simplified-language'],
      interaction: ['guided-navigation', 'progress-indicators'],
      content: ['simplified-content', 'step-by-step', 'summaries']
    },
    indicators: {
      readingSpeed: 120,
      clickAccuracy: 0.8,
      scrollBehavior: ['scattered'],
      mouseMovement: ['precise'],
      keyboardUsage: 0.4
    }
  },
  comprehensive: {
    name: 'Comprehensive Support',
    icon: Zap,
    triggers: ['multiple-impairments', 'severe-difficulty', 'accessibility-preference'],
    adaptations: {
      visual: ['maximum-contrast', 'largest-font', 'focus-enhancement'],
      audio: ['full-audio-support', 'screen-reader'],
      interaction: ['keyboard-only', 'voice-control', 'simplified-interactions'],
      content: ['simplified-everything', 'clear-structure', 'minimal-distraction']
    },
    indicators: {
      readingSpeed: 80,
      clickAccuracy: 0.5,
      scrollBehavior: ['jerky'],
      mouseMovement: ['slow', 'tremor'],
      keyboardUsage: 0.9
    }
  }
};

export function AccessibilityAutoSwitch({
  userId,
  onModeChange,
  onDetectionEvent,
  enableAutoDetection = true,
  detectionSensitivity = 0.7,
  allowUserOverride = true,
  showControls = true
}: AccessibilityAutoSwitchProps) {
  const [profile, setProfile] = useState<AccessibilityProfile>({
    userId,
    currentMode: 'none',
    adaptationLevel: 'minimal',
    autoSwitchEnabled: enableAutoDetection,
    detectionHistory: [],
    preferences: {
      fontSize: 16,
      contrast: 'normal',
      colorBlindness: 'none',
      motionReduction: false,
      screenReader: false,
      keyboardNavigation: false,
      voiceControl: false
    },
    performance: {
      detectionAccuracy: 0.8,
      adaptationSuccess: 0.9,
      userSatisfaction: 0.8,
      falsePositives: 0.1
    }
  });

  const [currentMetrics, setCurrentMetrics] = useState<AccessibilityMetrics>({
    readingSpeed: 200,
    clickAccuracy: 0.95,
    scrollBehavior: 'smooth',
    mouseMovement: 'precise',
    keyboardUsage: 0.1,
    voiceCommands: 0
  });

  const [isDetecting, setIsDetecting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [recentDetection, setRecentDetection] = useState<DetectionEvent | null>(null);

  // Monitor user behavior for accessibility needs
  useEffect(() => {
    if (!enableAutoDetection) return;

    const monitorBehavior = () => {
      setIsDetecting(true);
      
      // Track various user behaviors
      const trackReadingSpeed = () => {
        // Monitor reading speed through scroll and text selection
        let lastScrollTime = Date.now();
        let scrollCount = 0;
        
        const handleScroll = () => {
          scrollCount++;
          const now = Date.now();
          const timeDiff = now - lastScrollTime;
          
          if (timeDiff > 1000) {
            const speed = scrollCount / (timeDiff / 1000);
            setCurrentMetrics(prev => ({ ...prev, readingSpeed: speed * 50 }));
            scrollCount = 0;
            lastScrollTime = now;
          }
        };

        document.addEventListener('scroll', handleScroll);
        return () => document.removeEventListener('scroll', handleScroll);
      };

      const trackClickAccuracy = () => {
        let clicks = 0;
        let successfulClicks = 0;
        
        const handleClick = (e: MouseEvent) => {
          clicks++;
          const target = e.target as HTMLElement;
          
          // Check if click was on a meaningful target
          if (target.tagName === 'BUTTON' || target.tagName === 'A' || target.onclick) {
            successfulClicks++;
          }
          
          const accuracy = successfulClicks / clicks;
          setCurrentMetrics(prev => ({ ...prev, clickAccuracy: accuracy }));
        };

        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
      };

      const trackKeyboardUsage = () => {
        let keyPresses = 0;
        let mouseClicks = 0;
        
        const handleKeyPress = () => keyPresses++;
        const handleMouseClick = () => mouseClicks++;
        
        document.addEventListener('keydown', handleKeyPress);
        document.addEventListener('click', handleMouseClick);
        
        const interval = setInterval(() => {
          const total = keyPresses + mouseClicks;
          const keyboardRatio = total > 0 ? keyPresses / total : 0;
          setCurrentMetrics(prev => ({ ...prev, keyboardUsage: keyboardRatio }));
          keyPresses = 0;
          mouseClicks = 0;
        }, 5000);
        
        return () => {
          document.removeEventListener('keydown', handleKeyPress);
          document.removeEventListener('click', handleMouseClick);
          clearInterval(interval);
        };
      };

      const cleanupFunctions = [
        trackReadingSpeed(),
        trackClickAccuracy(),
        trackKeyboardUsage()
      ];

      return () => cleanupFunctions.forEach(cleanup => cleanup());
    };

    const cleanup = monitorBehavior();
    return cleanup;
  }, [enableAutoDetection]);

  // Analyze metrics and detect accessibility needs
  useEffect(() => {
    if (!enableAutoDetection) return;

    const analyzeAccessibilityNeeds = () => {
      const detections: DetectionEvent[] = [];

      // Check for visual impairment indicators
      if (currentMetrics.readingSpeed < 120 || currentMetrics.clickAccuracy < 0.7) {
        detections.push({
          timestamp: new Date().toISOString(),
          trigger: currentMetrics.readingSpeed < 120 ? 'slow-reading' : 'click-difficulty',
          detectedMode: 'visual',
          confidence: Math.max(0.5, 1 - (currentMetrics.readingSpeed / 200)),
          applied: false
        });
      }

      // Check for motor impairment indicators
      if (currentMetrics.keyboardUsage > 0.6 || currentMetrics.clickAccuracy < 0.6) {
        detections.push({
          timestamp: new Date().toISOString(),
          trigger: currentMetrics.keyboardUsage > 0.6 ? 'keyboard-heavy' : 'click-difficulty',
          detectedMode: 'motor',
          confidence: currentMetrics.keyboardUsage,
          applied: false
        });
      }

      // Check for cognitive support needs
      if (currentMetrics.scrollBehavior === 'scattered') {
        detections.push({
          timestamp: new Date().toISOString(),
          trigger: 'focus-issues',
          detectedMode: 'cognitive',
          confidence: 0.7,
          applied: false
        });
      }

      // Process detections
      detections.forEach(detection => {
        if (detection.confidence >= detectionSensitivity) {
          applyAccessibilityMode(detection);
        }
      });
    };

    const analysisInterval = setInterval(analyzeAccessibilityNeeds, 10000);
    return () => clearInterval(analysisInterval);
  }, [currentMetrics, enableAutoDetection, detectionSensitivity]);

  // Apply accessibility mode
  const applyAccessibilityMode = useCallback((detection: DetectionEvent) => {
    if (profile.currentMode === detection.detectedMode) return;

    const newDetection = { ...detection, applied: true };
    setRecentDetection(newDetection);

    setProfile(prev => ({
      ...prev,
      currentMode: detection.detectedMode,
      detectionHistory: [...prev.detectionHistory.slice(-20), newDetection]
    }));

    // Apply adaptations
    const adaptations = ACCESSIBILITY_MODES[detection.detectedMode].adaptations;
    onModeChange?.(detection.detectedMode, adaptations);
    onDetectionEvent?.(newDetection);

    // Update preferences based on mode
    updatePreferencesForMode(detection.detectedMode);
  }, [profile.currentMode, onModeChange, onDetectionEvent]);

  // Update preferences for detected mode
  const updatePreferencesForMode = useCallback((mode: AccessibilityMode) => {
    const modeConfig = ACCESSIBILITY_MODES[mode];
    
    setProfile(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        fontSize: mode === 'visual' || mode === 'comprehensive' ? 20 : 16,
        contrast: mode === 'visual' || mode === 'comprehensive' ? 'high' : 'normal',
        motionReduction: mode === 'visual' || mode === 'motor' || mode === 'comprehensive',
        screenReader: mode === 'visual' || mode === 'comprehensive',
        keyboardNavigation: mode === 'motor' || mode === 'visual' || mode === 'comprehensive',
        voiceControl: mode === 'motor' || mode === 'comprehensive'
      }
    }));
  }, []);

  // Manual mode override
  const setManualMode = useCallback((mode: AccessibilityMode) => {
    if (!allowUserOverride) return;

    const detection: DetectionEvent = {
      timestamp: new Date().toISOString(),
      trigger: 'manual-override',
      detectedMode: mode,
      confidence: 1.0,
      applied: true,
      userFeedback: 'positive'
    };

    setProfile(prev => ({
      ...prev,
      currentMode: mode,
      detectionHistory: [...prev.detectionHistory.slice(-20), detection]
    }));

    const adaptations = ACCESSIBILITY_MODES[mode].adaptations;
    onModeChange?.(mode, adaptations);
    updatePreferencesForMode(mode);
  }, [allowUserOverride, onModeChange, updatePreferencesForMode]);

  // Toggle auto-detection
  const toggleAutoDetection = useCallback(() => {
    setProfile(prev => ({
      ...prev,
      autoSwitchEnabled: !prev.autoSwitchEnabled
    }));
  }, []);

  // Apply CSS adaptations based on preferences
  const applyCSSAdaptations = useMemo(() => {
    const adaptations: React.CSSProperties = {};

    if (profile.preferences.fontSize > 16) {
      adaptations.fontSize = `${profile.preferences.fontSize}px`;
    }

    if (profile.preferences.contrast === 'high') {
      adaptations.filter = 'contrast(1.5)';
    } else if (profile.preferences.contrast === 'low') {
      adaptations.filter = 'contrast(0.8)';
    }

    return adaptations;
  }, [profile.preferences]);

  const currentModeConfig = ACCESSIBILITY_MODES[profile.currentMode];
  const ModeIcon = currentModeConfig.icon;

  return (
    <div className="relative">
      {/* Accessibility Status Indicator */}
      <div 
        className="fixed top-4 left-4 z-50 p-3 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700"
        style={applyCSSAdaptations}
      >
        <div className="flex items-center gap-3">
          <ModeIcon className="h-5 w-5 text-blue-600" />
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {currentModeConfig.name}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              {profile.autoSwitchEnabled ? 'Auto-detecting' : 'Manual mode'}
            </div>
          </div>
          {showControls && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Settings className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Recent Detection Notification */}
      <AnimatePresence>
        {recentDetection && (
          <motion.div
            className="fixed top-20 left-4 z-50 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg shadow-lg border border-blue-200 dark:border-blue-800 max-w-xs"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="flex items-start gap-3">
              <ModeIcon className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Accessibility Mode Updated
                </div>
                <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Switched to {ACCESSIBILITY_MODES[recentDetection.detectedMode].name} mode
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  Confidence: {Math.round(recentDetection.confidence * 100)}%
                </div>
              </div>
              <button
                onClick={() => setRecentDetection(null)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="fixed top-16 left-4 z-50 w-80 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 p-6"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Accessibility Settings
            </h3>

            {/* Mode Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(ACCESSIBILITY_MODES).map(([mode, config]) => {
                  const IconComponent = config.icon;
                  return (
                    <button
                      key={mode}
                      onClick={() => setManualMode(mode as AccessibilityMode)}
                      className={`flex items-center gap-2 p-2 rounded text-xs font-medium transition-colors ${
                        profile.currentMode === mode
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <IconComponent className="h-3 w-3" />
                      {config.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Auto-detection Toggle */}
            <div className="mb-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={profile.autoSwitchEnabled}
                  onChange={toggleAutoDetection}
                  className="rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Enable auto-detection
                </span>
              </label>
            </div>

            {/* Preferences */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Font Size: {profile.preferences.fontSize}px
                </label>
                <input
                  type="range"
                  min="12"
                  max="24"
                  value={profile.preferences.fontSize}
                  onChange={(e) => setProfile(prev => ({
                    ...prev,
                    preferences: {
                      ...prev.preferences,
                      fontSize: parseInt(e.target.value)
                    }
                  }))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Contrast
                </label>
                <div className="flex gap-2">
                  {(['normal', 'high', 'low'] as const).map(contrast => (
                    <button
                      key={contrast}
                      onClick={() => setProfile(prev => ({
                        ...prev,
                        preferences: {
                          ...prev.preferences,
                          contrast
                        }
                      }))}
                      className={`flex-1 p-2 rounded text-xs font-medium transition-colors ${
                        profile.preferences.contrast === contrast
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {contrast}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={profile.preferences.motionReduction}
                    onChange={(e) => setProfile(prev => ({
                      ...prev,
                      preferences: {
                        ...prev.preferences,
                        motionReduction: e.target.checked
                      }
                    }))}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Reduce motion
                  </span>
                </label>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Current Metrics
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Reading: </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {Math.round(currentMetrics.readingSpeed)} wpm
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Accuracy: </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {Math.round(currentMetrics.clickAccuracy * 100)}%
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Keyboard: </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {Math.round(currentMetrics.keyboardUsage * 100)}%
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Scroll: </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {currentMetrics.scrollBehavior}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detection Status */}
      {isDetecting && (
        <div className="fixed bottom-4 left-4 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 text-xs text-green-800 dark:text-green-200">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Monitoring accessibility needs...
          </div>
        </div>
      )}
    </div>
  );
}
