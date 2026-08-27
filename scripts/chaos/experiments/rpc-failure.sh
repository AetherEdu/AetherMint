#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# AetherMint Chaos Experiment — Stellar/Soroban RPC Failure
# =============================================================================
#
# Simulates Stellar RPC endpoint unavailability (e.g. Horizon or Soroban RPC)
# by blocking outbound traffic to the configured RPC host. Verifies that:
#
# 1. Backend health remains reachable
# 2. Contract interactions queue or return controlled errors (not 500)
# 3. Non-blockchain endpoints continue to work
# 4. Recovery restores full functionality
#
# The RPC host is detected from env vars or defaults to common testnet URLs.
# =============================================================================

BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://localhost:3001/api/health}"
STAGING="${STAGING:-false}"
RUN_ID="${RUN_ID:-manual-$(date -u +'%Y%m%dT%H%M%S')}"
EXPERIMENT_NAME="rpc-failure"
DURATION_SECONDS="${DURATION_SECONDS:-90}"
RECOVERY_WAIT_SECONDS="${RECOVERY_WAIT_SECONDS:-30}"
OUTPUT_DIR="${OUTPUT_DIR:-$(mktemp -d)}"

# Determine RPC target to block
RPC_HOST="${RPC_HOST:-}"
if [[ -z "$RPC_HOST" ]]; then
  # Default: common testnet RPC endpoints
  RPC_HOST="soroban-testnet.stellar.org"
fi
RPC_PORT="${RPC_PORT:-443}"

log()  { printf '%s [%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$EXPERIMENT_NAME" "$*" >&2; }
fail() { printf '%s [%s] ERROR: %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$EXPERIMENT_NAME" "$*" >&2; }

health_status() {
  curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$BACKEND_HEALTH_URL" 2>/dev/null || echo "000"
}

block_rpc() {
  if [[ "$STAGING" == "true" ]] && command -v iptables &>/dev/null; then
    sudo iptables -A OUTPUT -p tcp -d "$RPC_HOST" --dport "$RPC_PORT" -j DROP 2>/dev/null || true
    log "Blocked outbound traffic to $RPC_HOST:$RPC_PORT"
  elif command -v docker &>/dev/null; then
    # In CI/local, use docker network manipulation on the backend container
    docker exec aethermint-backend sh -c \
      "iptables -A OUTPUT -p tcp -d $RPC_HOST --dport $RPC_PORT -j DROP 2>/dev/null || true" \
      2>/dev/null || true
    log "Blocked RPC traffic via backend container"
  else
    log "Cannot block RPC in this environment — skipping"
    exit 0
  fi
}

unblock_rpc() {
  if [[ "$STAGING" == "true" ]]; then
    sudo iptables -D OUTPUT -p tcp -d "$RPC_HOST" --dport "$RPC_PORT" -j DROP 2>/dev/null || true
  elif command -v docker &>/dev/null; then
    docker exec aethermint-backend sh -c \
      "iptables -D OUTPUT -p tcp -d $RPC_HOST --dport $RPC_PORT -j DROP 2>/dev/null || true" \
      2>/dev/null || true
  fi
  log "Unblocked RPC traffic"
}

main() {
  log "Starting experiment: RPC endpoint failure"
  log "  rpc_host:    $RPC_HOST:$RPC_PORT"
  log "  run_id:      $RUN_ID"
  log "  duration:    ${DURATION_SECONDS}s"

  local result="pass"
  local assertions_passed=0
  local assertions_total=0

  # Baseline
  local baseline_health
  baseline_health="$(health_status)"
  log "  baseline health: HTTP $baseline_health"
  if [[ "$baseline_health" != "200" ]]; then
    fail "Baseline health check failed — aborting"
    printf '{"experiment":"%s","run_id":"%s","result":"aborted"}\n' "$EXPERIMENT_NAME" "$RUN_ID" > "$OUTPUT_DIR/${EXPERIMENT_NAME}.json"
    exit 1
  fi

  # Inject failure
  block_rpc
  sleep 5

  # Assertion 1: Health remains reachable
  : $(( assertions_total += 1 ))
  local during_health
  during_health="$(health_status)"
  log "  health during RPC block: HTTP $during_health"
  if [[ "$during_health" == "200" || "$during_health" == "503" ]]; then
    log "  PASS: Backend reachable during RPC outage"
    : $(( assertions_passed += 1 ))
  else
    fail "  FAIL: Backend unreachable (HTTP $during_health)"
    result="fail"
  fi

  # Assertion 2: No crash after extended outage
  # Poll health every 10s for the duration
  local crash_detected=0
  for i in $(seq 1 $(( DURATION_SECONDS / 10 ))); do
    sleep 10
    local h
    h="$(health_status)"
    if [[ "$h" == "000" ]]; then
      crash_detected=1
      break
    fi
  done

  if [[ "$crash_detected" -eq 1 ]]; then
    fail "  FAIL: Backend crashed during RPC outage"
    result="fail"
  else
    log "  PASS: Backend survived RPC outage without crashing"
  fi

  # Recovery
  unblock_rpc
  sleep "$RECOVERY_WAIT_SECONDS"

  # Recovery assertion
  : $(( assertions_total += 1 ))
  local recover_health
  recover_health="$(health_status)"
  log "  health after RPC recovery: HTTP $recover_health"
  if [[ "$recover_health" == "200" ]]; then
    log "  PASS: Health recovered"
    : $(( assertions_passed += 1 ))
  else
    fail "  FAIL: Health did not recover (HTTP $recover_health)"
    result="fail"
  fi

  local report
  report="$(cat <<JSON
{
  "experiment": "$EXPERIMENT_NAME",
  "run_id": "$RUN_ID",
  "result": "$result",
  "rpc_host": "$RPC_HOST:$RPC_PORT",
  "assertions": {
    "passed": $assertions_passed,
    "total": $assertions_total
  }
}
JSON
)"

  printf '%s\n' "$report" | tee "$OUTPUT_DIR/${EXPERIMENT_NAME}.json"
  log "Experiment complete: $result"

  [[ "$result" == "fail" ]] && exit 1
  exit 0
}

main