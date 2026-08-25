#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# AetherMint - Canary release coordinator
# =============================================================================
#
# Deploys a release to the canary color, shifts a small percentage of traffic
# to it, and progressively increases the share while health-gating every step.
# If any gate fails the canary weight is automatically dropped to 0
# (automated rollback) and the script exits non-zero.
#
# Platform-specific operations are injected as executables, mirroring
# scripts/failover-region.sh.
#
# Usage:
#   scripts/deploy-canary.sh --version v1.2.3 [options]
#
# Options:
#   --version TAG       Image tag to release (required)
#   --weights LIST      Space-separated canary weights in percent, e.g.
#                       "5 25 50 100". Defaults to the weights from the
#                       ReleaseRoute config. The final value must be 100 to
#                       complete the release.
#   --hold SECONDS      Seconds to observe each step before shifting more
#                       traffic (default: from config, or 300)
#   --config FILE       ReleaseRoute config file (default: infra/release/release-route.yaml)
#   --execute           Perform the release; requires DEPLOY_APPROVED=true
#   --deploy CMD        Command receiving "COLOR TAG"; deploys TAG to the canary color
#   --verify CMD        Command receiving "COLOR"; must exit 0 when COLOR is healthy
#   --shift CMD         Command receiving "WEIGHT"; sets canary traffic share to WEIGHT%
#   --help              Show this help
#
# Without --execute the script only prints the release plan.
# =============================================================================

SCRIPT_NAME="$(basename "$0")"
CONFIG_FILE="${RELEASE_CONFIG:-infra/release/release-route.yaml}"
VERSION=""
WEIGHTS=""
HOLD_SECONDS=""
EXECUTE=0
DEPLOY_COMMAND=""
VERIFY_COMMAND=""
SHIFT_COMMAND=""

