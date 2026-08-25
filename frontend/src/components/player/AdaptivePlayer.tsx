'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gauge, Info, ShieldCheck, Zap } from 'lucide-react';
import { useEmotionDetection } from '../../hooks/useEmotionDetection';
import type { AdaptationAction } from '../../lib/adaptationEngine';

interface Subtitle {
  src: string;
  srcLang: string;
  label: string;
  default?: boolean;
  kind?: 'subtitles' | 'captions';
}

interface AdaptivePlayerProps {
  src: string;
  title: string;
  subtitles?: Subtitle[];
  poster?: string;
  /** Called whenever the engine applies an adaptation. */
  onAdaptationApplied?: () => void;
}

const ADAPTATION_LABEL: Record<string, string> = {
  slow_down: 'Pacing slowed',
  speed_up: 'Pacing increased',
  offer_review: 'Review suggested',
  offer_hint: 'Hint offered',
  simplify: 'Difficulty simplified',
};

/**
 * Engagement-aware adaptive video player (issue #408).
 *
 * Wires the emotion/engagement detection hook into content delivery:
 * pacing (playback rate) adapts to the learner's engagement, every
 * adaptation is explained and can be accepted or dismissed, and the
 * learner controls consent + which dimensions may auto-adapt.
 */
export const AdaptivePlayer: React.FC<AdaptivePlayerProps> = ({
  src,
  title,
  subtitles = [],
  poster,
  onAdaptationApplied,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const {
    videoRef: cameraRef,
    dominantEmotion,
    engagementScore,
    frustrationScore,
    isDetecting,
    error,
    startDetection,
    stopDetection,
    playbackRate,
    currentAdaptation,
    adaptationExplanation,
    isAdapting,
    preferences,
    consent,
    updatePreference,
    setConsent,
    dismissAdaptation,
    acceptAdaptation,
  } = useEmotionDetection({ onAdaptationApplied });

  // Apply the engine's pacing to the native video element.
  useEffect(() => {
    if (videoRef.current && playbackRate !== 1) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const statusText = `${title} is playing at ${playbackRate.toFixed(2)}×. ` +
    `Engagement ${Math.round(engagementScore)}/100, frustration ${Math.round(frustrationScore)}/100.`;

  const action: AdaptationAction | null = currentAdaptation;
  const actionLabel = action ? ADAPTATION_LABEL[action.kind] || action.kind : null;

  return (
    <figure
      className="relative w-full max-w-4xl mx-auto rounded-lg overflow-hidden bg-black"
      role="region"
      aria-label={`Adaptive video player for ${title}`}
    >
      <video
        ref={videoRef}
        className="w-full"
        poster={poster}
        preload="metadata"
        playsInline
        crossOrigin="anonymous"
        aria-label={title}
        controls
      >
        <source src={src} type="video/mp4" />
        {subtitles.map((sub, index) => (
          <track
            key={index}
            kind={sub.kind || 'captions'}
            src={sub.src}
            srcLang={sub.srcLang}
            label={sub.label}
            default={sub.default || (!subtitles.some((item) => item.default) && index === 0)}
          />
        ))}
        <p>Your browser does not support the video tag. Please download the video to view it.</p>
      </video>

      <div className="sr-only" aria-live="polite">
        {statusText}
      </div>

      {/* Explainable, user-overridable adaptation banner */}
      <AnimatePresence>
        {isAdapting && action && actionLabel && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="absolute bottom-16 left-3 right-3 md:left-6 md:right-6 bg-slate-900/95 text-white rounded-lg p-4 shadow-xl border border-blue-500/40"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{actionLabel}</p>
                {adaptationExplanation && (
                  <p className="text-xs text-slate-300 mt-1">{adaptationExplanation}</p>
                )}
                {action.kind === 'slow_down' || action.kind === 'speed_up' ? (
                  <p className="text-xs text-blue-300 mt-1">
                    Playback speed set to {action.playbackRate?.toFixed(2)}×
                  </p>
                ) : null}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={acceptAdaptation}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={dismissAdaptation}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded transition-colors"
                  >
                    Dismiss (back to {action.kind === 'speed_up' ? '1.00' : '1.00'}×)
                  </button>
                </div>
              </div>
              <button
                onClick={dismissAdaptation}
                aria-label="Dismiss adaptation"
                className="text-slate-400 hover:text-white text-lg leading-none shrink-0"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Engagement + privacy controls */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <button
          onClick={() => setShowSettings((s) => !s)}
          aria-expanded={showSettings}
          className="bg-slate-900/80 hover:bg-slate-800 text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors"
        >
          <Gauge className="h-3.5 w-3.5" />
          Adaptation
        </button>
        {consent.engagementTrackingConsent && (
          <span className="bg-green-900/80 text-green-200 text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Tracking on
          </span>
        )}
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 bottom-0 bg-slate-900/95 text-white p-4 md:p-5 backdrop-blur"
            role="dialog"
            aria-label="Adaptation settings"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Gauge className="h-4 w-4 text-blue-400" /> Adaptation Settings
              </h4>
              <button
                onClick={() => setShowSettings(false)}
                aria-label="Close settings"
                className="text-slate-400 hover:text-white text-lg leading-none"
              >
                ×
              </button>
            </div>

            {/* Emotion state */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs">
              <div className="bg-slate-800 rounded px-3 py-2">
                <span className="text-slate-400 block">Emotion</span>
                <span className="capitalize font-medium">{isDetecting ? dominantEmotion : '—'}</span>
              </div>
              <div className="bg-slate-800 rounded px-3 py-2">
                <span className="text-slate-400 block">Engagement</span>
                <span className="font-medium">{isDetecting ? `${Math.round(engagementScore)}%` : '—'}</span>
              </div>
              <div className="bg-slate-800 rounded px-3 py-2">
                <span className="text-slate-400 block">Frustration</span>
                <span className="font-medium">{isDetecting ? `${Math.round(frustrationScore)}%` : '—'}</span>
              </div>
              <div className="bg-slate-800 rounded px-3 py-2">
                <span className="text-slate-400 block">Pacing</span>
                <span className="font-medium">{playbackRate.toFixed(2)}×</span>
              </div>
            </div>

            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

            {/* Consent + camera controls */}
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <button
                onClick={isDetecting ? stopDetection : startDetection}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors"
              >
                {isDetecting ? 'Stop Detection' : 'Start Detection'}
              </button>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent.engagementTrackingConsent}
                  onChange={(e) => setConsent({ engagementTrackingConsent: e.target.checked })}
                  className="rounded"
                />
                Allow privacy-safe engagement tracking
              </label>
              <span className="text-slate-400 text-[11px]">
                Only derived scores are shared — raw video never leaves your device.
              </span>
            </div>

            {/* Adaptation dimensions */}
            <div className="flex flex-wrap gap-4 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.adaptationEnabled}
                  onChange={(e) => updatePreference({ adaptationEnabled: e.target.checked })}
                  className="rounded"
                />
                Auto-adapt
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.pacingEnabled}
                  onChange={(e) => updatePreference({ pacingEnabled: e.target.checked })}
                  className="rounded"
                />
                Pacing
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.difficultyEnabled}
                  onChange={(e) => updatePreference({ difficultyEnabled: e.target.checked })}
                  className="rounded"
                />
                Difficulty
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.hintsEnabled}
                  onChange={(e) => updatePreference({ hintsEnabled: e.target.checked })}
                  className="rounded"
                />
                Hints
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <figcaption className="sr-only">
        {subtitles.length > 0
          ? `Caption tracks available for ${title}.`
          : `No caption tracks were provided for ${title}.`}
      </figcaption>
    </figure>
  );
};

export default AdaptivePlayer;
