export type LearningMode = 'concept' | 'practice' | 'revision';

export interface TimeDilationProfile {
  id: string;
  name: string;
  description: string;
  focusCadence: number;
  sensoryIntensity: number;
  recoveryBias: number;
  retentionBias: number;
  maxScale: number;
  preferredMode: LearningMode;
}

export interface TemporalSignals {
  focus: number;
  retention: number;
  strain: number;
  drift: number;
  sensoryTolerance: number;
  sessionMinutes: number;
  contentComplexity: number;
  priorMomentum: number;
}

export interface SafetyState {
  level: 'stable' | 'caution' | 'recovery';
  label: string;
  maxAllowedScale: number;
  reversible: boolean;
  autoPause: boolean;
  reason: string;
  intervention: string;
}

export interface ProtocolPhase {
  name: string;
  minutes: number;
  intensity: string;
  objective: string;
}

export interface TemporalFeedback {
  id: string;
  title: string;
  detail: string;
  tone: 'positive' | 'neutral' | 'warning';
}

export interface TimeDilationSession {
  profile: TimeDilationProfile;
  learningMode: LearningMode;
  recommendedScale: number;
  projectedSpeedGain: number;
  perceivedMinutes: number;
  masteryConfidence: number;
  safety: SafetyState;
  protocol: ProtocolPhase[];
  feedback: TemporalFeedback[];
}

export const timeDilationProfiles: TimeDilationProfile[] = [
  {
    id: 'deep-focus',
    name: 'Deep Focus',
    description: 'Higher compression for learners who can sustain intense attention with structured recovery.',
    focusCadence: 78,
    sensoryIntensity: 66,
    recoveryBias: 52,
    retentionBias: 74,
    maxScale: 2.4,
    preferredMode: 'practice',
  },
  {
    id: 'steady-flow',
    name: 'Steady Flow',
    description: 'Balanced pacing that protects retention when the material is new or cognitively heavy.',
    focusCadence: 64,
    sensoryIntensity: 48,
    recoveryBias: 72,
    retentionBias: 81,
    maxScale: 2.1,
    preferredMode: 'concept',
  },
  {
    id: 'exam-sprint',
    name: 'Exam Sprint',
    description: 'Short, high-urgency compression tuned for review bursts and rapid recall loops.',
    focusCadence: 84,
    sensoryIntensity: 73,
    recoveryBias: 44,
    retentionBias: 68,
    maxScale: 2.5,
    preferredMode: 'revision',
  },
];

