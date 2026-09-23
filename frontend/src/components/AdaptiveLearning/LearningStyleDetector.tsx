'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Brain, Eye, Ear, Hand, Users, BookOpen, Zap, Target } from 'lucide-react';

// Learning style types based on VARK + additional modern learning patterns
export type LearningStyle = 
  | 'visual' 
  | 'auditory' 
  | 'reading' 
  | 'kinesthetic' 
  | 'social' 
  | 'solitary' 
  | 'logical' 
  | 'creative';

interface LearningStyleProfile {
  primary: LearningStyle;
  secondary: LearningStyle;
  tertiary: LearningStyle;
  scores: Record<LearningStyle, number>;
  confidence: number;
  lastUpdated: string;
  adaptationHistory: AdaptationEvent[];
}

interface AdaptationEvent {
  timestamp: string;
  type: 'layout' | 'content' | 'interaction' | 'accessibility';
  trigger: string;
  previousStyle: LearningStyle;
  newStyle: LearningStyle;
  performance: number;
}

interface InteractionData {
  type: 'click' | 'hover' | 'scroll' | 'read' | 'watch' | 'listen' | 'type' | 'drag';
  duration: number;
  element: string;
  context: string;
  timestamp: string;
  success?: boolean;
}

interface LearningStyleDetectorProps {
  userId: string;
  onStyleUpdate?: (profile: LearningStyleProfile) => void;
  onAdaptationTriggered?: (event: AdaptationEvent) => void;
  enableRealTimeDetection?: boolean;
  detectionSensitivity?: 'low' | 'medium' | 'high';
}

const LEARNING_STYLE_PATTERNS = {
  visual: {
    indicators: ['image-view', 'diagram-interaction', 'color-preference', 'spatial-reasoning'],
    contentPreference: ['infographics', 'videos', 'diagrams', 'charts'],
    layoutPreference: 'grid',
    interactionPattern: 'visual-exploration'
  },
  auditory: {
    indicators: ['audio-play', 'podcast-listen', 'verbal-instruction', 'discussion-participate'],
    contentPreference: ['podcasts', 'audio-lectures', 'discussions', 'verbal-explanations'],
    layoutPreference: 'linear',
    interactionPattern: 'sequential-learning'
  },
  reading: {
    indicators: ['text-read', 'note-taking', 'documentation-browse', 'article-focus'],
    contentPreference: ['articles', 'books', 'documentation', 'written-tutorials'],
    layoutPreference: 'text-focused',
    interactionPattern: 'detailed-reading'
  },
  kinesthetic: {
    indicators: ['drag-drop', 'simulation-interact', 'hands-on-activity', 'gesture-use'],
    contentPreference: ['simulations', 'interactive-labs', 'hands-on-projects', 'exercises'],
    layoutPreference: 'interactive',
    interactionPattern: 'experiential-learning'
  },
  social: {
    indicators: ['group-work', 'discussion', 'peer-help', 'collaboration'],
    contentPreference: ['group-projects', 'discussions', 'peer-review', 'study-groups'],
    layoutPreference: 'collaborative',
    interactionPattern: 'social-learning'
  },
  solitary: {
    indicators: ['solo-focus', 'self-study', 'independent-work', 'reflection'],
    contentPreference: ['self-paced', 'individual-projects', 'research', 'deep-dive'],
    layoutPreference: 'minimalist',
    interactionPattern: 'independent-learning'
  },
  logical: {
    indicators: ['pattern-recognition', 'problem-solving', 'algorithm-thinking', 'system-analysis'],
    contentPreference: ['problem-sets', 'algorithms', 'system-design', 'logical-puzzles'],
    layoutPreference: 'structured',
    interactionPattern: 'analytical-learning'
  },
  creative: {
    indicators: ['brainstorming', 'design-thinking', 'artistic-expression', 'innovation'],
    contentPreference: ['creative-projects', 'design-challenges', 'brainstorming', 'innovation-tasks'],
    layoutPreference: 'flexible',
    interactionPattern: 'creative-exploration'
  }
};

