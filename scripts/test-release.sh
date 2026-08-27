#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# AetherMint - Release tooling dry-run tests
# =============================================================================
#
# Non-destructive validation of the release coordinators, mirroring
# scripts/test-failover.sh. It verifies plan output, argument validation, and
# the approval gate without touching any cluster. Run locally or in CI:
#
#   scripts/test-release.sh
# =============================================================================

SCRIPT_NAME="$(basename "$0")"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG="$ROOT/infra/release/release-route.yaml"

pass=0
fail=0

check() {
  local name="$1" status="$2"
  if [[ "$status" -eq 0 ]]; then
    printf 'PASS: %s\n' "$name"
    pass=$((pass + 1))
  else
    printf 'FAIL: %s\n' "$name" >&2
    fail=$((fail + 1))
  fi
}

expect_failure() {
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then
    check "$name" 1
  else
    check "$name" 0
  fi
}

# --- deploy-blue-green.sh ----------------------------------------------------
output="$(scripts/deploy-blue-green.sh --version v1.2.3)"
check "blue-green: dry run prints a plan" $?
grep -q "Blue-green release plan" <<<"$output"
check "blue-green: plan header present" $?
grep -q "target:      green" <<<"$output"
check "blue-green: standby color resolved from config" $?
grep -q "Dry run only" <<<"$output"
check "blue-green: dry run does not execute" $?

expect_failure "blue-green: missing --version is rejected" \
  scripts/deploy-blue-green.sh
expect_failure "blue-green: unknown --color is rejected" \
  scripts/deploy-blue-green.sh --version v1.2.3 --color purple
expect_failure "blue-green: deploying to the active color is rejected" \
  scripts/deploy-blue-green.sh --version v1.2.3 --color blue

# --- deploy-canary.sh --------------------------------------------------------
output="$(scripts/deploy-canary.sh --version v1.2.3)"
check "canary: dry run prints a plan" $?
grep -q "Canary release plan" <<<"$output"
grep -q "weights:     5 25 50 100" <<<"$output"
check "canary: weights read from config" $?
grep -q "canary:      green" <<<"$output"
check "canary: canary color resolved from config" $?

expect_failure "canary: missing --version is rejected" \
  scripts/deploy-canary.sh
expect_failure "canary: final weight must be 100" \
  scripts/deploy-canary.sh --version v1.2.3 --weights "5 25 50"
expect_failure "canary: non-numeric weight is rejected" \
  scripts/deploy-canary.sh --version v1.2.3 --weights "5 50 100x"
expect_failure "canary: decreasing weights are rejected" \
  scripts/deploy-canary.sh --version v1.2.3 --weights "50 25 100"

# --- rollback-release.sh -----------------------------------------------------
output="$(scripts/rollback-release.sh --mode bluegreen)"
check "rollback: bluegreen dry run prints a plan" $?
grep -q "Blue-green rollback plan" <<<"$output"
grep -q "restore:    green" <<<"$output"
check "rollback: restore color defaults to standby" $?

output="$(scripts/rollback-release.sh --mode canary)"
check "rollback: canary dry run prints a plan" $?
grep -q "Canary rollback plan" <<<"$output"

expect_failure "rollback: unknown mode is rejected" \
  scripts/rollback-release.sh --mode rolling
expect_failure "rollback: unknown restore color is rejected" \
  scripts/rollback-release.sh --mode bluegreen --color purple

# --- update-release-state.sh -------------------------------------------------
tmp_config="$(mktemp)"
cp "$CONFIG" "$tmp_config"
scripts/update-release-state.sh --config "$tmp_config" --color green --version v9.9.9 >/dev/null
check "update-state: runs against a copy of the config" $?
grep -q "activeColor: green" "$tmp_config"
check "update-state: activeColor updated" $?
grep -q 'version: "v9.9.9"' "$tmp_config"
check "update-state: color version updated" $?
expect_failure "update-state: unknown color is rejected" \
  scripts/update-release-state.sh --config "$tmp_config" --color purple
rm -f "$tmp_config"

# --- approval gate -----------------------------------------------------------
output="$(DEPLOY_APPROVED=false scripts/deploy-blue-green.sh --version v1.2.3 --execute \
  --deploy 'true' --verify 'true' --switch 'true' 2>&1 || true)"
grep -q "requires DEPLOY_APPROVED=true" <<<"$output"
check "approval gate: --execute without approval is blocked" $?

output="$(DEPLOY_APPROVED=true scripts/deploy-blue-green.sh --version v1.2.3 --execute \
  --deploy 'true' --verify 'true' --switch 'true' 2>&1)"
grep -q "Blue-green release complete" <<<"$output"
check "approval gate: --execute with approval runs the full flow" $?

# --- summary -----------------------------------------------------------------
printf '\n%d passed, %d failed\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]] || exit 1
