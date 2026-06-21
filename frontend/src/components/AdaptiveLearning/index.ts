// AdaptiveLearning Components — barrel
//
// The source components declare named exports (`export function RealTimeAdaptationEngine`,
// etc.), so this barrel re-exports them by name rather than via `default`.
// Removed `export type { ... }` entries for types that the component
// sources do not declare (`LayoutConfiguration`, `AdaptationEvent`,
// `AdaptationRule`, `AdaptationContext`) and omitted the missing
// `./SocialSharing` re-export.

export { RealTimeAdaptationEngine } from './RealTimeAdaptationEngine';
export { DynamicLayoutAdapter } from './DynamicLayoutAdapter';
export { InteractionPatternOptimizer } from './InteractionPatternOptimizer';
export { LearningStyleDetector } from './LearningStyleDetector';
export { AccessibilityAutoSwitch } from './AccessibilityAutoSwitch';
