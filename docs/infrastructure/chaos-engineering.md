# Chaos Engineering & Resilience Runbook

This document defines the chaos engineering experiments, expected resilience
behaviour, and operational response for the AetherMint platform.

## Purpose

Proactively validate that AetherMint degrades gracefully when key
dependencies fail or become latent. Each experiment targets a specific
dependency and asserts measurable recovery behaviour.

Chaos experiments are **not** ad-hoc breakage — every experiment has:

- A defined **steady state** measured before injection
- A specific **failure mode** injected in a controlled manner
- **Assertions** that verify graceful degradation (no crash, no 500)
- **Recovery verification** with RTO/RPO measurements

## Experiment catalogue

| Experiment | Target | Failure mode | Expected behaviour |
|---|---|---|---|
| `redis-failure` | Redis (ioredis) | Complete unavailability | Backend stays healthy; circuit breaker opens; Redis-dependent features return fallback or controlled errors |
| `redis-latency` | Redis (ioredis) | 500ms latency injection | Health returns 200; latency increases within tolerance; no timeouts cascade to crash |
| `mongo-failure` | MongoDB (mongoose) | Container stopped | Health returns 200; model operations time out gracefully; no crash |
| `rpc-failure` | Stellar/Soroban RPC | Outbound traffic blocked | Health returns 200; contract queries error cleanly; non-blockchain endpoints unaffected |
| `pod-termination` | Backend container | SIGKILL | Process dies; Docker/Orchestrator restarts; recovery within 60s RTO |

## Running experiments

### Quick start (local, non-destructive)

```bash
# Run all safe (non-destructive) experiments locally
scripts/chaos/run-experiments.sh
```

### Specific experiment

```bash
scripts/chaos/run-experiments.sh --experiment redis
scripts/chaos/run-experiments.sh --experiment mongo
scripts/chaos/run-experiments.sh --experiment rpc
```

### Staging (destructive experiments enabled)

```bash
# pod-termination is only enabled with STAGING=true
STAGING=true scripts/chaos/run-experiments.sh --experiment pod
```

### Dry run (print plan only)

```bash
scripts/chaos/run-experiments.sh --dry-run
```

## CI integration

The chaos suite runs automatically:

- **Weekly** (Sunday 06:00 UTC) via scheduled GitHub Actions
- **On PRs** that modify `scripts/chaos/**` or `.github/workflows/chaos.yml`
- **On demand** via `workflow_dispatch` from the Actions tab

Results are uploaded as workflow artifacts (`chaos-results`) retained for 90
days and summarised in the run summary. See `.github/workflows/chaos.yml`.

## Interpreting results

Each experiment produces a JSON report in `.chaos-results/`:

```json
{
  "experiment": "redis-failure",
  "run_id": "chaos-20260101T120000Z",
  "result": "pass",
  "baseline": { "latency_ms": 15, "health_status": 200 },
  "during_outage": { "health_status": 200, "latency_ms": 27 },
  "after_recovery": { "health_status": 200, "latency_ms": 18 },
  "assertions": { "passed": 6, "total": 6 }
}
```

A consolidated `summary.json` aggregates all experiment outcomes for the run.

### Failure signals

| Signal | Meaning | Action |
|---|---|---|
| `result: "fail"` | At least one assertion violated | Investigate which assertion failed (see experiment log) |
| `health_status: "000"` | Backend unreachable | Backend may have crashed; check logs, increase connection timeout |
| `result: "aborted"` | Baseline health not healthy | Backend not running or unhealthy before experiment started |
| Latency > threshold | Dependency call times out or cascades | Review timeout configs, circuit breaker thresholds, connection pooling |
| Recovery timeout | Backend did not recover before RTO | Check restart policies, readiness probes, reconnection logic |

## RTO/RPO targets

These targets align with the multi-region failover contract defined in
`docs/infrastructure/multi-region.md`:

| Metric | Target | Measurement |
|---|---|---|
| RTO (Recovery Time Objective) | ≤ 15 minutes | T4 — T0 (failure detected to smoke tests pass) |
| Redis cache loss | Acceptable | Cache is not source of truth; session re-establishment acceptable |
| MongoDB data loss | RPO ≤ 5 minutes | Replication lag at time of promotion |

The pod-termination experiment specifically measures container-level RTO
(target ≤ 60s for a single backend instance).

## Runbook: responding to findings

### Experiment fails in CI

1. Download the `chaos-results` artifact from the workflow run.
2. Identify the failing experiment and assertion from `summary.json`.
3. Check the per-experiment JSON report for specific metrics.
4. Reproduce locally:
   ```bash
   STAGING=true scripts/chaos/run-experiments.sh --experiment <name>
   ```
5. Drill into backend logs for the failure window.

### Common causes

| Symptom | Likely cause | Fix |
|---|---|---|
| Backend crashes on dependency failure | Unhandled connection errors | Add try/catch or `.catch()` handlers around dependency init; verify mongoose `bufferCommands: false` is set for non-critical models |
| Circuit breaker doesn't open | Threshold too high or not implemented | Review `backend/src/config/redis.ts` — verify `circuitBreakerThreshold` and `handleFailure` wiring |
| Recovery takes > RTO | Restart delay or readiness probe too slow | Review Docker Compose `restart: unless-stopped`, healthcheck intervals, Kubernetes readiness probe `initialDelaySeconds` |
| 500 errors during outage | Missing fallback in a dependency path | Audit middleware/services that call Redis/Mongo directly; ensure `redisConfig.getRawClient()` null-checks exist |

### Adding a new experiment

1. Create `scripts/chaos/experiments/<name>.sh` following the existing pattern:
   - Phase 0: Baseline measurement
   - Phase 1: Inject failure
   - Phase 2: Assertions during failure
   - Phase 3: Recovery
   - Phase 4: Recovery assertions
   - Output: JSON report to `$OUTPUT_DIR/<name>.json`
2. Register the experiment in `scripts/chaos/run-experiments.sh`.
3. Update the table in this document.
4. Run locally and verify the JSON report schema.

## Feedback loop

Experimental findings should feed directly back into resilience improvements.
Open an issue referencing the experiment and include:

- The experiment name and run ID
- The specific assertion that failed
- The measured metric vs. expected threshold
- Proposed fix (timeout tuning, circuit breaker threshold, retry logic)

Template: `[Resilience] <experiment> failed — <metric> exceeded threshold`

## References

- `scripts/chaos/run-experiments.sh` — Orchestrator
- `scripts/chaos/experiments/` — Individual experiment definitions
- `.github/workflows/chaos.yml` — Scheduled and on-demand CI runs
- `docs/infrastructure/multi-region.md` — Regional failover RTO/RPO targets
- `backend/src/config/redis.ts` — Redis circuit breaker implementation
- `backend/src/utils/shutdown.ts` — Graceful shutdown and drain logic