usage() {
  sed -n '2,32p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

fail() { printf '%s: %s\n' "$SCRIPT_NAME" "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) [[ $# -ge 2 ]] || fail "--version requires a tag"; VERSION="$2"; shift 2 ;;
    --weights) [[ $# -ge 2 ]] || fail "--weights requires a list"; WEIGHTS="$2"; shift 2 ;;
    --hold) [[ $# -ge 2 ]] || fail "--hold requires seconds"; HOLD_SECONDS="$2"; shift 2 ;;
    --config) [[ $# -ge 2 ]] || fail "--config requires a file"; CONFIG_FILE="$2"; shift 2 ;;
    --execute) EXECUTE=1; shift ;;
    --deploy) [[ $# -ge 2 ]] || fail "--deploy requires a command"; DEPLOY_COMMAND="$2"; shift 2 ;;
    --verify) [[ $# -ge 2 ]] || fail "--verify requires a command"; VERIFY_COMMAND="$2"; shift 2 ;;
    --shift) [[ $# -ge 2 ]] || fail "--shift requires a command"; SHIFT_COMMAND="$2"; shift 2 ;;
    --help|-h) usage ;;
    *) fail "unknown argument: $1" ;;
  esac
done

# --- preflight ---------------------------------------------------------------
[[ -n "$VERSION" ]] || fail "--version is required"
[[ -f "$CONFIG_FILE" ]] || fail "ReleaseRoute config not found: $CONFIG_FILE"

CANARY_COLOR="$(grep -E '^[[:space:]]*canaryColor:' "$CONFIG_FILE" | head -n1 | awk '{print $2}')"
[[ -n "$CANARY_COLOR" ]] || fail "could not read canaryColor from $CONFIG_FILE"

if [[ -z "$WEIGHTS" ]]; then
  WEIGHTS="$(grep -E '^[[:space:]]*weights:' "$CONFIG_FILE" | head -n1 | sed -E 's/.*\[([0-9, ]+)\].*/\1/' | tr -d ' ' | tr ',' ' ')"
fi
[[ -n "$WEIGHTS" ]] || fail "could not read canary weights from $CONFIG_FILE"

# Validate the weight list: numeric, non-decreasing, ending at 100.
prev=""
for w in $WEIGHTS; do
  [[ "$w" =~ ^[0-9]+$ ]] || fail "invalid canary weight '$w' (expected a non-negative integer percent)"
  [[ -n "$prev" && "$w" -lt "$prev" ]] && fail "canary weights must be non-decreasing: $WEIGHTS"
  prev="$w"
done
last="${WEIGHTS##* }"
[[ "$last" == "100" ]] || fail "final canary weight must be 100 to complete the release (got '$last')"

HOLD_SECONDS="${HOLD_SECONDS:-$(grep -E '^[[:space:]]*holdSeconds:' "$CONFIG_FILE" | head -n1 | awk '{print $2}')}"
HOLD_SECONDS="${HOLD_SECONDS:-300}"
[[ "$HOLD_SECONDS" =~ ^[0-9]+$ ]] || fail "invalid holdSeconds '$HOLD_SECONDS'"

rollback_canary() {
  printf '%s\n' "AUTO-ROLLBACK: dropping canary traffic on '$CANARY_COLOR' to 0%"
  bash -c "$SHIFT_COMMAND 0" || fail "could not zero the canary weight; manual intervention required"
  printf '%s\n' "Canary rolled back; all traffic remains on the stable color."
}

# --- plan --------------------------------------------------------------------
printf '%s\n' \
  "Canary release plan" \
  "  version:     $VERSION" \
  "  config:      $CONFIG_FILE" \
  "  canary:      $CANARY_COLOR" \
  "  weights:     $WEIGHTS (percent of traffic on the canary)" \
  "  hold:        ${HOLD_SECONDS}s between steps" \
  "  1. Deploy image tag '$VERSION' to '$CANARY_COLOR' (--deploy)" \
  "  2. Health-gate '$CANARY_COLOR' (--verify)" \
  "  3. Shift traffic step by step: $(printf '%s%% ' $WEIGHTS)(--shift), health-gating and holding after each step" \
  "  4. On any failure: automatically shift back to 0%"

if [[ "$EXECUTE" -eq 0 ]]; then
  printf '%s\n' "Dry run only. Pass --execute and DEPLOY_APPROVED=true to perform the release."
  exit 0
fi

[[ "${DEPLOY_APPROVED:-false}" == "true" ]] || fail "execution requires DEPLOY_APPROVED=true"
[[ -n "$DEPLOY_COMMAND" ]] || fail "--deploy or DEPLOY_COMMAND is required"
[[ -n "$VERIFY_COMMAND" ]] || fail "--verify or VERIFY_COMMAND is required"
[[ -n "$SHIFT_COMMAND" ]] || fail "--shift or SHIFT_COMMAND is required"

# --- execute -----------------------------------------------------------------
printf '%s\n' "Step 1: deploying '$VERSION' to canary color '$CANARY_COLOR'"
bash -c "$DEPLOY_COMMAND \"$CANARY_COLOR\" \"$VERSION\"" || { rollback_canary; exit 1; }

printf '%s\n' "Step 2: health-gating canary color '$CANARY_COLOR' before shifting traffic"
bash -c "$VERIFY_COMMAND \"$CANARY_COLOR\"" || { rollback_canary; exit 1; }

step=0
for w in $WEIGHTS; do
  step=$((step + 1))
  printf '%s\n' "Step $((step + 2)): shifting canary traffic to ${w}%"
  bash -c "$SHIFT_COMMAND \"$w\"" || { rollback_canary; exit 1; }
  printf '%s\n' "Holding ${HOLD_SECONDS}s to observe ${w}% before the next shift..."
  sleep "$HOLD_SECONDS"
  printf '%s\n' "Health-gating canary at ${w}%"
  bash -c "$VERIFY_COMMAND \"$CANARY_COLOR\"" || { rollback_canary; exit 1; }
done

printf '%s\n' \
  "Canary release complete: 100% of traffic is on '$CANARY_COLOR'." \
  "Update $CONFIG_FILE (scripts/update-release-state.sh --color $CANARY_COLOR --version $VERSION)" \
  "so the contract reflects the new state."
