/**
 * SLO Metrics
 *
 * Journey-level metrics that back the service-level objectives defined in
 * `docs/observability/slo.md`. Each of the three core user journeys
 * (enrollment, verification, playback) emits a labelled counter of
 * success/failure outcomes plus a duration histogram, so Prometheus recording
 * rules can compute error ratios, error budgets, and burn rates.
 *
 * Metrics are registered on the same registry used by the HTTP middleware so
 * they are exposed together on GET /api/metrics.
 */

import client from 'prom-client';
import { register } from '../middleware/metrics';

export type SloJourney = 'enrollment' | 'verification' | 'playback';
export type SloResult = 'success' | 'failure';

/** The journeys covered by an SLO. Any new journey needs a matching SLO doc. */
export const SLO_JOURNEYS: SloJourney[] = ['enrollment', 'verification', 'playback'];

/**
 * Total requests for SLO-tracked journeys, split by outcome so the error
 * ratio can be derived as failures / total over any window.
 */
export const sloRequestsTotal = new client.Counter({
  name: 'aethermint_slo_requests_total',
  help: 'Total requests for SLO-tracked user journeys, labelled by journey and result',
  labelNames: ['journey', 'result'],
  registers: [register],
});

/**
 * Duration of successful SLO-tracked journey requests in seconds. Only
 * successful outcomes are observed so latency percentiles reflect good
 * requests (failed requests are short-circuited and would skew the curve).
 */
export const sloRequestDurationSeconds = new client.Histogram({
  name: 'aethermint_slo_request_duration_seconds',
  help: 'Duration of successful SLO-tracked user journey requests in seconds',
  labelNames: ['journey'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [register],
});

/**
 * Unix timestamp (seconds) of the last successful request for each journey.
 * A stale timestamp relative to the request rate is a strong early signal
 * that a journey is completely broken.
 */
export const sloLastSuccessTimestamp = new client.Gauge({
  name: 'aethermint_slo_last_success_timestamp_seconds',
  help: 'Unix timestamp of the last successful SLO-tracked journey request',
  labelNames: ['journey'],
  registers: [register],
});

function elapsedSeconds(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1e9;
}

/**
 * Record a single journey outcome. Durations are only observed for successful
 * requests (see sloRequestDurationSeconds above).
 */
export function recordSlo(
  journey: SloJourney,
  result: SloResult,
  durationSeconds?: number,
): void {
  sloRequestsTotal.inc({ journey, result });

  if (result === 'success') {
    sloLastSuccessTimestamp.set({ journey }, Date.now() / 1000);
    if (durationSeconds !== undefined && durationSeconds >= 0) {
      sloRequestDurationSeconds.observe({ journey }, durationSeconds);
    }
  }
}

/**
 * Runs an async journey operation, timing it and recording the outcome.
 * Success/failure is determined by promise resolution; the error is re-thrown
 * so callers keep their existing error handling.
 */
export async function timeSloJourney<T>(
  journey: SloJourney,
  fn: () => Promise<T>,
): Promise<T> {
  const start = process.hrtime.bigint();
  try {
    const result = await fn();
    recordSlo(journey, 'success', elapsedSeconds(start));
    return result;
  } catch (error) {
    recordSlo(journey, 'failure', elapsedSeconds(start));
    throw error;
  }
}
