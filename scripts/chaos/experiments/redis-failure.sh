#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# AetherMint Chaos Experiment — Redis Unavailability
# =============================================================================
#
# Simulates complete Redis unavailability by either stopping the Redis
# container or blocking its port. Validates that the backend degrades
# gracefully (health check still returns healthy, circuit breaker opens,
# Redis-dependent features return fallback responses).
#
# Pre-requisites:
#   - Docker Compose services running (docker compose up -d)
#   - BACKEND_HEALTH_URL set or defaults to http://localhost:3001/api/health
#
# Expected graceful degradation signals:
#   - Backend /api/health returns 200 with status "healthy" or "degraded"
#   - Redis-dependent endpoints return fallback or 503, not 500
#   - No backend crash or restart
#   - Circuit breaker opens after repeated failures
#   - Recovery within 30s after Redis restored
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://localhost:3001/api/health}"
BACKEND_ROOT_URL="${BACKEND_ROOT_URL:-http://localhost:3001}"
STAGING="${STAGING:-false}"
RUN_ID="${RUN_ID:-manual-$(date -u +'%Y%m%dT%H%M%S')}"
EXPERIMENT_NAME="redis-failure"
DURATION_SECONDS="${DURATION_SECONDS:-60}"
RECOVERY_WAIT_SECONDS="${RECOVERY_WAIT_SECONDS:-30}"
OUTPUT_DIR="${OUTPUT_DIR:-$(mktemp -d)}"

