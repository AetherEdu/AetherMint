#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# AetherMint — Chaos Engineering Test Suite Orchestrator
# =============================================================================
#
# Orchestrates chaos experiments against key platform dependencies (Redis,
# MongoDB, Stellar RPC) and collects structured results. Designed to run in
# CI or on a controlled staging environment.
#
# Usage:
#   scripts/chaos/run-experiments.sh                     # Run all experiments
#   scripts/chaos/run-experiments.sh --experiment redis   # Run Redis experiments
#   scripts/chaos/run-experiments.sh --experiment mongo   # Run MongoDB experiments
#   scripts/chaos/run-experiments.sh --experiment rpc     # Run RPC experiments
#   scripts/chaos/run-experiments.sh --experiment pod     # Run pod termination
#   scripts/chaos/run-experiments.sh --dry-run            # Print plan only
#
# Environment variables:
#   STAGING                 "true" enables destructive experiments (default: false)
#   BACKEND_HEALTH_URL      URL for backend health endpoint
#   CHAOS_DURATION_SECONDS  Duration to hold injected failures (default: 60)
#   CHAOS_OUTPUT_DIR        Directory for result artifacts
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPERIMENTS_DIR="$SCRIPT_DIR/experiments"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

CHAOS_DURATION_SECONDS="${CHAOS_DURATION_SECONDS:-60}"
BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://localhost:3001/api/health}"
STAGING="${STAGING:-false}"
DRY_RUN="${DRY_RUN:-false}"
OUTPUT_DIR="${CHAOS_OUTPUT_DIR:-${PROJECT_ROOT}/.chaos-results}"
SELECTED_EXPERIMENT="${SELECTED_EXPERIMENT:-all}"
RUN_ID="${RUN_ID:-chaos-$(date -u +'%Y%m%dT%H%M%S')}"
SUMMARY_FILE="$OUTPUT_DIR/summary.json"

