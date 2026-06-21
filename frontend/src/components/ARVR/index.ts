// AR/VR Components — barrel re-exports
//
// The original barrel attempted to re-export many internal types
// (XRDevice, XRController, XRHand, XRSession, XRSettings, ModelInfo,
//  ModelViewerSettings, PerformanceStats, UserAvatar, ClassroomEnvironment,
//  ClassroomSession, etc.) that the sibling components define as private
// interfaces (not exported) or do not declare at all. To keep this barrel
// type-safe under strict mode the type re-export statements have been
// removed. The runtime component re-exports are preserved.

export { WebXREngine } from './WebXREngine';
export { ModelViewer } from './ModelViewer';
export { VirtualClassroom } from './VirtualClassroom';
export { InteractiveSimulation } from './InteractiveSimulation';
export { GestureControls } from './GestureControls';
export { PerformanceOptimizer } from './PerformanceOptimizer';
