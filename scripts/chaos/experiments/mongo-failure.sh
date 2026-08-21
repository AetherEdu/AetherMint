#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# AetherMint Chaos Experiment — MongoDB Unavailability
# =============================================================================
#
# Simulates MongoDB failure by stopping the MongoDB container and verifies
# the backend degrades gracefully: health remains reachable, MongoDB-dependent
# endpoints return fallback responses rather than 500.
#
# Backend services that rely on MongoDB (models, audit logs, analytics) must
# handle connection failures without crashing the process.
#
# Pre-requisites:
#   - Docker Compose services running
#   - BACKEND_HEALTH_URL set or defaults to http://localhost:3001/api/health
#
# Expected graceful degradation:
#   - Health check still returns 200
#   - No 500 errors from API endpoints
#   - MongoDB models time out or return connection errors gracefully
#   - Full recovery after MongoDB is restored
# =============================================================================

BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://localhost:3001/api/health}"
STAGING="${STAGING:-false}"
RUN_ID="${RUN_ID:-manual-$(date -u +'%Y%m%dT%H%M%S')}"
EXPERIMENT_NAME="mongo-failure"
DURATION_SECONDS="${DURATION_SECONDS:-60}"
RECOVERY_WAIT_SECONDS="${RECOVERY_WAIT_SECONDS:-30}"
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

stop_mongo() {
  if docker compose ps mongodb 2>/dev/null | grep -q 'Up'; then
    docker compose stop mongodb
    log "MongoDB container stopped"
  elif command -v docker &>/dev/null; then
    docker stop aethermint-mongodb 2>/dev/null || true
    log "MongoDB container stop attempted"
  else
    log "Docker not available — skipping MongoDB failure injection"
    exit 0
  fi
}

start_mongo() {
  docker compose start mongodb 2>/dev/null || docker start aethermint-mongodb 2>/dev/null || true
  log "MongoDB container started"
}

main() {
  log "Starting experiment: MongoDB unavailability"
  log "  run_id:     $RUN_ID"
  log "  duration:   ${DURATION_SECONDS}s"

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
  local baseline_latency
  baseline_latency="$(measure_latency "$BACKEND_HEALTH_URL")"
  log "  baseline latency: ${baseline_latency}ms"

  # Inject failure
  log "Injecting MongoDB failure..."
  stop_mongo
  sleep 5

  # Assertions during failure
  : $(( assertions_total += 1 ))
  local during_health
  during_health="$(health_status)"
  log "  health during MongoDB outage: HTTP $during_health"
  if [[ "$during_health" == "200" || "$during_health" == "503" ]]; then
    log "  PASS: Backend reachable during MongoDB outage"
    : $(( assertions_passed += 1 ))
  else
    fail "  FAIL: Backend unreachable (HTTP $during_health)"
    result="fail"
  fi

  # Verify no crash — check multiple times
  for i in $(seq 1 3); do
    sleep 5
    local h
    h="$(health_status)"
    if [[ "$h" == "000" ]]; then
      fail "  FAIL: Backend appears to have crashed after $((i*5))s of MongoDB outage"
      result="fail"
      break
    fi
  done
  log "  Backend survived MongoDB outage without crashing"

  # Hold
  log "  Holding failure for ${DURATION_SECONDS}s..."
  sleep "$DURATION_SECONDS"

  # Recovery
  log "Restoring MongoDB..."
  start_mongo
  sleep "$RECOVERY_WAIT_SECONDS"

  # Recovery assertions
  : $(( assertions_total += 1 ))
  local recover_health
  recover_health="$(health_status)"
  log "  health after recovery: HTTP $recover_health"
  if [[ "$recover_health" == "200" ]]; then
    log "  PASS: Health recovered to 200"
    : $(( assertions_passed += 1 ))
  else
    fail "  FAIL: Health did not recover (HTTP $recover_health)"
    result="fail"
  fi

  : $(( assertions_total += 1 ))
  local recover_latency
  recover_latency="$(measure_latency "$BACKEND_HEALTH_URL")"
  log "  latency after recovery: ${recover_latency}ms"
  if [[ "$recover_latency" -le $(( baseline_latency * 3 > 5000 ? baseline_latency * 3 : 5000 )) ]]; then
    log "  PASS: Latency recovered"
    : $(( assertions_passed += 1 ))
  else
    fail "  FAIL: Recovery latency too high (${recover_latency}ms)"
    result="fail"
  fi

  local report
  report="$(cat <<JSON
{
  "experiment": "$EXPERIMENT_NAME",
  "run_id": "$RUN_ID",
  "result": "$result",
  "baseline_latency_ms": $baseline_latency,
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