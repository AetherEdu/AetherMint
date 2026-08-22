#!/usr/bin/env bash
set -euo pipefail

# Provider-neutral failover coordinator.
# The routing and data-promotion operations are injected as executables so this
# script can be used with any DNS/GSLB and database operator without embedding
# credentials or a cloud-specific API.

SCRIPT_NAME="$(basename "$0")"
CONFIG_FILE="${FAILOVER_CONFIG_FILE:-infra/multi-region/regions.yaml}"
FROM_REGION=""
TO_REGION=""
EXECUTE=0
ROUTER_COMMAND="${FAILOVER_ROUTER_COMMAND:-}"
PROMOTE_COMMAND="${FAILOVER_PROMOTE_COMMAND:-}"
VERIFY_COMMAND="${FAILOVER_VERIFY_COMMAND:-}"

usage() {
  cat <<EOF
Usage: $SCRIPT_NAME --from REGION --to REGION [options]

Options:
  --from REGION       Region currently serving traffic
  --to REGION         Healthy region to promote
  --execute           Execute injected promotion and routing commands
  --router COMMAND    Command receiving FROM_REGION TO_REGION
  --promote COMMAND   Command receiving TO_REGION
  --verify COMMAND    Command receiving TO_REGION
  --config FILE       Topology configuration file
  --help              Show this help

Without --execute, the script only prints the failover plan. Execution also
requires FAILOVER_APPROVED=true to prevent accidental production changes.
EOF
}

fail() { printf '%s: %s\n' "$SCRIPT_NAME" "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from) [[ $# -ge 2 ]] || fail "--from requires a region"; FROM_REGION="$2"; shift 2 ;;
    --to) [[ $# -ge 2 ]] || fail "--to requires a region"; TO_REGION="$2"; shift 2 ;;
    --execute) EXECUTE=1; shift ;;
    --router) [[ $# -ge 2 ]] || fail "--router requires a command"; ROUTER_COMMAND="$2"; shift 2 ;;
    --promote) [[ $# -ge 2 ]] || fail "--promote requires a command"; PROMOTE_COMMAND="$2"; shift 2 ;;
    --verify) [[ $# -ge 2 ]] || fail "--verify requires a command"; VERIFY_COMMAND="$2"; shift 2 ;;
    --config) [[ $# -ge 2 ]] || fail "--config requires a file"; CONFIG_FILE="$2"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) fail "unknown argument: $1" ;;
  esac
done

[[ -n "$FROM_REGION" ]] || fail "--from is required"
[[ -n "$TO_REGION" ]] || fail "--to is required"
[[ "$FROM_REGION" != "$TO_REGION" ]] || fail "source and target regions must differ"
[[ -f "$CONFIG_FILE" ]] || fail "topology config not found: $CONFIG_FILE"
grep -q "name: $FROM_REGION" "$CONFIG_FILE" || fail "unknown source region: $FROM_REGION"
grep -q "name: $TO_REGION" "$CONFIG_FILE" || fail "unknown target region: $TO_REGION"

printf '%s\n' "Failover plan" "  source: $FROM_REGION" "  target: $TO_REGION" "  config: $CONFIG_FILE" "  target RTO: 15 minutes" "  target RPO: 5 minutes"
printf '%s\n' "1. Confirm target health and replication lag is within the configured limit." "2. Promote the target data services using the platform-specific operator." "3. Switch global routing to the target region." "4. Verify /api/health and representative read/write probes." "5. Record the event and keep the former primary isolated until repaired."

if [[ "$EXECUTE" -eq 0 ]]; then
  printf '%s\n' "Dry run only. Pass --execute and FAILOVER_APPROVED=true to perform the injected operations."
  exit 0
fi

[[ "${FAILOVER_APPROVED:-false}" == "true" ]] || fail "execution requires FAILOVER_APPROVED=true"
[[ -n "$PROMOTE_COMMAND" ]] || fail "--promote or FAILOVER_PROMOTE_COMMAND is required"
[[ -n "$ROUTER_COMMAND" ]] || fail "--router or FAILOVER_ROUTER_COMMAND is required"
[[ -n "$VERIFY_COMMAND" ]] || fail "--verify or FAILOVER_VERIFY_COMMAND is required"

bash -c "$PROMOTE_COMMAND \"$TO_REGION\""
bash -c "$ROUTER_COMMAND \"$FROM_REGION\" \"$TO_REGION\""
bash -c "$VERIFY_COMMAND \"$TO_REGION\""
printf '%s\n' "Failover completed. Keep the old primary out of service until replication is re-established and the rollback plan is approved."