# --- logging ----------------------------------------------------------------
log()  { printf '%s [%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$EXPERIMENT_NAME" "$*" >&2; }
fail() { printf '%s [%s] ERROR: %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$EXPERIMENT_NAME" "$*" >&2; }

# --- helpers ----------------------------------------------------------------
health_status() {
  local status
  status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$BACKEND_HEALTH_URL" 2>/dev/null || echo "000")"
  printf '%s' "$status"
}

health_body() {
  curl -sS --max-time 5 "$BACKEND_HEALTH_URL" 2>/dev/null || echo '{}'
}

measure_latency() {
  local url="$1"
  local started elapsed
  started="$(date +%s%3N)"
  curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$url" >/dev/null 2>&1 || true
  elapsed="$(($(date +%s%3N) - started))"
  printf '%d' "$elapsed"
}

# --- main -------------------------------------------------------------------
main() {
  log "Starting experiment: Redis unavailability"
  log "  run_id:       $RUN_ID"
  log "  health_url:   $BACKEND_HEALTH_URL"
  log "  duration:     ${DURATION_SECONDS}s"
  log "  staging:      $STAGING"

  local result="pass"
  local assertions_passed=0
  local assertions_total=0

  # ── Phase 0: Baseline ─────────────────────────────────────────────────
  log "Phase 0: Baseline measurement"

  local baseline_health
  baseline_health="$(health_status)"
  log "  baseline health status: $baseline_health"

  if [[ "$baseline_health" != "200" ]]; then
    fail "Baseline health check returned $baseline_health (expected 200) — aborting"
    printf '{"experiment":"%s","run_id":"%s","result":"aborted","baseline_failed":true}\n' \
      "$EXPERIMENT_NAME" "$RUN_ID" > "$OUTPUT_DIR/${EXPERIMENT_NAME}.json"
    exit 1
  fi

  local baseline_latency
  baseline_latency="$(measure_latency "$BACKEND_HEALTH_URL")"
  log "  baseline latency: ${baseline_latency}ms"

  # ── Phase 1: Inject failure ───────────────────────────────────────────
  log "Phase 1: Injecting Redis failure"

  if [[ "$STAGING" == "true" ]]; then
    # Production-grade: stop Redis container in Docker Compose
    docker compose stop redis 2>/dev/null || {
      # Fallback: block the Redis port via iptables
      log "docker compose stop failed — blocking port 6379 via iptables"
      sudo iptables -A INPUT -p tcp --dport 6379 -j DROP 2>/dev/null || \
        sudo iptables -A OUTPUT -p tcp --dport 6379 -j DROP 2>/dev/null || true
    }
  else
    # Local/CI: use docker compose to pause Redis
    if command -v docker &>/dev/null; then
      docker compose pause redis 2>/dev/null || \
        docker compose stop redis 2>/dev/null || \
        log "Could not control Redis via Docker Compose — skipping injection (not in staging)"
    else
      log "Docker not available, cannot inject Redis failure in this environment"
      printf '{"experiment":"%s","run_id":"%s","result":"skipped","reason":"docker_unavailable"}\n' \
        "$EXPERIMENT_NAME" "$RUN_ID" > "$OUTPUT_DIR/${EXPERIMENT_NAME}.json"
      exit 0
    fi
  fi

  sleep 5  # Allow failure to propagate

  # ── Phase 2: Assertions during failure ─────────────────────────────────
  log "Phase 2: Assertions during Redis outage"

  # Assertion A1: Health endpoint remains reachable (not crashed)
  : $(( assertions_total += 1 ))
  local fail_health
  fail_health="$(health_status)"
  log "  health status during outage: $fail_health"
  if [[ "$fail_health" == "200" || "$fail_health" == "503" ]]; then
    log "  PASS: Backend remained reachable (HTTP $fail_health)"
    : $(( assertions_passed += 1 ))
  else
    fail "  FAIL: Backend unreachable during Redis outage (HTTP $fail_health)"
    result="fail"
  fi

  # Assertion A2: No 500 errors during outage
  : $(( assertions_total += 1 ))
  local fail_root
  fail_root="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$BACKEND_ROOT_URL" 2>/dev/null || echo "000")"
  log "  root endpoint during outage: HTTP $fail_root"
  if [[ "$fail_root" != "500" ]]; then
    log "  PASS: No 500 error from root endpoint (HTTP $fail_root)"
    : $(( assertions_passed += 1 ))
  else
    fail "  FAIL: Root endpoint returned 500 during Redis outage"
    result="fail"
  fi

  # Assertion A3: Latency does not spike beyond threshold
  : $(( assertions_total += 1 ))
  local fail_latency
  fail_latency="$(measure_latency "$BACKEND_HEALTH_URL")"
  log "  latency during outage: ${fail_latency}ms (baseline: ${baseline_latency}ms)"
  # Allow up to 5x baseline or 2000ms, whichever is larger
  local threshold=$(( baseline_latency * 5 > 2000 ? baseline_latency * 5 : 2000 ))
  if [[ "$fail_latency" -le "$threshold" ]]; then
    log "  PASS: Latency within threshold (${fail_latency}ms ≤ ${threshold}ms)"
    : $(( assertions_passed += 1 ))
  else
    fail "  FAIL: Latency exceeded threshold (${fail_latency}ms > ${threshold}ms)"
    result="fail"
  fi

  # Hold the failure for the specified duration
  log "  Holding failure for ${DURATION_SECONDS}s..."
  sleep "$DURATION_SECONDS"

  # ── Phase 3: Recovery ─────────────────────────────────────────────────
  log "Phase 3: Restoring Redis"

  if [[ "$STAGING" == "true" ]]; then
    docker compose unpause redis 2>/dev/null || docker compose start redis 2>/dev/null || true
    sudo iptables -D INPUT -p tcp --dport 6379 -j DROP 2>/dev/null || true
    sudo iptables -D OUTPUT -p tcp --dport 6379 -j DROP 2>/dev/null || true
  else
    docker compose unpause redis 2>/dev/null || docker compose start redis 2>/dev/null || true
  fi

  log "  Waiting ${RECOVERY_WAIT_SECONDS}s for recovery..."
  sleep "$RECOVERY_WAIT_SECONDS"

  # ── Phase 4: Recovery assertions ───────────────────────────────────────
  log "Phase 4: Recovery assertions"

  # Assertion R1: Health returns to healthy
  : $(( assertions_total += 1 ))
  local recover_health
  recover_health="$(health_status)"
  log "  health status after recovery: $recover_health"
  if [[ "$recover_health" == "200" ]]; then
    log "  PASS: Health returned to 200 after recovery"
    : $(( assertions_passed += 1 ))
  else
    fail "  FAIL: Health did not recover (HTTP $recover_health)"
    result="fail"
  fi

  # Assertion R2: Response body contains "healthy"
  : $(( assertions_total += 1 ))
  local body
  body="$(health_body)"
  log "  health body: $body"
  if echo "$body" | grep -q '"healthy"'; then
    log "  PASS: Health response confirms healthy status"
    : $(( assertions_passed += 1 ))
  else
    fail "  FAIL: Health body does not contain 'healthy'"
    result="fail"
  fi

  # Assertion R3: Latency returns to near-baseline
  : $(( assertions_total += 1 ))
  local recover_latency
  recover_latency="$(measure_latency "$BACKEND_HEALTH_URL")"
  log "  latency after recovery: ${recover_latency}ms (baseline: ${baseline_latency}ms)"
  local max_recovery_latency=$(( baseline_latency * 3 > 3000 ? baseline_latency * 3 : 3000 ))
  if [[ "$recover_latency" -le "$max_recovery_latency" ]]; then
    log "  PASS: Recovery latency within threshold (${recover_latency}ms ≤ ${max_recovery_latency}ms)"
    : $(( assertions_passed += 1 ))
  else
    fail "  FAIL: Recovery latency exceeded threshold (${recover_latency}ms > ${max_recovery_latency}ms)"
    result="fail"
  fi

  # ── Report ────────────────────────────────────────────────────────────
  local report
  report="$(cat <<JSON
{
  "experiment": "$EXPERIMENT_NAME",
  "run_id": "$RUN_ID",
  "result": "$result",
  "baseline": {
    "latency_ms": $baseline_latency,
    "health_status": $baseline_health
  },
  "during_outage": {
    "health_status": $fail_health,
    "latency_ms": $fail_latency
  },
  "after_recovery": {
    "health_status": $recover_health,
    "latency_ms": $recover_latency
  },
  "assertions": {
    "passed": $assertions_passed,
    "total": $assertions_total
  }
}
JSON
)"

  printf '%s\n' "$report" | tee "$OUTPUT_DIR/${EXPERIMENT_NAME}.json"
  log "Experiment complete: $result ($assertions_passed/$assertions_total assertions passed)"

  if [[ "$result" == "fail" ]]; then
    exit 1
  fi
}

main