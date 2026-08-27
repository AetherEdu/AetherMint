#!/usr/bin/env bash
set -euo pipefail

output="$(scripts/failover-region.sh --from region-a --to region-b)"
printf '%s\n' "$output"
grep -q "Dry run only" <<<"$output"
grep -q "source: region-a" <<<"$output"
grep -q "target: region-b" <<<"$output"
printf '%s\n' "Failover dry-run checks passed."
