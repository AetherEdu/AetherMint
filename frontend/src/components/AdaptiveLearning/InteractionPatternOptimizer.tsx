'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MousePointer, Clock, Target, Zap, Brain, Eye, Hand, Users, TrendingUp } from 'lucide-react';
import { LearningStyle } from './LearningStyleDetector';

export type InteractionType = 
  | 'click' 
  | 'hover' 
  | 'scroll' 
  | 'drag' 
  | 'swipe' 
  | 'pinch' 
  | 'keyboard' 
  | 'voice' 
  | 'gesture';

export type InteractionPattern = {
  type: InteractionType;
  frequency: number;
  duration: number;
  success: number;
  timestamp: number;
  context: string;
  element: string;
  position: { x: number; y: number };
  pressure?: number;
  velocity?: number;
};

export type OptimizationStrategy = 
  | 'speed' 
  | 'accuracy' 
  | 'efficiency' 
  | 'accessibility' 
  | 'engagement';

interface UserInteractionProfile {
  userId: string;
  learningStyle: LearningStyle;
  dominantPatterns: InteractionType[];
  preferredStrategies: OptimizationStrategy[];
  adaptationHistory: AdaptationRecord[];
  performanceMetrics: {
    averageSpeed: number;
    accuracyRate: number;
    errorRate: number;
    engagementScore: number;
    accessibilityScore: number;
  };
  recommendations: InteractionRecommendation[];
}

interface AdaptationRecord {
  timestamp: string;
  trigger: string;
  previousPattern: InteractionType;
  newPattern: InteractionType;
  strategy: OptimizationStrategy;
  performance: number;
  success: boolean;
}

interface InteractionRecommendation {
  type: 'add' | 'modify' | 'remove' | 'enhance';
  element: string;
  interaction: InteractionType;
  strategy: OptimizationStrategy;
  reason: string;
  expectedImprovement: number;
  priority: number;
}

interface InteractionPatternOptimizerProps {
  userId: string;
  learningStyle: LearningStyle;
  onPatternDetected?: (pattern: InteractionPattern) => void;
  onAdaptationApplied?: (adaptation: AdaptationRecord) => void;
  onRecommendationGenerated?: (recommendation: InteractionRecommendation) => void;
  enableRealTimeOptimization?: boolean;
  optimizationSensitivity?: 'low' | 'medium' | 'high';
  trackPerformanceMetrics?: boolean;
}

const INTERACTION_PATTERNS: Record<LearningStyle, {
  preferred: InteractionType[];
  alternatives: InteractionType[];
  strategies: OptimizationStrategy[];
  thresholds: {
    speed: number;
    accuracy: number;
    engagement: number;
  };
}> = {
  visual: {
    preferred: ['click', 'hover', 'drag', 'gesture'],
    alternatives: ['scroll', 'swipe', 'pinch'],
    strategies: ['speed', 'engagement'],
    thresholds: { speed: 0.7, accuracy: 0.8, engagement: 0.8 }
  },
  auditory: {
    preferred: ['click', 'keyboard', 'voice'],
    alternatives: ['hover', 'scroll'],
    strategies: ['accuracy', 'accessibility'],
    thresholds: { speed: 0.6, accuracy: 0.9, engagement: 0.7 }
  },
  reading: {
    preferred: ['scroll', 'click', 'keyboard'],
    alternatives: ['hover', 'drag'],
    strategies: ['accuracy', 'efficiency'],
    thresholds: { speed: 0.5, accuracy: 0.9, engagement: 0.6 }
  },
  kinesthetic: {
    preferred: ['drag', 'gesture', 'swipe', 'pinch', 'hover'],
    alternatives: ['click', 'scroll'],
    strategies: ['engagement', 'speed'],
    thresholds: { speed: 0.8, accuracy: 0.7, engagement: 0.9 }
  },
  social: {
    preferred: ['click', 'hover', 'gesture'],
    alternatives: ['scroll', 'keyboard'],
    strategies: ['engagement', 'accessibility'],
    thresholds: { speed: 0.6, accuracy: 0.8, engagement: 0.9 }
  },
  solitary: {
    preferred: ['click', 'keyboard', 'scroll'],
    alternatives: ['hover'],
    strategies: ['efficiency', 'accuracy'],
    thresholds: { speed: 0.7, accuracy: 0.9, engagement: 0.5 }
  },
  logical: {
    preferred: ['click', 'keyboard', 'drag'],
    alternatives: ['hover', 'scroll'],
    strategies: ['accuracy', 'efficiency'],
    thresholds: { speed: 0.6, accuracy: 0.9, engagement: 0.7 }
  },
  creative: {
    preferred: ['drag', 'gesture', 'swipe', 'hover'],
    alternatives: ['click', 'scroll'],
    strategies: ['engagement', 'speed'],
    thresholds: { speed: 0.8, accuracy: 0.7, engagement: 0.9 }
  }
};

