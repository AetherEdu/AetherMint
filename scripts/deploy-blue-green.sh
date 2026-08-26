#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# AetherMint - Blue-green release coordinator
# =============================================================================
#
# Deploys a release to the standby color, health-gates it, then atomically
# switches the active color. If any gate fails the release is automatically
# reverted to the previously active color (instant rollback) and the script
# exits non-zero so the calling pipeline surfaces the failure.
#
# Platform-specific operations are injected as executables, mirroring
# scripts/failover-region.sh, so this coordinator works with any Kubernetes
# distribution, DNS/GSLB, or edge router without embedding credentials.
#
# Usage:
#   scripts/deploy-blue-green.sh --version v1.2.3 [options]
#
# Options:
#   --version TAG       Image tag to release (required)
#   --color COLOR       Color to deploy to; defaults to the standby color from
#                       the ReleaseRoute config
#   --config FILE       ReleaseRoute config file (default: infra/release/release-route.yaml)
#   --execute           Perform the deployment; requires DEPLOY_APPROVED=true
#   --deploy CMD        Command receiving "COLOR TAG"; deploys TAG to COLOR
#   --verify CMD        Command receiving "COLOR"; must exit 0 when COLOR is healthy
#   --switch CMD        Command receiving "FROM_COLOR TO_COLOR"; moves active traffic
#   --rollback CMD      Command receiving "FROM_COLOR TO_COLOR"; undoes a switch.
#                       Defaults to --switch with the arguments reversed.
#   --help              Show this help
#
# Without --execute the script only prints the release plan.
# =============================================================================

SCRIPT_NAME="$(basename "$0")"
CONFIG_FILE="${RELEASE_CONFIG:-infra/release/release-route.yaml}"
VERSION=""
TARGET_COLOR=""
EXECUTE=0
DEPLOY_COMMAND=""
VERIFY_COMMAND=""
SWITCH_COMMAND=""
ROLLBACK_COMMAND=""

