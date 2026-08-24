# On-call Runbook

This runbook is the playbook for detecting, triaging, and resolving incidents
that affect AetherMint's core user journeys. Read it before your first on-call
shift and keep it open while you are on call.

## On-call rotation

- **Rotation:** a weekly primary/secondary rotation. The primary owns the
  pager; the secondary shadows and backs them up.
- **Handoff:** every Monday, the outgoing primary walks the incoming primary
  through open incidents, known issues, and the state of the error budgets.
- **Coverage:** 24×7. During business hours the primary is expected to respond
  within 5 minutes; outside business hours within 15 minutes.
- **Tooling:** alerts are delivered to the on-call rotation through Grafana
  On-Call (or your preferred on-call tool — see
  [`infra/grafana/README.md`](../../infra/grafana/README.md) for the
  integration). The rotation schedule itself is owned by the platform team
  and managed in the on-call tool, not in this repository.

## Severity definitions

| Severity | Definition | Examples | Initial response |
| --- | --- | --- | --- |
| **SEV-1** | Core journey fully unavailable, or security/data-loss incident | Enrollment API 100% 5xx, credential data loss, key compromise | Immediate; escalate to platform lead |
| **SEV-2** | Core journey degraded, error budget burning fast, or partial outage | SLO burn-rate critical alert, one region down | Within 15 minutes |
| **SEV-3** | Non-core degradation or slow burn; no user impact yet | SLO warning alert, elevated latency | Same business day |

## Incident detection

Incidents are detected through the alert rules in
[`infra/prometheus/slo-alerts.yml`](../../infra/prometheus/slo-alerts.yml):

- **SloBurnRateCritical / SloBurnRateWarning** — error budget burning faster
  than expected for enrollment, verification, or playback.
- **CriticalErrorRate** — high 5xx rate on the backend.
- **BackendDown** — the backend is unreachable.

Any SEV-1/SEV-2 alert pages the on-call rotation. If you are the on-call
engineer and get paged, follow the triage flow below.

## Triage flow

1. **Acknowledge the page** in the on-call tool so the rotation knows someone
   is working it.
2. **Open the dashboards** (Grafana): `SLOs` dashboard for journey-level
   compliance, error budget, and latency; `Overview` for backend/region health.
3. **Confirm the blast radius:** which journey(s) are affected, which region(s),
   and is it errors, latency, or both? Check `aethermint_slo_requests_total`
   by `result` and `aethermint_http_requests_total` by `status_code`.
4. **Check recent changes:** the incident often correlates with a deploy or a
   config change. Check the release feed and `kubectl rollout status` for the
   affected region(s).
5. **Mitigate first, debug second:** roll back the last deploy, scale out, or
   fail over to the standby region per the multi-region runbook
   (`scripts/failover-region.sh`, [`docs/infrastructure/multi-region.md`](../../docs/infrastructure/multi-region.md))
   before deep debugging.
6. **Announce** in the `#incidents` channel: severity, journey, region, and
   what you are doing. Update the announcement as the situation changes.
7. **Create a tracking issue** for the incident if it is not resolved in
   ~30 minutes or is SEV-2 or above.

## Journey-specific runbooks

### Enrollment (`POST /api/enrollments`)

1. Check the enrollment SLO panels and `aethermint_enrollment_total`.
2. Check PostgreSQL health (`DATABASE_URL` pool, replication lag) — enrollment
   writes go through PostgreSQL.
3. Check payment provider responses — enrollment may fail at the payment step
   (Stellar / card), not in our own stack.
4. Common fixes: DB connection exhaustion (restart/scale Postgres), a stuck
   migration (see `backend/migrations/` and `npm run migrate:status`), payment
   provider outage (status page; retry/queue).

### Verification (`POST /api/v1/fraud-detection/verify-credential`)

1. Check the verification SLO panels and `aethermint_credential_issuance_total`.
2. Check the Stellar/Soroban RPC (`STELLAR_RPC_URL`) — on-chain verification
   calls depend on RPC availability.
3. Check the contract address / network config in the environment; a wrong
   `CONTRACT_ADDRESS` or testnet/mainnet mismatch surfaces here.
4. Common fixes: RPC rate limiting (increase retries/backoff), contract
   not paused (call `is_paused` on the contract), wrong network env.

### Playback (`GET /api/content/*`)

1. Check the playback SLO panels and request rate by status.
2. Check IPFS gateway/API (`IPFS_GATEWAY_URL`, `IPFS_API_URL`) and the content
   CDN (`docs/infrastructure/cdn.md`).
3. Check cache layers (Redis, CDN) for a hot-path failure.
4. Common fixes: IPFS node/gateway outage (fail over to a second gateway),
   CDN purge storms, large-content timeouts (raise the gateway timeout).

## Escalation paths

```
On-call engineer (primary) ── 15 min, no resolution ──▶ Secondary
Secondary ── 30 min, no resolution ──▶ Platform lead (SEV-2+)
Platform lead ── any SEV-1 ──▶ Engineering manager / product owner
```

Escalate when: you cannot identify the cause, the blast radius is growing,
the error budget for the journey is fully consumed, or the incident involves
data loss or security (SEV-1 — escalate immediately, do not wait).

## Communication

- All incidents get a thread in `#incidents`. Post a short update every
  30 minutes for SEV-2 and every 15 minutes for SEV-1, even if nothing
  changed.
- If the incident is user-visible for more than 15 minutes, open the status
  page (or post to `#announcements`) with severity, affected journeys, and an
  ETA.
- Never close an incident silently: resolve it in the on-call tool, then post
  the summary.

## Post-incident

1. **Close the incident** in the on-call tool with a summary.
2. **Write a postmortem** (within 5 business days for SEV-1, 10 for SEV-2):
   timeline, root cause, impact (including error budget consumed), actions
   taken, and follow-up items with owners.
3. **Follow-up items** become issues/PRs; if the incident consumed a
   significant share of the error budget, re-evaluate the SLO targets in
   `docs/observability/slos.md`.