# --- logging ----------------------------------------------------------------
log()  { printf '%s [chaos-runner] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*" >&2; }
fail() { printf '%s [chaos-runner] ERROR: %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*" >&2; }

# --- argument parsing --------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --experiment)
      [[ $# -ge 2 ]] || { fail "--experiment requires a value"; exit 1; }
      SELECTED_EXPERIMENT="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --staging)
      STAGING=true
      shift
      ;;
    --output-dir)
      [[ $# -ge 2 ]] || { fail "--output-dir requires a value"; exit 1; }
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --help|-h)
      cat <<HELP
Usage: $(basename "$0") [options]

Options:
  --experiment TYPE   Run specific experiment type:
                      redis, mongo, rpc, pod, all (default: all)
  --dry-run           Print plan without executing
  --staging           Enable destructive staging experiments
  --output-dir DIR    Directory for result artifacts
  --help              Show this message

Environment:
  STAGING              Set to "true" for destructive experiments
  BACKEND_HEALTH_URL   Backend health endpoint (default: http://localhost:3001/api/health)
  CHAOS_DURATION_SECONDS  Duration to hold failures (default: 60)
HELP
      exit 0
      ;;
    *)
      fail "unknown argument: $1"
      exit 1
      ;;
  esac
done

# --- helpers ----------------------------------------------------------------
ensure_output_dir() {
  mkdir -p "$OUTPUT_DIR"
}

run_experiment() {
  local script="$1"
  local name
  name="$(basename "$script" .sh)"

  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log "Running: $name"
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if [[ "$DRY_RUN" == "true" ]]; then
    log "  DRY RUN: would execute $script"
    echo "{\"experiment\":\"$name\",\"run_id\":\"$RUN_ID\",\"result\":\"dry_run\"}" > "$OUTPUT_DIR/${name}.json"
    return 0
  fi

  local exit_code=0
  STAGING="$STAGING" \
  BACKEND_HEALTH_URL="$BACKEND_HEALTH_URL" \
  DURATION_SECONDS="$CHAOS_DURATION_SECONDS" \
  RUN_ID="$RUN_ID" \
  OUTPUT_DIR="$OUTPUT_DIR" \
  bash "$script" 2>&1 | sed "s/^/  /" || exit_code=$?

  if [[ "$exit_code" -ne 0 ]]; then
    log "  EXPERIMENT FAILED (exit $exit_code)"
    return 1
  fi
  log "  EXPERIMENT PASSED"
  return 0
}

# --- experiment definitions --------------------------------------------------
REDIS_EXPERIMENTS=(
  "$EXPERIMENTS_DIR/redis-failure.sh"
  "$EXPERIMENTS_DIR/redis-latency.sh"
)

MONGO_EXPERIMENTS=(
  "$EXPERIMENTS_DIR/mongo-failure.sh"
)

RPC_EXPERIMENTS=(
  "$EXPERIMENTS_DIR/rpc-failure.sh"
)

POD_EXPERIMENTS=(
  "$EXPERIMENTS_DIR/pod-termination.sh"
)

# --- main -------------------------------------------------------------------
main() {
  log "AetherMint Chaos Engineering — Test Suite"
  log "  run_id:       $RUN_ID"
  log "  staging:      $STAGING"
  log "  output_dir:   $OUTPUT_DIR"
  log "  experiment:   $SELECTED_EXPERIMENT"
  log "  dry_run:      $DRY_RUN"
  log "  duration:     ${CHAOS_DURATION_SECONDS}s per experiment"
  log ""

  ensure_output_dir

  # Verify backend is reachable before starting
  if [[ "$DRY_RUN" != "true" ]]; then
    log "Pre-flight: checking backend health..."
    local preflight
    preflight="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$BACKEND_HEALTH_URL" 2>/dev/null || echo "000")"
    if [[ "$preflight" != "200" ]]; then
      fail "Pre-flight health check failed (HTTP $preflight). Is the backend running?"
      exit 1
    fi
    log "Pre-flight passed: HTTP $preflight"
    log ""
  fi

  local experiments_to_run=()
  local allow_destructive=false

  case "$SELECTED_EXPERIMENT" in
    redis)
      experiments_to_run=("${REDIS_EXPERIMENTS[@]}")
      ;;
    mongo)
      experiments_to_run=("${MONGO_EXPERIMENTS[@]}")
      ;;
    rpc)
      experiments_to_run=("${RPC_EXPERIMENTS[@]}")
      ;;
    pod)
      experiments_to_run=("${POD_EXPERIMENTS[@]}")
      allow_destructive=true
      ;;
    all)
      experiments_to_run=("${REDIS_EXPERIMENTS[@]}" "${MONGO_EXPERIMENTS[@]}" "${RPC_EXPERIMENTS[@]}")
      ;;
    *)
      fail "Unknown experiment type: $SELECTED_EXPERIMENT"
      log "Valid types: redis, mongo, rpc, pod, all"
      exit 1
      ;;
  esac

  # Pod termination is inherently destructive — only in staging
  if [[ "$allow_destructive" == "true" ]] && [[ "$STAGING" != "true" ]]; then
    log "WARNING: pod-termination is destructive and requires STAGING=true"
    log "  Set --staging flag or STAGING=true to enable"
    log ""
  fi

  if [[ "$allow_destructive" == "true" ]] && [[ "$STAGING" == "true" ]]; then
    experiments_to_run+=("${POD_EXPERIMENTS[@]}")
  fi

  if [[ ${#experiments_to_run[@]} -eq 0 ]]; then
    log "No experiments selected to run."
    exit 0
  fi

  log "Experiments to run (${#experiments_to_run[@]}):"
  for exp in "${experiments_to_run[@]}"; do
    log "  - $(basename "$exp" .sh)"
  done
  log ""

  # Run experiments
  local total=0
  local passed=0
  local failed=0
  local skipped=0

  local results_json="["

  for exp in "${experiments_to_run[@]}"; do
    : $(( total += 1 ))
    local exp_name
    exp_name="$(basename "$exp" .sh)"

    local result_file="$OUTPUT_DIR/${exp_name}.json"

    if run_experiment "$exp"; then
      # Check if it was a skip
      if [[ -f "$result_file" ]]; then
        local res
        res="$(grep -o '"result":"[^"]*"' "$result_file" 2>/dev/null | head -1 | cut -d'"' -f4 || true)"
        case "$res" in
          skipped) skipped=$(( skipped + 1 )) ;;
          pass) passed=$(( passed + 1 )) ;;
          *) passed=$(( passed + 1 )) ;;
        esac
      else
        passed=$(( passed + 1 ))
      fi
    else
      failed=$(( failed + 1 ))
    fi

    # Append to results array
    if [[ -f "$result_file" ]]; then
      results_json+="$(cat "$result_file"),"
    else
      results_json+="{\"experiment\":\"$exp_name\",\"run_id\":\"$RUN_ID\",\"result\":\"error\"},"
    fi

    # Reset between experiments
    sleep 5
    log ""
  done

  # Strip trailing comma
  results_json="${results_json%,}]"

  # ── Summary ────────────────────────────────────────────────────────────
  log "=============================================="
  log "Chaos Suite Complete"
  log "  Total:    $total"
  log "  Passed:   $passed"
  log "  Failed:   $failed"
  log "  Skipped:  $skipped"
  log "=============================================="

  # Write summary
  local overall_result="pass"
  [[ "$failed" -gt 0 ]] && overall_result="fail"

  cat > "$SUMMARY_FILE" <<JSON
{
  "run_id": "$RUN_ID",
  "timestamp": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "result": "$overall_result",
  "staging": "$STAGING",
  "experiments": $results_json,
  "counts": {
    "total": $total,
    "passed": $passed,
    "failed": $failed,
    "skipped": $skipped
  }
}
JSON

  log "Summary written to: $SUMMARY_FILE"

  if [[ "$failed" -gt 0 ]]; then
    log "One or more experiments FAILED."
    exit 1
  fi

  log "All experiments passed."
  exit 0
}

main