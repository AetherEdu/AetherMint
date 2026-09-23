/**
 * Nanotechnology Learning System Type Definitions
 * Defines all types for the nanotech learning platform
 */

/**
 * Neural Pattern - Represents brain activity patterns
 */
export interface NeuralPattern {
  id: string;
  timestamp: number;
  userId: string;
  
  // Neural activity
  neuronActivation: number[]; // 0-1 for each neuron
  synapseStrength: Record<string, number>; // Connection strengths
  brainWaveFrequency: {
    delta: number;    // 0.5-4 Hz (sleep)
    theta: number;    // 4-8 Hz (meditation)
    alpha: number;    // 8-12 Hz (relaxed)
    beta: number;     // 12-30 Hz (focused)
    gamma: number;    // 30+ Hz (insight)
  };
  
  // Cognitive state
  focusLevel: number;           // 0-100
  memoryCapacity: number;       // 0-100
  learningVelocity: number;     // Learning speed multiplier
  neuroplasticity: number;      // 0-100 (brain adaptability)
  
  // Pattern analysis
  patternHash: string;
  dominantFrequency: string;    // Which brain wave is strongest
  learningReadiness: number;    // 0-100 (how ready to learn)
}

/**
 * Nanobot - Individual nanobot entity
 */
export interface Nanobot {
  id: string;
  swarmId: string;
  
  // Status
  status: 'idle' | 'active' | 'transferring' | 'resting' | 'errored';
  healthLevel: number;          // 0-100
  energyLevel: number;          // 0-100
  
  // Mission
  currentMission: string;
  targetNeuron: number;         // Target neuron index
  knowledgeFragments: string[]; // Knowledge being transferred
  transferProgress: number;     // 0-100
  
  // Metadata
  createdAt: number;
  lastActivityAt: number;
  tasksCompleted: number;
  errorCount: number;
}

/**
 * Nanobot Swarm - Coordinated group of nanobots
 */
export interface NanobotSwarm {
  id: string;
  userId: string;
  skillTargetId: string;
  
  // Swarm state
  nanobots: Nanobot[];
  totalCount: number;
  activeCount: number;
  
  // Coordination
  coordinationStrategy: 'particle-swarm' | 'genetic-algorithm' | 'ant-colony';
  cohesion: number;             // 0-1 (swarm cohesion)
  efficiency: number;           // 0-1 (mission efficiency)
  
  // Mission status
  missionProgress: number;      // 0-100
  estimatedCompletion: number;  // ms remaining
  knowledgeTransferred: number; // 0-100
  
  // Metadata
  deployedAt: number;
  estimatedReturnAt: number;
  safetyStatus: 'safe' | 'warning' | 'critical';
}

/**
 * Encoded Knowledge - Compressed knowledge for transfer
 */
export interface EncodedKnowledge {
  id: string;
  skillId: string;
  
  // Encoding
  originalSize: number;         // Bytes
  compressedSize: number;       // Bytes
  compressionRatio: number;     // 0-1
  algorithm: 'heuristic' | 'neural' | 'semantic';
  
  // Knowledge structure
  concepts: {
    id: string;
    name: string;
    importance: number;        // 0-1
    prerequisites: string[];
    relatedConcepts: string[];
  }[];
  
  // Transfer properties
  requiredBandwidth: number;    // bits/second
  estimatedTransferTime: number; // ms at 100x speed
  fragmentSize: number;         // bytes per fragment
  
  // Verification
  checksum: string;
  contentHash: string;
  verified: boolean;
}

/**
 * Skill - Learnable skill through nanotechnology
 */
export interface Skill {
  id: string;
  name: string;
  category: 'technical' | 'cognitive' | 'motor' | 'creative';
  
  // Difficulty
  difficulty: 1 | 2 | 3 | 4 | 5;
  prerequisiteSkills: string[];
  estimatedLearningTime: number; // ms at 1x speed
  
  // Encoded knowledge
  knowledgeBlocks: EncodedKnowledge[];
  totalKnowledge: number;       // Total bytes to transfer
  
  // Verification
  testQuestions: {
    id: string;
    question: string;
    correctAnswer: string;
    difficulty: number;
  }[];
  masteryThreshold: number;     // Required % to master
}

/**
 * Skill Trackins - User's skill acquisition progress
 */
export interface SkillTracking {
  userId: string;
  skillId: string;
  
  // Progress
  acquisitionProgress: number;  // 0-100
  masteryLevel: number;         // 0-100
  proficiency: number;          // 0-1
  
  // Performance
  testsPassed: number;
  testsFailed: number;
  averageScore: number;
  
