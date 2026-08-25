# Alerting and on-call

This document describes the alerting rules shipped in
`infra/observability/prometheus/slo-alerts.yaml`, how alerts are routed to the
on-call rotation, and the escalation contract. The SLO targets the rules are
based on are defined in [`slo.md`](slo.md).

## Alert rules

All rules carry a `journey` label (`enrollment`, `verification`, `playback`)
and a `severity` of `page` or `ticket`.

| Alert | Severity | Condition | What it means |
| --- | --- | --- | --- |
| `AetherMintSLOPageFastBurn` | page | error ratio > 14.4× target over 5m **and** 30m | Budget would be exhausted in < 2 h — active incident |
| `AetherMintSLOPageLongBurn` | page | error ratio > 6× target over 30m **and** 2h | Budget would be exhausted in ~5 h |
| `AetherMintSLOTicketShortBurn` | ticket | error ratio > 3× target over 2h **and** 24h | Budget would be exhausted in ~1 day |
| `AetherMintCriticalErrorRate` | page | > 10% of journey requests failing over 5m | Journey is mostly erroring right now |
| `AetherMintJourneyNoSuccess` | page | no successful request for 10m while traffic continues | Total outage of the journey |
| `AetherMintErrorBudgetDepleted` | ticket | < 25% of the 30-day budget remaining | Reliability risk; schedule remediation |

Burn-rate thresholds assume the 99.9% targets for verification/playback
(0.1% budget). For enrollment (99.5%, 0.5% budget) the same absolute ratios
correspond to a burn rate that consumes the budget about 5× faster; this is
intentional — enrollment is the paid journey and degrades fast when the
payment path breaks.

## Routing and the on-call rotation

Alertmanager (`infra/observability/alertmanager/`) routes:

- `severity=page` → **on-call rotation** via webhook (Opsgenie or PagerDuty),
  with email as fallback.
- `severity=ticket` → team Slack channel, with email as fallback.

The rotation (who is on call, shift schedule, handover) is owned by the
on-call platform and is deliberately not stored in this repository.
Alertmanager only forwards `page` alerts to it; the on-call platform handles
acknowledgement, escalation timers, and shift changes.

### Wiring the rotation

Export these variables on the Alertmanager pod (see
[`infra/observability/README.md`](../../infra/observability/README.md)):

- `ON_CALL_WEBHOOK_URL` and `ON_CALL_API_KEY` — the on-call platform endpoint
  and integration key.
- `SLACK_WEBHOOK_URL` — the `#aethermint-alerts` channel.
- `ALERTMANAGER_EMAIL_TO` and SMTP settings — email fallback.

If the webhook variables are unset, `page` alerts fall back to email so the
system still degrades gracefully.

## Escalation contract

| Level | Responsibility | Response time | Escalation |
| --- | --- | --- | --- |
| **On-call (page)** | Triage the incident, mitigate, and decide whether to declare a full incident | 15 min to acknowledge | After 15 min unacknowledged the on-call platform escalates to the on-call backup |
| **On-call backup** | Cover when the primary does not acknowledge or needs support | 30 min | After 30 min unacknowledged, escalate to the SRE lead |
| **SRE lead** | Coordinate cross-team response and communications | 1 h | Declares a major incident if needed |
| **Engineering team** | Support diagnosis and fix; run the post-incident review | Same day | — |

Page-worthy conditions (per the runbook) require at least one person to act
within 15 minutes; ticket alerts are handled during working hours.

## Alert hygiene

- **No alert without a runbook entry.** Every rule in the table above has a
  section in [`runbook.md`](runbook.md).
- **Prefer multi-window rules.** Single-window thresholds either page too
  early (noise) or too late (budget exhausted). The burn-rate rules use two
  windows each.
- **Review monthly.** During the SLO review (see [`slo.md`](slo.md)), check
  alerting rates. A rule that fired with no actionable outcome is either
  wrong or needs a better runbook.
