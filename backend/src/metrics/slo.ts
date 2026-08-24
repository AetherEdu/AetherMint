/**
 * SLO journey metrics.
 *
 * Tracks the three core user journeys defined in
 * `docs/observability/slos.md` — enrollment, verification, playback — with
 * success/failure counters and a request-duration histogram. Prometheus
 * computes the availability SLO and error budget from these series:
 *
 * - `aethermint_slo_requests_total{journey, result}`
 * - `aethermint_slo_request_duration_seconds{journey}`
 *
 * A request is classified as `result="success"` when the response status is
 * < 500 (the service handled the request, including client-error 4xx) and
 * `result="failure"` when the status is >= 500. See the SLO doc for the
 * error-budget policy this maps to.
 */

import { Request, Response } from 'express';
import client from 'prom-client';
import { register } from './registry';

export type SloJourney = 'enrollment' | 'verification' | 'playback';

export const sloRequestsTotal = new client.Counter({
  name: 'aethermint_slo_requests_total',
  help: 'Total requests per core SLO journey, labeled by result (success/failure)',
  labelNames: ['journey', 'result'],
  registers: [register],
});

export const sloRequestDurationSeconds = new client.Histogram({
  name: 'aethermint_slo_request_duration_seconds',
  help: 'Duration in seconds of core SLO journey requests',
  labelNames: ['journey'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [register],
});

/**
 * Route-to-journey classification.
 *
 * Keyed on the request path (and method) because mounted routers expose only
 * their router-local `req.route.path`, which is not stable across mounts.
 */
const JOURNEY_ROUTE_MATCHERS: ReadonlyArray<{
  journey: SloJourney;
  method: string;
  matches: (path: string) => boolean;
}> = [
  {
    journey: 'enrollment',
    method: 'POST',
    matches: (path) =>
      path === '/api/enrollments' || path === '/api/events/course-enrollment',
  },
  {
    journey: 'verification',
    method: 'POST',
    matches: (path) => path === '/api/v1/fraud-detection/verify-credential',
  },
  {
    journey: 'playback',
    method: 'GET',
    matches: (path) => path.startsWith('/api/content/'),
  },
];

/** Classify a request into its SLO journey, or `undefined` if it is not one. */
export function classifyJourney(req: Request): SloJourney | undefined {
  const path = req.path;
  const method = req.method;
  for (const matcher of JOURNEY_ROUTE_MATCHERS) {
    if (matcher.method === method && matcher.matches(path)) {
      return matcher.journey;
    }
  }
  return undefined;
}

/**
 * Record SLO journey metrics for a completed request.
 *
 * `result` is derived from the HTTP status: < 500 is a success (including
 * client-error 4xx responses), >= 500 is a failure that consumes the error
 * budget. This mirrors the availability definition in `docs/observability/slos.md`.
 */
export function observeSloJourneyForRequest(
  req: Request,
  res: Response,
  durationSeconds: number
): void {
  const journey = classifyJourney(req);
  if (!journey) {
    return;
  }

  const result = res.statusCode < 500 ? 'success' : 'failure';
  sloRequestsTotal.inc({ journey, result });
  sloRequestDurationSeconds.observe({ journey }, durationSeconds);
}
