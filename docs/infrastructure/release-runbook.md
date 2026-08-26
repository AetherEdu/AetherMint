# Blue-green and canary release runbook

This document is the operational contract for shipping AetherMint releases
with zero downtime. It complements the deployment/failover model in
[`multi-region.md`](./multi-region.md) — failover moves traffic between
*regions*, this runbook moves traffic between *release colors* inside a region
(or across the whole fleet) so new versions can be validated before they serve
production traffic.

## Strategies

### Blue-green

Two fully isolated deployment sets — **blue** and **green** — run side by side.
Only one color serves production traffic at a time:

1. The new image is deployed to the **standby** color while the active color
   keeps serving.
2. The standby color is health-gated.
3. Traffic is switched atomically to the standby color.
4. The standby is health-gated again after promotion.

Rollback is instant: switch traffic back to the previous color. There is no
"rolling back a deployment" — the old color was never torn down, so reverting
is a routing decision, not a redeploy.

### Canary

The same colored deployment sets are used, but instead of an atomic switch,
traffic is shifted to the canary color in small steps (`5% → 25% → 50% →
100%`). Every step is health-gated and held for an observation window before
more traffic is shifted. If any gate fails, the canary weight is dropped back
to `0%` automatically.

## Components

| Component | Purpose |
| --- | --- |
| `infra/release/release-route.yaml` | `ReleaseRoute` contract: active/standby colors, image repos, canary weights, health-gate and auto-rollback policy. The routing provider must implement it like the `GlobalRoute` contract. |
| `infra/kubernetes/release/` | Blue/green Deployment + Service pairs for backend and frontend. Each color only talks to its own backend. Replaces the single rolling-update Deployment during release-mode operation. |
| `scripts/deploy-blue-green.sh` | Blue-green coordinator: deploy → gate → switch → gate, with automatic rollback. Dry-run by default; requires `--execute` + `DEPLOY_APPROVED=true`. |
| `scripts/deploy-canary.sh` | Canary coordinator: deploy → progressive weight shifts with health gating and automatic rollback to 0%. |
| `scripts/rollback-release.sh` | Operator-facing rollback: reverts a completed blue-green release or zeroes a canary. |
| `scripts/update-release-state.sh` | Rewrites `release-route.yaml` so `activeColor` and per-color versions match reality after a release or rollback. |
| `scripts/test-release.sh` | Non-destructive dry-run test suite for all of the above. |
| `.github/workflows/deploy.yml` | Release pipeline: CI gate → image build/push → validation → deploy. |
| `.github/workflows/ci-pr.yml` | PR CI; gains a `Validate Release Tooling` job that runs `scripts/test-release.sh`. |

## Prerequisites

1. **Image repositories.** The pipeline pushes to
   `ghcr.io/aetheredu/aethermint-backend` and
   `ghcr.io/aetheredu/aethermint-frontend` (see `images` in `release-route.yaml`).
2. **Platform commands.** The coordinators never embed platform specifics;
   operators inject them, exactly like `scripts/failover-region.sh`. Reference
   Kubernetes commands are shown below. Configure them as repository secrets
   for the pipeline:
   - `DEPLOY_CMD` — deploy a tag to a color
   - `DEPLOY_VERIFY_CMD` — health-gate a color
   - `DEPLOY_SWITCH_CMD` — switch the active color
   - `DEPLOY_ROLLBACK_CMD` — undo a switch (optional; defaults to the switch command reversed)
   - `DEPLOY_SHIFT_CMD` — set the canary weight (canary releases only)
3. **ReleaseRoute config.** Keep `infra/release/release-route.yaml` in sync:
   run `scripts/update-release-state.sh` after every promotion/rollback (the
   pipeline does this automatically).
4. **Environment protection.** The `deploy` job targets a GitHub
   `environment` (default `production`); add required reviewers there to gate
   production deploys.

## Reference injected commands (Kubernetes)

The coordinators call injected commands with positional arguments. For a
Kubernetes deployment of `infra/kubernetes/release/`:

