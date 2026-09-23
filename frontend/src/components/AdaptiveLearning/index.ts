// Core Components
export { LearningStyleDetector } from './LearningStyleDetector';
export { DynamicLayoutAdapter } from './DynamicLayoutAdapter';
export { ContentPresentationEngine } from './ContentPresentationEngine';
export { InteractionPatternOptimizer } from './InteractionPatternOptimizer';
export { AccessibilityAutoSwitch } from './AccessibilityAutoSwitch';
export { DifficultyAdjustmentEngine } from './DifficultyAdjustmentEngine';
export { RealTimeAdaptationEngine } from './RealTimeAdaptationEngine';

// Types
export type { LearningStyle } from './LearningStyleDetector';
export type { LayoutConfiguration } from './DynamicLayoutAdapter';
export type { AccessibilityMode } from './AccessibilityAutoSwitch';
export type { DifficultyLevel } from './DifficultyAdjustmentEngine';

// Re-exports for easier importing
export type {
  AdaptationTrigger,
  AdaptationPriority,
  AdaptationEvent,
  AdaptationRule,
  AdaptationContext
} from './RealTimeAdaptationEngine';
