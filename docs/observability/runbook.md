# On-call runbook

This runbook is the first place an on-call engineer looks when an alert fires.
It covers the incident response process, the severity model, escalation
paths, and one section per alert. The alert rules are defined in
[`alerting.md`](alerting.md); the metrics they reference are described in
[`slo.md`](slo.md).

## Incident response process

1. **Acknowledge** the alert in the on-call platform within 15 minutes. If you
   do not acknowledge, the platform escalates to the backup on-call.
2. **Assess.** Open the Grafana dashboard
   (`infra/observability/grafana/`), confirm the affected journey, and check
   whether the error ratio is rising or flat. Read the alert's `description`
   annotation for the current value.
3. **Mitigate first, diagnose second.** If a rollback, traffic reroute, or
   failover can stop the bleeding, do it and record it. Do not fix forward
   under pressure unless the fix is trivially safe.
4. **Declare an incident** if the journey is down or the error budget is
   burning fast. Announce in the team channel, open an incident thread, and
   assign a scribe.
5. **Communicate.** Post a status update every 30 minutes for `page`
   incidents. Include: what is affected, what is being done, and the current
   estimate.
6. **Resolve and review.** When the journey is healthy for at least 15
   minutes, resolve the alert, archive the thread, and schedule the
   post-incident review within 5 working days.

## Severity model

| Severity | Definition | Example | Initial response |
| --- | --- | --- | --- |
| **SEV-1** | Journey fully down, or data loss / security breach | Playback 100% failing | On-call pages immediately; SRE lead notified |
| **SEV-2** | Journey degraded or error budget burning fast | Enrollment error ratio 20% | On-call pages; fix within the shift |
| **SEV-3** | Error budget trending toward depletion, no user-visible impact yet | Budget below 25% | Ticket; handled during working hours |

## Escalation paths

```
On-call primary ──15 min──▶ On-call backup ──30 min──▶ SRE lead ──▶ Major incident (SEV-1)
     │                                                         │
     └── support: backend team, infra team, security team ◀───┘
```

- **Acknowledged but not resolved in 2 h** (SEV-2) → bring in the SRE lead.
- **SEV-1 or suspected security issue** → SRE lead + security team
  immediately. Security incidents follow `docs/security/` procedures.
- **Multi-journey failure** → likely shared infrastructure (database, Redis,
  network). Escalate to infra immediately instead of debugging per-journey.

## Where to look

- Metrics: `GET /api/metrics` (needs `X-Internal-Key` when
  `INTERNAL_METRICS_KEY` is set) and the Grafana SLO dashboard.
- Backend logs: standard output of the backend pods; aggregated by the
  logging pipeline. Look for `ERROR` lines around the alert timestamp.
- Health: `GET /api/health` per pod and per region.
- Deploys: check whether a deployment or release landed in the last hour
  (`kubectl rollout history deploy/aethermint-backend`).
- State: PostgreSQL, MongoDB, and Redis health per `docs/infrastructure/`.

## Alert-specific runbooks

### AetherMintSLOPageFastBurn / AetherMintSLOPageLongBurn

The `<journey>` journey is consuming its error budget too fast.

1. Confirm on the dashboard whether the failure rate is uniform or spiky.
2. Check backend pod health and recent deploys (`Where to look`).
3. If a recent deploy correlates, roll back the backend image.
4. Check the journey's dependencies:
   - **enrollment** → payment service and the enrollment contract
     (`backend/src/services/EnrollmentService.ts`, `PaymentService.ts`)
   - **verification** → the event/credential contract reads
     (`backend/src/services/eventLoggerService.ts`)
   - **playback** → IPFS node and content cache
     (`backend/src/services/ipfs.js`)
5. If a dependency is down, follow the failover runbook
   (`docs/infrastructure/multi-region.md`) for cross-region recovery.

### AetherMintCriticalErrorRate

More than 10% of a journey's requests are failing.

1. Pull the error ratio over the last 5–30 minutes.
2. Identify the error class from logs: 5xx from the app, timeouts to
   PostgreSQL/Redis, or contract RPC failures.
3. Apply the matching mitigation below; otherwise follow the fast-burn steps.

### AetherMintJourneyNoSuccess

Traffic is flowing but nothing succeeds for 10 minutes — likely a total outage
of the journey.

1. Verify the backend is serving `/api/health` (check `livenessProbe`).
2. If pods are crash-looping, check `kubectl logs` for a startup failure and
   consider rolling back.
3. If pods are healthy, the journey's external dependency is failing — see
   the per-journey dependency list above.

### AetherMintSLOTicketShortBurn / AetherMintErrorBudgetDepleted

Slow-burn degradation. No immediate action required, but:

1. Create a tracking ticket with the error ratio charts attached.
2. Assign a root-cause owner and a due date (same sprint).
3. Do not ship risky changes to the affected journey until the budget recovers
   above 50%.

## General mitigations

| Symptom | Quick action |
| --- | --- |
| Backend errors after a deploy | Roll back `aethermint-backend` to the previous image |
| PostgreSQL slow / down | Check replication lag; consider promoting region-b (`docs/infrastructure/multi-region.md`) |
| Redis down | Cache loss only — sessions re-establish; do not treat as data loss |
| MongoDB down | Verification and enrollment reads fail; check replica set majority |
| IPFS unreachable | Playback fails; check IPFS node and pinning, fall back to CDN if configured |
| Contract RPC failures | Verification fails; check the Stellar RPC endpoint and network config |

## Post-incident review template

- Timeline (T0 detect → T1 acknowledge → T2 mitigate → T3 resolve)
- Impact (journey, error ratio, error budget consumed, users affected)
- Root cause (one paragraph, five whys)
- What went well / what went wrong
- Action items with owners and due dates — track to completion in the next
  SLO review
