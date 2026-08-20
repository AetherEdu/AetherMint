# Multi-region deployment and failover

This document defines the provider-neutral deployment contract for AetherMint.
It keeps Kubernetes, DNS/GSLB, and stateful database operators replaceable while
making the topology and operational guarantees explicit.

## Architecture

- `region-a` is the normal primary region.
- `region-b` is a warm standby with the same stateless frontend and backend
  workloads.
- Each region runs independent Kubernetes resources from the corresponding
  overlay under `infra/kubernetes/overlays/`.
- Global routing uses latency-based selection among healthy regional endpoints.
  The desired state and health-check settings are in
  `infra/multi-region/edge-routing.yaml`.
- API traffic is never cached at the edge. Built frontend assets remain
  content-addressed and can be cached independently.

The routing provider must implement the `GlobalRoute` contract: HTTPS health
checks against `/api/health`, three failed checks before removal, two successful
checks before recovery, and no session affinity.

## Replication strategy

| Service | Strategy | Primary | Failover | Target |
| --- | --- | --- | --- | --- |
| PostgreSQL | Asynchronous physical standby | region-a | Promote verified standby in region-b | RPO ≤ 5 min |
| MongoDB | Replica set with majority writes | region-a | Reconfigure/promote a healthy member | Preserve majority acknowledgement |
| Redis | AOF-backed active/passive pair | region-a | Promote standby after data check | Cache loss is acceptable; sessions must be re-established |
| Frontend/backend | Stateless replicas in both regions | Both | Route traffic to healthy region | RTO ≤ 15 min |

PostgreSQL asynchronous replication is intentional: synchronous cross-region
writes would increase normal write latency and make the application dependent on
wide-area network availability. The replication operator must alert when lag
exceeds 300 seconds; that condition blocks automated promotion.

MongoDB writes use `majority` acknowledgement. Redis is not the source of truth;
losing its contents must not lose enrollments, credentials, or payments.

## Deployment sequence

1. Build immutable frontend and backend images and record their digests.
2. Create the `aethermint-runtime` secret independently in each cluster.
3. Apply the region-a overlay and wait for backend/frontend rollouts.
4. Provision or verify the stateful replication operators and replication lag.
5. Run application smoke tests against each regional endpoint.
6. Add the healthy endpoint to the global route only after all checks pass.
7. Repeat on every release; never promote an image tagged only `latest`.

## RTO/RPO measurement

The targets are:

- **RTO:** 15 minutes from declared regional failure to healthy traffic in the
  promoted region.
- **RPO:** 5 minutes maximum acknowledged-data loss for PostgreSQL, bounded by
  the measured replication lag at the time promotion is approved.

Record these timestamps during every exercise:

- `T0`: failure detected by health checks
- `T1`: incident declared and writes isolated in the failed region
- `T2`: stateful promotion completed
- `T3`: global route changed
- `T4`: application smoke tests pass

`T4 - T0` is the measured RTO. The replication lag at `T1` is the measured RPO.
Keep the results with the incident record.

## Failover runbook

The coordinator is intentionally dry-run by default:

```bash
scripts/failover-region.sh --from region-a --to region-b
```

An operator must verify replication lag, target health, and write isolation before
executing. Platform-specific commands are injected instead of stored in the
repository:

```bash
FAILOVER_APPROVED=true \
scripts/failover-region.sh \
  --from region-a \
  --to region-b \
  --execute \
  --promote '/usr/local/bin/promote-database' \
  --router '/usr/local/bin/switch-global-route' \
  --verify '/usr/local/bin/verify-aethermint'
```

Each injected command receives the relevant region arguments. The coordinator
will not execute without all three commands and the explicit approval flag.

### Rollback

Do not immediately route traffic back to the former primary. Keep it isolated,
repair replication, verify that it has caught up, and perform a planned
failback using the same procedure with a new incident record.

## Failure exercise coverage

The repository provides a repeatable, non-destructive dry-run exercise:

```bash
scripts/test-failover.sh
```

This verifies source/target validation, the configured topology file, target
selection, and the execution gate. A staging exercise must additionally inject
real database promotion, routing, and smoke-test commands, then record the
measured `T0`–`T4` timestamps and replication lag. Production failover is never
simulated by a local script.
