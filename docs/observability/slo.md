# Service-level objectives

This document defines the service-level objectives (SLOs) for the core
AetherMint user journeys: **enrollment**, **verification**, and **playback**.
The SLOs are measured from the journey metrics emitted by the backend
(`backend/src/metrics/slo.ts`) and visualised on the Grafana dashboard in
`infra/observability/`.

## Definitions

- **SLI** (service-level indicator): a measurement of a user journey. We track
  availability (share of good requests) and latency (p95 duration of good
  requests) per journey.
- **Good request**: a request that completes the journey successfully and
  returns an HTTP 2xx. Client errors (4xx) are excluded from the denominator —
  they are not failures of the service. Server errors (5xx) and thrown
  exceptions count as bad requests.
- **SLO**: the target we commit to for each SLI over a rolling 30-day window.
- **Error budget**: the allowed share of bad requests over the window,
  `1 - availability target`. For a 99.9% SLO the budget is 0.1%.

## Journeys and targets

| Journey | SLI definition | Availability | Latency (p95) | Error budget / 30d |
| --- | --- | --- | --- | --- |
| **Enrollment** | `POST /api/enrollments` + enrollment event logging completes | 99.5% | 2 s | 3.6 h of bad requests |
| **Verification** | `GET /api/events/verify/:eventId` returns a definitive result | 99.9% | 1 s | 43 min of bad requests |
| **Playback** | `GET /api/content/:cid` delivers content to the client | 99.9% | 1 s | 43 min of bad requests |

The verification and playback journeys are read-heavy and fully cacheable, so
a higher target is realistic. Enrollment involves payment and contract
interactions, which justifies the lower target.

### Measurement

| Journey | Instrumented at | Metric |
| --- | --- | --- |
| Enrollment | `eventLoggerService.logCourseEnrollment()` | `aethermint_slo_requests_total{journey="enrollment"}` |
| Verification | `eventLoggerService.verifyEvent()` | `aethermint_slo_requests_total{journey="verification"}` |
| Playback | `routes/content.js` `GET /:cid` | `aethermint_slo_requests_total{journey="playback"}` |

Durations are recorded on the same instrumentation points into
`aethermint_slo_request_duration_seconds{journey}`. The metrics are exposed on
`GET /api/metrics` (protected by `INTERNAL_METRICS_KEY` when configured) and
scraped by Prometheus.

## Error budget and burn rate

The error budget is consumed when the ratio of bad requests to total requests
exceeds `1 - availability`. Because a 30-day window reacts slowly, alerting
uses **burn rate**: how fast the budget is being consumed relative to the
budget period.

- Burn rate 1: budget would last exactly the full 30 days.
- Burn rate 14.4: budget would be exhausted in ~2 hours — page immediately.
- Burn rate 6: exhausted in ~5 hours — page.
- Burn rate 3: exhausted in ~1 day — open a ticket.
- Burn rate 1: sustained at the target — monitor, no alert.

The alert rules in `infra/observability/prometheus/slo-alerts.yaml` implement
the multi-window, multi-burn-rate pattern so both sudden outages and slow
deterioration are caught while avoiding alert fatigue.

## Reporting

The Grafana dashboard (`infra/observability/grafana/`) shows, per journey:

- error budget remaining (24 h window)
- error ratio over time against the SLO target line
- p95/p99 latency
- request rate split by result, failure rate, and seconds since last success

At the end of every month, review each journey's SLO attainment over the
window. If the target was missed, document the reason in the incident review
and decide whether to relax the SLO (never silently), fix the root cause, or
accept the miss. If the target was exceeded comfortably for three consecutive
months, consider tightening it.
