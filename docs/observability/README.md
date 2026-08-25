# Observability

Operational documentation for the AetherMint platform (Issue #415): how we
measure reliability, how we alert on it, and how on-call engineers respond.

| Document | Contents |
| --- | --- |
| [slo.md](slo.md) | Service-level objectives for the enrollment, verification, and playback journeys, error budgets, and measurement |
| [alerting.md](alerting.md) | Alert rules, routing to the on-call rotation, and the escalation contract |
| [runbook.md](runbook.md) | Incident response process, severity model, escalation paths, and per-alert runbooks |

## How it fits together

1. The backend emits journey metrics
   (`backend/src/metrics/slo.ts`) for enrollment, verification, and playback.
2. Prometheus scrapes `GET /api/metrics` and evaluates the recording and
   alerting rules in `infra/observability/prometheus/slo-alerts.yaml`.
3. Grafana visualises SLO compliance and error budgets
   (`infra/observability/grafana/`).
4. Alertmanager routes `page` alerts to the on-call rotation and `ticket`
   alerts to the team channel (`infra/observability/alertmanager/`).

Deployment instructions for the monitoring stack live in
[`infra/observability/README.md`](../../infra/observability/README.md).

## Ownership and review

The SLO targets and alert thresholds are reviewed monthly (see the reporting
section of [slo.md](slo.md)). Changes to the SLOs, alert rules, or the
runbook go through the same review as production code.
