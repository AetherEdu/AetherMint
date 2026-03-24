import Head from 'next/head';
import { useState } from 'react';
import styles from './index.module.css';
import {
  buildTimeDilationSession,
  LearningMode,
  TemporalSignals,
  timeDilationProfiles,
} from '../lib/timeDilationEngine';

const learningModes: Array<{
  id: LearningMode;
  label: string;
  description: string;
}> = [
  {
    id: 'concept',
    label: 'Concept Compression',
    description: 'Condense new ideas with calmer pacing and stronger decompression windows.',
  },
  {
    id: 'practice',
    label: 'Skill Acceleration',
    description: 'Push repetition speed while preserving error correction and recovery.',
  },
  {
    id: 'revision',
    label: 'Revision Surge',
    description: 'Bias toward rapid recall loops for exam and checkpoint preparation.',
  },
];

const initialSignals: TemporalSignals = {
  focus: 78,
  retention: 72,
  strain: 26,
  drift: 18,
  sensoryTolerance: 74,
  sessionMinutes: 30,
  contentComplexity: 42,
  priorMomentum: 68,
};

const metricLabels: Record<keyof TemporalSignals, string> = {
  focus: 'Focus stability',
  retention: 'Retention confidence',
  strain: 'Cognitive strain',
  drift: 'Temporal drift',
  sensoryTolerance: 'Sensory tolerance',
  sessionMinutes: 'Real session length',
  contentComplexity: 'Content complexity',
  priorMomentum: 'Prior momentum',
};

