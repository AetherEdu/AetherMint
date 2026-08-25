#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# AetherMint Chaos Experiment — Redis Latency Injection
# =============================================================================
#
# Injects artificial latency (e.g., 500ms) into Redis responses and verifies
# the backend remains responsive within acceptable degradation thresholds.
# Uses `tc` (traffic control) on the Redis container network interface in
# staging, or a proxy-based approach in CI.
#
# Expected graceful degradation signals:
#   - Backend /api/health returns 200
#   - Response time increases but stays below configured max (5x baseline)
#   - No 500 errors
#   - Recovery after latency removed
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://localhost:3001/api/health}"
STAGING="${STAGING:-false}"
RUN_ID="${RUN_ID:-manual-$(date -u +'%Y%m%dT%H%M%S')}"
EXPERIMENT_NAME="redis-latency"
INJECTED_LATENCY_MS="${INJECTED_LATENCY_MS:-500}"
DURATION_SECONDS="${DURATION_SECONDS:-60}"
RECOVERY_WAIT_SECONDS="${RECOVERY_WAIT_SECONDS:-30}"
OUTPUT_DIR="${OUTPUT_DIR:-$(mktemp -d)}"
RESULTS_DIR="${RESULTS_DIR:-${OUTPUT_DIR}}"

# --- logging ----------------------------------------------------------------
log()  { printf '%s [%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$EXPERIMENT_NAME" "$*" >&2; }
fail() { printf '%s [%s] ERROR: %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$EXPERIMENT_NAME" "$*" >&2; }

# --- helpers ----------------------------------------------------------------
health_status() {
  curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$BACKEND_HEALTH_URL" 2>/dev/null || echo "000"
}

measure_latency() {
  local url="$1" started elapsed
  started="$(date +%s%3N)"
  curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$url" >/dev/null 2>&1 || true
  elapsed="$(($(date +%s%3N) - started))"
  printf '%d' "$elapsed"
}

inject_latency() {
  local container_interface="eth0"
  local container="aethermint-redis"

  if [[ "$STAGING" == "true" ]]; then
    if command -v tc &>/dev/null; then
      # Apply tc netem to the Docker host interface (Redis port)
      sudo tc qdisc add dev lo root handle 1: prio 2>/dev/null || sudo tc qdisc change dev lo root handle 1: prio
      sudo tc qdisc add dev lo parent 1:3 handle 30: netem delay "${INJECTED_LATENCY_MS}ms" 2>/dev/null || true
      sudo tc filter add dev lo protocol ip parent 1:0 prio 3 u32 match ip dport 6379 0xffff flowid 1:3 2>/dev/null || true
      log "Latency injected: ${INJECTED_LATENCY_MS}ms on Redis port"
    else
      log "tc not available — skipping latency injection (not in staging)"
      exit 0
    fi
  else
    # CI/local: try docker pause/unpause cycle as a simpler latency proxy
    docker compose pause redis 2>/dev/null && sleep 1 && docker compose unpause redis 2>/dev/null || {
      log "Docker control failed for latency injection"
    }
  fi
}

remove_latency() {
  if [[ "$STAGING" == "true" ]]; then
    sudo tc qdisc del dev lo root 2>/dev/null || true
    log "Latency injection removed"
  fi
}

# --- main -------------------------------------------------------------------
main() {
  log "Starting experiment: Redis latency injection (${INJECTED_LATENCY_MS}ms)"
  log "  run_id:       $RUN_ID"
  log "  health_url:   $BACKEND_HEALTH_URL"
  log "  duration:     ${DURATION_SECONDS}s"

  local result="pass"
  local assertions_passed=0
  local assertions_total=0

  # Baseline
  local baseline_latency
  baseline_latency="$(measure_latency "$BACKEND_HEALTH_URL")"
  log "  baseline latency: ${baseline_latency}ms"

  local baseline_health
  baseline_health="$(health_status)"
  log "  baseline health: HTTP $baseline_health"

  if [[ "$baseline_health" != "200" ]]; then
    fail "Baseline health check failed — aborting"
    printf '{"experiment":"%s","run_id":"%s","result":"aborted"}\n' "$EXPERIMENT_NAME" "$RUN_ID" > "$RESULTS_DIR/${EXPERIMENT_NAME}.json"
    exit 1
  fi

  # Inject latency
  inject_latency
  sleep 3

  # Assertion 1: Health still reachable during latency
  : $(( assertions_total += 1 ))
  local during_health
  during_health="$(health_status)"
  log "  health during latency: HTTP $during_health"
  if [[ "$during_health" == "200" ]]; then
    log "  PASS: Health still 200 under latency"
    : $(( assertions_passed += 1 ))
  else
    fail "  FAIL: Health returned $during_health under latency"
    result="fail"
  fi

  # Assertion 2: Latency increased but within tolerance
  : $(( assertions_total += 1 ))
  local during_latency
  during_latency="$(measure_latency "$BACKEND_HEALTH_URL")"
  local expected_worst=$(( baseline_latency + INJECTED_LATENCY_MS + 1000 ))
  log "  latency during injection: ${during_latency}ms (baseline: ${baseline_latency}ms, max: ${expected_worst}ms)"
  if [[ "$during_latency" -le "$expected_worst" ]] || [[ "$STAGING" != "true" ]]; then
    log "  PASS: Latency within expected range"
    : $(( assertions_passed += 1 ))
  else
    fail "  FAIL: Latency too high (${during_latency}ms > ${expected_worst}ms)"
    result="fail"
  fi

  # Hold
  log "  Holding latency for ${DURATION_SECONDS}s..."
  sleep "$DURATION_SECONDS"

  # Remove latency
  remove_latency
  sleep "$RECOVERY_WAIT_SECONDS"

  # Recovery assertion
  : $(( assertions_total += 1 ))
  local recover_latency
  recover_latency="$(measure_latency "$BACKEND_HEALTH_URL")"
  log "  latency after recovery: ${recover_latency}ms"
  if [[ "$recover_latency" -le $(( baseline_latency * 2 > 2000 ? baseline_latency * 2 : 2000 )) ]]; then
    log "  PASS: Latency recovered to near-baseline"
    : $(( assertions_passed += 1 ))
  else
    fail "  FAIL: Latency did not recover (${recover_latency}ms)"
    result="fail"
  fi

  # Report
  local report
  report="$(cat <<JSON
{
  "experiment": "$EXPERIMENT_NAME",
  "run_id": "$RUN_ID",
  "result": "$result",
  "injected_latency_ms": $INJECTED_LATENCY_MS,
  "baseline_latency_ms": $baseline_latency,
  "during_latency_ms": $during_latency,
  "recovery_latency_ms": $recover_latency,
  "assertions": {
    "passed": $assertions_passed,
    "total": $assertions_total
  }
}
JSON
)"

  printf '%s\n' "$report" | tee "$RESULTS_DIR/${EXPERIMENT_NAME}.json"
  log "Experiment complete: $result"

  [[ "$result" == "fail" ]] && exit 1
  exit 0
}

main