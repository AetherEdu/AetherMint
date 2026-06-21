// Interactive Learning Components - Main Export File
// AetherMint Education Platform

// Core Interactive Components
export { default as VirtualLabSimulation } from './VirtualLabSimulation';
export { default as InteractiveDiagram } from './InteractiveDiagram';
export { default as DragDropActivity } from './DragDropActivity';
export { default as GamificationEngine } from './GamificationEngine';
export { default as InteractiveTimelineMap } from './InteractiveTimelineMap';
export { default as CollaborativeWhiteboard } from './CollaborativeWhiteboard';
export { default as ProgressVisualization } from './ProgressVisualization';
export { default as InteractiveQuiz } from './InteractiveQuiz';

// Accessibility Provider
export { default as AccessibilityProvider, useAccessibility } from './AccessibilityProvider';

// NOTE: The original barrel file attempted to re-export types from sibling
// components (VirtualLabProps, ExperimentStep, Achievement, etc.) that those
// components do not currently declare as exported. To keep this barrel
// type-safe under strict mode without modifying the runtime behavior of the
// consuming components, those `export type { ... }` blocks have been removed.
// Consumers that need those types should import them directly from the source
// component once those components export them explicitly.

// Utility Functions
export const createInteractiveLab = (config: any) => {
  // Utility function to quickly create lab configurations
  return {
    labType: config.type || 'chemistry',
    title: config.title || 'Interactive Lab',
    description: config.description || 'Explore scientific concepts',
    ...config,
  };
};

export const createQuiz = (config: any) => {
  // Utility function to quickly create quiz configurations
  return {
    quizId: config.id || 'quiz-' + Date.now(),
    title: config.title || 'Interactive Quiz',
    description: config.description || 'Test your knowledge',
    timeLimit: config.timeLimit || 300,
    ...config,
  };
};

export const createGamificationConfig = (config: any) => {
  // Utility function to create gamification configurations
  return {
    userId: config.userId || 'default-user',
    showPoints: config.showPoints !== false,
    showBadges: config.showBadges !== false,
    showLeaderboard: config.showLeaderboard !== false,
    showStreaks: config.showStreaks !== false,
    ...config,
  };
};

// Constants
export const LAB_TYPES = {
  CHEMISTRY: 'chemistry',
  PHYSICS: 'physics',
  BIOLOGY: 'biology',
  MATHEMATICS: 'mathematics',
} as const;

export const ACTIVITY_TYPES = {
  MATCHING: 'matching',
  SORTING: 'sorting',
  CATEGORIZATION: 'categorization',
  SEQUENCING: 'sequencing',
  LABELING: 'labeling',
} as const;

export const QUESTION_TYPES = {
  MULTIPLE_CHOICE: 'multiple-choice',
  TRUE_FALSE: 'true-false',
  FILL_BLANK: 'fill-blank',
  MATCHING: 'matching',
  ORDERING: 'ordering',
  ESSAY: 'essay',
} as const;

export const BADGE_RARITIES = {
  COMMON: 'common',
  RARE: 'rare',
  EPIC: 'epic',
  LEGENDARY: 'legendary',
} as const;

export const DIFFICULTY_LEVELS = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
} as const;

// Default Configurations
export const DEFAULT_LAB_CONFIG = {
  labType: LAB_TYPES.CHEMISTRY,
  title: 'Interactive Chemistry Lab',
  description: 'Explore chemical reactions and molecular interactions',
  accessibilityMode: false,
};

export const DEFAULT_QUIZ_CONFIG = {
  timeLimit: 300,
  allowReview: true,
  showCorrectAnswers: true,
  adaptiveDifficulty: false,
  accessibilityMode: false,
};