export default function HomePage() {
  const [profileId, setProfileId] = useState(timeDilationProfiles[0].id);
  const [learningMode, setLearningMode] = useState<LearningMode>('practice');
  const [signals, setSignals] = useState<TemporalSignals>(initialSignals);

  const profile =
    timeDilationProfiles.find((candidate) => candidate.id === profileId) ??
    timeDilationProfiles[0];

  const session = buildTimeDilationSession(profile, learningMode, signals);

  const updateSignal = (field: keyof TemporalSignals, value: number) => {
    setSignals((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleProfileChange = (nextProfileId: string) => {
    const nextProfile =
      timeDilationProfiles.find((candidate) => candidate.id === nextProfileId) ??
      timeDilationProfiles[0];

    setProfileId(nextProfileId);
    setLearningMode(nextProfile.preferredMode);
    setSignals((current) => ({
      ...current,
      focus: Math.max(current.focus, nextProfile.focusCadence),
      sensoryTolerance: Math.max(current.sensoryTolerance, nextProfile.sensoryIntensity - 2),
    }));
  };

  const applyAccelerationPreset = () => {
    setSignals({
      focus: 92,
      retention: 84,
      strain: 18,
      drift: 12,
      sensoryTolerance: 82,
      sessionMinutes: 32,
      contentComplexity: 36,
      priorMomentum: 88,
    });
  };

  const normalizeSession = () => {
    setSignals({
      ...initialSignals,
      sessionMinutes: signals.sessionMinutes,
      contentComplexity: signals.contentComplexity,
    });
  };

  return (
    <>
      <Head>
        <title>StarkEd Temporal Learning Studio</title>
        <meta
          name="description"
          content="A frontend prototype for adaptive learning acceleration with temporal pacing, personalization, and safety guardrails."
        />
      </Head>

      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Frontend Feature Prototype</span>
            <h1 className={styles.title}>Temporal Learning Studio</h1>
            <p className={styles.subtitle}>
              A safe frontend interpretation of time-dilation learning: adaptive pacing,
              intensified focus windows, and reversible guardrails that compress how a study
              block feels without pretending to alter real-world time.
            </p>

            <div className={styles.heroActions}>
              <button className={styles.primaryButton} onClick={applyAccelerationPreset}>
                Unlock 2x+ Projection
              </button>
              <button className={styles.secondaryButton} onClick={normalizeSession}>
                Normalize Session
              </button>
              <a className={styles.textLink} href="/notifications-demo">
                View existing demo
              </a>
            </div>

            <div className={styles.notice}>
              <strong>Safety note:</strong> this interface models cognitive pacing and feedback
              heuristics. It does not claim medical efficacy, neurofeedback treatment, or literal
              manipulation of time perception.
            </div>
          </div>

          <div className={styles.heroPanel}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Recommended scale</span>
              <strong className={styles.statValue}>{session.recommendedScale.toFixed(1)}x</strong>
              <span className={styles.statHint}>Projected learning pace multiplier</span>
            </div>
            <div className={styles.statGrid}>
              <div className={styles.miniStat}>
                <span className={styles.miniLabel}>Projected speed gain</span>
                <strong>{session.projectedSpeedGain}%</strong>
              </div>
              <div className={styles.miniStat}>
                <span className={styles.miniLabel}>Perceived study span</span>
                <strong>{session.perceivedMinutes} min</strong>
              </div>
              <div className={styles.miniStat}>
                <span className={styles.miniLabel}>Mastery confidence</span>
                <strong>{session.masteryConfidence}%</strong>
              </div>
              <div className={styles.miniStat}>
                <span className={styles.miniLabel}>Safety state</span>
                <strong>{session.safety.label}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.mainGrid}>
          <div className={styles.column}>
            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <span className={styles.panelEyebrow}>Personalization</span>
                  <h2>Time dilation profiles</h2>
                </div>
                <p>{profile.description}</p>
              </div>

              <div className={styles.profileGrid}>
                {timeDilationProfiles.map((candidate) => (
                  <button
                    key={candidate.id}
                    className={
                      candidate.id === profile.id
                        ? `${styles.profileCard} ${styles.profileCardActive}`
                        : styles.profileCard
                    }
                    onClick={() => handleProfileChange(candidate.id)}
                  >
                    <strong>{candidate.name}</strong>
                    <span>{candidate.description}</span>
                    <small>
                      Cadence {candidate.focusCadence}% • Max {candidate.maxScale.toFixed(1)}x
                    </small>
                  </button>
                ))}
              </div>

              <div className={styles.modeGrid}>
                {learningModes.map((mode) => (
                  <button
                    key={mode.id}
                    className={
                      mode.id === learningMode
                        ? `${styles.modeCard} ${styles.modeCardActive}`
                        : styles.modeCard
                    }
                    onClick={() => setLearningMode(mode.id)}
                  >
                    <strong>{mode.label}</strong>
                    <span>{mode.description}</span>
                  </button>
                ))}
              </div>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <span className={styles.panelEyebrow}>Telemetry</span>
                  <h2>Adaptive temporal controls</h2>
                </div>
                <p>Move the dials and the engine updates acceleration, decompression, and safety limits in real time.</p>
              </div>

              <div className={styles.sliderGrid}>
                {(Object.keys(metricLabels) as Array<keyof TemporalSignals>).map((key) => {
                  const value = signals[key];
                  const max = key === 'sessionMinutes' ? 60 : 100;
                  const min = key === 'sessionMinutes' ? 15 : 0;
                  const suffix = key === 'sessionMinutes' ? ' min' : '%';

                  return (
                    <label className={styles.sliderRow} key={key}>
                      <div className={styles.sliderHeader}>
                        <span>{metricLabels[key]}</span>
                        <strong>
                          {value}
                          {suffix}
                        </strong>
                      </div>
                      <input
                        className={styles.slider}
                        type="range"
                        min={min}
                        max={max}
                        value={value}
                        onChange={(event) => updateSignal(key, Number(event.target.value))}
                      />
                    </label>
                  );
                })}
              </div>
            </article>
          </div>

          <div className={styles.column}>
            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <span className={styles.panelEyebrow}>Live output</span>
                  <h2>Temporal feedback and adjustment</h2>
                </div>
                <p>{session.safety.reason}</p>
              </div>

              <div className={styles.feedbackGrid}>
                {session.feedback.map((item) => (
                  <div
                    key={item.id}
                    className={
                      item.tone === 'warning'
                        ? `${styles.feedbackCard} ${styles.feedbackWarning}`
                        : item.tone === 'positive'
                        ? `${styles.feedbackCard} ${styles.feedbackPositive}`
                        : styles.feedbackCard
                    }
                  >
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                ))}
              </div>

              <div className={styles.timeline}>
                {session.protocol.map((phase) => (
                  <div className={styles.timelineRow} key={phase.name}>
                    <div className={styles.timelineHeader}>
                      <div>
                        <strong>{phase.name}</strong>
                        <span>{phase.objective}</span>
                      </div>
                      <small>
                        {phase.minutes} min • {phase.intensity}
                      </small>
                    </div>
                    <div className={styles.timelineBar}>
                      <span
                        className={styles.timelineFill}
                        style={{ width: `${(phase.minutes / signals.sessionMinutes) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <span className={styles.panelEyebrow}>Safety systems</span>
                  <h2>Constraints and intervention</h2>
                </div>
                <p>Every acceleration recommendation is reversible, capped, and monitored for overload before it reaches the learner.</p>
              </div>

              <div className={styles.guardrailGrid}>
                <div className={styles.guardrailCard}>
                  <strong>Adaptive ceiling</strong>
                  <p>
                    The current profile can rise to {session.safety.maxAllowedScale.toFixed(1)}x
                    before guardrails cut the tempo.
                  </p>
                </div>
                <div className={styles.guardrailCard}>
                  <strong>Auto-pause</strong>
                  <p>
                    {session.safety.autoPause
                      ? 'Triggered now: the engine recommends a reset before more compression.'
                      : 'Standing by: the system will pause only if strain or drift crosses the recovery threshold.'}
                  </p>
                </div>
                <div className={styles.guardrailCard}>
                  <strong>Reversibility</strong>
                  <p>
                    {session.safety.reversible
                      ? 'All adjustments can return to a neutral cadence without losing the study plan.'
                      : 'Manual review required before the next pacing change.'}
                  </p>
                </div>
              </div>

              <div className={styles.acceptanceCard}>
                <h3>Issue acceptance alignment</h3>
                <ul>
                  <li>
                    Projected acceleration can exceed 200% when focus, recall, and safety metrics
                    stay in the stable window.
                  </li>
                  <li>
                    Reversible guardrails automatically taper or pause the experience when strain or
                    temporal drift rises.
                  </li>
                  <li>
                    Personalized profiles adapt pacing, sensory intensity, and decompression timing.
                  </li>
                  <li>
                    Feedback prompts prioritize focus and retention instead of pushing unsafe speed.
                  </li>
                </ul>
              </div>
            </article>
          </div>
        </section>
      </main>
    </>
  );
}
