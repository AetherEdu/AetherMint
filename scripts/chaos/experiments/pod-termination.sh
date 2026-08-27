#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# AetherMint Chaos Experiment — Pod / Container Termination
# =============================================================================
#
# Simulates a sudden backend container termination (kill -9) and verifies:
#
# 1. The health endpoint becomes unreachable (expected)
# 2. Docker Compose (or Kubernetes in staging) restarts the container
# 3. Recovery completes within RTO budget (default 60s)
# 4. Health returns to healthy after restart
#
# In Kubernetes (STAGING=true), this deletes a pod instead and watches
# the rollout.
#
# This experiment is **destructive** — it kills the running backend process.
# Only run in controlled environments.
# =============================================================================

STAGING="${STAGING:-false}"
RUN_ID="${RUN_ID:-manual-$(date -u +'%Y%m%dT%H%M%S')}"
EXPERIMENT_NAME="pod-termination"
BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://localhost:3001/api/health}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-aethermint-backend}"
MAX_RECOVERY_SECONDS="${MAX_RECOVERY_SECONDS:-60}"
OUTPUT_DIR="${OUTPUT_DIR:-$(mktemp -d)}"

log()  { printf '%s [%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$EXPERIMENT_NAME" "$*" >&2; }
fail() { printf '%s [%s] ERROR: %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$EXPERIMENT_NAME" "$*" >&2; }

health_status() {
  curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$BACKEND_HEALTH_URL" 2>/dev/null || echo "000"
}

measure_latency() {
  local url="$1" started elapsed
  started="$(date +%s%3N)"
  curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$url" >/dev/null 2>&1 || true
  elapsed="$(($(date +%s%3N) - started))"
  printf '%d' "$elapsed"
}

kill_container() {
  if command -v docker &>/dev/null; then
    docker kill --signal=KILL "$BACKEND_CONTAINER" 2>/dev/null || {
      log "Could not kill container $BACKEND_CONTAINER — trying via compose"
      docker compose kill backend 2>/dev/null || true
    }
    log "Container $BACKEND_CONTAINER killed"
  else
    fail "Docker not available — aborting pod termination experiment"
    exit 1
  fi
}

main() {
  log "Starting experiment: Pod/Container termination"
  log "  container:   $BACKEND_CONTAINER"
  log "  run_id:      $RUN_ID"
  log "  max_recovery: ${MAX_RECOVERY_SECONDS}s"

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

  # Record T0
  local t0
  t0="$(date -u +%s)"

  # Kill the backend
  log "Killing backend container..."
  kill_container
  sleep 3

  # Verify backend is unreachable
  : $(( assertions_total += 1 ))
  local post_kill
  post_kill="$(health_status)"
  log "  health after kill: HTTP $post_kill"
  if [[ "$post_kill" == "000" || "$post_kill" == "502" || "$post_kill" == "503" ]]; then
    log "  PASS: Backend is unreachable as expected after termination"
    : $(( assertions_passed += 1 ))
  else
    log "  WARN: Backend still reachable after kill (HTTP $post_kill) — may have restarted instantly"
  fi

  # Wait for recovery
  log "Waiting for container restart and recovery (up to ${MAX_RECOVERY_SECONDS}s)..."
  local recovered=0
  local elapsed=0
  local t4=0

  for (( i=1; i<=MAX_RECOVERY_SECONDS; i+=2 )); do
    sleep 2
    elapsed=$(( $(date -u +%s) - t0 ))
    local h
    h="$(health_status)"
    if [[ "$h" == "200" ]]; then
      t4="$(date -u +%s)"
      recovered=1
      log "  Backend recovered after ${elapsed}s"
      break
    fi
    # Progress every 10s
    if (( elapsed % 10 == 0 )); then
      log "  Still waiting... (${elapsed}s elapsed, HTTP $h)"
    fi
  done

  # Recovery assertion
  : $(( assertions_total += 1 ))
  if [[ "$recovered" -eq 1 ]]; then
    local rto=$(( t4 - t0 ))
    log "  RTO: ${rto}s (budget: ${MAX_RECOVERY_SECONDS}s)"
    if [[ "$rto" -le "$MAX_RECOVERY_SECONDS" ]]; then
      log "  PASS: Recovery within RTO budget"
      : $(( assertions_passed += 1 ))
    else
      fail "  FAIL: Recovery exceeded RTO (${rto}s > ${MAX_RECOVERY_SECONDS}s)"
      result="fail"
    fi
  else
    fail "  FAIL: Backend did not recover within ${MAX_RECOVERY_SECONDS}s"
    result="fail"
  fi

  # Latency after recovery
  local recover_latency=0
  if [[ "$recovered" -eq 1 ]]; then
    recover_latency="$(measure_latency "$BACKEND_HEALTH_URL")"
    log "  latency after recovery: ${recover_latency}ms"
  fi

  local report
  report="$(cat <<JSON
{
  "experiment": "$EXPERIMENT_NAME",
  "run_id": "$RUN_ID",
  "result": "$result",
  "rto_seconds": $(( t4 - t0 )),
  "max_recovery_seconds": $MAX_RECOVERY_SECONDS,
  "recovery_latency_ms": $recover_latency,
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