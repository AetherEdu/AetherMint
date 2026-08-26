#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# AetherMint - Release rollback coordinator
# =============================================================================
#
# Reverts a completed release back to the previously active color (blue-green)
# or zeroes the canary weight (canary). This is the operator-facing counterpart
# of the automatic rollback the deploy coordinators perform on health-gate
# failure; use it when a release passed its gates but must be undone anyway.
#
# Platform-specific operations are injected as executables, mirroring
# scripts/failover-region.sh.
#
# Usage:
#   scripts/rollback-release.sh [options]
#
# Options:
#   --mode bluegreen|canary   Which rollback to perform. Defaults to canary
#                             when the config has canary.enabled: true, else
#                             bluegreen.
#   --color COLOR             Blue-green: color to restore as active. Defaults
#                             to the standby color from the config (i.e. the
#                             color that served traffic before the last release).
#   --config FILE             ReleaseRoute config file (default: infra/release/release-route.yaml)
#   --execute                 Perform the rollback; requires DEPLOY_APPROVED=true
#   --switch CMD              Blue-green: command receiving "FROM_COLOR TO_COLOR"
#   --shift CMD               Canary: command receiving "WEIGHT" (0 = off)
#   --verify CMD              Command receiving "COLOR"; must exit 0 when healthy
#   --help                    Show this help
#
# Without --execute the script only prints the rollback plan.
# =============================================================================

SCRIPT_NAME="$(basename "$0")"
CONFIG_FILE="${RELEASE_CONFIG:-infra/release/release-route.yaml}"
MODE=""
RESTORE_COLOR=""
EXECUTE=0
SWITCH_COMMAND=""
SHIFT_COMMAND=""
VERIFY_COMMAND=""

usage() {
  sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

fail() { printf '%s: %s\n' "$SCRIPT_NAME" "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode) [[ $# -ge 2 ]] || fail "--mode requires bluegreen|canary"; MODE="$2"; shift 2 ;;
    --color) [[ $# -ge 2 ]] || fail "--color requires a color"; RESTORE_COLOR="$2"; shift 2 ;;
    --config) [[ $# -ge 2 ]] || fail "--config requires a file"; CONFIG_FILE="$2"; shift 2 ;;
    --execute) EXECUTE=1; shift ;;
    --switch) [[ $# -ge 2 ]] || fail "--switch requires a command"; SWITCH_COMMAND="$2"; shift 2 ;;
    --shift) [[ $# -ge 2 ]] || fail "--shift requires a command"; SHIFT_COMMAND="$2"; shift 2 ;;
    --verify) [[ $# -ge 2 ]] || fail "--verify requires a command"; VERIFY_COMMAND="$2"; shift 2 ;;
    --help|-h) usage ;;
    *) fail "unknown argument: $1" ;;
  esac
done

# --- preflight ---------------------------------------------------------------
[[ -f "$CONFIG_FILE" ]] || fail "ReleaseRoute config not found: $CONFIG_FILE"

ACTIVE_COLOR="$(grep -E '^[[:space:]]*activeColor:' "$CONFIG_FILE" | head -n1 | awk '{print $2}')"
STANDBY_COLOR="$(grep -E '^[[:space:]]*standbyColor:' "$CONFIG_FILE" | head -n1 | awk '{print $2}')"
CANARY_ENABLED="$(grep -E '^[[:space:]]*enabled:' "$CONFIG_FILE" | head -n1 | awk '{print $2}')"

if [[ -z "$MODE" ]]; then
  if [[ "$CANARY_ENABLED" == "true" ]]; then
    MODE="canary"
  else
    MODE="bluegreen"
  fi
fi
[[ "$MODE" == "bluegreen" || "$MODE" == "canary" ]] || fail "unknown mode '$MODE' (expected bluegreen|canary)"

if [[ "$MODE" == "bluegreen" ]]; then
  [[ -n "$ACTIVE_COLOR" && -n "$STANDBY_COLOR" ]] || fail "could not read activeColor/standbyColor from $CONFIG_FILE"
  [[ "$ACTIVE_COLOR" != "$STANDBY_COLOR" ]] || fail "activeColor and standbyColor must differ in $CONFIG_FILE"
  RESTORE_COLOR="${RESTORE_COLOR:-$STANDBY_COLOR}"
  [[ "$RESTORE_COLOR" == "$ACTIVE_COLOR" || "$RESTORE_COLOR" == "$STANDBY_COLOR" ]] \
    || fail "unknown restore color '$RESTORE_COLOR' (expected $ACTIVE_COLOR or $STANDBY_COLOR)"

  printf '%s\n' \
    "Blue-green rollback plan" \
    "  config:     $CONFIG_FILE" \
    "  active:     $ACTIVE_COLOR (currently serving)" \
    "  restore:    $RESTORE_COLOR" \
    "  1. Switch active traffic '$ACTIVE_COLOR' -> '$RESTORE_COLOR' (--switch)" \
    "  2. Health-gate restored color '$RESTORE_COLOR' (--verify)"

  if [[ "$EXECUTE" -eq 0 ]]; then
    printf '%s\n' "Dry run only. Pass --execute and DEPLOY_APPROVED=true to perform the rollback."
    exit 0
  fi

  [[ "${DEPLOY_APPROVED:-false}" == "true" ]] || fail "execution requires DEPLOY_APPROVED=true"
  [[ -n "$SWITCH_COMMAND" ]] || fail "--switch or SWITCH_COMMAND is required"
  [[ -n "$VERIFY_COMMAND" ]] || fail "--verify or VERIFY_COMMAND is required"

  bash -c "$SWITCH_COMMAND \"$ACTIVE_COLOR\" \"$RESTORE_COLOR\"" || fail "switch command failed; manual intervention required"
  bash -c "$VERIFY_COMMAND \"$RESTORE_COLOR\"" || fail "restored color '$RESTORE_COLOR' failed health checks; manual intervention required"
  printf '%s\n' "Rollback complete: active color is now '$RESTORE_COLOR'."
else
  printf '%s\n' \
    "Canary rollback plan" \
    "  config:  $CONFIG_FILE" \
    "  1. Shift canary traffic to 0% (--shift 0)"

  if [[ "$EXECUTE" -eq 0 ]]; then
    printf '%s\n' "Dry run only. Pass --execute and DEPLOY_APPROVED=true to perform the rollback."
    exit 0
  fi

  [[ "${DEPLOY_APPROVED:-false}" == "true" ]] || fail "execution requires DEPLOY_APPROVED=true"
  [[ -n "$SHIFT_COMMAND" ]] || fail "--shift or SHIFT_COMMAND is required"

  bash -c "$SHIFT_COMMAND 0" || fail "could not zero the canary weight; manual intervention required"
  printf '%s\n' "Canary rolled back; all traffic is on the stable color."
fi
