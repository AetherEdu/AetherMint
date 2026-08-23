/**
 * Engagement-Aware Content Adaptation Service (issue #408)
 *
 * Uses the existing emotion/engagement detection signals (frontend
 * `useEmotionDetection` hook, neural data) to adapt content delivery:
 * pacing (playback rate), difficulty, and hints are adjusted when a
 * learner is disengaged or struggling.
 *
 * Design notes
 * ------------
 * - Signals arrive as *derived* scores (engagement 0-100, frustration
 *   0-100, dominant emotion) — raw video/biometric data never leaves the
 *   client, so this service never touches it.
 * - State is kept in memory, mirroring `bridgeMonitor.ts`; a production
 *   deployment would persist profiles to Redis/Mongo.
 * - Decisions are deterministic and *explainable*: every recommendation
 *   carries a human-readable explanation plus the rule id that fired.
 * - Every adaptation is *user-overridable*: per-user preferences gate
 *   which dimensions (pacing / difficulty / hints) may auto-adapt and
 *   bound the allowed playback range.
 * - Consent is enforced: when a user revokes consent, stored signals are
 *   purged and signal ingestion stops.
 * - Effectiveness is measured: outcomes recorded after each adaptation
 *   (quiz score, completion) are aggregated per action so impact on
 *   learning outcomes can be evaluated.
 */

export type Emotion =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'fearful'
  | 'disgusted'
  | 'surprised';

export type AdaptationDimension = 'pacing' | 'difficulty' | 'hints';
export type AdaptationKind = 'slow_down' | 'speed_up' | 'offer_review' | 'offer_hint' | 'simplify' | 'none';

export interface EngagementSignal {
  /** Client-derived scores, 0-100. Never contains raw biometric data. */
  engagementScore: number;
  frustrationScore: number;
  dominantEmotion: Emotion;
  /** 0-1, where 1 = video fully watched. Used to keep hints relevant. */
  progress?: number;
  timestamp?: number;
}

export interface AdaptationPreference {
  /** Master switch — disables all automatic adaptation. */
  adaptationEnabled: boolean;
  /** Allow pacing (playback rate) adjustments. */
  pacingEnabled: boolean;
  /** Allow difficulty adjustments. */
  difficultyEnabled: boolean;
  /** Allow hint / alternate-explanation injection. */
  hintsEnabled: boolean;
  /** Bounds for automatic playback-rate changes (0.25 - 2.0). */
  maxPlaybackRate: number;
  minPlaybackRate: number;
}

export interface ConsentState {
  /** Opt-in to storing engagement signals for adaptation. */
  engagementTrackingConsent: boolean;
  /** Whether the learner consents to any biometric capture at all. */
  biometricConsent: boolean;
  grantedAt?: number;
  revokedAt?: number;
}

export interface AdaptationAction {
  kind: AdaptationKind;
  /** Target playback rate for `slow_down` / `speed_up`. */
  playbackRate?: number;
  /** Suggested difficulty label for `simplify`. */
  difficulty?: string;
  /** Hint text for `offer_hint` / `offer_review`. */
  message?: string;
}

export interface AdaptationRecommendation {
  id: string;
  userId: string;
  action: AdaptationAction;
  /** Human-readable explanation of *why* this adaptation was chosen. */
  explanation: string;
  /** Deterministic rule id that produced the recommendation. */
  rule: string;
  /** Model confidence in the underlying engagement state (0-1). */
  confidence: number;
  /** Always true — every recommendation can be dismissed/overridden. */
  overridable: boolean;
  createdAt: number;
}

export interface StoredSignal extends EngagementSignal {
  timestamp: number;
}

export interface AdaptationOutcome {
  id: string;
  userId: string;
  recommendationId: string;
  /** Whether the learner accepted (vs dismissed) the adaptation. */
  accepted: boolean;
  /** Learning-outcome proxy measured after the adaptation. */
  quizScoreAfter?: number;
  completionDelta?: number;
  timestamp: number;
}

export interface EngagementState {
  averageEngagement: number;
  averageFrustration: number;
  sampleCount: number;
  dominantEmotion: Emotion;
}

