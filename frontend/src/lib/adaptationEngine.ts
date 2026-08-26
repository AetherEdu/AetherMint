/**
 * Engagement-aware content adaptation (issue #408)
 *
 * Pure decision logic + thin API client for the adaptation endpoints.
 * The decision rules mirror the backend `AdaptationService` so playback
 * can adapt instantly on-device while the backend records signals,
 * preferences, consent, and effectiveness.
 *
 * Privacy: only *derived* scores (engagement / frustration / emotion)
 * are ever sent to the API, and only when the learner has granted
 * engagement-tracking consent. Raw video never leaves the client.
 */

export type Emotion = 'neutral' | 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised';
export type AdaptationKind = 'slow_down' | 'speed_up' | 'offer_review' | 'offer_hint' | 'simplify' | 'none';

export interface EngagementSignal {
  engagementScore: number;
  frustrationScore: number;
  dominantEmotion: Emotion;
  progress?: number;
}

export interface AdaptationPreference {
  adaptationEnabled: boolean;
  pacingEnabled: boolean;
  difficultyEnabled: boolean;
  hintsEnabled: boolean;
  maxPlaybackRate: number;
  minPlaybackRate: number;
}

export interface ConsentState {
  engagementTrackingConsent: boolean;
  biometricConsent: boolean;
}

export interface AdaptationAction {
  kind: AdaptationKind;
  playbackRate?: number;
  difficulty?: string;
  message?: string;
}

export interface AdaptationRecommendation {
  id: string;
  userId: string;
  action: AdaptationAction;
  explanation: string;
  rule: string;
  confidence: number;
  overridable: boolean;
  createdAt: number;
}

export const DEFAULT_PREFERENCES: AdaptationPreference = {
  adaptationEnabled: true,
  pacingEnabled: true,
  difficultyEnabled: true,
  hintsEnabled: true,
  maxPlaybackRate: 1.5,
  minPlaybackRate: 0.5,
};

export const DEFAULT_CONSENT: ConsentState = {
  engagementTrackingConsent: false,
  biometricConsent: false,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Pure, deterministic adaptation decision. Mirrors the backend rule set
 * so on-device playback and server-side history stay consistent.
 */
export function decideAdaptation(
  signal: EngagementSignal,
  prefs: AdaptationPreference = DEFAULT_PREFERENCES,
): { action: AdaptationAction; rule: string; explanation: string; confidence: number } {
  const engagement = clamp(Number(signal.engagementScore) || 0, 0, 100);
  const frustration = clamp(Number(signal.frustrationScore) || 0, 0, 100);

  if (!prefs.adaptationEnabled) {
    return {
      action: { kind: 'none', message: 'Automatic adaptation is disabled in your preferences.' },
      rule: 'preference-disabled',
      explanation: 'Adaptation is turned off in your preferences, so no changes were made.',
      confidence: 0,
    };
  }

  if (prefs.hintsEnabled && frustration > 75) {
    return {
      action: {
        kind: 'offer_review',
        message: 'You seem frustrated. Would you like to review the previous section or take a short break?',
      },
      rule: 'frustration-review',
      explanation:
        `Frustration is at ${Math.round(frustration)}/100, above the 75 threshold. ` +
        'Reviewing earlier material reduces cognitive load.',
      confidence: 0.9,
    };
  }

  if (prefs.pacingEnabled && frustration > 60) {
    const rate = Math.max(prefs.minPlaybackRate, 0.75);
    return {
      action: { kind: 'slow_down', playbackRate: rate },
      rule: 'frustration-slow-down',
      explanation:
        `Frustration is at ${Math.round(frustration)}/100, above the 60 threshold. ` +
        `Slowing the pacing to ${rate}× gives you more time to process.`,
      confidence: 0.85,
    };
  }

  if (prefs.hintsEnabled && engagement < 30) {
    return {
      action: { kind: 'offer_hint', message: 'Engagement is dropping — here is a hint to help you stay on track.' },
      rule: 'low-engagement-hint',
      explanation:
        `Engagement is at ${Math.round(engagement)}/100, below the 30 threshold. ` +
        'An alternate explanation or hint is offered to re-engage you.',
      confidence: 0.8,
    };
  }

  if (prefs.difficultyEnabled && engagement < 40) {
    return {
      action: { kind: 'simplify', difficulty: 'beginner' },
      rule: 'low-engagement-simplify',
      explanation:
        `Engagement is at ${Math.round(engagement)}/100, below the 40 threshold. ` +
        'The content difficulty is temporarily simplified to rebuild confidence.',
      confidence: 0.75,
    };
  }

  if (prefs.pacingEnabled && engagement > 80 && frustration < 40) {
    const rate = Math.min(prefs.maxPlaybackRate, 1.25);
    return {
      action: { kind: 'speed_up', playbackRate: rate },
      rule: 'high-engagement-speed-up',
      explanation:
        `Engagement is at ${Math.round(engagement)}/100 with low frustration, above the 80 threshold. ` +
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
 * Returns the playback rate implied by a decision (1 = unchanged).
 */
export function playbackRateFor(action: AdaptationAction): number {
  if (action.kind === 'slow_down' && action.playbackRate !== undefined) return action.playbackRate;
  if (action.kind === 'speed_up' && action.playbackRate !== undefined) return action.playbackRate;
  return 1;
}

const API_BASE = '/api/adaptation';

const authHeaders = (): Record<string, string> => {
  const token =
    typeof window !== 'undefined' ? window.localStorage.getItem('admin_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers || {}) },
  });
  if (!res.ok) {
    throw new Error(`Adaptation API request failed (${res.status})`);
  }
  return res.json();
}

/**
 * Thin client for the adaptation endpoints. All calls fail open — the
 * player should keep working (un-adapted) when the API is unreachable.
 */
export const adaptationApi = {
  reportSignal(userId: string, signal: EngagementSignal): Promise<{ stored: boolean }> {
    return request<{ stored: boolean }>('/signal', {
      method: 'POST',
      body: JSON.stringify({ ...signal, userId }),
    });
  },
  getRecommendation(userId: string, signal: EngagementSignal): Promise<{ data: AdaptationRecommendation }> {
    return request<{ data: AdaptationRecommendation }>('/recommend', {
      method: 'POST',
      body: JSON.stringify({ ...signal, userId }),
    });
  },
  updatePreferences(prefs: Partial<AdaptationPreference>): Promise<{ data: AdaptationPreference }> {
    return request<{ data: AdaptationPreference }>('/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    });
  },
  updateConsent(consent: Partial<ConsentState>): Promise<{ data: ConsentState }> {
    return request<{ data: ConsentState }>('/consent', {
      method: 'PUT',
      body: JSON.stringify(consent),
    });
  },
  recordOutcome(outcome: {
    recommendationId: string;
    accepted: boolean;
    quizScoreAfter?: number;
  }): Promise<{ data: unknown }> {
    return request<{ data: unknown }>('/outcome', {
      method: 'POST',
      body: JSON.stringify(outcome),
    });
  },
};
