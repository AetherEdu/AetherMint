# Service-Level Objectives (SLOs)

This document defines the service-level objectives for AetherMint's core user
journeys, the error budgets they imply, and how compliance is measured and
alerted on. It is the source of truth for the Grafana dashboards and
Prometheus alert rules in [`infra/grafana/`](../../infra/grafana/) and
[`infra/prometheus/`](../../infra/prometheus/).

## SLO model

Each SLO is expressed as an **availability target** over a 30-day rolling
window, measured as:

```
availability = successful requests / total requests
```

A request is *successful* when the API responds with a status `< 500` (the
service handled it, including client-error 4xx responses) and *failed* when it
responds with `>= 500`. This maps directly to the SLO metrics emitted by the
backend:

- `aethermint_slo_requests_total{journey, result}` — counter of requests per
  journey and result (`success` | `failure`)
- `aethermint_slo_request_duration_seconds{journey}` — histogram of request
  duration per journey (latency SLOs use its P95)

Journeys are classified in [`backend/src/metrics/slo.ts`](../../backend/src/metrics/slo.ts)
by route:

| Journey | Route(s) | Method |
| --- | --- | --- |
| Enrollment | `/api/enrollments`, `/api/events/course-enrollment` | POST |
| Verification | `/api/v1/fraud-detection/verify-credential` | POST |
| Playback | `/api/content/*` | GET |

## Objectives

| Journey | Availability target | Latency target (P95) | Window |
| --- | --- | --- | --- |
| Enrollment | 99.9% | < 2.0 s | 30 days |
| Verification | 99.9% | < 1.0 s | 30 days |
| Playback | 99.5% | < 3.0 s | 30 days |

These targets assume the multi-region availability model in
[`infra/multi-region/regions.yaml`](../../infra/multi-region/regions.yaml)
(99.9% regional availability, 15-minute RTO). Adjust the targets when that
model changes rather than when an incident happens.

## Error budgets

Error budget over the 30-day window:

| Journey | Budget (failures allowed in 30 d) | Monthly budget |
| --- | --- | --- |
| Enrollment | 0.1% | 43.2 minutes of degraded service |
| Verification | 0.1% | 43.2 minutes |
| Playback | 0.5% | 3.6 hours |

Spending the budget is expected occasionally; the team should intentionally
burn up to ~10% of the budget on releases. When the budget is exhausted,
freeze feature releases for the journey until it recovers.

## Burn-rate alerting

Alerts use the multi-window, multi-burn-rate approach (Google SRE workbook) so
we detect both fast and slow error-budget consumption:

| Burn rate | Window 1 | Window 2 | Severity |
| --- | --- | --- | --- |
| Fast burn (≥ 14.4×) | 5 min | 30 min | `critical` |
| Slow burn (≥ 3×) | 2 h | 6 h | `warning` |

The thresholds are computed from a 30-day window (43,200 minutes): a 14.4×
burn rate consumes the entire budget in ~2.5 days and 3× in ~10 days. Alert
rules are in [`infra/prometheus/slo-alerts.yml`](../../infra/prometheus/slo-alerts.yml).

## Dashboards

[`infra/grafana/dashboards/slos.json`](../../infra/grafana/dashboards/slos.json)
visualizes, per journey:

- SLO compliance (current + historical) and error budget remaining
- Request rate split by result (success/failure)
- Latency percentiles (P50/P95/P99) from `aethermint_slo_request_duration_seconds`

Deploying the dashboard and wiring alerts to an on-call rotation is described
in [`infra/grafana/README.md`](../../infra/grafana/README.md).

## Reviewing and changing SLOs

SLOs are a product decision, not just an engineering one. Change them through
a PR that:

1. updates this document (including the rationale and expected budget),
2. updates the burn-rate thresholds in `infra/prometheus/slo-alerts.yml`, and
3. updates the dashboard targets in `infra/grafana/dashboards/slos.json`.

Aim to review SLOs quarterly and after any significant architecture change
(e.g. new regions, new storage layer).