  // Learning metrics
  currentNanobotSwarmId?: string;
  transferStartedAt?: number;
  transferCompletedAt?: number;
  neuroplasticityGain: number;  // How much brain adapted
  
  // Verification
  verified: boolean;
  verificationDate?: number;
  certificateId?: string;
}

/**
 * Learning Profile - Personalized learning configuration
 */
export interface LearningProfile {
  userId: string;
  
  // Neural characteristics
  dominantLearningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading-writing';
  averageNeuroplasticity: number;
  baselineNeuralPattern: NeuralPattern;
  
  // Performance
  averageLearningVelocity: number; // Speed multiplier
  retentionRate: number;        // 0-1 (knowledge retention)
  skillMasteryRate: number;     // Skills mastered per sesion
  
  // Preferences
  preferredSwarmSize: number;
  preferredTransferSpeed: 'slow' | 'moderate' | 'fast' | 'maximum';
  sessionDuration: number;      // minutes
  
  // History
  totalSkillsAcquired: number;
  totalTransferTime: number;
  successRate: number;
  
  // Recommendations
  recommendedNextSkills: string[];
  estimatedTimeForMastery: Record<string, number>;
}

/**
 * Safety Status - Bio-safety monitoring
 */
export interface SafetyStatus {
  swarmId: string;
  timestamp: number;
  
  // Health metrics
  neurotoxicity: number;        // 0-100 (lower is safer)
  inflammationLevel: number;    // 0-100
  immuneResponse: number;       // 0-100 (immune system activity)
  
  // Containment
  nanobotContainment: number;   // 0-100 (% contained)
  escapeDetections: number;     // Number of nanobots escaped
  recoverySuccessRate: number;  // Recovery % of escaped nanobots
  
  // System integrity
  systemIntegrity: number;      // 0-100
  errorRate: number;
  
  // Overall status
  overallSafetyScore: number;   // 0-100
  status: 'safe' | 'caution' | 'critical';
  recommendations: string[];
}

/**
 * Learning Session - Single learning session
 */
export interface LearningSession {
  id: string;
  userId: string;
  skillId: string;
  
  // Session timing
  startedAt: number;
  completedAt?: number;
  duration?: number;
  
  // Neural data
  initialNeuralPattern: NeuralPattern;
  finalNeuralPattern?: NeuralPattern;
  neuroplasticityGain?: number;
  
  // Nanobot data
  nanobotSwarmId: string;
  knowledgeTransferred: number;
  transferSpeed: number;        // Multiplier of normal speed
  
  // Results
  skillProgress: number;        // 0-100
  testScore?: number;
  successStatus: 'pending' | 'success' | 'partial' | 'failed';
  
  // Safety
  safetyStatus: SafetyStatus;
  incidents: string[];
}

/**
 * Configuration for nanotechnology learning
 */
export interface NanotechLearningConfig {
  // Transfer settings
  maxTransferSpeed: number;     // Multiplier (1 = normal speed)
  defaultSwarmSize: number;
  nanobotDensity: number;       // Nanobots per neuron
  
  // Safety thresholds
  maxNeurotoxicity: number;     // 0-100
  maxInflammation: number;      // 0-100
  emergencyShutdownThreshold: number;
  
  // Learning settings
  enableAdaptiveSpeed: boolean;
  minNeuroplasticity: number;   // Min required for session
  maxSessionDuration: number;   // minutes
  
  // Monitoring
  healthCheckInterval: number;  // ms
  safetyCheckInterval: number;  // ms
  performanceLoggingEnabled: boolean;
}

/**
 * Hook return types
 */
export interface UseNeuralInterfaceReturn {
  neuralPattern: NeuralPattern | null;
  isMonitoring: boolean;
  error: Error | null;
  startMonitoring: (context?: string) => Promise<void>;
  stopMonitoring: () => Promise<void>;
  getNeuralState: () => Partial<NeuralPattern>;
}

export interface UseSkillAcquisitionReturn {
  currentSkill: Skill | null;
  tracking: SkillTracking | null;
  isTransferring: boolean;
  swarmStatus: NanobotSwarm | null;
  error: Error | null;
  initiateTransfer: (skillId: string, skillData?: Skill) => Promise<void>;
  stopTransfer: () => Promise<void>;
  getProgress: () => number;
}

export interface UseNanotechMonitoringReturn {
  safetyStatus: SafetyStatus | null;
  isMonitoring: boolean;
  error: Error | null;
  swarmHealth: number;
  containmentStatus: number;
  startMonitoring: (swarmId?: string) => Promise<void>;
  stopMonitoring: () => Promise<void>;
  emergencyShutdown: () => Promise<void>;
}