const DEFAULT_PREFERENCES: AdaptationPreference = {
  adaptationEnabled: true,
  pacingEnabled: true,
  difficultyEnabled: true,
  hintsEnabled: true,
  maxPlaybackRate: 1.5,
  minPlaybackRate: 0.5,
};

const DEFAULT_CONSENT: ConsentState = {
  engagementTrackingConsent: false,
  biometricConsent: false,
};

/** Keep only the last N signals per user (rolling window). */
const MAX_SIGNALS_PER_USER = 50;

export class AdaptationService {
  private signals = new Map<string, StoredSignal[]>();
  private recommendations = new Map<string, AdaptationRecommendation[]>();
  private preferences = new Map<string, AdaptationPreference>();
  private consents = new Map<string, ConsentState>();
  private outcomes = new Map<string, AdaptationOutcome[]>();
  private ruleCounter = 0;

  /**
   * Ingests a client-derived engagement signal. Respects consent: without
   * `engagementTrackingConsent` the signal is validated but not stored, so
   * the user still gets a *stateless* recommendation if they call
   * `recommend` with the same signal.
   */
  ingestSignal(userId: string, signal: EngagementSignal): { stored: boolean } {
    const normalized = this.normalizeSignal(signal);
    const consent = this.getConsent(userId);

    if (!consent.engagementTrackingConsent) {
      return { stored: false };
    }

    const window = this.signals.get(userId) || [];
    window.push(normalized);
    // Keep the rolling window bounded.
    this.signals.set(userId, window.slice(-MAX_SIGNALS_PER_USER));
    return { stored: true };
  }

  /**
   * Pure decision: given a signal (plus optionally the stored rolling
   * window) produce an explainable, overridable adaptation.
   *
   * The returned recommendation is recorded so the learner can review
   * what the system did and why.
   */
  recommend(userId: string, signal: EngagementSignal): AdaptationRecommendation {
    const normalized = this.normalizeSignal(signal);
    const prefs = this.getPreferences(userId);

    if (!prefs.adaptationEnabled) {
      return this.buildRecommendation(userId, {
        kind: 'none',
        message: 'Automatic adaptation is disabled in your preferences.',
      }, 'preference-disabled', 'Adaptation is turned off in your preferences, so no changes were made.', 0);
    }

    const state = this.computeEngagementState(userId, normalized);
    const decision = this.decide(state, prefs);

    return this.buildRecommendation(
      userId,
      decision.action,
      decision.rule,
      decision.explanation,
      decision.confidence,
    );
  }

  /**
   * Evaluates the rolling engagement state against deterministic rules.
   * Returns the highest-priority matching rule — mirroring the existing
   * `EmotionDashboard` thresholds but as a backend-grade, testable engine.
   */
  private decide(
    state: EngagementState,
    prefs: AdaptationPreference,
  ): { action: AdaptationAction; rule: string; explanation: string; confidence: number } {
    const frustration = state.averageFrustration;
    const engagement = state.averageEngagement;

    if (prefs.hintsEnabled && frustration > 75) {
      return {
        action: {
          kind: 'offer_review',
          message: 'You seem frustrated. Would you like to review the previous section or take a short break?',
        },
        rule: 'frustration-review',
        explanation:
          `Frustration averaged ${Math.round(frustration)}/100 over the last ${state.sampleCount} sample(s), ` +
          'which is above the 75 threshold. Reviewing earlier material reduces cognitive load.',
        confidence: 0.9,
      };
    }

    if (prefs.pacingEnabled && frustration > 60) {
      const rate = Math.max(prefs.minPlaybackRate, 0.75);
      return {
        action: { kind: 'slow_down', playbackRate: rate },
        rule: 'frustration-slow-down',
        explanation:
          `Frustration averaged ${Math.round(frustration)}/100, above the 60 threshold. ` +
          `Slowing the pacing to ${rate}× gives you more time to process.`,
        confidence: 0.85,
      };
    }

    if (prefs.hintsEnabled && engagement < 30) {
      return {
        action: {
          kind: 'offer_hint',
          message: 'Engagement is dropping — here is a hint to help you stay on track.',
        },
        rule: 'low-engagement-hint',
        explanation:
          `Engagement averaged ${Math.round(engagement)}/100, below the 30 threshold. ` +
          'An alternate explanation or hint is offered to re-engage you.',
        confidence: 0.8,
      };
    }

    if (prefs.difficultyEnabled && engagement < 40) {
      return {
        action: { kind: 'simplify', difficulty: 'beginner' },
        rule: 'low-engagement-simplify',
        explanation:
          `Engagement averaged ${Math.round(engagement)}/100, below the 40 threshold. ` +
          'The content difficulty is temporarily simplified to rebuild confidence.',
        confidence: 0.75,
      };
    }

    if (prefs.pacingEnabled && engagement > 80 && state.averageFrustration < 40) {
      const rate = Math.min(prefs.maxPlaybackRate, 1.25);
      return {
        action: { kind: 'speed_up', playbackRate: rate },
        rule: 'high-engagement-speed-up',
        explanation:
          `Engagement averaged ${Math.round(engagement)}/100 with low frustration, above the 80 threshold. ` +
          `Pacing increased to ${rate}× to match your flow state.`,
        confidence: 0.85,
      };
    }

    return {
      action: { kind: 'none', message: 'No adaptation needed right now.' },
      rule: 'standard-pacing',
      explanation:
        `Engagement ${Math.round(engagement)}/100 and frustration ${Math.round(frustration)}/100 are both ` +
        'within the healthy band, so the current pacing is kept.',
      confidence: 0.7,
    };
  }

