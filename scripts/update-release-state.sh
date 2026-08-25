#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# AetherMint - ReleaseRoute state updater
# =============================================================================
#
# Rewrites the ReleaseRoute contract file after a successful release or
# rollback so `activeColor` (and optionally the version recorded for that
# color) reflects reality. The release pipeline calls this after every
# promotion; operators can call it by hand after a manual rollback.
#
# Usage:
#   scripts/update-release-state.sh --color green [--version v1.2.3] [--config FILE]
#
# Options:
#   --color COLOR   Color that now serves traffic (required)
#   --version TAG   Version now running in that color (optional)
#   --config FILE   ReleaseRoute config file (default: infra/release/release-route.yaml)
#   --help          Show this help
# =============================================================================

SCRIPT_NAME="$(basename "$0")"
CONFIG_FILE="${RELEASE_CONFIG:-infra/release/release-route.yaml}"
COLOR=""
VERSION=""

usage() {
  sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

fail() { printf '%s: %s\n' "$SCRIPT_NAME" "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --color) [[ $# -ge 2 ]] || fail "--color requires a color"; COLOR="$2"; shift 2 ;;
    --version) [[ $# -ge 2 ]] || fail "--version requires a tag"; VERSION="$2"; shift 2 ;;
    --config) [[ $# -ge 2 ]] || fail "--config requires a file"; CONFIG_FILE="$2"; shift 2 ;;
    --help|-h) usage ;;
    *) fail "unknown argument: $1" ;;
  esac
done

[[ -n "$COLOR" ]] || fail "--color is required"
[[ -f "$CONFIG_FILE" ]] || fail "ReleaseRoute config not found: $CONFIG_FILE"

ACTIVE_COLOR="$(grep -E '^[[:space:]]*activeColor:' "$CONFIG_FILE" | head -n1 | awk '{print $2}')"
STANDBY_COLOR="$(grep -E '^[[:space:]]*standbyColor:' "$CONFIG_FILE" | head -n1 | awk '{print $2}')"
[[ "$COLOR" == "$ACTIVE_COLOR" || "$COLOR" == "$STANDBY_COLOR" ]] \
  || fail "unknown color '$COLOR' (expected $ACTIVE_COLOR or $STANDBY_COLOR)"

# Single awk pass: set activeColor, and when a --version is given, replace the
# `version:` line inside the environments block for that color (matched by its
# 4-space-indented `color:` key). Everything else is preserved byte-for-byte.
awk -v color="$COLOR" -v version="$VERSION" -v update_version="${VERSION:+1}" '
  /^[[:space:]]*activeColor:/ { print "  activeColor: " color; next }
  # Enter the target color block on its 4-space-indented key; leave the block
  # on any 2- or 4-space-indented sibling key. Child keys (e.g. the 6-space
  # `version:` line) do not match those patterns, so they keep the block open.
  $0 ~ "^    " color ":$" { in_color_block = 1; next }
  $0 ~ "^  [a-zA-Z0-9_-]+:" || ($0 ~ "^    [a-zA-Z0-9_-]+:" && $0 !~ "^    " color ":$") {
    in_color_block = 0
  }
  in_color_block && update_version && /version:/ && !done {
    sub(/version:.*/, "version: \"" version "\"")
    done = 1
  }
  { print }
' "$CONFIG_FILE" > "$CONFIG_FILE.tmp"

mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
printf '%s\n' "Updated $CONFIG_FILE: activeColor=$COLOR${VERSION:+, $COLOR version=$VERSION}"