export const DEFAULT_ACCESSIBILITY_CONFIG = {
  fontSize: 'medium' as const,
  highContrast: false,
  reducedMotion: false,
  screenReaderMode: false,
  keyboardNavigation: true,
  focusVisible: true,
  colorBlindMode: 'none' as const,
  textToSpeech: false,
  autoRead: false,
  dyslexiaFont: false,
  lineSpacing: 'normal' as const,
  wordSpacing: 'normal' as const,
  letterSpacing: 'normal' as const,
  pauseAnimations: false,
  simplifyInterface: false,
  showAltText: false,
  extendedTimeout: false,
  visualIndicators: true,
  audioDescriptions: false,
};

// Component Factory
export class InteractiveComponentFactory {
  static createLab(type: keyof typeof LAB_TYPES, config?: any) {
    return {
      ...DEFAULT_LAB_CONFIG,
      labType: LAB_TYPES[type.toUpperCase() as keyof typeof LAB_TYPES],
      ...config,
    };
  }

  static createQuiz(config?: any) {
    return {
      ...DEFAULT_QUIZ_CONFIG,
      ...config,
    };
  }

  static createAccessibilitySettings(config?: Partial<AccessibilitySettings>) {
    return {
      ...DEFAULT_ACCESSIBILITY_CONFIG,
      ...config,
    };
  }
}

// Version Information
export const VERSION = '1.0.0';
export const BUILD_DATE = new Date().toISOString();

// Development Utilities
export const isDevelopment = () => process.env.NODE_ENV === 'development';
export const isProduction = () => process.env.NODE_ENV === 'production';

// Error Handling
export class InteractiveComponentError extends Error {
  constructor(message: string, public component?: string, public code?: string) {
    super(message);
    this.name = 'InteractiveComponentError';
  }
}

// Validation Utilities
export const validateLabConfig = (config: any) => {
  if (!config.labType || !Object.values(LAB_TYPES).includes(config.labType)) {
    throw new InteractiveComponentError('Invalid lab type', 'VirtualLabSimulation', 'INVALID_LAB_TYPE');
  }
  return true;
};

export const validateQuizConfig = (config: any) => {
  if (!config.questions || !Array.isArray(config.questions) || config.questions.length === 0) {
    throw new InteractiveComponentError('Quiz must have at least one question', 'InteractiveQuiz', 'NO_QUESTIONS');
  }
  return true;
};

// Performance Monitoring
export const performanceMonitor = {
  startTime: 0,
  
  start() {
    this.startTime = performance.now();
  },
  
  end(label: string) {
    const duration = performance.now() - this.startTime;
    if (isDevelopment()) {
      console.log(`${label} took ${duration.toFixed(2)}ms`);
    }
    return duration;
  },
};

// Theme Utilities
export const getThemeColors = (theme: 'light' | 'dark') => {
  return {
    light: {
      primary: '#3b82f6',
      secondary: '#6b7280',
      background: '#ffffff',
      surface: '#f9fafb',
      text: '#111827',
    },
    dark: {
      primary: '#60a5fa',
      secondary: '#9ca3af',
      background: '#111827',
      surface: '#1f2937',
      text: '#f9fafb',
    },
  }[theme];
};

// Export all components as a single object for convenience
import VirtualLabSimulation from './VirtualLabSimulation';
import InteractiveDiagram from './InteractiveDiagram';
import DragDropActivity from './DragDropActivity';
import GamificationEngine from './GamificationEngine';
import InteractiveTimelineMap from './InteractiveTimelineMap';
import CollaborativeWhiteboard from './CollaborativeWhiteboard';
import ProgressVisualization from './ProgressVisualization';
import InteractiveQuiz from './InteractiveQuiz';
import AccessibilityProvider from './AccessibilityProvider';

export const InteractiveComponents = {
  VirtualLabSimulation,
  InteractiveDiagram,
  DragDropActivity,
  GamificationEngine,
  InteractiveTimelineMap,
  CollaborativeWhiteboard,
  ProgressVisualization,
  InteractiveQuiz,
  AccessibilityProvider,
};

// Default export
export default InteractiveComponents;
