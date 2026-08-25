# Observability: SLOs, dashboards, alerting, on-call

Deployable resources that implement the observability plan for the
[`docs/observability/`](../../docs/observability/) SLOs (Issue #415):

| Directory | Resource | Purpose |
| --- | --- | --- |
| `prometheus/` | `PrometheusRule` | Recording rules (error ratio, error budget) and burn-rate / critical-error alerts |
| `grafana/` | Dashboard `ConfigMap` | SLO compliance, error budgets, latency, and traffic panels |
| `alertmanager/` | Alertmanager `ConfigMap` + templates | Routes alerts to the on-call rotation vs. the team channel |

## Prerequisites

- A Prometheus instance with the Prometheus Operator CRDs installed
  (`monitoring.coreos.com/v1`). The `PrometheusRule` requires the operator;
  without it, load the rule expressions manually.
- Prometheus must scrape the backend `/api/metrics` endpoint. When
  `INTERNAL_METRICS_KEY` is set, configure the scrape job with the header
  `X-Internal-Key: <key>`. A `ServiceMonitor` or pod-annotation scrape will
  both work.
- Grafana provisioned with a Prometheus datasource named `prometheus`
  (UID `prometheus`).

## Deploy

```bash
kubectl apply -k infra/observability
```

The resources are namespaced to `aethermint`; override with
`-n <prometheus-namespace>` or a kustomize overlay if the monitoring stack
lives in a different namespace.

### Grafana dashboard

The dashboard `ConfigMap` is labelled `grafana_dashboard: "1"`, which the
Grafana sidecar dashboard provider picks up automatically. Without the
sidecar, import `aethermint-slos.json` from the ConfigMap manually.

### Alertmanager and the on-call rotation

The Alertmanager config routes `severity=page` alerts to the on-call rotation
webhook and `severity=ticket` alerts to the team Slack channel, with email as
a fallback for both. No secrets are stored in this repository — export the
following environment variables on the Alertmanager pod (e.g. via a secret
referenced from the Alertmanager StatefulSet):

| Variable | Example | Purpose |
| --- | --- | --- |
| `ON_CALL_WEBHOOK_URL` | `https://api.opsgenie.com/v2/json/alert` or PagerDuty Events v2 URL | On-call rotation endpoint |
| `ON_CALL_API_KEY` | Opsgenie / PagerDuty integration key | Authenticates the on-call webhook |
| `SLACK_WEBHOOK_URL` | `https://hooks.slack.com/services/...` | Team alert channel |
| `ALERTMANAGER_EMAIL_TO` | `sre@example.com` | Email fallback for both severities |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USERNAME`, `SMTP_PASSWORD` | — | SMTP relay used by the email receivers |

The rotation itself (who is on call, when shifts change) is owned by the
on-call platform (Opsgenie / PagerDuty); Alertmanager only forwards `page`
severity alerts to it.

## Verify

```bash
# Rules are accepted
kubectl -n aethermint get prometheusrule aethermint-slo-alerts

# Alerts are firing / pending as expected
kubectl -n aethermint get prometheusrule aethermint-slo-alerts -o jsonpath='{.status}'
```

See [`docs/observability/alerting.md`](../../docs/observability/alerting.md)
for the alert semantics and [`docs/observability/runbook.md`](../../docs/observability/runbook.md)
for the response procedures.