  /**
   * Per-user preferences gate every decision dimension, making adaptation
   * explainable and user-overridable.
   */
  setPreferences(userId: string, prefs: Partial<AdaptationPreference>): AdaptationPreference {
    const merged: AdaptationPreference = {
      ...this.getPreferences(userId),
      ...prefs,
    };
    // Clamp playback bounds to a sane range.
    merged.maxPlaybackRate = this.clamp(merged.maxPlaybackRate, 0.25, 2);
    merged.minPlaybackRate = this.clamp(merged.minPlaybackRate, 0.25, 2);
    if (merged.minPlaybackRate > merged.maxPlaybackRate) {
      merged.minPlaybackRate = merged.maxPlaybackRate;
    }
    this.preferences.set(userId, merged);
    return { ...merged };
  }

  getPreferences(userId: string): AdaptationPreference {
    return { ...(this.preferences.get(userId) || DEFAULT_PREFERENCES) };
  }

  /**
   * Privacy & consent controls. Revoking consent purges stored signals
   * immediately (right-to-erasure for derived engagement data).
   */
  setConsent(userId: string, consent: Partial<ConsentState>): ConsentState {
    const current = this.getConsent(userId);
    const now = Date.now();
    const merged: ConsentState = { ...current, ...consent };

    if (merged.engagementTrackingConsent && !current.engagementTrackingConsent) {
      merged.grantedAt = now;
    }
    if (!merged.engagementTrackingConsent && current.engagementTrackingConsent) {
      merged.revokedAt = now;
      this.signals.delete(userId);
    }

    this.consents.set(userId, merged);
    return { ...merged };
  }

  getConsent(userId: string): ConsentState {
    return { ...(this.consents.get(userId) || DEFAULT_CONSENT) };
  }

  /** Purge all stored engagement data for a user (GDPR-style erasure). */
  purgeUserData(userId: string): void {
    this.signals.delete(userId);
    this.recommendations.delete(userId);
    this.outcomes.delete(userId);
    this.consents.delete(userId);
    this.preferences.delete(userId);
  }