const learningModeBoost: Record<LearningMode, number> = {
  concept: 0.02,
  practice: 0.18,
  revision: 0.26,
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const round = (value: number, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export const evaluateSafetyState = (
  profile: TimeDilationProfile,
  signals: TemporalSignals
): SafetyState => {
  const fatigueLoad =
    signals.strain * 0.42 +
    signals.drift * 0.28 +
    (100 - signals.focus) * 0.2 +
    Math.max(profile.sensoryIntensity - signals.sensoryTolerance, 0) * 0.1;

  if (signals.strain >= 78 || signals.drift >= 72 || fatigueLoad >= 68) {
    return {
      level: 'recovery',
      label: 'Recovery Mode',
      maxAllowedScale: 1.1,
      reversible: true,
      autoPause: true,
      reason: 'Cognitive strain or temporal drift is too high for safe compression.',
      intervention: 'Pause acceleration, lower sensory load, and shift to a grounding review cycle.',
    };
  }

  if (signals.strain >= 58 || signals.drift >= 48 || fatigueLoad >= 48) {
    return {
      level: 'caution',
      label: 'Guardrail Active',
      maxAllowedScale: Math.min(profile.maxScale, 1.7),
      reversible: true,
      autoPause: false,
      reason: 'The learner is still stable, but feedback suggests compression should taper.',
      intervention: 'Reduce tempo, increase retrieval breaks, and rebalance toward retention.',
    };
  }

  return {
    level: 'stable',
    label: 'Stable Window',
    maxAllowedScale: profile.maxScale,
    reversible: true,
    autoPause: false,
    reason: 'Focus, retention, and sensory tolerance support a faster learning cadence.',
    intervention: 'Maintain rhythm and keep monitoring drift, strain, and recall quality.',
  };
};

export const buildTimeDilationSession = (
  profile: TimeDilationProfile,
  learningMode: LearningMode,
  signals: TemporalSignals
): TimeDilationSession => {
  const safety = evaluateSafetyState(profile, signals);

  const rawScale =
    1 +
    (signals.focus - 50) / 60 +
    signals.retention / 220 +
    signals.priorMomentum / 280 +
    learningModeBoost[learningMode] +
    profile.focusCadence / 240 -
    signals.contentComplexity / 260 -
    signals.strain / 300 -
    signals.drift / 400;

  const recommendedScale = round(clamp(rawScale, 1, safety.maxAllowedScale));
  const projectedSpeedGain = Math.max(0, Math.round((recommendedScale - 1) * 100));
  const perceivedMinutes = Math.round(signals.sessionMinutes * recommendedScale);

  const masteryConfidence = Math.round(
    clamp(
      signals.retention * 0.45 +
        signals.focus * 0.22 +
        signals.priorMomentum * 0.15 +
        profile.retentionBias * 0.18 -
        signals.strain * 0.14,
      35,
      96
    )
  );

  const phaseTemplate: Record<LearningMode, Array<[string, number, string, string]>> = {
    concept: [
      ['Orient', 0.18, 'Low', 'Frame the topic and establish a calm reference pace.'],
      ['Compression Sprint', 0.34, 'Medium', 'Deliver condensed concepts with cue-rich prompts.'],
      ['Recall Ladder', 0.26, 'Medium', 'Switch from intake to retrieval before drift builds.'],
      ['Decompress', 0.22, 'Low', 'Normalize tempo and lock in the memory trace.'],
    ],
    practice: [
      ['Prime', 0.16, 'Medium', 'Load the rule set and surface the target skill.'],
      ['Active Run', 0.4, 'High', 'Sustain rapid applied practice while the engine tracks strain.'],
      ['Error Sweep', 0.22, 'Medium', 'Review mistakes before the session loses coherence.'],
      ['Cooldown', 0.22, 'Low', 'Reduce pace and summarize the strongest corrections.'],
    ],
    revision: [
      ['Anchor', 0.14, 'Medium', 'Start with confidence-building recall cues.'],
      ['Rapid Recall', 0.44, 'High', 'Cycle through compressed prompts and recognition checks.'],
      ['Retention Lock', 0.2, 'Medium', 'Convert speed into stable retrieval patterns.'],
      ['Recovery', 0.22, 'Low', 'Step down stimulation and restore neutral pacing.'],
    ],
  };

  const protocol = phaseTemplate[learningMode].map(([name, share, intensity, objective], index, list) => {
    const exactMinutes = signals.sessionMinutes * share;
    const remainingMinutes = signals.sessionMinutes - list.slice(0, index).reduce((sum, [, prevShare]) => {
      return sum + Math.round(signals.sessionMinutes * prevShare);
    }, 0);

    const minutes = index === list.length - 1 ? remainingMinutes : Math.round(exactMinutes);

    return {
      name,
      minutes,
      intensity,
      objective,
    };
  });

  const feedback: TemporalFeedback[] = [
    {
      id: 'scale',
      title:
        recommendedScale >= 2
          ? '2x+ projected acceleration unlocked'
          : 'Compression remains moderated',
      detail:
        recommendedScale >= 2
          ? 'Current telemetry supports a projected pace increase above 200%, while guardrails stay active.'
          : 'The engine is holding back until focus and recall metrics improve.',
      tone: recommendedScale >= 2 ? 'positive' : 'neutral',
    },
    {
      id: 'safety',
      title: safety.label,
      detail: `${safety.reason} ${safety.intervention}`,
      tone: safety.level === 'stable' ? 'positive' : safety.level === 'caution' ? 'warning' : 'warning',
    },
    {
      id: 'retention',
      title:
        signals.retention >= 70
          ? 'Retention pipeline is strong'
          : 'Add more retrieval before increasing speed',
      detail:
        signals.retention >= 70
          ? 'The learner can spend more time in high-density learning blocks.'
          : 'Recall confidence is below target, so the next safest lift comes from practice loops.',
      tone: signals.retention >= 70 ? 'positive' : 'neutral',
    },
  ];

  if (signals.strain >= 60 || signals.drift >= 55) {
    feedback.push({
      id: 'normalize',
      title: 'Automatic normalization recommended',
      detail: 'A softer cadence and a grounding break will protect reversibility and reduce overload.',
      tone: 'warning',
    });
  }

  return {
    profile,
    learningMode,
    recommendedScale,
    projectedSpeedGain,
    perceivedMinutes,
    masteryConfidence,
    safety,
    protocol,
    feedback,
  };
};