const INTERACTION_ICONS = {
  click: MousePointer,
  hover: Eye,
  scroll: Target,
  drag: Hand,
  swipe: Hand,
  pinch: Hand,
  keyboard: Target,
  voice: Brain,
  gesture: Zap
};

export function InteractionPatternOptimizer({
  userId,
  learningStyle,
  onPatternDetected,
  onAdaptationApplied,
  onRecommendationGenerated,
  enableRealTimeOptimization = true,
  optimizationSensitivity = 'medium',
  trackPerformanceMetrics = true
}: InteractionPatternOptimizerProps) {
  const [interactionHistory, setInteractionHistory] = useState<InteractionPattern[]>([]);
  const [currentProfile, setCurrentProfile] = useState<UserInteractionProfile | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [recommendations, setRecommendations] = useState<InteractionRecommendation[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    averageSpeed: 0,
    accuracyRate: 0,
    errorRate: 0,
    engagementScore: 0,
    accessibilityScore: 0
  });

  // Initialize user profile
  useEffect(() => {
    const profile: UserInteractionProfile = {
      userId,
      learningStyle,
      dominantPatterns: [],
      preferredStrategies: INTERACTION_PATTERNS[learningStyle].strategies,
      adaptationHistory: [],
      performanceMetrics: {
        averageSpeed: 0.5,
        accuracyRate: 0.8,
        errorRate: 0.2,
        engagementScore: 0.7,
        accessibilityScore: 0.8
      },
      recommendations: []
    };
    setCurrentProfile(profile);
  }, [userId, learningStyle]);

  // Track user interactions
  useEffect(() => {
    if (!enableRealTimeOptimization) return;

    const trackInteraction = (event: Event) => {
      const pattern = analyzeInteraction(event);
      if (pattern) {
        setInteractionHistory(prev => [...prev.slice(-100), pattern]);
        onPatternDetected?.(pattern);
        updateProfile(pattern);
      }
    };

    // Event listeners for different interaction types
    const handleClick = (e: MouseEvent) => {
      trackInteraction({
        type: 'click',
        target: e.target,
        clientX: e.clientX,
        clientY: e.clientY,
        timestamp: Date.now()
      } as any);
    };

    const handleMouseMove = (e: MouseEvent) => {
      trackInteraction({
        type: 'hover',
        target: e.target,
        clientX: e.clientX,
        clientY: e.clientY,
        timestamp: Date.now()
      } as any);
    };

    const handleScroll = (e: Event) => {
      trackInteraction({
        type: 'scroll',
        target: e.target,
        timestamp: Date.now()
      } as any);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      trackInteraction({
        type: 'keyboard',
        target: e.target,
        timestamp: Date.now()
      } as any);
    };

    // Add event listeners
    document.addEventListener('click', handleClick);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('scroll', handleScroll);
    document.addEventListener('keydown', handleKeyDown);

    // Touch events for mobile
    let handleTouchStart: ((e: TouchEvent) => void) | undefined;
    if ('ontouchstart' in window) {
      handleTouchStart = (e: TouchEvent) => {
        const touch = e.touches[0];
        if (touch) {
          trackInteraction({
            type: 'gesture',
            target: e.target,
            clientX: touch.clientX,
            clientY: touch.clientY,
            timestamp: Date.now()
          } as any);
        }
      };

      document.addEventListener('touchstart', handleTouchStart);
    }

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('scroll', handleScroll);
      document.removeEventListener('keydown', handleKeyDown);
      if (handleTouchStart) {
        document.removeEventListener('touchstart', handleTouchStart);
      }
    };
  }, [enableRealTimeOptimization, onPatternDetected]);

  // Analyze interaction event
  const analyzeInteraction = useCallback((event: Event): InteractionPattern | null => {
    const element = event.target as HTMLElement;
    const timestamp = Date.now();
    
    let type: InteractionType = 'click';
    let duration = 0;
    let position = { x: 0, y: 0 };

    // Determine interaction type and properties
    if (event instanceof MouseEvent) {
      type = event.type === 'click' ? 'click' : event.type === 'mousemove' ? 'hover' : 'click';
      position = { x: event.clientX, y: event.clientY };
    } else if (event instanceof KeyboardEvent) {
      type = 'keyboard';
    } else if (event instanceof TouchEvent) {
      type = 'gesture';
      const touch = event.touches[0];
      if (touch) {
        position = { x: touch.clientX, y: touch.clientY };
      }
    }

    // Calculate duration (simplified - would need start/end tracking in real implementation)
    duration = Math.random() * 2000 + 500; // Mock duration

    // Determine context and element
    const context = getElementContext(element);
    const elementTag = element.tagName.toLowerCase();
    const elementClass = element.className;

    // Calculate success based on recent performance
    const success = calculateInteractionSuccess(type, context, performanceMetrics);

    return {
      type,
      frequency: 1, // Will be calculated from history
      duration,
      success,
      timestamp,
      context,
      element: elementTag,
      position,
      pressure: 0.5, // Mock pressure
      velocity: 0.5  // Mock velocity
    };
  }, [performanceMetrics]);

  const getElementContext = (element: HTMLElement): string => {
    const className = element.className;
    const id = element.id;
    const tagName = element.tagName.toLowerCase();

    if (className.includes('button') || tagName === 'button') return 'button';
    if (className.includes('link') || tagName === 'a') return 'link';
    if (className.includes('input') || tagName === 'input') return 'input';
    if (className.includes('video') || tagName === 'video') return 'media';
    if (className.includes('image') || tagName === 'img') return 'media';
    if (className.includes('text') || tagName === 'p' || tagName === 'span') return 'text';
    if (className.includes('interactive')) return 'interactive';
    if (className.includes('navigation')) return 'navigation';
    
    return 'general';
  };

  const calculateInteractionSuccess = (
    type: InteractionType, 
    context: string, 
    metrics: typeof performanceMetrics
  ): number => {
    // Base success rate
    let success = 0.8;

    // Adjust based on interaction type and performance
    if (metrics.accuracyRate < 0.7) success -= 0.2;
    if (metrics.errorRate > 0.3) success -= 0.3;
    if (metrics.engagementScore < 0.5) success -= 0.1;

    // Context-specific adjustments
    if (context === 'button' && type === 'click') success += 0.1;
    if (context === 'input' && type === 'keyboard') success += 0.1;
    if (context === 'media' && type === 'gesture') success += 0.1;

    return Math.max(0, Math.min(1, success));
  };

  // Update user profile based on new interaction
  const updateProfile = useCallback((pattern: InteractionPattern) => {
    if (!currentProfile) return;

    // Update interaction history
    const newHistory = [...currentProfile.adaptationHistory.slice(-20)];
    
    // Analyze patterns and update dominant interactions
    const patternFrequency = interactionHistory.reduce((acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + 1;
      return acc;
    }, {} as Record<InteractionType, number>);

    const dominantPatterns = Object.entries(patternFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([type]) => type as InteractionType);

    // Update performance metrics
    const newMetrics = {
      averageSpeed: (performanceMetrics.averageSpeed * 0.9 + (pattern.duration / 2000) * 0.1),
      accuracyRate: (performanceMetrics.accuracyRate * 0.9 + pattern.success * 0.1),
      errorRate: (performanceMetrics.errorRate * 0.9 + (1 - pattern.success) * 0.1),
      engagementScore: Math.min(1, performanceMetrics.engagementScore + 0.01),
      accessibilityScore: performanceMetrics.accessibilityScore
    };

    setCurrentProfile({
      ...currentProfile,
      dominantPatterns,
      adaptationHistory: newHistory,
      performanceMetrics: newMetrics
    });

    setPerformanceMetrics(newMetrics);

    // Check if optimization is needed
    checkOptimizationNeeds(pattern, newMetrics);
  }, [currentProfile, interactionHistory, performanceMetrics]);

  // Check if optimization is needed
  const checkOptimizationNeeds = useCallback((pattern: InteractionPattern, metrics: typeof performanceMetrics) => {
    if (!currentProfile) return;

    const thresholds = INTERACTION_PATTERNS[currentProfile.learningStyle].thresholds;
    const needsOptimization = 
      metrics.averageSpeed < thresholds.speed ||
      metrics.accuracyRate < thresholds.accuracy ||
      metrics.engagementScore < thresholds.engagement;

    if (needsOptimization) {
      generateOptimizationRecommendations(pattern, metrics);
    }
  }, [currentProfile]);

  // Generate optimization recommendations
  const generateOptimizationRecommendations = useCallback((
    pattern: InteractionPattern, 
    metrics: typeof performanceMetrics
  ) => {
    const recommendations: InteractionRecommendation[] = [];

    // Analyze current performance and generate recommendations
    if (metrics.accuracyRate < 0.7) {
      recommendations.push({
        type: 'enhance',
        element: pattern.element,
        interaction: pattern.type,
        strategy: 'accuracy',
        reason: 'Low accuracy rate detected',
        expectedImprovement: 0.2,
        priority: 1
      });
    }

    if (metrics.averageSpeed < 0.6) {
      recommendations.push({
        type: 'enhance',
        element: pattern.element,
        interaction: pattern.type,
        strategy: 'speed',
        reason: 'Slow interaction speed detected',
        expectedImprovement: 0.3,
        priority: 2
      });
    }

    if (metrics.engagementScore < 0.5) {
      recommendations.push({
        type: 'add',
        element: pattern.element,
        interaction: 'hover',
        strategy: 'engagement',
        reason: 'Low engagement detected',
        expectedImprovement: 0.25,
        priority: 2
      });
    }

    setRecommendations(recommendations);
    recommendations.forEach((recommendation) =>
      onRecommendationGenerated?.(recommendation)
    );
  }, [onRecommendationGenerated]);

  // Apply optimization
  const applyOptimization = useCallback((recommendation: InteractionRecommendation) => {
    setIsOptimizing(true);

    const adaptation: AdaptationRecord = {
      timestamp: new Date().toISOString(),
      trigger: 'performance-optimization',
      previousPattern: 'click', // Would be determined from context
      newPattern: recommendation.interaction,
      strategy: recommendation.strategy,
      performance: recommendation.expectedImprovement,
      success: true
    };

    if (currentProfile) {
      setCurrentProfile({
        ...currentProfile,
        adaptationHistory: [...currentProfile.adaptationHistory, adaptation]
      });
    }

    onAdaptationApplied?.(adaptation);

    setTimeout(() => {
      setIsOptimizing(false);
    }, 1000);
  }, [currentProfile, onAdaptationApplied]);

  // Get interaction statistics
  const getInteractionStats = useMemo(() => {
    if (interactionHistory.length === 0) return null;

    const stats = {
      total: interactionHistory.length,
      byType: {} as Record<InteractionType, number>,
      averageDuration: 0,
      averageSuccess: 0,
      mostFrequent: null as InteractionType | null
    };

    let totalDuration = 0;
    let totalSuccess = 0;

    interactionHistory.forEach(pattern => {
      stats.byType[pattern.type] = (stats.byType[pattern.type] || 0) + 1;
      totalDuration += pattern.duration;
      totalSuccess += pattern.success;
    });

    stats.averageDuration = totalDuration / interactionHistory.length;
    stats.averageSuccess = totalSuccess / interactionHistory.length;

    // Find most frequent interaction type
    const mostFrequent = Object.entries(stats.byType)
      .sort(([, a], [, b]) => b - a)[0];
    if (mostFrequent) {
      stats.mostFrequent = mostFrequent[0] as InteractionType;
    }

    return stats;
  }, [interactionHistory]);

  if (!currentProfile) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-2">Analyzing interaction patterns...</p>
      </div>
    );
  }

  const stats = getInteractionStats;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-gray-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Interaction Pattern Optimizer
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isOptimizing ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {isOptimizing ? 'Optimizing' : 'Monitoring'}
          </span>
        </div>
      </div>

      {/* Learning Style Info */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
            Learning Style:
          </span>
          <span className="text-sm font-bold text-blue-900 dark:text-blue-100 capitalize">
            {currentProfile.learningStyle}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {INTERACTION_PATTERNS[currentProfile.learningStyle].preferred.map(type => {
            const IconComponent = INTERACTION_ICONS[type];
            return (
              <div key={type} className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 rounded text-xs">
                <IconComponent className="h-3 w-3 text-blue-600" />
                <span className="capitalize">{type}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Performance Metrics</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {Math.round(performanceMetrics.accuracyRate * 100)}%
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Accuracy</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {Math.round(performanceMetrics.averageSpeed * 100)}%
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Speed</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {Math.round(performanceMetrics.engagementScore * 100)}%
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Engagement</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {Math.round((1 - performanceMetrics.errorRate) * 100)}%
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Success</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {Math.round(performanceMetrics.accessibilityScore * 100)}%
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Accessibility</div>
          </div>
        </div>
      </div>

      {/* Interaction Statistics */}
      {stats && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Interaction Statistics</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {stats.total}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Total Interactions</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {stats.mostFrequent ? stats.mostFrequent : 'N/A'}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Most Frequent</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {Math.round(stats.averageDuration)}ms
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Avg Duration</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {Math.round(stats.averageSuccess * 100)}%
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Success Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Optimization Recommendations
          </h4>
          <div className="space-y-2">
            {recommendations.slice(0, 3).map((rec, index) => (
              <motion.div
                key={index}
                className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      {rec.reason}
                    </span>
                  </div>
                  <button
                    onClick={() => applyOptimization(rec)}
                    className="px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700 transition-colors"
                  >
                    Apply
                  </button>
                </div>
                <div className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  Expected improvement: +{Math.round(rec.expectedImprovement * 100)}%
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Optimization Status */}
      {isOptimizing && (
        <motion.div
          className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-green-600 animate-pulse" />
            <span className="text-green-800 dark:text-green-200">
              Applying optimizations to improve your learning experience...
            </span>
          </div>
        </motion.div>
      )}

      {/* Adaptation History */}
      {currentProfile.adaptationHistory.length > 0 && (
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Recent Adaptations
          </h4>
          <div className="space-y-2">
            {currentProfile.adaptationHistory.slice(-3).reverse().map((adaptation, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-400">
                    {new Date(adaptation.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="text-gray-900 dark:text-white capitalize">
                    {adaptation.strategy} optimization
                  </span>
                </div>
                <div className={`px-2 py-1 rounded text-xs ${
                  adaptation.success 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {adaptation.success ? 'Success' : 'Failed'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
