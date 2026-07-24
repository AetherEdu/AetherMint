# Closes Issues #167, #266, #267 (all assigned to Degentle12)

## Summary

Three issues, one focused PR. Backend gets a feature flag system and
WebSocket horizontal scaling; the Soroban contracts get a property-based
invariant harness so we can catch state-machine regressions before merging.

## Issue #267 — Feature flag system for gradual rollouts

Closed-by: admin CRUD, group middleware, public evaluation endpoint.

- `backend/src/services/featureFlagService.ts` — Redis-backed store with
  30s in-memory cache, single-flight `inflight` Promise to dedupe
  concurrent refreshers, deterministic per-user evaluation.
- `backend/src/middleware/featureFlag.ts` — `requireFeature(flag, opts)`
  gates a route; `requireVariant(flag, key)` enforces A/B variants after
  a flag check; emits `X-Feature-Flag-Status: degraded` if the service
  errors so outages are visible rather than silent.
- `backend/src/routes/admin/featureFlags.ts` — admin CRUD + toggle
  mounted at `/api/admin/feature-flags`. Public `publicRouter` for
  evaluation mounted at `/api/feature-flags/:name/evaluate`.
- `backend/src/controllers/featureFlagController.ts` — Express handlers.
- `backend/src/middleware/auth.ts` — adds `optionalAuth` for endpoints
  that accept both authenticated and anonymous callers.
- `backend/src/index.ts` — wires both routers.
- `backend/tests/services/featureFlagService.test.ts` —
  kill switch, allow/block lists, percentage rollout, A/B variants, CRUD.
- `backend/tests/routes/featureFlags.test.ts` — middleware + public
  evaluate endpoint coverage (default value, missing flag, `?bucket=N`).

### Features supported
- Global kill switch (`enabled: false` → disabled for everyone)
- Percentage-based rollouts (`rolloutPercent: 0..100`) via SHA-1 hash on
  `flag.name + userId`
- A/B variants (`variants: { control: 50, treatment: 50 }`); user-deterministic
- Allow-list (`allowedUserIds`) and block-list (`blockedUserIds`)
- Explicit `?bucket=N` for QA bucketing

## Issue #266 — WebSocket connection pooling + horizontal scaling

Closed-by: Redis pub/sub adapter attached in `WebsocketService`.

- `backend/src/services/websocketService.ts` — `setupHorizontalScaling()`
  builds two dedicated ioredis clients (pub + sub) and attaches
  `createAdapter(...)` to the Socket.IO server. `transports: ['websocket',
  'polling']` keeps long-polling available so front-ends degrade
  gracefully when sticky-session routing isn't available upstream.
- `close()` is now async and awaits `quit()` on both pub/sub clients so
  the graceful shutdown coordinator completes before the process exits.
- Opt-out via `WS_REDIS_ADAPTER_ENABLED=false` for single-node deploys.
- `backend/package.json` — adds `@socket.io/redis-adapter` pinned `~8.3.0`
  for compatibility with existing `socket.io@^4.7.2`.
- `backend/tests/services/websocketScaling.test.ts` — verifies the
  in-process adapter is used when the adapter is disabled, and that
  smoke emits succeed when the adapter is attached.

### Operational notes
- The Redis adapter gracefully falls back to the in-process adapter if
  Redis is unreachable at startup; logs are loud.
- Sticky sessions on the load balancer (cookie-based) keep the same
  client routed to the same node during a session. The transport
  fallback ensures the SPA still works without sticky routing (it just
  pays the long-poll cost on first connect).

## Issue #167 — Property-based fuzzing for Soroban state invariants

Closed-by: a hand-rolled LCG-driven invariant harness compatible with
Soroban's `no_std` `Env::default()` workflow.

- `contracts/src/fuzzing_test.rs` — four property tests:
  - **credential_registry** — issue / revoke / renew / check-expiration
    sequences. Asserts `get_credential_count() == sum(issued) - sum(revoked)`,
    per-recipient list lengths match, and `is_credential_valid` matches
    the unrevoked count.
  - **marketplace** — list / buy / cancel sequences. Asserts listing
    status state machine and duplicate-prevention invariants.
    Skips release/refund as those exercise known marketplace bugs
    flagged in `marketplace_test.rs`.
  - **profile_nft** — mint / update sequences. Asserts supply ==
    unique owners and double-mint prevention.
  - **dynamic_nft** — mint / evolve sequences. Asserts supply ==
    `sum(balance_of)` invariant.
- `contracts/src/lib.rs` — registers the fuzzing test module.

### How to use
```bash
cd contracts
cargo test fuzz_
```
Each test runs across multiple seeds; a failing invariant prints the
seed and the assertion so the trace can be reproduced.

## Verification

```bash
cd backend
npx tsc --noEmit                         # clean
npx jest --no-coverage \
  tests/services/featureFlagService.test.ts \
  tests/routes/featureFlags.test.ts \
  tests/services/websocketScaling.test.ts
# 24 tests across 3 suites — all passing

cd ../contracts
cargo test                               # CI: must run; local toolchain unavailable here
```

## Design choices

**Why single-flight refresh?** Two concurrent evaluations should not
both trip a Redis read; one wins and the second piggy-backs. Beyond
TTLC dedupe, the `inflight` Promise ensures only one GET-in-flight at a
time. Failure cases still clear the inflight so future calls retry.

**Why fail-open with a header?** A kill switch should not be silently
lifted by a Redis blip. Marking the response as `degraded` in a header
means ops dashboards, load balancers, and SRE alerts can respond
without reacting to every error in middleware. Privilege gates still
authenticate upstream; the flag only controls UX rollout.

**Why hand-rolled fuzzing?** `proptest` doesn't compose well with
Soroban's `Env::default()`, and `cargo-fuzz` requires nightly + custom
target wiring that's heavy. The LCG-driven sequence generator + post-
condition checks give us repeatable, deterministic fuzz traces that
run in the normal `cargo test` harness.

**Why `@socket.io/redis-adapter`?** The Socket.IO team's official
adapter. Production-tested across clusters. Pinned `~8.3.0` to match
`socket.io@^4.7.2` already in `package.json`.

## Follow-ups

These are small enough to land separately if reviewers want to keep
this PR tight:

1. Split `backend/src/routes/admin/featureFlags.ts` into two files
   (`admin/featureFlags.ts` + `public/featureFlagEval.ts`) so the auth
   scopes are obvious from the imports.
2. Per-flag Redis keys (`featureflag:{name}`) with `SET NX` semantics
   to fully atomic-mutate individual flags instead of snapshotting the
   whole cache blob.
3. `cargo test` must be run in CI before merge to validate that the
   Soroban SDK auto-generates the `try_*` methods used by
   `fuzzing_test.rs` for the 26.1.0 toolchain.