usage() {
  sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

fail() { printf '%s: %s\n' "$SCRIPT_NAME" "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) [[ $# -ge 2 ]] || fail "--version requires a tag"; VERSION="$2"; shift 2 ;;
    --color) [[ $# -ge 2 ]] || fail "--color requires a color"; TARGET_COLOR="$2"; shift 2 ;;
    --config) [[ $# -ge 2 ]] || fail "--config requires a file"; CONFIG_FILE="$2"; shift 2 ;;
    --execute) EXECUTE=1; shift ;;
    --deploy) [[ $# -ge 2 ]] || fail "--deploy requires a command"; DEPLOY_COMMAND="$2"; shift 2 ;;
    --verify) [[ $# -ge 2 ]] || fail "--verify requires a command"; VERIFY_COMMAND="$2"; shift 2 ;;
    --switch) [[ $# -ge 2 ]] || fail "--switch requires a command"; SWITCH_COMMAND="$2"; shift 2 ;;
    --rollback) [[ $# -ge 2 ]] || fail "--rollback requires a command"; ROLLBACK_COMMAND="$2"; shift 2 ;;
    --help|-h) usage ;;
    *) fail "unknown argument: $1" ;;
  esac
done

# --- preflight ---------------------------------------------------------------
[[ -n "$VERSION" ]] || fail "--version is required"
[[ -f "$CONFIG_FILE" ]] || fail "ReleaseRoute config not found: $CONFIG_FILE"

ACTIVE_COLOR="$(grep -E '^[[:space:]]*activeColor:' "$CONFIG_FILE" | head -n1 | awk '{print $2}')"
STANDBY_COLOR="$(grep -E '^[[:space:]]*standbyColor:' "$CONFIG_FILE" | head -n1 | awk '{print $2}')"
[[ -n "$ACTIVE_COLOR" ]] || fail "could not read activeColor from $CONFIG_FILE"
[[ -n "$STANDBY_COLOR" ]] || fail "could not read standbyColor from $CONFIG_FILE"
[[ "$ACTIVE_COLOR" != "$STANDBY_COLOR" ]] || fail "activeColor and standbyColor must differ in $CONFIG_FILE"

TARGET_COLOR="${TARGET_COLOR:-$STANDBY_COLOR}"
[[ "$TARGET_COLOR" == "$ACTIVE_COLOR" || "$TARGET_COLOR" == "$STANDBY_COLOR" ]] \
  || fail "unknown target color '$TARGET_COLOR' (expected $ACTIVE_COLOR or $STANDBY_COLOR)"
# A release always deploys to the color that is not serving traffic.
[[ "$TARGET_COLOR" != "$ACTIVE_COLOR" ]] || fail "refusing to deploy to the active color '$ACTIVE_COLOR'; deploy to the standby color instead"

run() {
  printf '%s\n' "  $ $*" >&2
  bash -c "$*"
}

verify_color() {
  local color="$1"
  [[ -n "$VERIFY_COMMAND" ]] || fail "a --verify command is required"
  printf '%s\n' "Health-gating color '$color'..."
  bash -c "$VERIFY_COMMAND \"$color\"" || return 1
}

rollback() {
  local from="$1" to="$2"
  printf '%s\n' "AUTO-ROLLBACK: reverting active color from '$from' to '$to'"
  if [[ -n "$ROLLBACK_COMMAND" ]]; then
    bash -c "$ROLLBACK_COMMAND \"$from\" \"$to\"" || \
      fail "rollback command failed; manual intervention required"
  else
    bash -c "$SWITCH_COMMAND \"$from\" \"$to\"" || \
      fail "rollback switch failed; manual intervention required"
  fi
  printf '%s\n' "Rollback switch applied. Verifying restored color '$to'..."
  verify_color "$to" || fail "restored color '$to' failed health checks; manual intervention required"
  printf '%s\n' "Rollback complete; traffic is back on '$to'."
}

# --- plan --------------------------------------------------------------------
printf '%s\n' \
  "Blue-green release plan" \
  "  version:     $VERSION" \
  "  config:      $CONFIG_FILE" \
  "  active:      $ACTIVE_COLOR (currently serving)" \
  "  target:      $TARGET_COLOR (standby)" \
  "  1. Deploy image tag '$VERSION' to '$TARGET_COLOR' (--deploy)" \
  "  2. Health-gate '$TARGET_COLOR' (--verify)" \
  "  3. Switch active traffic '$ACTIVE_COLOR' -> '$TARGET_COLOR' (--switch)" \
  "  4. Health-gate '$TARGET_COLOR' again after promotion" \
  "  5. On any failure: automatically switch back to '$ACTIVE_COLOR'"

if [[ "$EXECUTE" -eq 0 ]]; then
  printf '%s\n' "Dry run only. Pass --execute and DEPLOY_APPROVED=true to perform the release."
  exit 0
fi

[[ "${DEPLOY_APPROVED:-false}" == "true" ]] || fail "execution requires DEPLOY_APPROVED=true"
[[ -n "$DEPLOY_COMMAND" ]] || fail "--deploy or DEPLOY_COMMAND is required"
[[ -n "$VERIFY_COMMAND" ]] || fail "--verify or VERIFY_COMMAND is required"
[[ -n "$SWITCH_COMMAND" ]] || fail "--switch or SWITCH_COMMAND is required"

# --- execute -----------------------------------------------------------------
printf '%s\n' "Step 1: deploying '$VERSION' to color '$TARGET_COLOR'"
run "$DEPLOY_COMMAND" "$TARGET_COLOR" "$VERSION" || { rollback "$TARGET_COLOR" "$ACTIVE_COLOR"; exit 1; }

printf '%s\n' "Step 2: health-gating color '$TARGET_COLOR' before promotion"
verify_color "$TARGET_COLOR" || { rollback "$TARGET_COLOR" "$ACTIVE_COLOR"; exit 1; }

printf '%s\n' "Step 3: switching active traffic '$ACTIVE_COLOR' -> '$TARGET_COLOR'"
bash -c "$SWITCH_COMMAND \"$ACTIVE_COLOR\" \"$TARGET_COLOR\"" || { rollback "$TARGET_COLOR" "$ACTIVE_COLOR"; exit 1; }

printf '%s\n' "Step 4: health-gating promoted color '$TARGET_COLOR'"
verify_color "$TARGET_COLOR" || { rollback "$TARGET_COLOR" "$ACTIVE_COLOR"; exit 1; }

printf '%s\n' \
  "Blue-green release complete: active color is now '$TARGET_COLOR'." \
  "Update $CONFIG_FILE (scripts/update-release-state.sh --color $TARGET_COLOR --version $VERSION)" \
  "so the contract reflects the new state."
