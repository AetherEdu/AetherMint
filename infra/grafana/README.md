# Observability: Grafana dashboards and alerting

This directory holds the Grafana dashboard and the Prometheus alert rules for
AetherMint's SLOs. The objectives, error budgets, and alerting policy live in
[`docs/observability/slos.md`](../../docs/observability/slos.md); the on-call
process lives in [`docs/observability/on-call-runbook.md`](../../docs/observability/on-call-runbook.md).

## Contents

- `dashboards/slos.json` — SLO compliance, error budget, error rate, and
  latency (P95) panels for the enrollment, verification, and playback journeys.
- `../prometheus/slo-alerts.yml` — burn-rate alerts (critical + warning),
  high-5xx route alerts, and a backend-down alert.

## Backend metrics

The backend exposes Prometheus metrics at `GET /api/metrics` (protected by
`X-Internal-Key` when `INTERNAL_METRICS_KEY` is set). SLO journey series:

- `aethermint_slo_requests_total{journey, result}` — counter
- `aethermint_slo_request_duration_seconds{journey}` — histogram

Journeys are classified by route in
[`backend/src/metrics/slo.ts`](../../backend/src/metrics/slo.ts). All metrics
share one registry (`backend/src/metrics/registry.ts`).

## Deploying Prometheus + Grafana

The Kubernetes manifests in `../kubernetes/` are provider-neutral; the
observability stack itself is not bundled into them. To stand it up:

1. **Scrape the backend.** Add a scrape job for the backend metrics endpoint.
   With Prometheus Operator:

   ```yaml
   apiVersion: monitoring.coreos.com/v1
   kind: ServiceMonitor
   metadata:
     name: aethermint-backend
     namespace: aethermint-region-a
   spec:
     selector:
       matchLabels:
         app.kubernetes.io/name: aethermint
     endpoints:
       - port: http
         path: /api/metrics
         interval: 30s
   ```

   Configure `INTERNAL_METRICS_KEY` in the `aethermint-runtime` secret and set
   the matching `X-Internal-Key` in the ServiceMonitor's
   `bearerTokenSecret`/headers. If the key is unset the endpoint is open.

2. **Load the alert rules.** Copy `infra/prometheus/slo-alerts.yml` into the
   Prometheus rules directory and `reload` (or apply a `PrometheusRule` CRD
   with the same `groups`). Validate first:

   ```bash
   promtool check rules infra/prometheus/slo-alerts.yml
   ```

3. **Import the dashboard.** Add `infra/grafana/dashboards/slos.json` as a
   provisioned dashboard, or import it via the Grafana UI. It expects a
   Prometheus datasource named `Prometheus` (override via the
   `DS_PROMETHEUS` variable).

## Wiring alerts to the on-call rotation

1. **Create the rotation** in Grafana On-Call (or your on-call tool:
   PagerDuty, Opsgenie, etc.) with a weekly primary/secondary schedule per
   the runbook.
2. **Create a contact point** in Grafana Alerting that routes to that
   rotation (Grafana On-Call integration, PagerDuty service, or Opsgenie
   team).
3. **Add a notification policy** matching the SLO alerts:
   - match `severity = "critical"` → page immediately (Grafana On-Call
     `notify_grade: page`),
   - match `severity = "warning"` → notify but do not page.
4. **Verify** by silencing a test alert and confirming the page arrives on
   the rotation's primary.

The rotation schedule itself is owned by the platform team and lives in the
on-call tool — it is intentionally not committed to this repository.
