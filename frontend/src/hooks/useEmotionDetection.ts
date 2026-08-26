import { useState, useEffect, useRef, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import {
  decideAdaptation,
  playbackRateFor,
  adaptationApi,
  DEFAULT_PREFERENCES,
  DEFAULT_CONSENT,
} from '../lib/adaptationEngine';
import type {
  Emotion,
  AdaptationPreference,
  ConsentState,
  AdaptationAction,
} from '../lib/adaptationEngine';

export type { Emotion } from '../lib/adaptationEngine';

export interface EmotionState {
  dominantEmotion: Emotion;
  engagementScore: number;
  frustrationScore: number;
  isDetecting: boolean;
  error?: string;
}

export interface AdaptiveState {
  /** Currently applied playback rate (1 = unchanged). */
  playbackRate: number;
  /** The active adaptation action (or `none`). */
  currentAction: AdaptationAction | null;
  /** Human-readable explanation for the current adaptation. */
  explanation: string | null;
  /** Whether an adaptation is being shown to the learner. */
  isAdapting: boolean;
  /** Deterministic rule id that produced the current adaptation. */
  rule: string | null;
  /** The full recommendation, used to record outcomes. */
  recommendation: { id: string; userId: string; confidence: number } | null;
}

export interface UseEmotionDetectionOptions {
  /** Master switch for automatic adaptation (default true). */
  adaptationEnabled?: boolean;
  /** Whether the learner has granted engagement-tracking consent. */
  consent?: boolean;
  /** Called whenever an adaptation is applied. */
  onAdaptationApplied?: (adaptation: AdaptiveState) => void;
}

/**
 * Emotion/engagement detection hook wired into the engagement-aware
 * content adaptation engine (issue #408).
 *
 * Privacy: the camera stream never leaves the device. Only derived
 * scores are reported to the backend, and only after the learner grants
 * engagement-tracking consent via `setConsent(true)`.
 */
export const useEmotionDetection = (options: UseEmotionDetectionOptions = {}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [state, setState] = useState<EmotionState>({
    dominantEmotion: 'neutral',
    engagementScore: 50,
    frustrationScore: 0,
    isDetecting: false,
  });
  const [adaptive, setAdaptive] = useState<AdaptiveState>({
    playbackRate: 1,
    currentAction: null,
    explanation: null,
    isAdapting: false,
    rule: null,
    recommendation: null,
  });
  const [preferences, setPreferences] = useState<AdaptationPreference>({
    ...DEFAULT_PREFERENCES,
    adaptationEnabled: options.adaptationEnabled ?? true,
  });
  const [consent, setConsentState] = useState<ConsentState>({
    ...DEFAULT_CONSENT,
    engagementTrackingConsent: options.consent ?? false,
  });
  const optionsRef = useRef(options);
  optionsRef.current = options;

  /** Report a derived signal to the backend — only with consent, fail-open. */
  const reportSignal = useCallback(
    (signal: { engagementScore: number; frustrationScore: number; dominantEmotion: Emotion }) => {
      if (!consent.engagementTrackingConsent) return;
      const userId = typeof window !== 'undefined'
        ? window.localStorage.getItem('learner_id') || 'anonymous'
        : 'anonymous';
      adaptationApi.reportSignal(userId, signal).catch(() => {
        // Fail open: the player keeps working un-adapted when offline/unreachable.
      });
    },
    [consent.engagementTrackingConsent],
  );

  /** Evaluate the latest signal against the adaptation engine. */
  const evaluateAdaptation = useCallback(
    (signal: { engagementScore: number; frustrationScore: number; dominantEmotion: Emotion }) => {
      const prefs = preferencesRef.current;
      const decision = decideAdaptation(signal, prefs);
      const action = decision.action;
      const isActive = action.kind !== 'none';

      setAdaptive((prev) => {
        const next: AdaptiveState = {
          playbackRate: isActive ? playbackRateFor(action) : 1,
          currentAction: isActive ? action : null,
          explanation: isActive ? decision.explanation : null,
          isAdapting: isActive,
          rule: isActive ? decision.rule : null,
          recommendation: isActive
            ? { id: `local_${Date.now()}`, userId: 'local', confidence: decision.confidence }
            : null,
        };
        optionsRef.current.onAdaptationApplied?.(next);
        return next;
      });
    },
    [],
  );

  // Keep a ref so the interval callback always reads fresh preferences.
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;

  const startDetection = useCallback(async () => {
    try {
      // Privacy compliance: Explicit consent required for camera. Data never leaves the client.
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      setState((prev) => ({ ...prev, isDetecting: true, error: undefined }));

      // TensorFlow.js model integration point (simulation for demonstration logic).
      // A real integration runs inference on videoRef.current frames here.
      void tf;

      const detectionInterval = setInterval(() => {
        if (!videoRef.current || !streamRef.current) return;

        const emotions: Emotion[] = ['neutral', 'happy', 'sad', 'angry', 'surprised'];
        const detectedEmotion = emotions[Math.floor(Math.random() * emotions.length)];

        const isFrustrated = detectedEmotion === 'angry' || detectedEmotion === 'sad';
        const isEngaged =
          detectedEmotion === 'happy' || detectedEmotion === 'surprised' || detectedEmotion === 'neutral';

        setState((prev) => {
          const next = {
            dominantEmotion: detectedEmotion,
            engagementScore: Math.min(100, Math.max(0, prev.engagementScore + (isEngaged ? 5 : -5))),
            frustrationScore: Math.min(100, Math.max(0, prev.frustrationScore + (isFrustrated ? 8 : -3))),
            isDetecting: true,
          };
          evaluateAdaptation(next);
          reportSignal(next);
          return next;
        });
      }, 2000);
      intervalRef.current = detectionInterval;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error:
          'Camera access denied or unavailable. Privacy settings may be blocking access.',
        isDetecting: false,
      }));
    }
  }, [evaluateAdaptation, reportSignal]);

  const stopDetection = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setState((prev) => ({ ...prev, isDetecting: false, engagementScore: 50, frustrationScore: 0 }));
    setAdaptive({
      playbackRate: 1,
      currentAction: null,
      explanation: null,
      isAdapting: false,
      rule: null,
      recommendation: null,
    });
  }, []);

  /** Update adaptation preferences (user-overridable). */
  const updatePreference = useCallback((partial: Partial<AdaptationPreference>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...partial };
      adaptationApi.updatePreferences(partial).catch(() => {
        // Fail open — local preference still applies.
      });
      return next;
    });
  }, []);

  /** Update consent state; revocation also stops backend reporting. */
  const setConsent = useCallback((partial: Partial<ConsentState>) => {
    setConsentState((prev) => {
      const next = { ...prev, ...partial };
      adaptationApi.updateConsent(partial).catch(() => {
        // Fail open.
      });
      return next;
    });
  }, []);

  /** Dismiss the current adaptation and restore normal pacing. */
  const dismissAdaptation = useCallback(() => {
    setAdaptive((prev) => {
      if (prev.recommendation) {
        adaptationApi.recordOutcome({ recommendationId: prev.recommendation.id, accepted: false }).catch(() => {});
      }
      return {
        playbackRate: 1,
        currentAction: null,
        explanation: null,
        isAdapting: false,
        rule: null,
        recommendation: null,
      };
    });
  }, []);

  /** Accept the current adaptation and keep the applied pacing. */
  const acceptAdaptation = useCallback(() => {
    setAdaptive((prev) => {
      if (prev.recommendation) {
        adaptationApi.recordOutcome({ recommendationId: prev.recommendation.id, accepted: true }).catch(() => {});
      }
      return { ...prev, isAdapting: false };
    });
  }, []);

  useEffect(() => {
    return () => {
      stopDetection();
    };
  }, [stopDetection]);

  return {
    videoRef,
    ...state,
    startDetection,
    stopDetection,
    // Engagement-aware adaptation (issue #408)
    playbackRate: adaptive.playbackRate,
    currentAdaptation: adaptive.currentAction,
    adaptationExplanation: adaptive.explanation,
    isAdapting: adaptive.isAdapting,
    adaptationRule: adaptive.rule,
    preferences,
    consent,
    updatePreference,
    setConsent,
    dismissAdaptation,
    acceptAdaptation,
  };
};