```bash
# DEPLOY_CMD receives: COLOR TAG
DEPLOY_CMD='/usr/local/bin/deploy-color'
# e.g. kubectl -n aethermint set image deployment/aethermint-backend-green \
#        backend=ghcr.io/aetheredu/aethermint-backend:v1.2.3
#      kubectl -n aethermint rollout status deployment/aethermint-backend-green

# DEPLOY_VERIFY_CMD receives: COLOR
DEPLOY_VERIFY_CMD='/usr/local/bin/verify-color'
# e.g. curl -fsS https://green.example.invalid/api/health

# DEPLOY_SWITCH_CMD receives: FROM_COLOR TO_COLOR
DEPLOY_SWITCH_CMD='/usr/local/bin/switch-active-color'
# e.g. patch the edge router / GlobalRoute endpoint to target the new color's
#      frontend service (aethermint-frontend-green instead of -blue)

# DEPLOY_SHIFT_CMD receives: WEIGHT (percent)
DEPLOY_SHIFT_CMD='/usr/local/bin/set-canary-weight'
# e.g. set the traffic-split weight on the edge router to WEIGHT%
```

## Blue-green release

Dry run first — this prints the plan and validates the config without touching
anything:

```bash
scripts/deploy-blue-green.sh --version v1.2.3
```

Execute with injected commands:

```bash
DEPLOY_APPROVED=true \
scripts/deploy-blue-green.sh \
  --version v1.2.3 \
  --execute \
  --deploy "$DEPLOY_CMD" \
  --verify "$DEPLOY_VERIFY_CMD" \
  --switch "$DEPLOY_SWITCH_CMD" \
  --rollback "$DEPLOY_ROLLBACK_CMD"
```

On success, record the new state in the contract:

```bash
scripts/update-release-state.sh --color green --version v1.2.3
```

If any step fails, the coordinator automatically switches traffic back to the
previously active color and exits non-zero.

## Canary release

```bash
DEPLOY_APPROVED=true \
scripts/deploy-canary.sh \
  --version v1.2.3 \
  --weights "5 25 50 100" \
  --hold 300 \
  --execute \
  --deploy "$DEPLOY_CMD" \
  --verify "$DEPLOY_VERIFY_CMD" \
  --shift "$DEPLOY_SHIFT_CMD"
```

Each step shifts traffic, holds for the observation window, then health-gates
the canary. A failed gate at any step drops the weight back to `0%`
automatically — the release is aborted, never completed on a broken build.

## Rollback

### Automated (during a release)

Both coordinators revert automatically on health-gate failure:

- blue-green: traffic switches back to the previously active color;
- canary: canary weight drops to `0%`.

### Manual (after a completed release)

```bash
# Undo a blue-green promotion (restore the color that served before the release)
DEPLOY_APPROVED=true \
scripts/rollback-release.sh \
  --mode bluegreen \
  --execute \
  --switch "$DEPLOY_SWITCH_CMD" \
  --verify "$DEPLOY_VERIFY_CMD"

# Abort a canary that is mid-shift
DEPLOY_APPROVED=true \
scripts/rollback-release.sh --mode canary --execute --shift "$DEPLOY_SHIFT_CMD"
```

Always update the contract afterwards so the next release plans from the real
state:

```bash
scripts/update-release-state.sh --color blue --version v1.2.2
```

## CI wiring

- `.github/workflows/deploy.yml` runs automatically on push to `main` (app
  code paths only) and manually via `workflow_dispatch` (strategy, version,
  canary weights selectable).
- The `ci-gate` job refuses to deploy a commit whose recorded check runs are
  failing or still running. Push-triggered deploys have no check data on the
  merge commit by design; branch protection already required the PR CI
  (`ci-pr.yml`) to pass before the merge, so the gate passes through.
- The `validate-release-tooling` job runs `scripts/test-release.sh` before any
  deploy; the same suite runs on every PR in `ci-pr.yml`.
- Only `AetherEdu/AetherMint` may deploy; fork runs stop after image build.
- One deploy per environment at a time (`concurrency` group, no cancellation
  of in-flight releases).

## Exercise

Run the dry-run suite locally or in CI:

```bash
scripts/test-release.sh
```

It verifies plan output, config parsing, argument validation, the approval
gate, and a full simulated blue-green flow with no cluster required. A staging
exercise should additionally inject real deploy/verify/switch commands against
a staging cluster and record the timestamps, exactly as the failover exercise
does for RTO/RPO.

## Operational notes

- Never release an image tagged `latest`; the pipeline tags images with the
  git SHA.
- The standby color is not "old" — it is the previous release, kept warm so a
  rollback is a routing flip, not a redeploy.
- After a rollback, do not immediately redeploy the failed version; diagnose
  first, then release a fixed build through the normal flow.
- `infra/kubernetes/release/` is provider-neutral Kubernetes. The routing
  provider implements `ReleaseRoute` (colors + canary weights) the same way it
  implements `GlobalRoute` (regions + health failover).