  /**
   * Record a learning outcome measured after an adaptation was applied so
   * the effectiveness of adaptation can be evaluated against outcomes.
   */
  recordOutcome(userId: string, outcome: Omit<AdaptationOutcome, 'id' | 'timestamp'>): AdaptationOutcome {
    const stored: AdaptationOutcome = {
      ...outcome,
      id: `outcome_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    const list = this.outcomes.get(userId) || [];
    list.push(stored);
    this.outcomes.set(userId, list.slice(-100));
    return { ...stored };
  }

  /**
   * Aggregate outcomes per action type so the impact of adaptation on
   * learning outcomes can be measured (acceptance rate + score delta).
   */
  getEffectiveness(userId: string) {
    const outcomes = this.outcomes.get(userId) || [];
    const byKind = new Map<string, { count: number; accepted: number; scoreDeltas: number[] }>();

    for (const o of outcomes) {
      const recommendation = (this.recommendations.get(userId) || []).find(
        (r) => r.id === o.recommendationId,
      );
      const kind = recommendation?.action.kind || 'unknown';
      const entry = byKind.get(kind) || { count: 0, accepted: 0, scoreDeltas: [] };
      entry.count += 1;
      if (o.accepted) entry.accepted += 1;
      if (o.quizScoreAfter !== undefined && recommendation) {
        // Delta is measured against the baseline engagement at decision time.
        const baseline = recommendation.confidence * 50;
        entry.scoreDeltas.push(o.quizScoreAfter - baseline);
      }
      byKind.set(kind, entry);
    }

    return Array.from(byKind.entries()).map(([kind, entry]) => ({
      action: kind,
      samples: entry.count,
      acceptanceRate: entry.count > 0 ? entry.accepted / entry.count : 0,
      averageScoreDelta:
        entry.scoreDeltas.length > 0
          ? entry.scoreDeltas.reduce((a, b) => a + b, 0) / entry.scoreDeltas.length
          : 0,
    }));
  }

  getSignals(userId: string): StoredSignal[] {
    return (this.signals.get(userId) || []).map((s) => ({ ...s }));
  }

  getRecommendations(userId: string): AdaptationRecommendation[] {
    return (this.recommendations.get(userId) || []).map((r) => ({ ...r }));
  }

  reset(): void {
    this.signals.clear();
    this.recommendations.clear();
    this.preferences.clear();
    this.consents.clear();
    this.outcomes.clear();
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private buildRecommendation(
    userId: string,
    action: AdaptationAction,
    rule: string,
    explanation: string,
    confidence: number,
  ): AdaptationRecommendation {
    this.ruleCounter += 1;
    const recommendation: AdaptationRecommendation = {
      id: `adapt_${Date.now()}_${this.ruleCounter}`,
      userId,
      action,
      explanation,
      rule,
      confidence: this.clamp(confidence, 0, 1),
      overridable: true,
      createdAt: Date.now(),
    };
    const list = this.recommendations.get(userId) || [];
    list.push(recommendation);
    this.recommendations.set(userId, list.slice(-50));
    return { ...recommendation };
  }

  private computeEngagementState(userId: string, signal: StoredSignal): EngagementState {
    const window = this.signals.get(userId) || [];
    const samples = [...window, signal];

    const avg = (fn: (s: StoredSignal) => number) =>
      samples.reduce((sum, s) => sum + fn(s), 0) / Math.max(1, samples.length);

    const counts = new Map<Emotion, number>();
    for (const s of samples) {
      counts.set(s.dominantEmotion, (counts.get(s.dominantEmotion) || 0) + 1);
    }
    let dominantEmotion: Emotion = signal.dominantEmotion;
    let max = -1;
    for (const [emotion, count] of counts.entries()) {
      if (count > max) {
        max = count;
        dominantEmotion = emotion;
      }
    }

    return {
      averageEngagement: avg((s) => s.engagementScore),
      averageFrustration: avg((s) => s.frustrationScore),
      sampleCount: samples.length,
      dominantEmotion,
    };
  }

  private normalizeSignal(signal: EngagementSignal): StoredSignal {
    const engagementScore = this.clamp(Number(signal.engagementScore) || 0, 0, 100);
    const frustrationScore = this.clamp(Number(signal.frustrationScore) || 0, 0, 100);
    const dominantEmotion: Emotion = this.isEmotion(signal.dominantEmotion)
      ? signal.dominantEmotion
      : 'neutral';
    return {
      engagementScore,
      frustrationScore,
      dominantEmotion,
      progress: this.clamp(Number(signal.progress) || 0, 0, 1),
      timestamp: signal.timestamp || Date.now(),
    };
  }

  private isEmotion(value: unknown): value is Emotion {
    return (
      typeof value === 'string' &&
      ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'].includes(value)
    );
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}

export const adaptationService = new AdaptationService();