const LEARNING_STYLE_ICONS = {
  visual: Eye,
  auditory: Ear,
  reading: BookOpen,
  kinesthetic: Hand,
  social: Users,
  solitary: Target,
  logical: Brain,
  creative: Zap
};

export function LearningStyleDetector({
  userId,
  onStyleUpdate,
  onAdaptationTriggered,
  enableRealTimeDetection = true,
  detectionSensitivity = 'medium'
}: LearningStyleDetectorProps) {
  const [interactionData, setInteractionData] = useState<InteractionData[]>([]);
  const [currentProfile, setCurrentProfile] = useState<LearningStyleProfile | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionProgress, setDetectionProgress] = useState(0);

  // Initialize or load existing profile
  useEffect(() => {
    loadExistingProfile();
    if (enableRealTimeDetection) {
      startInteractionTracking();
    }
  }, [userId, enableRealTimeDetection]);

  const loadExistingProfile = async () => {
    try {
      const response = await fetch(`/api/learning-style/${userId}`);
      if (response.ok) {
        const profile = await response.json();
        setCurrentProfile(profile);
        onStyleUpdate?.(profile);
      }
    } catch (error) {
      console.error('Failed to load learning style profile:', error);
      initializeDefaultProfile();
    }
  };

  const initializeDefaultProfile = () => {
    const defaultProfile: LearningStyleProfile = {
      primary: 'visual',
      secondary: 'reading',
      tertiary: 'auditory',
      scores: {
        visual: 25,
        auditory: 20,
        reading: 22,
        kinesthetic: 18,
        social: 15,
        solitary: 20,
        logical: 18,
        creative: 12
      },
      confidence: 0.3,
      lastUpdated: new Date().toISOString(),
      adaptationHistory: []
    };
    setCurrentProfile(defaultProfile);
  };

  const startInteractionTracking = () => {
    setIsDetecting(true);
    
    // Track various user interactions
    const trackInteraction = (event: Event) => {
      const interaction: InteractionData = {
        type: getInteractionType(event),
        duration: 0, // Will be updated on interaction end
        element: (event.target as HTMLElement)?.tagName || 'unknown',
        context: getElementContext(event.target as HTMLElement),
        timestamp: new Date().toISOString()
      };
      
      setInteractionData(prev => [...prev.slice(-100), interaction]); // Keep last 100 interactions
    };

    // Track reading behavior
    const trackReading = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().length > 10) {
        const interaction: InteractionData = {
          type: 'read',
          duration: selection.toString().length * 50, // Estimate reading time
          element: 'text',
          context: 'content-reading',
          timestamp: new Date().toISOString(),
          success: true
        };
        setInteractionData(prev => [...prev.slice(-100), interaction]);
      }
    };

    // Event listeners
    document.addEventListener('click', trackInteraction);
    document.addEventListener('dblclick', trackInteraction);
    document.addEventListener('scroll', trackInteraction);
    document.addEventListener('selectionchange', trackReading);

    return () => {
      document.removeEventListener('click', trackInteraction);
      document.removeEventListener('dblclick', trackInteraction);
      document.removeEventListener('scroll', trackInteraction);
      document.removeEventListener('selectionchange', trackReading);
    };
  };

  const getInteractionType = (event: Event): InteractionData['type'] => {
    if (event.type === 'click') return 'click';
    if (event.type === 'dblclick') return 'click';
    if (event.type === 'scroll') return 'scroll';
    if (event instanceof KeyboardEvent) return 'type';
    if (event instanceof MouseEvent && event.type === 'mousemove') return 'hover';
    return 'click';
  };

  const getElementContext = (element: HTMLElement): string => {
    const className = element.className;
    const id = element.id;
    const tagName = element.tagName.toLowerCase();
    
    // Analyze element to determine learning context
    if (className.includes('video') || tagName === 'video') return 'video-content';
    if (className.includes('audio') || tagName === 'audio') return 'audio-content';
    if (className.includes('image') || tagName === 'img') return 'visual-content';
    if (className.includes('text') || tagName === 'p' || tagName === 'article') return 'text-content';
    if (className.includes('interactive') || className.includes('simulation')) return 'interactive-content';
    if (className.includes('discussion') || className.includes('comment')) return 'social-content';
    
    return 'general-content';
  };

  // Analyze interaction patterns to detect learning style
  const analyzeLearningStyle = useCallback(() => {
    if (interactionData.length < 10) return currentProfile;

    const scores: Record<LearningStyle, number> = {
      visual: 0,
      auditory: 0,
      reading: 0,
      kinesthetic: 0,
      social: 0,
      solitary: 0,
      logical: 0,
      creative: 0
    };

    // Analyze interaction patterns
    interactionData.forEach(interaction => {
      const { type, context, duration } = interaction;
      
      // Visual indicators
      if (context.includes('visual') || context.includes('image') || context.includes('diagram')) {
        scores.visual += duration > 1000 ? 2 : 1;
      }
      
      // Auditory indicators
      if (context.includes('audio') || context.includes('video') || context.includes('podcast')) {
        scores.auditory += duration > 5000 ? 3 : 1;
      }
      
      // Reading indicators
      if (type === 'read' || context.includes('text') || context.includes('article')) {
        scores.reading += duration > 2000 ? 2 : 1;
      }
      
      // Kinesthetic indicators
      if (type === 'drag' || context.includes('interactive') || context.includes('simulation')) {
        scores.kinesthetic += duration > 3000 ? 3 : 1;
      }
      
      // Social indicators
      if (context.includes('discussion') || context.includes('comment') || context.includes('group')) {
        scores.social += duration > 2000 ? 2 : 1;
      }
      
      // Solitary indicators
      if (interactionData.filter(i => 
        i.timestamp === interaction.timestamp && 
        i.context.includes('solo') || i.context.includes('individual')
      ).length > 0) {
        scores.solitary += 1;
      }
      
      // Logical indicators
      if (context.includes('problem') || context.includes('algorithm') || context.includes('logic')) {
        scores.logical += duration > 4000 ? 3 : 1;
      }
      
      // Creative indicators
      if (context.includes('creative') || context.includes('design') || context.includes('brainstorm')) {
        scores.creative += duration > 3000 ? 2 : 1;
      }
    });

    // Normalize scores
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
    const normalizedScores = Object.keys(scores).reduce((acc, key) => {
      acc[key as LearningStyle] = totalScore > 0 ? (scores[key as LearningStyle] / totalScore) * 100 : 0;
      return acc;
    }, {} as Record<LearningStyle, number>);

    // Sort and determine primary, secondary, tertiary
    const sortedStyles = Object.entries(normalizedScores)
      .sort(([, a], [, b]) => b - a)
      .map(([style]) => style as LearningStyle);

    const newProfile: LearningStyleProfile = {
      primary: sortedStyles[0] || 'visual',
      secondary: sortedStyles[1] || 'reading',
      tertiary: sortedStyles[2] || 'auditory',
      scores: normalizedScores,
      confidence: Math.min(interactionData.length / 50, 1), // Confidence based on data amount
      lastUpdated: new Date().toISOString(),
      adaptationHistory: currentProfile?.adaptationHistory || []
    };

    return newProfile;
  }, [interactionData, currentProfile]);

  // Trigger adaptation when learning style changes significantly
  const triggerAdaptation = useCallback((newProfile: LearningStyleProfile) => {
    if (!currentProfile) return;

    const significantChange = Math.abs(newProfile.scores[newProfile.primary] - currentProfile.scores[currentProfile.primary]) > 15;
    
    if (significantChange && onAdaptationTriggered) {
      const adaptationEvent: AdaptationEvent = {
        timestamp: new Date().toISOString(),
        type: 'layout',
        trigger: 'learning-style-change',
        previousStyle: currentProfile.primary,
        newStyle: newProfile.primary,
        performance: calculatePerformanceScore(newProfile)
      };

      onAdaptationTriggered(adaptationEvent);
    }
  }, [currentProfile, onAdaptationTriggered]);

  const calculatePerformanceScore = (profile: LearningStyleProfile): number => {
    // Calculate performance based on confidence and score distribution
    const maxScore = Math.max(...Object.values(profile.scores));
    const scoreVariance = Object.values(profile.scores).reduce((sum, score) => sum + Math.pow(score - maxScore, 2), 0) / 8;
    return (maxScore * profile.confidence) - (scoreVariance * 0.1);
  };

  // Periodic analysis and adaptation
  useEffect(() => {
    if (!enableRealTimeDetection) return;

    const analysisInterval = setInterval(() => {
      const newProfile = analyzeLearningStyle();
      if (newProfile) {
        setCurrentProfile(newProfile);
        onStyleUpdate?.(newProfile);
        triggerAdaptation(newProfile);
        setDetectionProgress(prev => Math.min(prev + 10, 100));
      }
    }, 5000); // Analyze every 5 seconds

    return () => clearInterval(analysisInterval);
  }, [enableRealTimeDetection, analyzeLearningStyle, onStyleUpdate, triggerAdaptation]);

  const getStyleColor = (style: LearningStyle): string => {
    const colors = {
      visual: 'text-blue-600',
      auditory: 'text-green-600',
      reading: 'text-purple-600',
      kinesthetic: 'text-orange-600',
      social: 'text-pink-600',
      solitary: 'text-gray-600',
      logical: 'text-indigo-600',
      creative: 'text-red-600'
    };
    return colors[style];
  };

  if (!currentProfile) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-2">Analyzing learning patterns...</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-gray-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Learning Style Profile
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isDetecting ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {isDetecting ? 'Detecting' : 'Idle'}
          </span>
        </div>
      </div>

      {/* Primary Learning Styles */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { style: currentProfile.primary, label: 'Primary', score: currentProfile.scores[currentProfile.primary] },
          { style: currentProfile.secondary, label: 'Secondary', score: currentProfile.scores[currentProfile.secondary] },
          { style: currentProfile.tertiary, label: 'Tertiary', score: currentProfile.scores[currentProfile.tertiary] }
        ].map(({ style, label, score }) => {
          const IconComponent = LEARNING_STYLE_ICONS[style];
          return (
            <motion.div
              key={label}
              className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: label === 'Primary' ? 0 : 0.1 }}
            >
              <IconComponent className={`h-8 w-8 mx-auto mb-2 ${getStyleColor(style)}`} />
              <div className="font-medium text-gray-900 dark:text-white">{label}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400 capitalize">{style}</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                {Math.round(score)}%
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* All Learning Styles Progress */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Complete Profile</h4>
        {Object.entries(currentProfile.scores).map(([style, score]) => {
          const IconComponent = LEARNING_STYLE_ICONS[style as LearningStyle];
          return (
            <div key={style} className="flex items-center gap-3">
              <IconComponent className={`h-4 w-4 ${getStyleColor(style as LearningStyle)}`} />
              <span className="text-sm text-gray-700 dark:text-gray-300 capitalize w-20">
                {style}
              </span>
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <motion.div
                  className={`h-2 rounded-full bg-gradient-to-r ${getStyleColor(style as LearningStyle).replace('text-', 'from-').replace('-600', '-400 to-').replace('-600', '-600')}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${score}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400 w-12 text-right">
                {Math.round(score)}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Confidence and Stats */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <div>
            <span className="text-gray-600 dark:text-gray-400">Confidence: </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {Math.round(currentProfile.confidence * 100)}%
            </span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Data Points: </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {interactionData.length}
            </span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Last Updated: </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {new Date(currentProfile.lastUpdated).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>

      {/* Detection Progress */}
      {isDetecting && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600 dark:text-gray-400">Detection Progress</span>
            <span className="text-gray-900 dark:text-white">{detectionProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <motion.div
              className="h-2 bg-blue-600 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${detectionProgress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
